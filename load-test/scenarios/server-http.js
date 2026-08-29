/**
 * load-test/scenarios/server-http.js
 *
 * HTTP load-test for server/ (port 5000) critical paths:
 *   - GET /orders              — order listing (wallet-scoped)
 *   - GET /orders/:id          — order by on-chain ID
 *   - GET /orders/stats/:addr  — seller statistics (4× parallel counts)
 *   - GET /disputes            — dispute listing (wallet-scoped)
 *   - GET /products            — product catalogue
 *   - GET /health              — baseline latency probe
 *
 * Each iteration exercises all routes in sequence; k6 automatically runs
 * concurrent iterations proportional to the VU count.
 *
 * Usage:
 *   # Smoke
 *   LOAD_PROFILE=smoke k6 run load-test/scenarios/server-http.js
 *
 *   # Full load
 *   LOAD_PROFILE=load K6_LOAD_VUS=100 k6 run load-test/scenarios/server-http.js
 *
 *   # Write JSON summary for reporting
 *   k6 run --out json=load-test/results/server-http.json \
 *           load-test/scenarios/server-http.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";
import { ENV } from "../shared/env.js";
import { buildStages } from "../config/thresholds.js";
import { buildVuTokens } from "../shared/auth.js";

// ── Custom metrics ─────────────────────────────────────────────────────────
const orderListLatency   = new Trend("order_list_latency_ms",   true);
const orderByIdLatency   = new Trend("order_by_id_latency_ms",  true);
const sellerStatsLatency = new Trend("seller_stats_latency_ms", true);
const disputeListLatency = new Trend("dispute_list_latency_ms", true);
const productListLatency = new Trend("product_list_latency_ms", true);
const authErrorRate      = new Rate("auth_error_rate");

// ── Scenario configuration ─────────────────────────────────────────────────
const { stages, thresholds } = buildStages({
  profile:      ENV.LOAD_PROFILE,
  loadVus:      ENV.K6_LOAD_VUS,
  soakVus:      ENV.K6_SOAK_VUS,
  soakDuration: ENV.K6_SOAK_DURATION,
});

export const options = {
  stages,
  thresholds: {
    ...thresholds,
    // Route-specific latency SLOs
    order_list_latency_ms:   ["p(95)<500"],
    order_by_id_latency_ms:  ["p(95)<300"],
    seller_stats_latency_ms: ["p(95)<600"],  // 4 parallel DB counts
    dispute_list_latency_ms: ["p(95)<500"],
    product_list_latency_ms: ["p(95)<300"],
    auth_error_rate:         ["rate<0.01"],
  },
};

const BASE = ENV.SERVER_BASE_URL;

// ── Per-VU setup ───────────────────────────────────────────────────────────
export function setup() {
  // Verify the server is reachable before the test ramps up.
  const res = http.get(`${BASE}/health`);
  if (res.status !== 200) {
    throw new Error(
      `server/ health check failed (${res.status}). ` +
      `Is the server running at ${BASE}?`,
    );
  }
  return {}; // shared data passed to default()
}

// ── VU state (initialised once per VU, not per iteration) ─────────────────
let vuTokens;

export default function (_data) {
  // Lazy-initialise tokens on first iteration of this VU.
  if (!vuTokens) {
    vuTokens = buildVuTokens();
  }

  const buyerHeaders  = vuTokens.buyerHeaders;
  const sellerHeaders = vuTokens.sellerHeaders;
  const buyerAddr     = ENV.TEST_WALLET_ADDRESS;
  const sellerAddr    = ENV.TEST_SELLER_ADDRESS;

  // ── 1. Health probe ────────────────────────────────────────────────────
  group("health", () => {
    const res = http.get(`${BASE}/health`, { tags: { name: "health" } });
    check(res, { "health 200": (r) => r.status === 200 });
  });

  // ── 2. Order listing (wallet-scoped) ───────────────────────────────────
  group("GET /orders", () => {
    const res = http.get(`${BASE}/orders`, {
      headers: buyerHeaders,
      tags: { name: "orders_list" },
    });
    orderListLatency.add(res.timings.duration);
    authErrorRate.add(res.status === 401 || res.status === 403 ? 1 : 0);
    check(res, {
      "orders list 200":       (r) => r.status === 200,
      "orders list is array":  (r) => Array.isArray(r.json()),
    });
  });

  sleep(0.1);

  // ── 3. Order by ID – uses a well-known seed ID; 404 is also acceptable
  //       because the staging DB may not have that exact record yet ─────────
  group("GET /orders/:id", () => {
    const seedOrderId = ENV.TEST_ORDER_ID || "test-order-001";
    const res = http.get(`${BASE}/orders/${seedOrderId}`, {
      headers: buyerHeaders,
      tags: { name: "order_by_id" },
    });
    orderByIdLatency.add(res.timings.duration);
    check(res, {
      "order by id acceptable": (r) =>
        r.status === 200 || r.status === 404 || r.status === 403,
    });
  });

  sleep(0.1);

  // ── 4. Buyer-scoped order listing ──────────────────────────────────────
  group("GET /orders/buyer/:address", () => {
    const res = http.get(`${BASE}/orders/buyer/${buyerAddr}`, {
      headers: buyerHeaders,
      tags: { name: "orders_by_buyer" },
    });
    check(res, {
      "orders by buyer 200": (r) => r.status === 200,
    });
  });

  sleep(0.1);

  // ── 5. Seller stats (expensive: 4 parallel Prisma count queries) ──────
  group("GET /orders/stats/:sellerAddress", () => {
    const res = http.get(`${BASE}/orders/stats/${sellerAddr}`, {
      headers: sellerHeaders,
      tags: { name: "seller_stats" },
    });
    sellerStatsLatency.add(res.timings.duration);
    check(res, {
      "seller stats 200":            (r) => r.status === 200,
      "seller stats has totalOrders": (r) => {
        if (r.status !== 200) return true; // skip shape check on non-200
        const body = r.json();
        return typeof body.totalOrders === "number";
      },
    });
  });

  sleep(0.1);

  // ── 6. Dispute listing (wallet-scoped, deep join: dispute→order→product) ─
  group("GET /disputes", () => {
    const res = http.get(`${BASE}/disputes`, {
      headers: buyerHeaders,
      tags: { name: "disputes_list" },
    });
    disputeListLatency.add(res.timings.duration);
    check(res, {
      "disputes 200 or 404": (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.1);

  // ── 7. Product listing (public, no auth) ───────────────────────────────
  group("GET /products", () => {
    const res = http.get(`${BASE}/products`, {
      tags: { name: "product_list" },
    });
    productListLatency.add(res.timings.duration);
    check(res, {
      "products 200":      (r) => r.status === 200,
      "products is array": (r) => {
        if (r.status !== 200) return true;
        const body = r.json();
        return Array.isArray(body) || (body && Array.isArray(body.data));
      },
    });
  });

  sleep(0.2);
}

export function teardown(_data) {
  // k6 prints a summary automatically; nothing extra needed here.
}
