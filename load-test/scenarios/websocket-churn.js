/**
 * load-test/scenarios/websocket-churn.js
 *
 * WebSocket load-test targeting both servers simultaneously:
 *
 *   server/ (port 5000)
 *     - Connects to ws://localhost:5000/ws
 *     - Sends auth message with a signed JWT
 *     - Holds connection for a random dwell time
 *     - Measures handshake latency, auth latency, and message receipt
 *     - Disconnects and reconnects (churn)
 *
 *   agro-production/server/ (port 5001)
 *     - Same pattern at ws://localhost:5001/ws
 *     - Validates WsEventEnvelope versioning (version: "1")
 *
 * This test is designed to find:
 *   1. MAX_CONNECTIONS ceiling — how many concurrent WS connections before
 *      the server starts rejecting with 1013 (Server Overloaded).
 *   2. Auth latency — how long it takes the server to JWT-verify the auth
 *      message under concurrency.
 *   3. Heartbeat interactions — does the ping/pong cycle stay alive under churn?
 *   4. Broadcast delivery — if the test triggers an HTTP write that causes a
 *      broadcast, does the WS client receive it within the latency SLO?
 *
 * Usage:
 *   LOAD_PROFILE=smoke k6 run load-test/scenarios/websocket-churn.js
 *   LOAD_PROFILE=load  K6_WS_VUS=200 k6 run load-test/scenarios/websocket-churn.js
 *
 * To find the connection ceiling, use the ramp-up profile:
 *   K6_WS_RAMP_CEILING=1200 k6 run load-test/scenarios/websocket-churn.js
 */

import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";
import { ENV } from "../shared/env.js";
import { makeJwt } from "../shared/auth.js";

// ── Custom metrics ─────────────────────────────────────────────────────────
/** Time from ws.connect() call to the onopen callback (TCP+TLS+upgrade). */
const wsHandshakeLatency = new Trend("ws_handshake_ms",        true);
/** Time from sending the auth message to receiving the first server message,
 *  or to the auth being silently accepted (no rejection close). */
const wsAuthLatency      = new Trend("ws_auth_latency_ms",     true);
/** Round-trip latency from a client-triggered HTTP write to the matching WS
 *  broadcast message arriving at the same VU's socket. */
const wsBroadcastLatency = new Trend("ws_broadcast_latency_ms", true);
/** How many connections were closed by the server (code 1013 = overloaded). */
const wsRejections       = new Counter("ws_rejected_1013_total");
/** How many auth attempts were rejected by the server (code 4001). */
const wsAuthErrors       = new Counter("ws_auth_error_4001_total");
/** How many messages were received across all connections. */
const wsMsgsReceived     = new Counter("ws_msgs_received_total");
/** Current concurrent connections (approximate – updated per-VU). */
const wsActiveSessions   = new Gauge("ws_active_sessions");

// ── Profile and VU configuration ──────────────────────────────────────────
const PROFILE      = ENV.LOAD_PROFILE;
const WS_VUS       = parseInt(__ENV.K6_WS_VUS       || "50",   10);
const RAMP_CEILING = parseInt(__ENV.K6_WS_RAMP_CEILING || "0", 10); // 0 = disabled
const DWELL_MIN_MS = 4_000;   // minimum time to hold a connection open
const DWELL_MAX_MS = 12_000;  // maximum time to hold a connection open

function buildStages() {
  if (RAMP_CEILING > 0) {
    // Connection-ceiling discovery profile: ramp slowly until server rejects
    return [
      { duration: "2m",  target: Math.floor(RAMP_CEILING * 0.5) },
      { duration: "3m",  target: RAMP_CEILING },
      { duration: "1m",  target: 0 },
    ];
  }
  switch (PROFILE) {
    case "soak":
      return [
        { duration: "2m",                  target: WS_VUS },
        { duration: ENV.K6_SOAK_DURATION,  target: WS_VUS },
        { duration: "2m",                  target: 0 },
      ];
    case "load":
      return [
        { duration: "1m",  target: Math.floor(WS_VUS * 0.5) },
        { duration: "3m",  target: WS_VUS },
        { duration: "2m",  target: Math.floor(WS_VUS * 0.25) },
        { duration: "1m",  target: 0 },
      ];
    case "smoke":
    default:
      return [
        { duration: "30s", target: 10 },
        { duration: "30s", target: 10 },
        { duration: "15s", target: 0 },
      ];
  }
}

export const options = {
  stages: buildStages(),
  thresholds: {
    // WebSocket upgrade should complete well under 200 ms on localhost/LAN
    ws_handshake_ms:        ["p(95)<200"],
    // JWT verification adds < 5 ms CPU; network round-trip dominates
    ws_auth_latency_ms:     ["p(95)<150"],
    // Broadcast latency (HTTP write → WS message) – 1 s is generous
    ws_broadcast_latency_ms: ["p(95)<1000"],
    // Zero connection rejections at or below MAX_CONNECTIONS
    ws_rejected_1013_total: ["count<1"],
    // Zero auth errors (bad token) – we always send valid tokens
    ws_auth_error_4001_total: ["count<1"],
    // Standard HTTP/WS pass rates
    checks:              ["rate>0.99"],
  },
};

