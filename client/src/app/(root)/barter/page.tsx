"use client";

import { useState } from "react";
import { Plus, ArrowLeftRight, Wallet } from "lucide-react";

import Wrapper from "@/components/shared/wrapper";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import BarterOfferForm from "@/components/BarterOfferForm";
import { useWallet } from "@/hooks/useWallet";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function BarterPage() {
  const { address, connected } = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { trackFunnelStep, trackFeatureAdoption } = useAnalytics();

  function handleSuccess() {
    setSuccessMessage("Barter offer submitted successfully!");
    trackFunnelStep("barter_creation", "completed");
    setTimeout(() => setSuccessMessage(null), 5000);
  }

  return (
    <Wrapper className="pt-32 pb-20 md:pt-40">
      <PageHeader
        title="Barter Trades"
        description="Propose goods-for-goods trades with other farmers. The chain settles only the optional collateral; the goods exchange is coordinated off-chain."
      >
        {connected && (
          <Button
            onClick={() => {
              trackFeatureAdoption("barter_offer_entry");
              trackFunnelStep("barter_creation", "opened");
              setShowForm(true);
            }}
          >
            <Plus className="size-4" />
            New Barter Offer
          </Button>
        )}
      </PageHeader>

      {successMessage && (
        <div className="bg-primary/10 border-primary/30 mt-6 rounded-2xl border p-4 text-sm">
          {successMessage}
        </div>
      )}

      <div className="mt-8">
        {!connected ? (
          <EmptyState
            icon={Wallet}
            title="Connect your wallet"
            description="Sign in with Freighter to propose or view barter trades."
          />
        ) : (
          // No backend endpoint yet — the form just validates and resolves locally.
          // When /barter is wired up on the server, replace this with a fetched list.
          <EmptyState
            icon={ArrowLeftRight}
            title="No active barter offers yet"
            description={'Click "New Barter Offer" to propose a goods-for-goods trade.'}
            action={
              <Button
                onClick={() => {
                  trackFeatureAdoption("barter_offer_entry");
                  trackFunnelStep("barter_creation", "opened");
                  setShowForm(true);
                }}
              >
                <Plus className="size-4" />
                New Barter Offer
              </Button>
            }
          />
        )}
      </div>

      {address && (
        <BarterOfferForm
          open={showForm}
          walletAddress={address}
          onClose={() => setShowForm(false)}
          onSuccess={handleSuccess}
        />
      )}
    </Wrapper>
  );
}
