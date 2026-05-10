import { API_BASE_URL as API_BASE } from "@/lib/apiConfig";
import { isTestMode } from "@/lib/testMode";

export interface Profile {
  wallet_address: string;
  role: "farmer" | "buyer";
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  is_public: boolean;
}

export async function getProfile(wallet: string): Promise<Profile | null> {
  // Test mode (Playwright e2e): the backend isn't running, so return a stub
  // farmer profile so AuthGuard lets the dashboard / orders routes through.
  if (isTestMode()) {
    return {
      wallet_address: wallet,
      role: "farmer",
      display_name: "Test Farmer",
      bio: null,
      avatar_url: null,
    };
  }

  const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(wallet)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

export async function createProfile(
  data: {
    role: "farmer" | "buyer";
    display_name: string;
    bio?: string;
    avatar_url?: string;
  },
  walletAddress: string,
): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": walletAddress,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create profile: ${res.status}`);
  return res.json();
}

export async function registerLocation(
  data: LocationData,
  walletAddress: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": walletAddress,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to register location: ${res.status}`);
}
