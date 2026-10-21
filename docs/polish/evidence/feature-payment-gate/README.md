# Payment webhook OFF guard

WALK — Issue #1246, Lane 2. Integration base: `39b564ec329705587df5262ed5a061bbec9a1e8f`. Captured 21 October 2026 using Bun 1.3.9. This is local proof of disabled behavior, not provider operation, paid admission or deployed preview proof.

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
| `bun --version` | 1.3.9 |
| Initial focused `bun test convex/lib/revenuecat_events.test.ts` | 9 pass / 0 fail, 120 assertions, exit 0, 2.47 seconds |
| Final focused same command, adding native body-consumption assertion | 9 pass / 0 fail, 129 assertions, exit 0, 4.35 seconds |
| Scoped Biome lint, all three changed TypeScript files | Passed, exit 0, no fixes |
| Scoped strict TypeScript compilation | Passed, exit 0; before the additional test-only native-body assertion; final mandatory typecheck pending |
| `git diff --check` | Passed |
| `bun install --frozen-lockfile` | In progress at this commit; no completed install claimed |
| Mandatory `bun run lint`, `bun run typecheck` | Queued after install in the authorized CPU slot |
| Mandatory full tests, four scans/notices, local Playwright and build | Pending the lead's serialized heavy-validation slot |
| Current-head hosted CI, CodeRabbit, guards, architecture approval | UNKNOWN until independently observed by the lead |
| Preview/provider behavior | UNKNOWN; no real endpoint or account was exercised |

The final focused log is included in this folder. No candidate failure occurred during the scoped implementation. Later broad results belong in the PR report with authoritative exit and any failure tails; this table does not substitute for those gates.

## Limits and reconciliation

The false server flag must not be enabled as a shortcut. The legacy enabled path still lacks canonical entitlement projection, safe identity mapping, event ordering/idempotency, correct cancellation/expiry semantics and retryable mutation failure handling. Those need their separate reviewed contract. This guard does not claim to make that path safe or to complete paid admission.

Configuration names only: existing `REVENUECAT_WEBHOOK_SECRET`, needed in the intended environment when a later approved activation is undertaken. No new runtime environment name, schema or deployment step is introduced here. The run's owner architecture gate remains required before merge; this worker adds no label.

Older PRs #47, #55, #76, #103, #110, #115, #119, #123, #124, #126, #127 and #128 overlap `convex/revenuecat.ts`. None was changed or declared fully superseded. Their later reconciliation must retain the OFF guard and its tests. Protected #1193/#1198 and other Lane 1 files were untouched.

Screenshot: N/A — no user interface change. Production remains unchanged.
