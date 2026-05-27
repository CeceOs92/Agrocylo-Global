# Agro Production — Client

Quick start and development notes for the `agro-production/client` frontend.

Prerequisites
- Node.js 18+ and npm or pnpm

Install

```bash
npm install
```

Env
- `NEXT_PUBLIC_API_URL` — API base URL (default: http://localhost:3001/api/v1)
- `NEXT_PUBLIC_SOROBAN_RPC_URL` — Soroban RPC endpoint
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` — Network passphrase

Available scripts
- `npm run dev` — start Next.js dev server
- `npm run build` — build for production
- `npm run start` — start built app
- `npm run test` — run unit/integration tests (Vitest)
- `npm run storybook` — start Storybook for components

Testing
- Tests use Vitest and simple DOM mocking. Run `npm run test` to execute.

Storybook
- Start with `npm run storybook`. Stories live under `src/**/*.stories.*`.

Notes for developers
- API calls are centralized in `src/lib/apiClient.ts` and wrapped by the service modules in `src/services/*`.
- Wallet context and signer code are in `src/context/WalletContext.tsx` and `src/lib/signTransaction.ts`.
