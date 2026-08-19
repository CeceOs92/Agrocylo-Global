/**
 * load-test/scenarios/soak-prisma.js
 *
 * Reconciliation / Prisma-query soak test.
 *
 * Purpose:
 *   Verify that the most expensive server-side database queries remain within
 *   latency SLOs under sustained concurrent load (no ramp-down safety net).
 *
 * Queries exercised:
 *
 *   server/ (port 5000)
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ GET /orders           → findMany(wallet OR) + include(product,  │
 *   │                          buyerUser, sellerUser)                  │
 *   │ GET /orders/stats/:addr → Promise.all([count × 3, dispute.count]) │
 *   │ GET /disputes         → findMany(wallet OR, deep join)          │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *   agro-production/server/ (port 5001)
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ GET /campaigns        → findMany + count (parallel)             │
 *   │ GET /campaigns/:id    → findUnique + include(investments, orders)│
 *   │ GET /investments      → findMany + include(campaign)            │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Why these queries matter for reconciliation:
 *   The contract watcher indexes on-chain events and calls wsManager.broadcast()
 *   for every order state change.  At the same time, reconciliation logic
 *   (disputed orders, settlement checks) runs the same Prisma joins as the
 *   HTTP handlers — but driven by the event queue, not HTTP requests.
 *   This soak test approximates that pattern by firing the HTTP handlers at
 *   sustained concurrency; actual reconciliation adds queue overhead on top.
 *
 * Usage:
 *   # 10-minute soak at 50 VUs (default)
 *   LOAD_PROFILE=soak k6 run load-test/scenarios/soak-prisma.js
 *
 *   # Custom duration
 *   LOAD_PROFILE=soak K6_SOAK_VUS=80 K6_SOAK_DURATION=20m \
 *     k6 run load-test/scenarios/soak-prisma.js
 *
 *   # Export results
 *   k6 run --out json=load-test/results/soak-prisma.json \
 *           load-test/scenarios/soak-prisma.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV } from "../shared/env.js";
import { buildVuTokens } from "../shared/auth.js";

// ── Custom metrics ─────────────────────────────────────────────────────────
/** Order+user+product join query latency under sustained load */
const soakOrderJoinMs      = new Trend("soak_order_join_ms",      true);
/** 4× parallel count queries (seller stats) under sustained load */
const soakSellerStatsMs    = new Trend("soak_seller_stats_ms",    true);
/** Deep dispute join: dispute→order→product+users under sustained load */
const soakDisputeJoinMs    = new Trend("soak_dispute_join_ms",    true);
/** Campaign list (count + findMany) under sustained load */
const soakCampaignListMs   = new Trend("soak_campaign_list_ms",   true);
/** Campaign detail (findUnique + includes) under sustained load */
const soakCampaignDetailMs = new Trend("soak_campaign_detail_ms", true);
/** Investment portfolio query under sustained load */
const soakInvestmentMs     = new Trend("soak_investment_ms",      true);
/** 5xx errors during soak – non-zero means the server is struggling */
const soakErrors           = new Counter("soak_5xx_total");
/** Slow queries (> 1 s response) – expected to stay near 0 */
const soakSlowQueries      = new Counter("soak_slow_query_total");

// ── Soak profile options ────────────────────────────────────────────────────
const SOAK_VUS      = ENV.K6_SOAK_VUS;       // default 50
const SOAK_DURATION = ENV.K6_SOAK_DURATION;  // default "10m"

export const options = {
  stages: [
    // Gradual warm-up so the connection pool and caches stabilise
    { duration: "2m",          target: Math.floor(SOAK_VUS * 0.3) },
    { duration: "1m",          target: SOAK_VUS },
    // Sustained hold – this is where Postgres connection exhaustion shows up
    { duration: SOAK_DURATION, target: SOAK_VUS },
    // Graceful ramp-down
    { duration: "2m",          target: 0 },
  ],
  thresholds: {
    // Soak SLOs are slightly relaxed vs. the standard load profile
    // because we are looking for slow degradation, not peak latency
    http_req_duration:      ["p(95)<800", "p(99)<1500"],
    http_req_failed:        ["rate<0.01"],
    checks:                 ["rate>0.99"],

    // Query-specific soak SLOs
    soak_order_join_ms:      ["p(95)<600",  "p(99)<1200"],
    soak_seller_stats_ms:    ["p(95)<700",  "p(99)<1400"],
    soak_dispute_join_ms:    ["p(95)<600",  "p(99)<1200"],
    soak_campaign_list_ms:   ["p(95)<500",  "p(99)<1000"],
    soak_campaign_detail_ms: ["p(95)<500",  "p(99)<1000"],
    soak_investment_ms:      ["p(95)<500",  "p(99)<1000"],

    // Zero 5xx errors across the entire soak
    soak_5xx_total:          ["count<1"],
    // Slow queries (> 1 s) must stay below 0.5 % of requests
    soak_slow_query_total:   ["count<50"],
  },
};

