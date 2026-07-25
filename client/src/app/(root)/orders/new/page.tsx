import Link from "next/link";
import Wrapper from "@/components/shared/wrapper";
import { PageHeader } from "@/components/shared/page-header";
import CreateOrderForm, {
  type ResolvedFarmer,
} from "@/components/orders/CreateOrderForm";
import { getProfile } from "@/services/profileService";

type SearchParams = Promise<{
  farmerId?: string | string[] | undefined;
  farmer?: string | string[] | undefined;
}>;

function getSingleValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveFarmer(
  searchParams?: SearchParams,
): Promise<ResolvedFarmer | null> {
  const params = searchParams ? await searchParams : {};
  const farmerId = getSingleValue(params.farmerId)?.trim();

  // Legacy `?farmer=` links are intentionally ignored to avoid attacker-
  // controlled destination overrides.
  if (!farmerId) {
    return null;
  }

  try {
    const profile = await getProfile(farmerId);
    if (!profile?.wallet_address) {
      return null;
    }

    return {
      farmerId,
      walletAddress: profile.wallet_address,
      displayName: profile.display_name || "Verified Farmer",
      avatarUrl: profile.avatar_url,
    };
  } catch {
    return null;
  }
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedFarmer = await resolveFarmer(searchParams);

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
        description="Lock funds in a Soroban escrow against a verified farmer profile. They ship, you confirm, the contract releases payment."
      />

      <div className="mt-8">
        <CreateOrderForm resolvedFarmer={resolvedFarmer} />
      </div>
    </Wrapper>
  );
}
