import { Badge } from "@/components/ui/badge";

/**
 * Status string the Soroban escrow contract returns.
 * Kept as a string union (rather than an enum) because the contract may
 * surface unknown values as the protocol evolves — `unknown` falls through
 * to a neutral outline badge.
 */
export type OrderStatus =
  | "Pending"
  | "Delivered"
  | "Completed"
  | "Refunded"
  | "Disputed"
  | (string & {}); // allow unknown future values

const config: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" | "outline" }
> = {
  Pending: { label: "Pending", variant: "warning" },
  Delivered: { label: "Delivered", variant: "default" },
  Completed: { label: "Completed", variant: "success" },
  Refunded: { label: "Refunded", variant: "secondary" },
  Disputed: { label: "Disputed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const item = config[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
