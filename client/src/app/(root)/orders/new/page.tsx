"use client";

import Link from "next/link";
import { Suspense } from "react";
import Wrapper from "@/components/shared/wrapper";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import CreateOrderForm from "@/components/orders/CreateOrderForm";

export default function NewOrderPage() {
  return (
    <Wrapper className="pt-32 pb-20 md:pt-40">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <Link href="/orders" className="hover:text-foreground">
          Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <PageHeader
        title="New Order"
        description="Lock funds in a Soroban escrow against a farmer's wallet. They ship, you confirm, the contract releases payment."
      />

      <div className="mt-8">
        <Suspense
          fallback={<Skeleton className="mx-auto h-[520px] max-w-lg rounded-2xl" />}
        >
          <CreateOrderForm />
        </Suspense>
      </div>
    </Wrapper>
  );
}
