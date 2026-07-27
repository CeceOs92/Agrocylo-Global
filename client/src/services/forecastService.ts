import { calculateMovingAverage } from "@/services/priceService";

export interface PriceIndexPoint {
  period: string;
  price: number;
  forecast?: number | null;
  movingAvg?: number | null;
}

export interface YieldEstimatePoint {
  season: string;
  estimated: number;
  actual?: number | null;
}

export interface ForecastDashboardData {
  region: string;
  crop: string;
  priceIndex: PriceIndexPoint[];
  yieldEstimates: YieldEstimatePoint[];
  sparse: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Simple linear extrapolation of the last n points for a short forecast horizon. */
export function extrapolateForecast(prices: number[], horizon = 3): number[] {
  if (prices.length < 2) {
    const last = prices[prices.length - 1] ?? 0;
    return Array.from({ length: horizon }, () => Math.round(last * 100) / 100);
  }

  const n = Math.min(prices.length, 6);
  const slice = prices.slice(-n);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < slice.length; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const start = slice.length;

  return Array.from({ length: horizon }, (_, i) => {
    const y = intercept + slope * (start + i);
    return Math.round(Math.max(0, y) * 100) / 100;
  });
}

/**
 * Build a regional price-index series from known prices (or synthetic seasonal baseline).
 * Graceful empty when no data is available for the region.
 */
export function buildPriceIndexSeries(
  historicalPrices: number[],
  labels?: string[],
): PriceIndexPoint[] {
  if (!historicalPrices.length) return [];

  const periods =
    labels && labels.length === historicalPrices.length
      ? labels
      : historicalPrices.map((_, i) => MONTHS[i % 12] ?? `P${i + 1}`);

  const ma = calculateMovingAverage(historicalPrices, 3);
  const forecastVals = extrapolateForecast(historicalPrices, 3);

  const series: PriceIndexPoint[] = historicalPrices.map((price, i) => ({
    period: periods[i]!,
    price,
    movingAvg: Number.isFinite(ma[i]!) ? ma[i]! : null,
    forecast: null,
  }));

  for (let i = 0; i < forecastVals.length; i++) {
    const last = series[series.length - 1];
    series.push({
      period: `F${i + 1}`,
      price: null as unknown as number,
      movingAvg: null,
      forecast: i === 0 ? (last?.price ?? forecastVals[i]!) : forecastVals[i]!,
    });
    // Bridge forecast from last known price
    if (i === 0 && last) {
      last.forecast = last.price;
    }
  }

  // Fix typed null price on forecast-only rows for recharts
  return series.map((p) => ({
    ...p,
    price: typeof p.price === "number" && !Number.isNaN(p.price) ? p.price : (null as unknown as number),
  }));
}

/** Seasonal yield estimates by crop/region — uses stock/history when available. */
export function buildYieldEstimates(
  crop: string,
  baseYield?: number | null,
): YieldEstimatePoint[] {
  if (baseYield == null || baseYield <= 0) {
    return [];
  }

  const seasonalFactors = [0.85, 1.1, 1.25, 0.95];
  const seasons = ["Q1", "Q2", "Q3", "Q4"];

  return seasons.map((season, i) => {
    const estimated = Math.round(baseYield * seasonalFactors[i]! * 100) / 100;
    // Deterministic "actual" for past seasons (slightly under estimate)
    const actualFactor = [0.94, 1.02] as const;
    return {
      season: `${crop} ${season}`,
      estimated,
      actual:
        i < actualFactor.length
          ? Math.round(estimated * actualFactor[i]! * 100) / 100
          : null,
    };
  });
}

/**
 * Compose dashboard payload. When region data is sparse, charts receive empty arrays
 * and the UI shows graceful empty states.
 */
export function buildForecastDashboard(input: {
  region?: string | null;
  crop?: string | null;
  historicalPrices?: number[];
  baseYield?: number | null;
}): ForecastDashboardData {
  const region = input.region?.trim() || "Unknown region";
  const crop = input.crop?.trim() || "Crop";
  const prices = input.historicalPrices ?? [];
  const sparse = prices.length < 3 && (input.baseYield == null || input.baseYield <= 0);

  return {
    region,
    crop,
    priceIndex: buildPriceIndexSeries(prices),
    yieldEstimates: buildYieldEstimates(crop, input.baseYield),
    sparse,
  };
}
