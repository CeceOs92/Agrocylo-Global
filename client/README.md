# AgroCylo 🌾 — Frontend Client

Peer-to-peer agro marketplace built on Stellar. Farmers list produce and receive
on-chain payments directly from buyers — no middlemen, settled by Soroban escrow.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Wallet | Freighter (`@stellar/freighter-api`) — user-custodied browser extension |
| Chain SDK | `@stellar/stellar-sdk` (Horizon + Soroban RPC) |
| Smart contract | Soroban escrow — `services/stellar/contractService.ts` |
| Data fetching | TanStack React Query |
| Tables | TanStack React Table |
| Styling | Tailwind v4 (oklch design tokens, light/dark) |
| UI primitives | shadcn/ui + Radix |
| State | Zustand-style React Contexts (Wallet, Profile, Cart, TransactionFeedback) |
| Charts | Recharts |
| Smooth scroll | Lenis driven by GSAP ticker |
| Maps | `react-leaflet` (farmer locations) |
| Toasts | Sonner (auto-themed via next-themes) |
| Tests | Vitest unit + Playwright e2e |

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout — fonts, metadata, GlobalProvider
    globals.css             # Tailwind v4 + design tokens (oklch, dark mode)
    manifest.ts             # PWA manifest
    opengraph-image.tsx     # Auto-generated OG card (1200×630)

    (root)/                 # Public site
      _components/          # Header, Footer
      (home)/               # Landing
        _components/        # hero, partners marquee, how-it-works, trust,
                            # why-choose-us, cta sections
      market/               # Market listing + product detail
      onboarding/           # Multi-step Freighter onboarding
      cart/  orders/  escrow/  barter/  map/

    (dashboard)/            # Farmer dashboard (role: farmer)
      _components/          # Sidebar, Header
      layout.tsx            # AuthGuard requiredRole="farmer"
      dashboard/
        page.tsx            # Overview: stats + charts + recent orders
        products/           # Product CRUD with DataTable
        orders/             # Incoming orders DataTable
        earnings/           # Payout history + 3% fee calc
        settings/           # Profile / wallet / notifications

    (admin)/                # Admin section (role: any onboarded for now)
      _components/          # Sidebar, Header
      layout.tsx            # AuthGuard
      admin/
        page.tsx            # Platform overview KPIs
        analytics/          # Charts
        users/              # Users DataTable (scaffold)
        orders/             # All orders DataTable (scaffold)
        products/           # All products DataTable (live)
        disputes/           # Real-time dispute queue (existing socket flow)

  components/
    ui/                     # shadcn primitives (button, card, input, dialog…)
    shared/                 # wrapper, page-header, stat-card, status-badge,
                            # data-table, charts, copy-button, theme-toggle,
                            # empty-state, star-rating, dashboard-footer
    modals/                 # account-modal, wallet-modal (Freighter)
    providers/              # global-provider, theme-provider
    onboarding/             # Step components for /onboarding
    orders/  admin/  map/   # Page-specific subcomponents

  context/                  # WalletContext, ProfileContext, CartContext,
                            # TransactionFeedbackContext

  hooks/
    useWallet.ts            # Wraps WalletContext
    useEscrowContract.ts    # Soroban contract calls
    useTransaction.ts       # Tx-feedback machine
    useSocket.ts            # Backend WebSocket
    use-is-mobile.ts        # 768px viewport check
    queries/                # React Query domain hooks (products, orders,
                            # cart, notifications)

  lib/
    apiConfig.ts            # NEXT_PUBLIC_API_URL canonical config
    queryClient.ts          # React Query client (server / browser singleton)
    queryKeys.ts            # Centralised key factory
    utils.ts                # cn(), getInitials(), formatUSD()
    testMode.ts             # Single isTestMode() helper
    helpers/                # format-address, token, chainId
    stellar.ts              # Horizon + Soroban server selection
    signTransaction.ts      # Wallet signing pipeline
    soroban.ts              # Soroban polling helpers

  services/
    productService.ts       # /products CRUD
    orderService.ts         # /orders queries
    cartService.ts          # /cart CRUD
    profileService.ts       # /profiles + /locations
    notification/api.ts     # /notifications + showOrderEventToast
    stellar/                # contractService (Soroban escrow), networkConfig

  config/site.config.ts     # Title, OG, Twitter, manifest config
  fonts/                    # Montserrat Alternates local font
  types/                    # Domain types (Product, Order, Cart, Wallet, …)
  theme/tokens.css          # Legacy token file (kept for back-compat;
                            # active tokens live in app/globals.css)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

