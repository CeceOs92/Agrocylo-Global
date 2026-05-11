"use client";

import Wrapper from "@/components/shared/wrapper";
import { DemandSignalPanel } from "@/components/DemandSignalPanel";

export default function DemandPage() {
  return (
    <Wrapper className="pt-32 pb-20 md:pt-40">
      <DemandSignalPanel />
    </Wrapper>
  );
}
