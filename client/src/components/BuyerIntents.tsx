"use client";

import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { BuyerIntent } from "@/types/demand";

interface BuyerIntentsProps {
  intents: BuyerIntent[];
}

export function BuyerIntents({ intents }: BuyerIntentsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Open Buyer Intents</CardTitle>
          <Badge variant="secondary">{intents.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {intents.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No open buyer intents in your area.
          </p>
        ) : (
          intents.map((intent) => (
            <div
              key={intent.id}
              className="bg-secondary/40 hover:border-primary/40 rounded-xl border p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {intent.product_name}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Buyer: {intent.buyer_name}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {intent.category}
                </Badge>
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary font-medium">
                    {intent.quantity} {intent.unit}
                  </span>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <MapPin className="size-3" />
                    {intent.location.region}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {new Date(intent.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
