/**
 * Concurrent Read-Write Load Test Scenario
 *
 * Simulates production-realistic workload: simultaneous read-heavy browsing
 * (campaign listing with pagination + aggregate joins) and write-heavy indexing
 * (sustained Soroban event throughput from the contract watcher).
 *
 * This tests whether the database indexes (from #795) and connection pooling
 * can handle concurrent load without degradation or transaction deadlocks.
 *
 * Usage:
 *   LOAD_PROFILE=smoke k6 run load-test/scenarios/concurrent-read-write.js
 *   LOAD_PROFILE=load k6 run load-test/scenarios/concurrent-read-write.js
 *   LOAD_PROFILE=soak K6_SOAK_DURATION=30m k6 run load-test/scenarios/concurrent-read-write.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { buildStages } from "../config/thresholds.js";
import { ENV } from "../shared/env.js";

export const options = {
  scenarios: {
    // Read-heavy browsers (50 VUs browsing campaigns)
    campaign_browsers: {
      executor: "constant-vus",
      vus: ENV.LOAD_PROFILE === "smoke" ? 5 : 50,
      duration: ENV.LOAD_PROFILE === "smoke" ? "5m" : ENV.LOAD_PROFILE === "load" ? "30m" : ENV.K6_SOAK_DURATION,
      exec: "campaignListingLoad",
      startTime: "0s",
    },
    // Write-heavy indexer (20 VUs simulating blockchain event indexing)
    indexer_writes: {
      executor: "constant-vus",
      vus: ENV.LOAD_PROFILE === "smoke" ? 2 : 20,
      duration: ENV.LOAD_PROFILE === "smoke" ? "5m" : ENV.LOAD_PROFILE === "load" ? "30m" : ENV.K6_SOAK_DURATION,
      exec: "indexerEventWrites",
      startTime: "0s",
    },
  },
  thresholds: {
    // Read path latency SLOs (from DATABASE_PRODUCTION_READINESS.md)
    "http_req_duration{path:/campaigns}": ["p(95) < 500", "p(99) < 1000"],
    "http_req_duration{path:/investments}": ["p(95) < 200", "p(99) < 500"],
    // Write path latency SLOs
    "http_req_duration{path:/transactions}": ["p(95) < 200"],
    // Global error rate
    "http_req_failed": ["rate < 0.01"], // < 1%
    // Checks (assertions)
    "checks": ["rate > 0.95"], // 95%+ pass rate
  },
};

/**
 * Simulates read-heavy campaign browsing: pagination + aggregate joins.
 * Runs for the test duration, fetching campaigns with different page offsets
 * to exercise the campaign listing index and connection pooling under read load.
 */
export function campaignListingLoad() {
  const baseUrl = ENV.SERVER_BASE_URL;
  const pages = [1, 2, 3, 4, 5]; // Paginate through first 5 pages
  const page = pages[Math.floor(Math.random() * pages.length)];
  const offset = (page - 1) * 20;

  group("Campaign Listing (Read-Heavy)", () => {
    // Fetch campaign listings with pagination
    // This query pattern exercises the idx_campaigns_status_created_desc index
    const campaignsRes = http.get(
      `${baseUrl}/campaigns?status=Active&page=${page}&limit=20`,
      {
        tags: { name: "CampaignList" },
      }
    );

    check(campaignsRes, {
      "Campaign list status 200": (r) => r.status === 200,
      "Campaign list has pagination": (r) => r.body.includes("pagination"),
      "Campaign list latency < 500ms": (r) => r.timings.duration < 500,
    });

    // If campaigns returned, fetch investment details for one campaign
    // This exercises the idx_investments_investor_address_created_desc index
    if (campaignsRes.status === 200) {
      const investmentsRes = http.get(
        `${baseUrl}/investments?campaign=active&limit=50`,
        {
          tags: { name: "InvestmentList" },
        }
      );

      check(investmentsRes, {
        "Investment list status 200": (r) => r.status === 200,
        "Investment list latency < 200ms": (r) => r.timings.duration < 200,
      });
    }

    // Occasional  slow client: simulate occasional real-world latency variance
    if (Math.random() < 0.05) {
      sleep(1); // 5% of clients add extra think time
    } else {
      sleep(0.2); // Normal think time between requests
    }
  });
}

/**
 * Simulates write-heavy blockchain event indexing: sustained BlockchainTransaction
 * writes from the Soroban contract watcher.
 *
 * This tests whether write performance remains acceptable under concurrent read load,
 * and whether the connection pool can handle the mixed workload without deadlocks.
 */
export function indexerEventWrites() {
  const baseUrl = ENV.SERVER_BASE_URL;

  group("Indexer Event Writes (Write-Heavy)", () => {
    // Simulate a blockchain event (e.g., from Soroban contract watcher)
    // Each "event" creates a BlockchainTransaction record with ledger + eventIndex
    const eventPayload = {
      sourceEventId: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: "OrderCreated",
      entity: "Order",
      action: "create_order",
      ledger: Math.floor(Math.random() * 1000000),
      eventIndex: Math.floor(Math.random() * 1000),
      orderIdOnChain: `order-${Math.random().toString(36).substr(2, 9)}`,
      payload: {
        buyer: `GBBUYER${Math.random().toString(36).substr(2, 40)}`,
        seller: `GBSELLER${Math.random().toString(36).substr(2, 40)}`,
        amount: String(Math.random() * 10000),
      },
    };

    const createTxRes = http.post(
      `${baseUrl}/admin/indexer/events`,
      JSON.stringify(eventPayload),
      {
        headers: { "Content-Type": "application/json" },
        tags: { name: "IndexerWrite" },
      }
    );

    check(createTxRes, {
      "Event write status 201/200": (r) => r.status === 200 || r.status === 201,
      "Event write latency < 200ms": (r) => r.timings.duration < 200,
      "Event write no duplicate errors": (r) => !r.body.includes("Unique constraint"),
    });

    // Occasionally fetch recent transactions to verify write visibility
    if (Math.random() < 0.2) {
      const readTxRes = http.get(
        `${baseUrl}/admin/indexer/transactions?limit=10&order=desc`,
        {
          tags: { name: "IndexerRead" },
        }
      );

      check(readTxRes, {
        "Recent transactions readable": (r) => r.status === 200,
        "Transactions latency < 100ms": (r) => r.timings.duration < 100,
      });
    }

    // Indexer think time: simulate batch processing delay (events arrive in batches every ~100ms)
    sleep(0.1);
  });
}

/**
 * Optional: POST endpoint to create transactions (for indexer simulation).
 * Endpoint would be something like: POST /admin/indexer/events
 * This is a placeholder for where such an endpoint would live; actual implementation
 * depends on your indexer architecture.
 */
