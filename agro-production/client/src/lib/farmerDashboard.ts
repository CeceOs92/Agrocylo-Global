import type { Order } from "@/types";

export interface FarmerOrderSummary {
  pendingDeliveries: Order[];
  completedOrders: Order[];
  pendingValue: bigint;
  completedRevenue: bigint;
}

/**
 * Defence in depth for the farmer dashboard. The API already filters by the
 * campaign owner, but a client must never display a record whose included
 * campaign belongs to another wallet.
 */
export function filterOrdersForFarmer(orders: Order[], farmerAddress: string): Order[] {
  return orders.filter(
    (order) => order.campaign?.farmerAddress === farmerAddress,
  );
}

export function summarizeFarmerOrders(orders: Order[]): FarmerOrderSummary {
  const pendingDeliveries = orders.filter((order) => order.status === "PENDING");
  const completedOrders = orders.filter((order) => order.status === "CONFIRMED");

  return {
    pendingDeliveries,
    completedOrders,
    pendingValue: pendingDeliveries.reduce(
      (total, order) => total + BigInt(order.amount),
      0n,
    ),
    completedRevenue: completedOrders.reduce(
      (total, order) => total + BigInt(order.amount),
      0n,
    ),
  };
}
