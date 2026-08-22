#!/usr/bin/env bash
set -euo pipefail

# Smoke-test script for post-deploy verification.
# Usage: ./scripts/smoke-test.sh <base_url>
# Example: ./scripts/smoke-test.sh https://agrocylo-staging.fly.dev

BASE_URL="${1:?Usage: smoke-test.sh <base_url>}"
FAILURES=0

check() {
  local name="$1" url="$2" expected_code="${3:-200}"
  printf "%-40s " "$name"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" || true)
  if [ "$code" = "$expected_code" ]; then
    echo "OK ($code)"
  else
    echo "FAIL (expected $expected_code, got $code)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "=== Smoke tests against $BASE_URL ==="
echo ""

check "Root marketplace backend /health"  "$BASE_URL/server/health"
check "Agro-production backend /health"   "$BASE_URL/agro-server/health"
check "Root marketplace client"           "$BASE_URL/client/"
check "Agro-production client"            "$BASE_URL/agro-client/"

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "FAILED: $FAILURES check(s) failed"
  exit 1
else
  echo "ALL PASSED"
fi
