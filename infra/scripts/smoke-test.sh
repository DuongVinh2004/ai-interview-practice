#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: smoke-test.sh
# Purpose: Shell wrapper for production smoke tests (AIP-064)
# ==============================================================================

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
echo "🔍 [Smoke Test] Running health and observability-boundary checks on ${BASE_URL}..."

if command -v curl &> /dev/null; then
    echo "1. Checking Liveness Probe (/api/v1/health/live)..."
    curl -s -o /dev/null -w "%{http_code}\n" "${BASE_URL}/api/v1/health/live" | grep -q "200" && echo "  -> OK ✅" || echo "  -> FAILED ❌"

    echo "2. Checking that public metrics are blocked (/api/v1/metrics)..."
    METRICS_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/metrics")"
    test "${METRICS_STATUS}" = "404" && echo "  -> BLOCKED ✅" || { echo "  -> FAILED (${METRICS_STATUS}) ❌"; exit 1; }

    if [[ -n "${PRIVATE_METRICS_URL:-}" && -n "${METRICS_AUTH_TOKEN:-}" ]]; then
        echo "3. Checking that private metrics reject anonymous requests..."
        PRIVATE_ANON_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${PRIVATE_METRICS_URL}")"
        test "${PRIVATE_ANON_STATUS}" = "401" && echo "  -> REJECTED ✅" || { echo "  -> FAILED (${PRIVATE_ANON_STATUS}) ❌"; exit 1; }
        echo "4. Checking authenticated private metrics exporter..."
        curl -fsS -o /dev/null -H "Authorization: Bearer ${METRICS_AUTH_TOKEN}" "${PRIVATE_METRICS_URL}"
        echo "  -> OK ✅"
    elif [[ "${REQUIRE_PRIVATE_METRICS_SMOKE:-false}" == "true" ]]; then
        echo "  -> FAILED: deployment acceptance requires PRIVATE_METRICS_URL and METRICS_AUTH_TOKEN ❌"
        exit 1
    fi
else
    echo "ℹ️ curl not found. Running ts-node smoke test runner..."
fi

if command -v npx &> /dev/null; then
    npx ts-node infra/scripts/smoke-test.ts
fi