```env
# Backend
NEXT_PUBLIC_API_URL=http://localhost:5000

# Stellar / Soroban
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Contracts
NEXT_PUBLIC_CONTRACT_ID=                       # Deployed escrow contract
NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT_ID=          # XLM SAC (testnet: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC)
NEXT_PUBLIC_TOKEN_CONTRACT_ID_USDC=
NEXT_PUBLIC_TOKEN_CONTRACT_ID_STRK=
```

### Run

```bash
npm run dev      # development on :3000
npm run build    # production build (Turbopack)
npm run start    # serve production build
npm run test     # vitest
```

## Auth & Wallet Flow

```
1. User clicks "Connect Wallet" in the header
      ↓
2. Freighter extension prompts the user to approve
      ↓
3. WalletContext stores address + network in localStorage and reconciles
   with Freighter on every mount (defends against wallet-switch drift)
      ↓
4. ProfileContext fetches /profile/{address}
      ↓
5. First connect with no profile → AuthGuard / connect-wallet-inner
   redirects to /onboarding
      ↓
6. Onboarding: select role (farmer / buyer) → profile form → location
   consent → /api/auth/register → seeded into ProfileContext
      ↓
7. Returning users: ProfileContext hydrates immediately, dashboard or
   market becomes available
```

All Stellar transactions go through `useEscrowContract` → `signAndSubmitTransaction`,
which builds a Soroban tx, prompts Freighter to sign, and submits via the Soroban
RPC. AVNU paymaster / sponsorship is *not* used — users pay Stellar's native
~$0.00001 fees directly.

## Backend API

The frontend calls a separate Express backend at `NEXT_PUBLIC_API_URL`. Auth
is via the `x-wallet-address` header (the wallet address itself is the
identity; signed-transaction proofs handle the on-chain side).

| Method | Path | Used by |
|---|---|---|
| GET | `/products` | Market listing, dashboard products, admin products |
| GET | `/products/:id` | Product detail |
| POST | `/products` | Farmer creates listing |
| PATCH | `/products/:id` | Update listing |
| DELETE | `/products/:id` | Soft delete |
| GET | `/orders/buyer/:addr` | Buyer's orders |
| GET | `/orders/seller/:addr` | Farmer's orders |
| GET | `/cart` | Active cart |
| POST | `/cart/items` | Add to cart |
| PATCH | `/cart/items/:id` | Update qty |
| DELETE | `/cart/items/:id` | Remove from cart |
| POST | `/profiles` | Onboarding step |
| POST | `/locations` | Onboarding step |
| GET | `/profiles/:addr` | ProfileContext hydration |
| GET | `/notifications` | NotificationPoller |
| GET | `/admin/disputes` | Admin disputes page |

WebSocket (Socket.io) on the same base URL emits `order:status_changed` events
for real-time refresh on the disputes page and order detail.

## Route Protection

- `/dashboard/*` — `<AuthGuard requiredRole="farmer">`
- `/admin/*` — `<AuthGuard>` (any onboarded user; will tighten to `admin` role
  once the backend models it)
- `/orders/*` — `<AuthGuard>`
- `/onboarding` — redirects authenticated + onboarded users away
- Unauthenticated users hitting protected routes → `/onboarding`

## Key Implementation Notes

- **Single backend env var** — every service reads `NEXT_PUBLIC_API_URL`
  through `lib/apiConfig.ts`. Sockets reuse the same base URL with `ws://`.
- **`isTestMode()` is single-source** — `lib/testMode.ts`. When Playwright
  injects `window.freighter.signTransaction`, services return deterministic
  fake data instead of hitting the real backend / Soroban RPC.
- **No custom Soroban RPC by default** — defaults to the public Stellar testnet
  RPC. Override `NEXT_PUBLIC_SOROBAN_RPC_URL` for mainnet or self-hosted nodes.
- **OpenZeppelin-equivalent (Soroban native)** — Soroban accounts don't need
  the same fee-bound workarounds Starknet does; standard `ensureReady()` is
  enough.
- **Wallet drift detection** — on every mount, `WalletContext` queries Freighter
  for the live public key and reconciles with localStorage. If the user switched
  wallets in Freighter outside our app, we adopt the live key (defends against
  signing transactions for the wrong account).

## Deploying to Vercel

1. Set the env vars from `.env.example` in the Vercel project settings.
2. Point Vercel at this directory (the repo subfolder containing `package.json`).
3. Build command: `npm run build`. Output: `.next`.
4. The PWA manifest (`/manifest.webmanifest`) and OG image
   (`/opengraph-image`) are generated at build time and need no extra
   configuration.
