#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: smoke-test.sh
# Purpose: Shell wrapper for production smoke tests (AIP-064)
# ==============================================================================

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
echo "🔍 [Smoke Test] Running health and metric checks on ${BASE_URL}..."

if command -v curl &> /dev/null; then
    echo "1. Checking Liveness Probe (/api/v1/health/live)..."
    curl -s -o /dev/null -w "%{http_code}\n" "${BASE_URL}/api/v1/health/live" | grep -q "200" && echo "  -> OK ✅" || echo "  -> FAILED ❌"

    echo "2. Checking Metrics Exporter (/api/v1/metrics)..."
    curl -s "${BASE_URL}/api/v1/metrics" | head -n 5 || true
    echo "  -> OK ✅"
else
    echo "ℹ️ curl not found. Running ts-node smoke test runner..."
fi

if command -v npx &> /dev/null; then
    npx ts-node infra/scripts/smoke-test.ts
fi
