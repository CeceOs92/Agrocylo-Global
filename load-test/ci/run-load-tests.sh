#!/usr/bin/env bash
# load-test/ci/run-load-tests.sh
#
# CI wrapper that runs all k6 scenarios and fails the pipeline if any
# threshold is breached.  Designed to be called from a GitHub Actions job
# after a staging environment is healthy.
#
# Usage:
#   LOAD_PROFILE=smoke load-test/ci/run-load-tests.sh
#   LOAD_PROFILE=load  SERVER_BASE_URL=http://staging:5000 \
#                      AGRO_BASE_URL=http://staging:5001   \
#                      load-test/ci/run-load-tests.sh
#
# Exit codes:
#   0 – all scenarios passed all thresholds
#   1 – one or more scenarios breached a threshold (details in results/)
#   2 – k6 not found, or pre-flight health check failed
#
# Environment variables (all optional with defaults):
#   SERVER_BASE_URL   http://localhost:5000
#   AGRO_BASE_URL     http://localhost:5001
#   JWT_SECRET        dev-secret-key-minimum32chars!!
#   LOAD_PROFILE      smoke | load | soak  (default: smoke)
#   K6_LOAD_VUS       100
#   K6_SOAK_VUS       50
#   K6_SOAK_DURATION  10m
#   SKIP_WEBSOCKET    1  (set to skip WS tests, e.g. when a WS server is not available)
#   SKIP_SOAK         1  (set to skip the long soak – typical for PR smoke gates)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCENARIOS_DIR="${REPO_ROOT}/load-test/scenarios"
RESULTS_DIR="${REPO_ROOT}/load-test/results"

# ── Defaults ────────────────────────────────────────────────────────────────
export SERVER_BASE_URL="${SERVER_BASE_URL:-http://localhost:5000}"
export AGRO_BASE_URL="${AGRO_BASE_URL:-http://localhost:5001}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-key-minimum32chars!!}"
export LOAD_PROFILE="${LOAD_PROFILE:-smoke}"
export K6_LOAD_VUS="${K6_LOAD_VUS:-100}"
export K6_SOAK_VUS="${K6_SOAK_VUS:-50}"
export K6_SOAK_DURATION="${K6_SOAK_DURATION:-10m}"
SKIP_WEBSOCKET="${SKIP_WEBSOCKET:-0}"
SKIP_SOAK="${SKIP_SOAK:-0}"

mkdir -p "${RESULTS_DIR}"

# ── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Verify k6 is installed ───────────────────────────────────────────────────
if ! command -v k6 &>/dev/null; then
  log_error "k6 is not installed.  See https://k6.io/docs/get-started/installation/"
  exit 2
fi

K6_VERSION="$(k6 version 2>&1 | head -1)"
log_info "Using ${K6_VERSION}"

# ── Pre-flight health checks ─────────────────────────────────────────────────
log_info "Pre-flight: checking ${SERVER_BASE_URL}/health ..."
SERVER_STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 "${SERVER_BASE_URL}/health" || echo "000")"
if [ "${SERVER_STATUS}" != "200" ]; then
  log_error "server/ health check returned ${SERVER_STATUS}.  Is the server running?"
  exit 2
fi
log_info "server/ is UP (HTTP ${SERVER_STATUS})"

log_info "Pre-flight: checking ${AGRO_BASE_URL}/health ..."
AGRO_STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 "${AGRO_BASE_URL}/health" || echo "000")"
if [ "${AGRO_STATUS}" != "200" ]; then
  log_error "agro-production/server health check returned ${AGRO_STATUS}.  Is the server running?"
  exit 2
fi
log_info "agro-production/server is UP (HTTP ${AGRO_STATUS})"

# ── Scenario runner ──────────────────────────────────────────────────────────
FAILED_SCENARIOS=()

run_scenario() {
  local name="$1"
  local script="$2"
  local out="${RESULTS_DIR}/${name}-${LOAD_PROFILE}.json"

  log_info "────────────────────────────────────────────────────────"
  log_info "Running scenario: ${name} (profile=${LOAD_PROFILE})"
  log_info "────────────────────────────────────────────────────────"

  if k6 run \
    --out "json=${out}" \
    --summary-export "${RESULTS_DIR}/${name}-${LOAD_PROFILE}-summary.json" \
    "${script}"; then
    log_info "✓ ${name} – all thresholds passed"
  else
    log_error "✗ ${name} – threshold breach detected (see ${out})"
    FAILED_SCENARIOS+=("${name}")
  fi
}

# ── Run scenarios ────────────────────────────────────────────────────────────

log_info "Load profile: ${LOAD_PROFILE}"
echo

run_scenario "server-http"          "${SCENARIOS_DIR}/server-http.js"
run_scenario "agro-production-http" "${SCENARIOS_DIR}/agro-production-http.js"

if [ "${SKIP_WEBSOCKET}" != "1" ]; then
  run_scenario "websocket-churn" "${SCENARIOS_DIR}/websocket-churn.js"
else
  log_warn "SKIP_WEBSOCKET=1 – skipping WebSocket scenario"
fi

if [ "${SKIP_SOAK}" != "1" ] && [ "${LOAD_PROFILE}" = "soak" ]; then
  run_scenario "soak-prisma" "${SCENARIOS_DIR}/soak-prisma.js"
elif [ "${LOAD_PROFILE}" != "soak" ]; then
  log_info "Soak scenario skipped (LOAD_PROFILE=${LOAD_PROFILE}; set LOAD_PROFILE=soak to enable)"
else
  log_warn "SKIP_SOAK=1 – skipping Prisma soak scenario"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo
log_info "════════════════════════════════════════════════════════"
if [ "${#FAILED_SCENARIOS[@]}" -eq 0 ]; then
  log_info "✓  All load-test scenarios passed."
  log_info "   Results written to: ${RESULTS_DIR}/"
  exit 0
else
  log_error "✗  The following scenarios breached one or more thresholds:"
  for s in "${FAILED_SCENARIOS[@]}"; do
    log_error "   - ${s}"
  done
  log_error "   Full results: ${RESULTS_DIR}/"
  exit 1
fi
