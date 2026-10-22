# WALK — Executor hub evidence (#1265)

Recorded 2026-10-22 UTC. State: locally-tested mounted behavior in scratch; not preview-tested or shipped. The screen uses the existing connection backend. No account, provider, permission, environment or deployment was changed.

## What changed

The mounted `/settings/integrations` body now presents one Executor hub, the person's actual connection state, short access/feature-limit copy, the existing memory import link and the existing personal MCP token card. The six speculative provider rows were removed. There are no invented provider counts, connected apps or setup links. The supplied MCP endpoint is not presented as a browser onboarding URL.

The parent route's always-visible notice uses `set.integ.nTitle` and `set.integ.nBody`. Root `apps/web/lib/i18n.ts` overrides those keys after its settings-group spread; editing the group alone would leave false copy on screen. The coordinator updated #1265's scope to replace `apps/web/lib/i18n-groups/settings.ts` with root `apps/web/lib/i18n.ts`, preserving the three-implementation-file limit. The settings group and route were not changed. New copy is English/Hebrew; Hebrew is machine-drafted, plural or impersonal, and flagged in source for Amit's native read.

A failed status query now shows a calm error and Retry. It no longer reports the feature OFF without evidence. A real `enabled: false` status still renders the existing disabled/paused state, including Disconnect for a retained connection. Disconnect still requires the existing confirm sheet; its text now explains that access must be restored by connecting again. It does not claim five-minute Undo for credential revocation. No AI-originated mutation was added. External tool mutations remain unavailable here and depend on KA-21 #1113's confirmation/Undo path.

## Existing contracts preserved

| Contract | Behavior |
| --- | --- |
| `users.getProfile({})` | Existing authenticated profile gate before status. |
| `connections.status({ provider: "executor" })` | Uses actual `status`, `enabled`, optional `connectedAt` and `lastUsedAt`; no credentials. |
| `connections.startExecutorConnect({ returnTo: "settings" })` | Existing Connect/Start again/Reconnect path; validates returned authorization URL before navigation. |
| `connections.confirmExecutorConnect({ nonce })` | Existing callback confirmation, address-bar cleanup, memory-only nonce, one-attempt deduplication and lost-response recovery retained. |
| `connections.disconnect({ provider: "executor" })` | Existing confirmed disconnect and `revokedAtProvider` result handling retained. |

There is no new public refresh method: the actual backend does refresh internally, and the UI reconnects through the existing start action. `TEMPO_EXECUTOR_ENABLED` and per-user encrypted OAuth ownership stay entirely in the existing backend. This ticket makes no backend or allowlist change and performs no remote call.

## Test results (cloud agent sandbox)

Bun 1.3.9. The new test mounts the real `IntegrationsList`, `ExecutorConnection`, and existing `ConfirmSheet` with real translated copy and fictional backend boundaries. It uses the repository's dependency-free DOM pattern, adapted from `tests/unit/releaseOnboardingGate.test.tsx`, inside an isolated Bun child. The child cannot contaminate other tests' module mocks; it inherits only PATH, test mode and its test-only isolation flag. No new dependency, browser, Next server or provider is used.

| Check | Result |
| --- | --- |
| `bun test tests/unit/tempo-executor-integrations.test.tsx` | exit 0; one isolation test passes and asserts the child reported 15 passing mounted cases and zero failures. See `focused-candidate-2.log`. |
| Strict isolated TypeScript for the three source files and test, with existing repository dependencies | exit 0, no diagnostics. See `scoped-types-candidate-2.log`. Actual workspace-wide typecheck remains unrun. |
| Scoped Biome lint for the three source files and test | exit 0, zero diagnostics. See `scoped-lint-candidate-2.log`. Existing repository rules used; VCS ignore discovery alone disabled in non-Git scratch. |
| `bun install --frozen-lockfile` | UNKNOWN: no actual checkout allocated to this worker; no packages added. |
| `bun run lint` | UNKNOWN: workspace-wide command deferred to allocated checkout. |
| `bun run typecheck` | UNKNOWN: workspace-wide command deferred to allocated checkout. |
| `bun run test` | UNKNOWN: full repository suite deferred to allocated checkout. |
| Four scans, in required order | UNKNOWN: actual checkout not allocated. |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: browser/heavy gate not allocated to this worker. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN: build not allocated to this worker. |
| CI, CodeRabbit and merge guards | UNKNOWN until checks run on the published PR's exact head. |

The fifteen mounted cases cover: flag OFF and inert Connect; exact Connect contract/navigation; removal of speculative providers and preservation of import/MCP; pending state; callback confirmation and nonce redaction; connected state and dates; reconnect; connect failure/retry/redaction; query error versus OFF with Retry; disconnect confirmation/Escape/focus return; accepted disconnect; disconnect failure preserving connection; paused connection with Disconnect; Hebrew/RTL and translated hub keys; and the actual parent notice's key values in both languages.

The first candidate's mounted tests passed. Scoped lint found an undeclared Bun global in the test; isolated TypeScript found missing declarations on direct filesystem React imports in that same fixture. Those exact diagnostics are preserved in candidate-1 logs. Candidate 2 imports Bun's API explicitly, resolves React from the existing web workspace with proper types, and passes the focused checks. No test assertion, production check or configuration was weakened. One failed candidate has been used for this ticket.

## AWAY — Browser evidence still required

This scratch lane was explicitly limited to pure mounted tests. It did not launch a browser or claim layout measurement from a simulated DOM. All new layout uses existing token classes, stacked settings rows and full-size `tp-btn` controls; no CSS, colours or pixel values were introduced.

The coordinator's allocated gallery/screenshot run must still record English and Hebrew at 390 and 1280 pixels, light and dark, covering OFF, disconnected, connecting, connected, reconnect, query error, and the disconnect sheet. Verify actual overflow, 44-pixel touch targets, visible keyboard focus, Escape/focus restoration, inherited RTL and reduced motion. Use only fictional state. Keep the normal shell's single h1/main; these components add neither. The mounted DOM suite tests semantics and focus transitions, not painted focus, physical dimensions or browser accessibility behavior.

Recommended browser fixture entry: mount the actual `IntegrationsList` inside the existing settings/shell frame and mock only `connections`/profile and the independent MCP card's backend. Leave `ExecutorConnection`, `ConfirmSheet`, locale strings and token CSS real. Use the screenshot/gallery harness; do not change `e2eWiringRoutes.ts` or routes. This ticket adds no orphan component.

## Report

```text
status: blocked
ticket: #1265
evidence: isolated mounted Bun child -> 15 pass / 0 fail; strict scoped types and lint -> exit 0
changed: apps/web/components/settings/IntegrationsList.tsx; apps/web/components/settings/ExecutorConnection.tsx; apps/web/lib/i18n.ts; tests/unit/tempo-executor-integrations.test.tsx; docs/polish/evidence/kb-executor-hub/
unknowns: actual-checkout full gates, browser screenshots/layout, CI/CodeRabbit/guards, live configured Executor behavior
notes for ticket sync: root i18n replaces settings-group ownership by coordinator-approved scope correction; schema/env/backend NONE; no public refresh API invented; Hebrew needs native read
```
