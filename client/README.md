# AgroCylo Frontend Setup

Welcome to the AgroCylo frontend repository. This document outlines the setup, architecture, and environment configuration.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Wallet Setup

We use Freighter for interacting with the Stellar network.
- Download and install the [Freighter browser extension](https://www.freighter.app/).
- Set up a wallet and switch to the **Testnet**.
- Fund your Testnet account using the [Stellar Laboratory Faucet](https://laboratory.stellar.org/#account-creator?network=test).

## Environment Variables

Create a `.env.local` file with the following variables:

```env
PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
PUBLIC_API_URL=http://localhost:3000
```

## Architecture Overview

- **Framework**: Next.js App Router (React islands)
- **State & Data**: React hooks, Zustand, and React Query (for async data/RPC calls)
- **Wallet Integration**: Freighter API integration for signing and submitting transactions to Soroban.
- **Contract Calls**: Uses `@stellar/stellar-sdk` and auto-generated contract client bindings.
- **Notifications**: WebSocket integration for real-time order/dispute updates.
- **Onboarding Flow**: Multi-step wizard with built-in geolocation and robust async state handling.

## Local Development

Run the frontend in isolation or alongside the backend. Use `testMode.ts` (if applicable) for mocking wallet behaviors during CI/CD.
