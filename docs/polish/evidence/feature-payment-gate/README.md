# Payment webhook OFF guard

WALK — Issue #1246, Lane 2. Validated source: `d2b259b062dd4649b598370265caf490be78ec89`; actual integration parent: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac` (the initial code-map audit used `39b564e`). Captured 21 October 2026 using Bun 1.3.9. This is local proof of disabled behavior, not provider operation, paid admission or deployed preview proof.

## Behavior

The frontend payment flag was already false, but the existing server webhook could still call the account updater. The webhook now uses a separate server-owned `REVENUECAT_PROCESSING_ENABLED=false` constant. It preserves missing-configuration and failed-authorization responses. Authenticated requests return HTTP 503 with `{received:false,reason:"payments_disabled"}` before parsing the body or calling any mutation/provider.

`revenueCatIngressDecision` validates configuration, authorization and the processing flag in that order. It does not validate payment events or entitlements. The existing event mapper and all three existing mapper tests are unchanged. No schema, route registration, account policy, frontend flag, dependency, environment or deployment changes were made.

## Gate matrix

| Case | Observed response | Event body | Mutation/provider calls |
|---|---|---|---|
| Missing or empty configured secret | 503, existing `Webhook not configured` text | Unread | 0 / 0 |
| Missing or unequal authorization | 401, existing `Unauthorized` text | Unread | 0 / 0 |
| Authenticated, processing off | 503, explicit disabled JSON | Unread | 0 / 0 |
| Malformed or throwing body while off | 503, explicit disabled JSON | Unread | 0 / 0 |
| Query/body/header/environment attempts to enable | 503, explicit disabled JSON | Unread | 0 / 0 |
| Actual registered POST action | 503, explicit disabled JSON | Unread | 0 / 0 |

The tests use fresh Bun children with `--no-env-file` and an explicit synthetic environment. They do not inherit, inspect or modify a host credential. The actual exported HTTP action is invoked, including the action registered by the existing router. No handler or Convex global mock replaces the implementation. Each request asserts both zero `json()` calls and native `request.bodyUsed=false`, zero mutations, zero provider calls and no synthetic authorization/body content in response or captured logs. Only the existing missing-configuration log appears in that case. Owned child processes exit authoritatively; no browser, server or account is used.

## Test results (cloud agent sandbox)

| Command/check | Result |
|---|---|
| `bun --version` | 1.3.9; exit 0 |
| Final focused `bun test convex/lib/revenuecat_events.test.ts` | 9 pass / 0 fail, 129 assertions, exit 0, 4.35 seconds; also all 9 passed within the full suite |
| Scoped Biome lint, all three changed TypeScript files | Passed, exit 0, no fixes |
| Scoped strict TypeScript compilation | Passed, exit 0; final mandatory typecheck below covers the final source |
| `bun install --frozen-lockfile` | Passed, exit 0; checked 1033 installs across 1079 packages, no changes |
| `bun run lint` | Passed, exit 0; 5/5 Turbo tasks cached; existing web output has 9 warnings, no fixes |
| `bun run typecheck` | Passed, exit 0; 5/5 Turbo tasks cached |
| `bun run test` | FAIL, exit 1; 3486 pass / 14 fail / 3 todo, 81499 assertions, 3503 tests across 211 files, 1243.63 seconds |
| `bun run scan:forbidden-tech` | Passed, exit 0 |
| `bun run scan:ram-only-audit` | Passed, exit 0; baseline unchanged |
| `bun run scan:design-tokens` | Passed, exit 0; baseline unchanged |
| `bun run check:notices` | Passed, exit 0; 66 documented runtime dependencies |
| First `CI=1 bunx playwright test --reporter=line` | UNKNOWN: environment handoff interrupted the runner; no authoritative exit. Original log preserved as `playwright.interrupted.log.gz` |
| Resumed exact `CI=1 bunx playwright test --reporter=line` | FAIL, exit 1; 25 passed / 3 failed / 89 skipped, 4.7 minutes; local mock dev server and existing system Chromium only |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Passed, exit 0; 1/1 Turbo task, 2m23.608s |
| `git diff --check` | Passed before implementation commit; evidence-only follow-up checked separately |
| CodeRabbit review | Lead-observed actual review: no findings on pre-rebase `2e574683d3e6146424cf1c49f1ebe367db216cbe`; all three payment source/test files are byte-identical to `d2b259b062dd4649b598370265caf490be78ec89` |
| Hosted CI and scope/config/security guards at `d2b259b062dd4649b598370265caf490be78ec89` | Passed, as observed by the lead; this is distinct from the failed local full-suite and E2E runs |
| Hosted checks on the final evidence-only head | UNKNOWN / unverified until observed after publication |
| Preview/provider behavior | UNKNOWN; no real endpoint or account exercised |

