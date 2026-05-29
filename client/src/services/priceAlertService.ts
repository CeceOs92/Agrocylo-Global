import type { PriceAlert, PriceAlertCreateInput } from "@/types/priceAlert";

export const priceAlertService = {
  async getAlerts(filters?: {
    status?: "active" | "inactive";
    category?: string;
  }): Promise<PriceAlert[]> {
    const query = new URLSearchParams();
    if (filters?.status) query.append("status", filters.status);
    if (filters?.category) query.append("category", filters.category);

    const response = await fetch(`/api/price-alerts?${query.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch alerts");
    return response.json();
  },

  async createAlert(alert: PriceAlertCreateInput): Promise<PriceAlert> {
    const response = await fetch("/api/price-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
    if (!response.ok) throw new Error("Failed to create alert");
    return response.json();
  },

  async updateAlert(
    id: string,
    updates: Partial<PriceAlertCreateInput>
  ): Promise<PriceAlert> {
    const response = await fetch(`/api/price-alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update alert");
    return response.json();
  },

  async deleteAlert(id: string): Promise<void> {
    const response = await fetch(`/api/price-alerts/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete alert");
  },

  async toggleAlert(id: string, enabled: boolean): Promise<PriceAlert> {
    return this.updateAlert(id, { enabled });
  },

  async getPriceHistory(
    productId: string,
    days: 7 | 30 | 90 = 30
  ): Promise<Array<{ timestamp: number; price: number }>> {
    const response = await fetch(
      `/api/price-history/${productId}?days=${days}`
    );
    if (!response.ok) throw new Error("Failed to fetch price history");
    return response.json();
  },

  async getPriceComparison(
    productId: string,
    regions?: string[]
  ): Promise<
    Array<{
      region: string;
      price: number;
      timestamp: number;
    }>
  > {
    const query = new URLSearchParams();
    if (regions) {
      regions.forEach((r) => query.append("regions", r));
    }
    const response = await fetch(
      `/api/price-comparison/${productId}?${query.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch price comparison");
    return response.json();
  },
};
