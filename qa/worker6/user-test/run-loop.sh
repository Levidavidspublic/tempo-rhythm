#!/usr/bin/env bash
# Per-loop user test. Usage: PREVIEW_URL=https://... [VERCEL_BYPASS via `op run`] ./run-loop.sh <ticket-id>
# Inject secret by reference: op run --env-file=.env.op.tempo -- ./run-loop.sh T-1  (or .env.op.omniagent). op masks the value in output.
set -euo pipefail
cd "$(dirname "$0")"
: "${PREVIEW_URL:?set PREVIEW_URL to the integration preview URL}"
TICKET="${1:-UNKNOWN}"
rm -rf results && mkdir -p results
code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 ${VERCEL_BYPASS:+-H "x-vercel-protection-bypass: $VERCEL_BYPASS"} "$PREVIEW_URL")
echo "preflight HTTP $code"
if [[ "$code" == 401 || "$code" == 302 || "$code" == 403 ]]; then echo "BLOCKED: preview is protected; inject VERCEL_BYPASS from 1Password dev vault"; exit 2; fi
export MONKEY_SEED="${MONKEY_SEED:-$RANDOM}"; echo "monkey seed $MONKEY_SEED"
pw=0; npx playwright test --reporter=list || pw=$?
fails=$(grep -c '"pass":false' results/verdicts.jsonl || true)
total=$(wc -l < results/verdicts.jsonl)
if [[ "$pw" -ne 0 ]]; then echo "TICKET $TICKET: send back for rewrite (playwright test failed, exit $pw)"; exit 1; fi
if [[ "$fails" -gt 0 ]]; then echo "TICKET $TICKET: send back for rewrite ($fails/$total checks NO)"; exit 1
else echo "TICKET $TICKET: PASS ($total checks YES)"; fi
