"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTruncatedAddress } from "@/lib/helpers/format-address";
import DisputeActionModal from "./DisputeActionModal";

interface Dispute {
  id?: string;
  orderIdOnChain?: string;
  raisedBy?: string;
  reason?: string;
  status?: string;
  evidenceHash?: string;
  order?: { amount?: string; orderIdOnChain?: string };
  createdAt?: string;
  [k: string]: unknown;
}

interface DisputeListProps {
  disputes: Dispute[];
  onRefresh: () => void;
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

function getStatusVariant(status?: string): BadgeVariant {
  switch ((status ?? "").toUpperCase()) {
    case "OPEN":
      return "warning";
    case "RESOLVED":
      return "success";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
}

export default function DisputeList({ disputes, onRefresh }: DisputeListProps) {
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground text-xs uppercase">
            <tr className="border-b">
              <Th>Order</Th>
              <Th>Raised by</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {disputes.map((dispute, i) => {
              const orderId =
                dispute.orderIdOnChain ?? dispute.order?.orderIdOnChain ?? "—";
              const isTerminal =
                dispute.status === "RESOLVED" || dispute.status === "REJECTED";
              return (
                <tr
                  key={dispute.id ?? `dispute-${i}`}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">#{orderId}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {dispute.raisedBy
                      ? formatTruncatedAddress(dispute.raisedBy)
                      : "—"}
                  </td>
                  <td className="text-foreground/80 max-w-xs truncate px-4 py-3">
                    {dispute.reason || (
                      <span className="text-muted-foreground italic">
                        No reason provided
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(dispute.status)}>
                      {dispute.status ?? "UNKNOWN"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDispute(dispute)}
                      disabled={isTerminal}
                    >
                      <Settings2 className="size-3.5" />
                      Manage
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {disputes.length > 0 && <Separator className="mt-2" />}

      {selectedDispute && (
        <DisputeActionModal
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
          onSuccess={() => {
            setSelectedDispute(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-semibold ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