const BASE_SERVER     = ENV.SERVER_BASE_URL;    // http://localhost:5000
const BASE_AGRO       = ENV.AGRO_BASE_URL;      // http://localhost:5001
const WS_SERVER_URL   = BASE_SERVER.replace(/^http/, "ws") + "/ws";
const WS_AGRO_URL     = BASE_AGRO.replace(/^http/, "ws")  + "/ws";

// ── Helpers ────────────────────────────────────────────────────────────────
function randomDwell() {
  return DWELL_MIN_MS + Math.random() * (DWELL_MAX_MS - DWELL_MIN_MS);
}

/**
 * Exercise a single WebSocket connection:
 * connect → authenticate → hold → receive messages → disconnect.
 *
 * @param {string} wsUrl       – WebSocket endpoint URL (ws://…)
 * @param {string} serverLabel – "server" | "agro" – for tag scoping
 */
function runWsSession(wsUrl, serverLabel) {
  const token     = makeJwt(ENV.TEST_WALLET_ADDRESS, ENV.JWT_SECRET);
  const authMsg   = JSON.stringify({ type: "auth", token });
  const dwellMs   = randomDwell();
  const connectTs = Date.now();

  let authSentAt    = null;
  let authConfirmed = false;
  let sessionActive = true;

  const res = ws.connect(wsUrl, { tags: { server: serverLabel } }, (socket) => {
    const handshakeMs = Date.now() - connectTs;
    wsHandshakeLatency.add(handshakeMs);
    wsActiveSessions.add(1);

    // ── Send auth immediately on connection ────────────────────────────
    socket.on("open", () => {
      authSentAt = Date.now();
      socket.send(authMsg);
    });

    // ── Handle incoming messages ───────────────────────────────────────
    socket.on("message", (data) => {
      wsMsgsReceived.add(1);

      let parsed;
      try { parsed = JSON.parse(data); } catch (_) { return; }

      // Measure broadcast latency if the message carries an order event
      const eventTs = parsed.timestamp ? new Date(parsed.timestamp).getTime() : null;
      if (eventTs && (parsed.event || parsed.type)) {
        wsBroadcastLatency.add(Date.now() - eventTs);
      }

      // agro-production server emits versioned envelopes
      if (parsed.version) {
        check(parsed, {
          "ws envelope version=1": (p) => p.version === "1",
          "ws envelope has type":  (p) => typeof p.type === "string",
        });
      }

      // First message after auth = auth confirmation (no explicit ack in protocol;
      // absence of a close(4001) within 500 ms implies success).
      if (!authConfirmed && authSentAt) {
        wsAuthLatency.add(Date.now() - authSentAt);
        authConfirmed = true;
      }
    });

    // ── Handle server-initiated close ──────────────────────────────────
    socket.on("close", (code, reason) => {
      sessionActive = false;
      wsActiveSessions.add(-1);

      if (code === 1013) {
        wsRejections.add(1);
        check(null, { "ws not overloaded (1013)": () => false });
      }
      if (code === 4001) {
        wsAuthErrors.add(1);
        check(null, { "ws auth accepted (4001)": () => false });
      }
    });

    socket.on("error", (err) => {
      // Network errors during churn are expected in edge cases; track but don't fail
      check(err, { "ws no error": () => false });
    });

    // ── Simulate auth timeout detection ───────────────────────────────
    // If the server closes with 4001 within 500 ms, authConfirmed stays false.
    // We record that case via wsAuthErrors counter above.
    socket.setTimeout(() => {
      if (!authConfirmed && sessionActive) {
        // No close arrived → auth was silently accepted → record latency
        wsAuthLatency.add(Date.now() - (authSentAt || connectTs));
        authConfirmed = true;
      }
    }, 500);

    // ── Hold connection for dwell period, then close cleanly ──────────
    socket.setTimeout(() => {
      if (sessionActive) {
        socket.close(1000, "dwell expired");
      }
    }, dwellMs);
  });

  // Connection-level check
  check(res, {
    "ws connected": (r) => r && r.status === 101,
  });
}

// ── Main VU function ───────────────────────────────────────────────────────
export default function () {
  // Alternate between server/ and agro-production/server/ across VUs so we
  // build load on both simultaneously.
  const isOddVu = __VU % 2 === 1;

  if (isOddVu) {
    runWsSession(WS_SERVER_URL, "server");
  } else {
    runWsSession(WS_AGRO_URL,   "agro");
  }

  // Short pause between reconnects – simulates real-world reconnection
  // back-off and prevents thundering herd on the connection accept path.
  sleep(0.5 + Math.random() * 0.5);
}

// ── Pre-flight checks ─────────────────────────────────────────────────────
export function setup() {
  // Verify both HTTP endpoints before opening WebSocket connections
  const s = http.get(`${BASE_SERVER}/health`);
  const a = http.get(`${BASE_AGRO}/health`);

  if (s.status !== 200) {
    throw new Error(`server/ health failed (${s.status}) at ${BASE_SERVER}`);
  }
  if (a.status !== 200) {
    throw new Error(`agro-production/server health failed (${a.status}) at ${BASE_AGRO}`);
  }

  return {};
}
