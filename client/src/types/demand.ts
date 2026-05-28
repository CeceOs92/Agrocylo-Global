import { ProductCategory, ProductUnit } from "./product";

export interface BuyerIntent {
  id: string;
  buyer_name: string;
  buyer_rating?: number; // 1–5
  product_name: string;
  category: ProductCategory | null;
  quantity: string; // numeric as string
  unit: ProductUnit;
  location: {
    region: string;
    coordinates: [number, number]; // [lat, lng]
  };
  created_at: string;
  /** Desired delivery timeline, e.g. "Within 2 weeks" */
  timeline?: string;
  /** Budget range, e.g. "₦50,000 – ₦70,000" */
  budget_range?: string;
  /** Quality requirements free text */
  quality_requirements?: string;
  /** Preferred delivery method */
  delivery_preference?: string;
  /** Whether this is a standing/recurring order */
  is_recurring?: boolean;
}

export interface DemandVolume {
  total_volume: string; // numeric as string
  unit: ProductUnit;
  category_breakdown: Record<ProductCategory, string>;
  /** Percentage change vs previous period (positive = growth) */
  growth_pct?: number;
  /** Per-category growth percentages */
  category_growth?: Partial<Record<ProductCategory, number>>;
}

export interface DemandTrendPoint {
  date: string; // ISO date
  volume: number;
}

export interface HeatMapPoint {
  coordinates: [number, number];
  intensity: number; // 0 to 1
  label: string;
}

export interface DemandData {
  volume: DemandVolume;
  intents: BuyerIntent[];
  heatMap: HeatMapPoint[];
  /** 30-day daily demand trend for the chart */
  trend?: DemandTrendPoint[];
}