const BASE_SERVER = ENV.SERVER_BASE_URL;
const BASE_AGRO   = ENV.AGRO_BASE_URL;

// ── Pre-flight health check ─────────────────────────────────────────────────
export function setup() {
  const s = http.get(`${BASE_SERVER}/health`);
  const a = http.get(`${BASE_AGRO}/health`);
  if (s.status !== 200) {
    throw new Error(`server/ health check failed (${s.status}) – cannot start soak`);
  }
  if (a.status !== 200) {
    throw new Error(`agro-production/server health check failed (${a.status}) – cannot start soak`);
  }
  return {};
}

// ── VU state ─────────────────────────────────────────────────────────────
let vuTokens;

// ── Main iteration ────────────────────────────────────────────────────────
export default function (_data) {
  if (!vuTokens) {
    vuTokens = buildVuTokens();
  }

  const buyerHeaders  = vuTokens.buyerHeaders;
  const sellerHeaders = vuTokens.sellerHeaders;
  const buyerAddr     = ENV.TEST_WALLET_ADDRESS;
  const sellerAddr    = ENV.TEST_SELLER_ADDRESS;
  const campaignId    = ENV.TEST_CAMPAIGN_ID;

  // ── server/ join queries ─────────────────────────────────────────────

  group("soak:server/order-join", () => {
    // findMany(wallet OR) + include(product, buyerUser, sellerUser)
    const res = http.get(`${BASE_SERVER}/orders`, {
      headers: buyerHeaders,
      tags: { name: "soak_order_join" },
    });
    soakOrderJoinMs.add(res.timings.duration);
    if (res.status >= 500) soakErrors.add(1);
    if (res.timings.duration > 1000) soakSlowQueries.add(1);
    check(res, { "soak order join 200": (r) => r.status === 200 });
  });

  // Slight delay to avoid creating query bursts on a single Prisma connection
  sleep(0.05);

  group("soak:server/seller-stats", () => {
    // Promise.all([count, count(COMPLETED), count(REFUNDED), dispute.count])
    const res = http.get(`${BASE_SERVER}/orders/stats/${sellerAddr}`, {
      headers: sellerHeaders,
      tags: { name: "soak_seller_stats" },
    });
    soakSellerStatsMs.add(res.timings.duration);
    if (res.status >= 500) soakErrors.add(1);
    if (res.timings.duration > 1000) soakSlowQueries.add(1);
    check(res, { "soak seller stats 200": (r) => r.status === 200 });
  });

  sleep(0.05);

  group("soak:server/dispute-join", () => {
    // findMany(wallet OR, include: order.include: {product, buyerUser, sellerUser})
    const res = http.get(`${BASE_SERVER}/disputes`, {
      headers: buyerHeaders,
      tags: { name: "soak_dispute_join" },
    });
    soakDisputeJoinMs.add(res.timings.duration);
    if (res.status >= 500) soakErrors.add(1);
    if (res.timings.duration > 1000) soakSlowQueries.add(1);
    check(res, { "soak dispute join 200": (r) => r.status === 200 });
  });

  sleep(0.05);

  // ── agro-production/server/ join queries ─────────────────────────────

  group("soak:agro/campaign-list", () => {
    // Promise.all([findMany + _count, count])
    const res = http.get(`${BASE_AGRO}/api/v1/campaigns?page=1&limit=20`, {
      tags: { name: "soak_campaign_list" },
    });
    soakCampaignListMs.add(res.timings.duration);
    if (res.status >= 500) soakErrors.add(1);
    if (res.timings.duration > 1000) soakSlowQueries.add(1);
    check(res, { "soak campaign list 200": (r) => r.status === 200 });
  });

  sleep(0.05);

  if (campaignId) {
    group("soak:agro/campaign-detail", () => {
      // findUnique + include(investments, orders)
      const res = http.get(`${BASE_AGRO}/api/v1/campaigns/${campaignId}`, {
        tags: { name: "soak_campaign_detail" },
      });
      soakCampaignDetailMs.add(res.timings.duration);
      if (res.status >= 500) soakErrors.add(1);
      if (res.timings.duration > 1000) soakSlowQueries.add(1);
      check(res, {
        "soak campaign detail 200 or 404": (r) => r.status === 200 || r.status === 404,
      });
    });

    sleep(0.05);
  }

  group("soak:agro/investments", () => {
    // findMany(investorAddress) + include(campaign)
    const res = http.get(
      `${BASE_AGRO}/api/v1/investments?investorAddress=${buyerAddr}`,
      { headers: buyerHeaders, tags: { name: "soak_investment_portfolio" } },
    );
    soakInvestmentMs.add(res.timings.duration);
    if (res.status >= 500) soakErrors.add(1);
    if (res.timings.duration > 1000) soakSlowQueries.add(1);
    check(res, { "soak investments 200": (r) => r.status === 200 });
  });

  // Thinking time between iterations – simulates realistic user pacing
  // and prevents the soak from pinning the Postgres connection pool
  sleep(0.3 + Math.random() * 0.2);
}
