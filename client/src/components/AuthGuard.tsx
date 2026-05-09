"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/context/ProfileContext";
import { Container, Spinner, Text } from "@/components/ui";

type Role = "farmer" | "buyer";

interface AuthGuardProps {
  children: ReactNode;
  /** Restrict access to a specific role; omit to allow any onboarded user. */
  requiredRole?: Role;
}

/**
 * Client-side route guard.
 *
 * Behaviour:
 *  - Wallet not connected     → redirect to `/onboarding`
 *  - Connected but no profile → redirect to `/onboarding`
 *  - Wrong role               → redirect to the role's home (`/dashboard/products` for farmers, `/market` for buyers)
 *  - All checks pass          → render children
 *
 * While the profile is loading, a spinner is shown so the page never flashes
 * its protected content before the redirect fires.
 */
export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const { connected } = useWallet();
  const { profile, isLoaded } = useProfile();

  useEffect(() => {
    if (!isLoaded) return;

    if (!connected || !profile) {
      router.replace("/onboarding");
      return;
    }

    if (requiredRole && profile.role !== requiredRole) {
      router.replace(profile.role === "farmer" ? "/dashboard/products" : "/market");
    }
  }, [connected, profile, isLoaded, requiredRole, router]);

  if (!isLoaded || !connected || !profile) {
    return (
      <Container className="py-24 text-center">
        <Spinner />
        <Text variant="body" muted className="mt-4">
          Checking access…
        </Text>
      </Container>
    );
  }

  if (requiredRole && profile.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
