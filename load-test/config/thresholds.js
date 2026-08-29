/**
 * load-test/config/thresholds.js
 *
 * Shared pass/fail thresholds and stage helpers used by every scenario.
 *
 * Thresholds are set conservatively for a single-node staging instance.
 * Tighten them once you have baseline numbers from a first successful run.
 *
 * Rationale for each value:
 *
 *  http_req_duration p(95) < 500 ms
 *      Order/escrow reads must complete well under a 1-second user-perceived
 *      deadline.  500 ms at p95 leaves headroom for network jitter.
 *
 *  http_req_failed < 1 %
 *      A 1 % error budget at load prevents false-alarm alerting from
 *      transient timeouts while still catching regressions.
 *
 *  ws_connecting p(95) < 200 ms
 *      WebSocket upgrade adds a round-trip on top of the TCP handshake.
 *      200 ms is already generous for a local/staging network.
 *
 *  checks > 99 %
 *      Every scenario has inline check() assertions.  This threshold ensures
 *      they are green even under sustained load.
 */

export const THRESHOLDS = {
  // ── HTTP ──────────────────────────────────────────────────────────────────
  http_req_duration: ["p(95)<500", "p(99)<1000"],
  http_req_failed:   ["rate<0.01"],

  // ── WebSocket ─────────────────────────────────────────────────────────────
  ws_connecting:     ["p(95)<200"],

  // ── Global check pass rate ────────────────────────────────────────────────
  checks:            ["rate>0.99"],
};

/**
 * Build a k6 stages array for the three canonical load profiles.
 *
 * smoke  – quick sanity: 5 VUs for 1 minute.
 * load   – capacity check: ramp to N VUs, hold, then ramp down.
 * soak   – sustained pressure: constant M VUs for a long window.
 *
 * @param {object} opts
 * @param {string} opts.profile  – "smoke" | "load" | "soak"
 * @param {number} opts.loadVus  – peak VUs for load profile
 * @param {number} opts.soakVus  – VUs for soak profile
 * @param {string} opts.soakDuration – k6 duration string (e.g. "10m")
 * @returns {{ stages: Array<{duration: string, target: number}>, thresholds: object }}
 */
export function buildStages({ profile, loadVus, soakVus, soakDuration }) {
  switch (profile) {
    case "soak":
      return {
        stages: [
          { duration: "2m",          target: soakVus },
          { duration: soakDuration,  target: soakVus },
          { duration: "2m",          target: 0 },
        ],
        thresholds: {
          ...THRESHOLDS,
          // Tighter error rate over sustained run
          http_req_failed: ["rate<0.005"],
        },
      };

    case "load":
      return {
        stages: [
          { duration: "1m",  target: Math.floor(loadVus * 0.5) },  // ramp-up
          { duration: "3m",  target: loadVus },                     // peak hold
          { duration: "2m",  target: Math.floor(loadVus * 0.25) }, // step-down
          { duration: "1m",  target: 0 },                           // drain
        ],
        thresholds: THRESHOLDS,
      };

    case "smoke":
    default:
      return {
        stages: [
          { duration: "30s", target: 5 },
          { duration: "30s", target: 5 },
          { duration: "10s", target: 0 },
        ],
        thresholds: THRESHOLDS,
      };
  }
}
