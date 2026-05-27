const SESSION_KEY = "ap_walletSession";
const LEGACY_ADDRESS_KEY = "ap_walletAddress";

export interface WalletSession {
  address: string;
  connectedAt: number;
}

function isValidSession(value: unknown): value is WalletSession {
  if (!value || typeof value !== "object") return false;
  const session = value as WalletSession;
  return (
    typeof session.address === "string" &&
    session.address.length > 0 &&
    typeof session.connectedAt === "number" &&
    Number.isFinite(session.connectedAt)
  );
}

export function loadWalletSession(): WalletSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValidSession(parsed)) return parsed;
    } catch {
      /* fall through to legacy migration */
    }
    localStorage.removeItem(SESSION_KEY);
  }

  const legacyAddress = localStorage.getItem(LEGACY_ADDRESS_KEY);
  if (!legacyAddress) return null;

  const migrated: WalletSession = {
    address: legacyAddress,
    connectedAt: Date.now(),
  };
  saveWalletSession(migrated);
  localStorage.removeItem(LEGACY_ADDRESS_KEY);
  return migrated;
}

export function saveWalletSession(session: WalletSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearWalletSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_ADDRESS_KEY);
}
