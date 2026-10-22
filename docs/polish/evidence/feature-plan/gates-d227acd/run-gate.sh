#!/bin/bash
set +e
if [ "${1:-}" != '--granted' ]; then
  printf '%s\n' 'Heavy-slot grant is required; no command started.'
  exit 78
fi
stage="${2:-}"
case "$stage" in
  test|scans) minimum_kb=524288 ;;
  e2e|build) minimum_kb=2097152 ;;
  *) printf '%s\n' 'Expected test, scans, e2e, or build.'; exit 64 ;;
esac
export PATH=/workspace/work/kb/bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/kb/browsers
cd /workspace/work/lane2-recovery || exit 1
log_dir=/workspace/work/overnight/plan-gates/d227acd
expected_head=d227acd39fb4c20bae025dd1601106f1a32125ca
if [ "$(git rev-parse HEAD)" != "$expected_head" ] || [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Head or clean worktree changed; no command started.'
  exit 78
fi
if [ "$(bun --version)" != 1.3.9 ]; then
  printf '%s\n' 'Bun version changed; no command started.'
  exit 78
fi
if [ -n "${PLAYWRIGHT_BASE_URL:-}" ] || [ -n "${TEMPO_E2E_STORAGE_STATE:-}" ]; then
  printf '%s\n' 'Live URL or account storage is set; no command started.'
  exit 78
fi
if [ "$stage" = scans ]; then
  steps='scan-forbidden-tech scan-ram-only-audit scan-design-tokens check-notices'
else
  steps="$stage"
fi
for gate_name in $steps; do
  if [ -e "$log_dir/$gate_name.exit" ] || [ -e "$log_dir/$gate_name.log" ] || [ -e "$log_dir/$gate_name.json" ]; then
    printf '%s\n' 'Existing gate receipt preserved; no retry started.'
    exit 78
  fi
done
df -Pk /workspace > "$log_dir/$stage.disk-before.txt"
available_kb=$(awk 'NR==2 { print $4 }' "$log_dir/$stage.disk-before.txt")
if [ "$available_kb" -lt "$minimum_kb" ]; then
  printf 'Insufficient free space for %s; no command started.\n' "$stage"
  exit 78
fi
if [ "$stage" = e2e ] || [ "$stage" = build ]; then
  if [ -n "$(ss -H -ltnp '( sport = :3000 )')" ]; then
    printf '%s\n' 'Localhost3000 occupied; verify ownership before proceeding. No command started.'
    exit 78
  fi
fi
failed=0
for gate_name in $steps; do
  case "$gate_name" in
    test) gate_command='bun run test' ;;
    scan-forbidden-tech) gate_command='bun run scan:forbidden-tech' ;;
    scan-ram-only-audit) gate_command='bun run scan:ram-only-audit' ;;
    scan-design-tokens) gate_command='bun run scan:design-tokens' ;;
    check-notices) gate_command='bun run check:notices' ;;
    e2e) gate_command='CI=1 bunx playwright test --reporter=line' ;;
    build) gate_command='NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build' ;;
  esac
  gate_start=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  gate_start_seconds=$(date +%s)
  bash -c "$gate_command" > "$log_dir/$gate_name.log" 2>&1
  gate_exit=$?
  gate_end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  gate_elapsed=$(( $(date +%s) - gate_start_seconds ))
  printf '{"command":"%s","exit":%s,"startedAt":"%s","endedAt":"%s","elapsedSeconds":%s,"head":"%s"}\n' "$gate_command" "$gate_exit" "$gate_start" "$gate_end" "$gate_elapsed" "$expected_head" > "$log_dir/$gate_name.json"
  printf '%s\n' "$gate_exit" > "$log_dir/$gate_name.exit"
  tail -20 "$log_dir/$gate_name.log" > "$log_dir/$gate_name.tail.txt"
  cat "$log_dir/$gate_name.tail.txt"
  printf '%s exit %s\n' "$gate_name" "$gate_exit"
  if [ "$gate_exit" -ne 0 ]; then failed=1; fi
done
df -Pk /workspace > "$log_dir/$stage.disk-after.txt"
exit "$failed"
