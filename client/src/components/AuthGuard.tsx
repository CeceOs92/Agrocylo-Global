"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/context/ProfileContext";

type Role = "farmer" | "buyer";

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: Role;
}

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
      router.replace(
        profile.role === "farmer" ? "/dashboard/products" : "/market",
      );
    }
  }, [connected, profile, isLoaded, requiredRole, router]);

  if (!isLoaded || !connected || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Checking access…</p>
      </div>
    );
  }

  if (requiredRole && profile.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
