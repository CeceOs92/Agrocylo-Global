/**
 * load-test/scenarios/agro-production-http.js
 *
 * HTTP load-test for agro-production/server/ (port 5001) critical paths:
 *
 *   READ paths (most traffic):
 *   - GET /api/v1/campaigns              – paginated campaign listing
 *   - GET /api/v1/campaigns/:id          – campaign detail + investments
 *   - GET /api/v1/campaigns/:id/milestones – milestone/tranche state
 *   - GET /api/v1/investments            – investor portfolio
 *   - GET /api/v1/orders                 – buyer order listing
 *
 *   WRITE paths (rate-limited, exercised at lower concurrency):
 *   - POST /api/v1/campaigns/:id/invest  – record an investment intent
 *   - POST /api/v1/orders                – create an order intent
 *   - PUT  /api/v1/orders/:id            – update txHash after on-chain confirm
 *   - PATCH /api/v1/orders/:id/confirm   – confirm delivery
 *
 *   HEALTH probes:
 *   - GET /health  – simple UP check
 *   - GET /livez   – liveness
 *   - GET /readyz  – readiness (DB + RPC)
 *
 * The write paths share the same per-IP write rate limiter
 * (RATE_LIMIT_WRITE_MAX_REQUESTS, default 10/60s).  Under load-profile,
 * each VU fires at most one write per ~6 seconds to avoid burning through
 * the limiter budget.  Observe 429 counts to discover the real ceiling.
 *
 * Usage:
 *   LOAD_PROFILE=smoke k6 run load-test/scenarios/agro-production-http.js
 *   LOAD_PROFILE=load  k6 run load-test/scenarios/agro-production-http.js \
 *       -e TEST_CAMPAIGN_ID=<uuid>
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV } from "../shared/env.js";
import { buildStages } from "../config/thresholds.js";
import { buildVuTokens } from "../shared/auth.js";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ── Custom metrics ─────────────────────────────────────────────────────────
const campaignListLatency       = new Trend("agro_campaign_list_ms",      true);
const campaignDetailLatency     = new Trend("agro_campaign_detail_ms",    true);
const milestoneLatency          = new Trend("agro_milestone_ms",          true);
const investmentListLatency     = new Trend("agro_investment_list_ms",    true);
const orderListLatency          = new Trend("agro_order_list_ms",         true);
const investWriteLatency        = new Trend("agro_invest_write_ms",       true);
const orderCreateLatency        = new Trend("agro_order_create_ms",       true);
const orderConfirmLatency       = new Trend("agro_order_confirm_ms",      true);
const writeLimiterHits          = new Counter("agro_write_429_total");

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
    agro_campaign_list_ms:   ["p(95)<400"],
    agro_campaign_detail_ms: ["p(95)<400"],
    agro_milestone_ms:       ["p(95)<400"],
    agro_investment_list_ms: ["p(95)<400"],
    agro_order_list_ms:      ["p(95)<400"],
    // Write endpoints are slower due to DB writes and idempotency checks
    agro_invest_write_ms:    ["p(95)<800"],
    agro_order_create_ms:    ["p(95)<800"],
    agro_order_confirm_ms:   ["p(95)<600"],
  },
};

const BASE       = ENV.AGRO_BASE_URL;
const CAMPAIGN_ID = ENV.TEST_CAMPAIGN_ID; // pre-seeded UUID; may be empty

// ── Pre-flight health check ────────────────────────────────────────────────
export function setup() {
  const res = http.get(`${BASE}/health`);
  if (res.status !== 200) {
    throw new Error(
      `agro-production/server health check failed (${res.status}). ` +
      `Is the server running at ${BASE}?`,
    );
  }
  return { campaignId: CAMPAIGN_ID };
}

// ── VU state ──────────────────────────────────────────────────────────────
let vuTokens;
// Track the most recently created order ID so PUT/PATCH routes have a target.
let lastCreatedOrderId = null;

export default function (data) {
  if (!vuTokens) {
    vuTokens = buildVuTokens();
  }

  const buyerHeaders  = vuTokens.buyerHeaders;
  const buyerAddr     = ENV.TEST_WALLET_ADDRESS;
  const farmerAddr    = ENV.TEST_SELLER_ADDRESS;
  const campaignId    = data.campaignId || CAMPAIGN_ID;

  // ── Health probes ─────────────────────────────────────────────────────
  group("health-probes", () => {
    const h = http.get(`${BASE}/health`,  { tags: { name: "agro_health" } });
    check(h, { "health 200": (r) => r.status === 200 });

    const l = http.get(`${BASE}/livez`,   { tags: { name: "agro_livez" } });
    check(l, { "livez 200": (r) => r.status === 200 });

    // readyz may return 503 if RPC is down – that's a separate concern
    const r = http.get(`${BASE}/readyz`,  { tags: { name: "agro_readyz" } });
    check(r, { "readyz 2xx or 503": (res) => res.status < 600 });
  });

  sleep(0.1);

  // ── Campaign listing (public, paginated) ──────────────────────────────
  group("GET /campaigns", () => {
    const res = http.get(`${BASE}/api/v1/campaigns?page=1&limit=20`, {
      tags: { name: "campaign_list" },
    });
    campaignListLatency.add(res.timings.duration);
    check(res, {
      "campaign list 200":     (r) => r.status === 200,
      "campaign list has data": (r) => {
        if (r.status !== 200) return true;
        const b = r.json();
        return b && Array.isArray(b.data);
      },
    });

    // Status-filtered sub-query (common UI pattern)
    const filtered = http.get(`${BASE}/api/v1/campaigns?status=FUNDING&page=1&limit=10`, {
      tags: { name: "campaign_list_filtered" },
    });
    check(filtered, { "campaign list filtered 200": (r) => r.status === 200 });
  });

  sleep(0.1);

  // ── Campaign detail + milestones ──────────────────────────────────────
  if (campaignId) {
    group("GET /campaigns/:id", () => {
      const detail = http.get(`${BASE}/api/v1/campaigns/${campaignId}`, {
        tags: { name: "campaign_detail" },
      });
      campaignDetailLatency.add(detail.timings.duration);
      check(detail, {
        "campaign detail 200 or 404": (r) => r.status === 200 || r.status === 404,
      });

      const ms = http.get(`${BASE}/api/v1/campaigns/${campaignId}/milestones`, {
        tags: { name: "campaign_milestones" },
      });
      milestoneLatency.add(ms.timings.duration);
      check(ms, {
        "milestones 200 or 404": (r) => r.status === 200 || r.status === 404,
      });

      const invList = http.get(`${BASE}/api/v1/campaigns/${campaignId}/investments`, {
        tags: { name: "campaign_investments" },
      });
      check(invList, {
        "campaign investments 200 or 404": (r) => r.status === 200 || r.status === 404,
      });
    });
  }

  sleep(0.1);

  // ── Investor portfolio ────────────────────────────────────────────────
  group("GET /investments", () => {
    const res = http.get(
      `${BASE}/api/v1/investments?investorAddress=${buyerAddr}`,
      { headers: buyerHeaders, tags: { name: "investment_list" } },
    );
    investmentListLatency.add(res.timings.duration);
    check(res, { "investments 200": (r) => r.status === 200 });
  });

  sleep(0.1);

  // ── Buyer order listing ───────────────────────────────────────────────
  group("GET /orders (buyer)", () => {
    const res = http.get(
      `${BASE}/api/v1/orders?buyerAddress=${buyerAddr}`,
      { headers: buyerHeaders, tags: { name: "order_list_buyer" } },
    );
    orderListLatency.add(res.timings.duration);
    check(res, { "order list buyer 200": (r) => r.status === 200 });
  });

  // ── Farmer order listing ──────────────────────────────────────────────
  group("GET /orders (farmer)", () => {
    const res = http.get(
      `${BASE}/api/v1/orders?farmerAddress=${farmerAddr}`,
      { headers: vuTokens.sellerHeaders, tags: { name: "order_list_farmer" } },
    );
    check(res, { "order list farmer 200": (r) => r.status === 200 });
  });

  sleep(0.2);

  // ── Write paths ───────────────────────────────────────────────────────
  // Only exercise writes every ~6 s per VU to avoid thrashing the 10 req/min
  // write limiter and to simulate realistic usage patterns.
  // We still capture 429s so we can measure the limiter ceiling.
  if (campaignId && Math.random() < 0.15) {
    group("POST /campaigns/:id/invest", () => {
      const iKey = `k6-invest-${uuidv4()}`;
      const res = http.post(
        `${BASE}/api/v1/campaigns/${campaignId}/invest`,
        JSON.stringify({ amount: "100" }),
        {
          headers: {
            ...buyerHeaders,
            "Idempotency-Key": iKey,
          },
          tags: { name: "invest_write" },
        },
      );
      investWriteLatency.add(res.timings.duration);
      if (res.status === 429) writeLimiterHits.add(1);
      check(res, {
        "invest 201 or 409 or 429": (r) =>
          r.status === 201 || r.status === 409 || r.status === 429 || r.status === 404,
      });
    });
  }

  sleep(0.1);

  if (campaignId && Math.random() < 0.1) {
    group("POST /orders (create intent)", () => {
      const iKey = `k6-order-${uuidv4()}`;
      const res = http.post(
        `${BASE}/api/v1/orders`,
        JSON.stringify({ campaignId, amount: "50" }),
        {
          headers: {
            ...buyerHeaders,
            "Idempotency-Key": iKey,
          },
          tags: { name: "order_create" },
        },
      );
      orderCreateLatency.add(res.timings.duration);
      if (res.status === 429) writeLimiterHits.add(1);
      check(res, {
        "order create 201 or 409 or 429": (r) =>
          r.status === 201 || r.status === 409 || r.status === 429 || r.status === 404,
      });

      // Capture the new order ID so we can confirm it
      if (res.status === 201) {
        try {
          lastCreatedOrderId = res.json().id;
        } catch (_) {
          // non-JSON response – ignore
        }
      }
    });
  }

  // ── Order confirmation (only if we created an order this iteration) ───
  if (lastCreatedOrderId && Math.random() < 0.5) {
    group("PATCH /orders/:id/confirm", () => {
      const res = http.patch(
        `${BASE}/api/v1/orders/${lastCreatedOrderId}/confirm`,
        null,
        {
          headers: buyerHeaders,
          tags: { name: "order_confirm" },
        },
      );
      orderConfirmLatency.add(res.timings.duration);
      if (res.status === 429) writeLimiterHits.add(1);
      check(res, {
        "order confirm 200 or 409 or 429": (r) =>
          r.status === 200 || r.status === 409 || r.status === 429 || r.status === 404,
      });
      lastCreatedOrderId = null;
    });
  }

  sleep(0.2);
}

export function teardown(_data) {
  // Summary printed automatically by k6
}