The full-suite failures are 13 named KB64 Undo recovery timeouts and one unnamed beforeEach/afterEach hook timeout, reported adjacent to `tests/unit/kb-64.test.tsx`. That file is unchanged by this payment commit. The E2E failures are `calendar-views.spec.ts:7` (`page.goto` timeout), `task-views-core.spec.ts:14` (`locator.fill` timeout), and `wiring/coach.spec.ts:8` (`page.screenshot` timeout); those files are also unchanged. Their causes and whether they reproduce on the integration base remain UNKNOWN: no baseline comparison or rerun was performed, and these are not described as proven baseline defects. Full-suite payment cases all passed.

Authoritative command logs and exit files are in `gates-d2b259b/` ([immutable receipt snapshot](https://github.com/Levidavidspublic/tempo-rhythm/tree/dbe572ca4cc1fc909c7c66a27352784e74aaef1a/docs/polish/evidence/feature-payment-gate/gates-d2b259b)); logs are losslessly gzip-compressed to preserve their exact bytes; failure tails below reproduce the final 20 lines. `prior-attempt/` retains the original focused/static receipts, including an earlier install timeout (exit 124) before the later completed frozen install. No failed or interrupted receipt was replaced by a passing claim. The first interrupted E2E log was preserved before the exact rerun, with no timeout/configuration change. Bun 1.3.9 and the already-provisioned `/usr/bin/chromium` were used; no preview/live URL or `PLAYWRIGHT_BASE_URL` was used. Owned server/build groups have no active processes; only inert zombies adopted by PID 1 remain. Before build, only verified gitignored non-symlink realpath `apps/web/.next/dev` was removed after its server exited.

The implementation, tests, check configuration, baselines and dependencies remain exactly as at the validated source SHA. This follow-up adds evidence only. Full-suite and browser failures block DONE and integration admission; keep PR #1248 draft. No secrets or environment files were read or changed, no paid provider called, and no deployment or remote mutation performed by this worker.

### Failure tails

`bun run test` (exit 1):

```text
  ^ this test timed out after 30000ms.
(fail) KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [30020.47ms]
  ^ this test timed out after 30000ms.
(fail) KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [30000.42ms]
  ^ this test timed out after 30000ms.
(fail) KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [30077.49ms]
  ^ this test timed out after 30000ms.
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [120000.90ms]
  ^ this test timed out after 120000ms.
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [30000.94ms]
  ^ this test timed out after 30000ms.
(fail) (unnamed) [5000.80ms]
  ^ a beforeEach/afterEach hook timed out for this test.

 3486 pass
 3 todo
 14 fail
 81499 expect() calls
Ran 3503 tests across 211 files. [1243.63s]
error: script "test" exited with code 1
```

`CI=1 bunx playwright test --reporter=line` (resumed run, exit 1):

```text
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:234654) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:234707) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  3 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
  89 skipped
  25 passed (4.7m)
```

The review and hosted outcomes above are supplied by the lead’s observed results. Source identity was independently checked with `git diff --exit-code 2e574683d3e6146424cf1c49f1ebe367db216cbe d2b259b062dd4649b598370265caf490be78ec89 -- convex/revenuecat.ts convex/lib/revenuecat_events.ts convex/lib/revenuecat_events.test.ts` (exit 0). Review evidence is limited to that identical implementation; final documentation-head checks remain unverified. [Reviewed source](https://github.com/Levidavidspublic/tempo-rhythm/commit/2e574683d3e6146424cf1c49f1ebe367db216cbe) · [Validated source and hosted checks](https://github.com/Levidavidspublic/tempo-rhythm/commit/d2b259b062dd4649b598370265caf490be78ec89/checks).

## Limits and reconciliation

The false server flag must not be enabled as a shortcut. The legacy enabled path still lacks canonical entitlement projection, safe identity mapping, event ordering/idempotency, correct cancellation/expiry semantics and retryable mutation failure handling. Those need their separate reviewed contract. This guard does not claim to make that path safe or to complete paid admission.

Configuration names only: existing `REVENUECAT_WEBHOOK_SECRET`, needed in the intended environment when a later approved activation is undertaken. No new runtime environment name, schema or deployment step is introduced here. #1246 is user-authorized scoped FEATURE `type:data` work. AGENTS rule 4 applies its backend exception to component tickets; this ticket requires no additional architecture label or owner-approval hold. All actual scope/config/security guards and validation requirements remain in force.

Older PRs #47, #55, #76, #103, #110, #115, #119, #123, #124, #126, #127 and #128 overlap `convex/revenuecat.ts`. None was changed or declared fully superseded. Their later reconciliation must retain the OFF guard and its tests. Protected #1193/#1198 and other Lane 1 files were untouched.

Screenshot: N/A — no user interface change. Production remains unchanged.
