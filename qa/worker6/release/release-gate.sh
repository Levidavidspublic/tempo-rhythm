#!/usr/bin/env bash
# Release gate. Default is DRY (prints plan). Real run requires SCOUT_STABLE=yes AND CONFIRM=release.
set -euo pipefail
PROJECT="${1:?tempo-web|omniagent}"; PREVIEW_URL="${PREVIEW_URL:?}"; TEAM="${VERCEL_SCOPE:-UNKNOWN}"
run(){ if [[ "${CONFIRM:-}" == release ]]; then echo "+ $*"; eval "$@"; else echo "DRY: $*"; fi; }
[[ "${SCOUT_STABLE:-}" == yes ]] || { echo "STOP: Scout has not declared loops stable"; exit 3; }
PREV_PROD=$(vercel ls "$PROJECT" --scope "$TEAM" --prod 2>/dev/null | awk 'NR==2{print $2}' || echo UNKNOWN)
echo "rollback target: $PREV_PROD"
echo "Gate 1 CodeRabbit: confirm manually on release PR (no CLI gate)."
run "PREVIEW_URL=$PREVIEW_URL ../user-test/run-loop.sh release-$PROJECT"
run "npm audit --omit=dev --audit-level=high"
run "gitleaks detect --no-banner"
run "docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $PREVIEW_URL"
echo "Production promote is a merge to main by the factory; then:"
run "PREVIEW_URL=<prod-url> ../user-test/run-loop.sh prod-smoke-$PROJECT || vercel rollback $PREV_PROD --scope $TEAM"
