# AGROCYLO🌾
### Overview

Agrocylo is an Agro-DeFi platform. The aim is to make life easier for farmers (especially homegrown/urban), enabling exchange of agro-goods and services using an escrow system. It eliminates middlemen, allows peer-to-peer trade between farmers and consumers, and gives both parties access to Blockchain, Native DeFi, and Digital services. 

Each purchase is secured using an escrow mechanism: funds are locked when a customer places an order and are released only after the buyer confirms receipt of goods. This guarantees protection for both parties while maintaining full user custody.

### ✨ Features
* On-chain escrow settlement - Funds are locked in an escrow smart contract until buyers confirm receipt of goods.

* Non-custodial payments - Users retain full control of funds at all times.

* Peer-to-peer Farmer-Consumer Marketplace - Farmers sell directly to consumers without middlemen, retaining price control and increasing income.

* Token-based payment - Supports stablecoin and token payments (USDC and XLM)

* Buyer-confirmed settlement - Funds are never released to farmer/seller until the buyer confirms receipt of goods.

* Unlimited parallel transactions - Unlimited concurrent trades can be carried out at a time, and each transaction is tracked by ID, time, status, amount, and associated addresses.

* Order indexing by role - Buyers can view all their purchases and order statuses. Farmers can track incoming orders and pending payments.

* Real-time updates and notifications - On-chain events are indexed and transmitted off-chain to deliver real-time order updates and notifications.

### 🎯 Why Agrocylo
* Wider market reach and ease of payment - Small scale farmers face limited market access and fragmented payment systems.
* Post-harvest loss reduction - Farmers incure losses due to lack of storage facilities and limited market access 
* Higher farmer profit and lower consumer cost - enabled by peer-to-peer interaction between farmer and consumer (Absence of middleman).
* Digital transformation of agriculture - price discovery tools, demand/supply aggregation tools to aid data-driven production.

###  Target Users
a. Primary users
    * Farmers/Producers
    * Consumers/buyers

b. Secondary stakeholders
    * Platform operators: analytics, monitoring and support.
    * NGO’s, cooperatives or government programs promoting farmer inclusion


### 🏗 COMPONENTS (DEVELOPMENT) 

#### Smart Contracts

Escrow creation

Order lifecycle management

Dispute handling 

#### Frontend

Farmer dashboards

Consumer checkout & order tracking

Wallet integration

#### Off-Chain Services

Event indexing

Notifications (email, push, in-app)

Analytics and reporting

### 🧱 Architecture
Frontend (Web / Mobile)

   ↓
Smart Contracts (Escrow)

   ↓
Stellar Network

   ↓
Off-Chain Indexers & Notification Services

┌─────────────────┐
│   FRONTEND      │
│ (Web/Mobile)    │
└────────┬────────┘
         │
         ├
         │
         └---------─┐
                    │
               ┌────▼───────────┐
               │Smart Contracts │
               │ (Soroban Rust) │----------─┐
               └────┬───────────┘           |
                                            │
                                       ┌────▼───────────┐
                                       │   Backend      |
                                       │                │
                                       └────────────────┘

### 🛠️ Tech Stack

Network: Stellar Testnet

Smart Contracts: Rust (Soroban)

Frontend: Astro (React)

Wallets: Freighter 

Indexing: Custom event indexer / Subgraph-style service

Notifications: Webhooks, Firebase, or Push APIs

### 📦 Project Goals

Enable swift, fair, and transparent trade

### 🤝 Contributing

### Contributions are welcome!
#### To Contribute:

   * Fork the repository
   * Clone your Forked version
   * cd contracts
   * Please keep a clean working tree (create a branch and be sure its free from conlicts)
   * Please Do not push uncompiled code
#### You can assist by:
    * Improving smart contract logic
    * Enhancing UI/UX
    * Adding indexing or notification services
    * Writing documentation or tests
    * Please open an issue or submit a pull request.

### 🧪 Running Tests

#### Unit Tests
```bash
# Client unit tests (vitest + jsdom)
cd client && npm test

# Server unit tests (vitest + node)
cd server && npm run test:coverage

# Contract tests (Rust soroban-sdk)
cd contracts && cargo test
```

#### E2E Tests
```bash
# Run Playwright E2E tests
cd client && npm run test:e2e

# Run E2E tests with interactive UI
cd client && npm run test:e2e:ui
```

E2E tests mock Freighter wallet and use `NEXT_PUBLIC_DEMO_MODE=true` for deterministic responses. See `.github/workflows/e2e.yml` for CI configuration.

### 🐳 Running locally with Docker

The quickest way to get the full stack running is a single command:

```bash
docker compose up
```

This brings up **all four applications** (two backends + two frontends) along with
both Postgres databases and Redis:

| Service | Port | Description |
|---------|------|-------------|
| **Caddy proxy** | `80` | Unified entry point (http://localhost) |
| Root client | `3000` | Marketplace frontend |
| Agro-production client | `3001` | Campaign/crowdfunding frontend |
| Root backend | `5000` | Marketplace API |
| Agro-production backend | `5001` | Campaign API |
| Postgres (marketplace) | `5432` | `agrocylo_db` |
| Postgres (campaigns) | `5433` | `agrocylo_production` |
| Redis | `6379` | Shared cache/queues |

**Once running**, visit:

- **http://localhost** — root marketplace (Caddy proxy)
- **http://localhost/agro** — agro-production (Caddy proxy)
- **http://localhost:5000** — root backend API (direct)
- **http://localhost:5001** — agro-production backend API (direct)

**Customising environment variables:**

Edit the `.env` file in the repo root. Sensible development defaults are provided
so `docker compose up` works out-of-the-box from a fresh clone.

**Tearing down:**

```bash
docker compose down -v   # stops containers + wipes database volumes
```

### Running locally without Docker

If you prefer to run services individually, you can start each one manually.
This requires Node.js 20+, PostgreSQL, and Redis installed on your host.

#### Agro-production server

1. Navigate to the server directory:
   ```bash
   cd agro-production/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database (create a PostgreSQL database named `agrocylo_production`
   and set `DATABASE_URL` in a `.env` file — see `.env.example`).

4. Run migrations and start the dev server:
   ```bash
   npx prisma migrate deploy
   npm run dev
   ```

   The server runs on `http://localhost:5001` by default.

#### Root server

1. `cd server && npm install`
2. Copy `.env.example` to `.env` and fill in the required values (at minimum
   `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a 32+ character
   `JWT_SECRET`).
3. `npx prisma migrate deploy && npm run dev`

#### Clients

```bash
# Root marketplace client
cd client && npm install && npm run dev    # → http://localhost:3000

# Agro-production client
cd agro-production/client && npm install && npm run dev  # → http://localhost:3000
```

### 🔌 API Documentation

#### Product Endpoints

The backend server (`/agro-production/server`) exposes product endpoints for the marketplace.

**Get all products**
```
GET /api/v1/products
```

**Get product by ID**
```
GET /api/v1/products/:id
```

**Environment Variables**

For production, ensure the following are configured (see `.env.example`):
- `NODE_ENV`: Set to `production`
- `DATABASE_URL`: Supabase PostgreSQL connection string (for production data)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

### Contact 
* [Telegram](https://t.me/Tiya_jd)
* [X](https://x.com/Tiya_JD)
* [Community Telegram](https://t.me/AgricCylo)
