# Plan mandatory local validation

Source: `d227acd39fb4c20bae025dd1601106f1a32125ca`, rebased onto integration `7d1a0f6`. Gates ran 21 October 2026 UTC. Evidence finalized 22 October 2026 UTC. Original implementation patch, source and tests remain frozen after three candidates. No fourth repair, unchanged failing retry, test weakening, configuration edit, hosted-backend use or deployment occurred. The heavy slot was released to the lead immediately after build exit and owned-process verification.

## Test results (cloud agent sandbox)

Bun 1.3.9; existing local Chromium through the prepared Playwright browser cache. All commands ran from the repository root in mandatory order, continuing after failures; the four scans each ran independently. Final-head static checks were already complete before the serialized remaining gates.

| Command | Result |
| --- | --- |
| `bun --version` | 1.3.9 |
| `bun install --frozen-lockfile` | PASS, exit 0; 1033 installs/1079 packages checked, unchanged; 8.24s |
| `bun run lint` | PASS, exit 0; 5/5 tasks, zero errors, nine existing warnings |
| `bun run typecheck` | PASS, exit 0; 5/5 tasks |
| `bun run test` | FAIL, exit 1; 3492 pass / 2 fail / 3 todo; 81527 assertions; 3497 tests, 212 files; 1140.28s |
| `bun run scan:forbidden-tech` | PASS, exit 0 |
| `bun run scan:ram-only-audit` | PASS, exit 0; 6/10 baseline hard deletes; baseline unchanged |
| `bun run scan:design-tokens` | PASS, exit 0; arbitrary hex 4/18, raw hex 2/2 |
| `bun run check:notices` | PASS, exit 0; 66 documented dependencies |
| `CI=1 bunx playwright test --reporter=line` | FAIL, exit 1; 19 pass / 9 fail / 89 skip; 117 tests; reported 8.1m |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, exit 0; 1/1 tasks; Turbo 3m16.794s |

The focused Plan child suite also passed inside the full test command: 13 child cases, 185 assertions, outer isolation test passed. Original 12 before/after fixture screenshots and all three focused logs remain in the parent evidence directory.

## Known failure and attempt boundary

Both full-test failures are introduced by PlanScreen replacing `tp-sr-only` with `tp-pagehead__title` on its h1. Existing English/Hebrew tests at `tests/unit/one-h1.test.tsx:198` expect exactly `tp-sr-only`. This is AT27; the three source/test candidates are consumed. Status remains **stuck**, awaiting Amit disposition. The old hosted 3492/2/3todo result belongs to original source `6bb6c65`; it is historical evidence, not a new-head hosted run.

## Local E2E failures

All nine failures and exact details are preserved in [e2e.log](e2e.log), [e2e-failures.txt](e2e-failures.txt), and the failure-context directory. 5 failure screenshots are retained here. Original traces and complete generated artifacts are additionally preserved in the scratch gate directory's `e2e-artifacts/`. Failures are reported as observed; their root causes and relation to this patch are not established. No Google Fonts/network-blocked classification is inferred.

1. Calendar Day-to-Week/Month event test: 30s timeout; page reload aborted/frame detached.
2. Sign-out button visibility: 30s timeout.
3. Persisted core task views: Today heading not found; 30s timeout and browser session closed.
4. Coach wiring: screenshot timed out after fonts loaded.
5. Habits wiring: route marker not attached; browser session closed.
6. Settings/preferences wiring: 30s timeout.
7. Settings/nags wiring: 30s timeout.
8. Settings/memory wiring: 30s timeout.
9. Billing wiring: 30s navigation timeout.

Plan timeline wiring is absent from the failure list, but the whole E2E command failed. Playwright reported 89 skips. No test, configuration or deadline was changed; individual skip prerequisites were not audited in this recovery run.

## Authoritative failure tails

### Full tests — last 20 lines

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.66ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.66ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.46ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


2 tests failed:
(fail) one h1 per page (en) > /plan names itself once, visually hidden [108.90ms]
(fail) one h1 per page (he) > /plan names itself once, visually hidden [12.31ms]

 3492 pass
 3 todo
 2 fail
 81527 expect() calls
Ran 3497 tests across 212 files. [1140.28s]
error: script "test" exited with code 1
```

### Local Playwright — last 20 lines

```text
[WebServer] (node:247924) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:247970) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  9 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/preferences mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:7:7 › settings nags + memory wiring › /settings/nags renders the nags screen and nav links exist
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
  89 skipped
  19 passed (8.1m)
```

## Cleanup and remaining unknowns

The Playwright server was verified in this Plan worktree, PGID245707. After E2E, port3000 was unowned and only zombie members remained. Only ignored, realpath-verified, nonsymlink `apps/web/.next/dev` was removed, recovering disk1.5GB→3.4GB. The cleanup receipt preserves the shell tool rejection and the subsequent non-forced Bun filesystem checks. Build groups248086/248168 also had no live members on completion; no other worktree process was stopped. See [e2e-cleanup.log](e2e-cleanup.log) and [build-cleanup.log](build-cleanup.log).

UNKNOWN: current-head hosted CI, guards, actual CodeRabbit review, preview behavior, and causes of the nine E2E failures. No preview or production claim. Protected #1193/#1198 and overlapping KA-09/#1102 and study #1081 remain untouched. Root owns push and remote report updates.

Repository text copies normalize generated trailing whitespace and final blank lines for diff hygiene. Byte-exact raw logs, receipts and 20-line tails remain in `/workspace/work/overnight/plan-gates/d227acd/`; their SHA-256 values are recorded in `raw-receipt-sha256.json`. Counts, failure details and command exits are unchanged.
