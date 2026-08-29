import { freighterAdapter } from "./freighterAdapter";
import { rabetAdapter } from "./rabetAdapter";
import { hanaAdapter } from "./hanaAdapter";
import type { WalletAdapter } from "./types";

export const WALLET_ADAPTERS: WalletAdapter[] = [freighterAdapter, rabetAdapter, hanaAdapter];

export const DEFAULT_WALLET_ID = freighterAdapter.id;

export function getWalletAdapter(id: string | null | undefined): WalletAdapter {
  return WALLET_ADAPTERS.find((adapter) => adapter.id === id) ?? freighterAdapter;
}

export type { WalletAdapter } from "./types";
