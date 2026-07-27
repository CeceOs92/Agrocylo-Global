import { describe, it, expect } from "vitest";
import {
  extrapolateForecast,
  buildPriceIndexSeries,
  buildYieldEstimates,
  buildForecastDashboard,
} from "./forecastService";

describe("forecastService", () => {
  describe("extrapolateForecast", () => {
    it("returns flat series for single price", () => {
      expect(extrapolateForecast([10], 2)).toEqual([10, 10]);
    });

    it("projects upward trend", () => {
      const out = extrapolateForecast([1, 2, 3, 4], 2);
      expect(out[0]).toBeGreaterThan(4);
      expect(out[1]).toBeGreaterThan(out[0]!);
    });
  });

  describe("buildPriceIndexSeries", () => {
    it("returns empty for no prices", () => {
      expect(buildPriceIndexSeries([])).toEqual([]);
    });

    it("includes historical points and forecast horizon", () => {
      const series = buildPriceIndexSeries([10, 12, 11, 13]);
      expect(series.length).toBeGreaterThan(4);
      expect(series[0]?.price).toBe(10);
      expect(series.some((p) => p.forecast != null)).toBe(true);
    });
  });

  describe("buildYieldEstimates", () => {
    it("returns empty without base yield", () => {
      expect(buildYieldEstimates("Maize", null)).toEqual([]);
      expect(buildYieldEstimates("Maize", 0)).toEqual([]);
    });

    it("returns four seasonal estimates", () => {
      const rows = buildYieldEstimates("Maize", 100);
      expect(rows).toHaveLength(4);
      expect(rows[0]?.season).toContain("Maize");
      expect(rows[0]?.estimated).toBeGreaterThan(0);
    });
  });

  describe("buildForecastDashboard", () => {
    it("marks sparse regions with empty charts", () => {
      const data = buildForecastDashboard({ region: "Remote", crop: "Tea" });
      expect(data.sparse).toBe(true);
      expect(data.priceIndex).toEqual([]);
      expect(data.yieldEstimates).toEqual([]);
    });

    it("builds full payload when data exists", () => {
      const data = buildForecastDashboard({
        region: "Rift Valley",
        crop: "Maize",
        historicalPrices: [8, 9, 10, 11],
        baseYield: 50,
      });
      expect(data.sparse).toBe(false);
      expect(data.priceIndex.length).toBeGreaterThan(0);
      expect(data.yieldEstimates.length).toBe(4);
    });
  });
});
