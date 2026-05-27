import type { Order } from "@/types";
import api from "../lib/apiClient";

export async function fetchOrdersByBuyer(buyerAddress: string): Promise<Order[]> {
  return api.get<Order[]>(`/orders?buyerAddress=${encodeURIComponent(buyerAddress)}`);
}

export async function fetchOrdersByFarmer(farmerAddress: string): Promise<Order[]> {
  return api.get<Order[]>(`/orders?farmerAddress=${encodeURIComponent(farmerAddress)}`);
}

export async function createOrder(data: {
  buyerAddress: string;
  campaignId: string;
  amount: string;
}): Promise<Order> {
  const sanitized = {
    buyerAddress: data.buyerAddress.replace(/[<>]/g, "").trim(),
    campaignId: data.campaignId.replace(/[<>]/g, "").trim(),
    amount: data.amount.replace(/[^0-9]/g, ""),
  };
  return api.post<Order>(`/orders`, sanitized);
}
