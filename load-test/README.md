# Agrocylo Load-Test Harness

k6-based load-testing harness for both backend servers.  Covers HTTP critical
paths, WebSocket connection churn, and a Prisma-query soak test.

## Prerequisites

```bash
# Install k6 (Linux)
sudo apt-get install gnupg
sudo gpg -k
sudo gpg --no-default-keyring \
         --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
         --keyserver hkp://keyserver.ubuntu.com:80 \
         --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
  https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Docker (no install)
docker pull grafana/k6
```

## Directory layout

```
load-test/
├── README.md                      # This file
├── config/
│   └── thresholds.js              # Shared pass/fail thresholds
├── shared/
│   ├── auth.js                    # JWT helper (HMAC-256 from k6 crypto)
│   └── env.js                     # Env-var config with defaults
├── scenarios/
│   ├── server-http.js             # server/ HTTP critical paths
│   ├── agro-production-http.js    # agro-production/server/ HTTP critical paths
│   ├── websocket-churn.js         # WS connection churn + auth latency (both servers)
│   └── soak-prisma.js             # Reconciliation / join-query soak
└── ci/
    └── run-load-tests.sh          # CI wrapper script
```

## Environment variables

| Variable                  | Default                   | Description                              |
|---------------------------|---------------------------|------------------------------------------|
| `SERVER_BASE_URL`         | `http://localhost:5000`   | server/ base URL                         |
| `AGRO_BASE_URL`           | `http://localhost:5001`   | agro-production/server/ base URL         |
| `JWT_SECRET`              | `dev-secret-key-minimum32chars!!` | HMAC secret for signing test JWTs |
| `TEST_WALLET_ADDRESS`     | `GBTEST...`               | Wallet address embedded in test tokens   |
| `TEST_SELLER_ADDRESS`     | `GBSELLER...`             | Seller address for seller-scoped routes  |
| `TEST_CAMPAIGN_ID`        | *(required for agro)*     | A pre-seeded campaign UUID               |
| `K6_SMOKE_VUS`            | `5`                       | VUs for smoke / sanity run               |
| `K6_LOAD_VUS`             | `100`                     | VUs for load run                         |
| `K6_SOAK_VUS`             | `50`                       | VUs for soak run                         |
| `K6_SOAK_DURATION`        | `10m`                     | Duration for soak run                    |
| `LOAD_PROFILE`            | `smoke`                   | `smoke`, `load`, or `soak`               |

## Running a single scenario

```bash
# Smoke – quick sanity
LOAD_PROFILE=smoke k6 run load-test/scenarios/server-http.js

# Load – capacity check
LOAD_PROFILE=load k6 run load-test/scenarios/server-http.js

# WebSocket churn
LOAD_PROFILE=load k6 run load-test/scenarios/websocket-churn.js

# Soak – sustained pressure
LOAD_PROFILE=soak k6 run load-test/scenarios/soak-prisma.js

# Full agro-production suite
LOAD_PROFILE=load k6 run load-test/scenarios/agro-production-http.js
```

## Running all scenarios via CI script

```bash
chmod +x load-test/ci/run-load-tests.sh
LOAD_PROFILE=load load-test/ci/run-load-tests.sh
```

The script exits non-zero if any k6 threshold is breached; suitable for CI gates.

## Interpreting results

k6 writes a JSON summary to `load-test/results/` (created automatically).  Key
metrics to watch:

- `http_req_duration{p(95)}` – 95th-percentile latency.  Threshold: **< 500 ms**.
- `http_req_failed`           – Error rate.  Threshold: **< 1 %**.
- `ws_connecting`             – WebSocket handshake time.  Threshold: **< 200 ms**.
- `ws_msgs_received`          – Confirms broadcast delivery under churn.
- `checks`                    – Per-scenario assertions; 0 failures = green.

## Adding new scenarios

1. Create `load-test/scenarios/<name>.js`.
2. Import `buildStages` from `../config/thresholds.js` and `ENV` from `../shared/env.js`.
3. Add the script to the `SCENARIOS` array in `load-test/ci/run-load-tests.sh`.
