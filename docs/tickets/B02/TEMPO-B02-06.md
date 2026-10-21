---
ticket: TEMPO-B02-06
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/insights/
depends_on: [TEMPO-B02-01]
contract:
  - api.analytics.insightsSummary(args: {todayStartMs, todayEndMs, weekStartMs}) -> InsightsSummary
  - api.users.getProfile(args: {}) -> Profile | null
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user opening /insights for a calm overview of tasks, habits and goals
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §3 "Broken live": "`/insights` (endless skeleton, #528)"; §4.1 A4 "Every control on every signed-in screen works"; §6 "Never shame. No 'you failed', 'streak lost' or 'overdue!'."
GOAL: /insights always leaves the loading skeleton: it shows the real numbers, a calm empty state, or a calm retry card, and never an endless skeleton.
SCOPE: apps/web/components/insights/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/insights/InsightsScreen.tsx; apps/web/components/insights/insightsState.ts (new, pure: maps `profile` / `summary` / auth states to "loading" | "signed-out" | "empty" | "ready" | "error"); apps/web/components/insights/insightsState.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Reproduce #528: InsightsScreen shows the skeleton while `profile === undefined || summary === undefined`. Find which query never resolves (a skipped query returns `undefined`; a query that throws leaves the screen stuck; `weekStartMs` from `startOfLocalWeekMondayMs` must be <= `todayStartMs`, and `insightsSummary` throws otherwise). Fix the root cause on the web side (window arguments). If the cause is inside convex/analytics.ts, stop and report `blocked: missing backend insightsSummary` (the data ticket checks it).
3. Create insightsState.ts as a pure function so the loading rule is testable; use it in InsightsScreen. Wrap the summary query in an error boundary or `useQuery` guard so a thrown error renders a calm card ("We couldn't load your overview. Try again") with a Retry button.
4. Keep all cards neutral: `tasksOverdue` is labelled "Waiting for a new date" or similar, never "overdue!"; streak numbers are shown as information.
5. Add one test for insightsState (signed out, profile loading, summary loading, empty, ready, error; assert the skeleton is never the state when auth is done and profile is null).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/insights` passes; /insights in the browser, signed in, shows numbers or the empty state within a few seconds; lint and typecheck green.
EVIDENCE: test output; root cause of #528 in one sentence; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't add AI-written insights or new metrics (not in the PRD)
- don't use shaming copy
REPORT: what changed, root cause of #528, what was verified, anything missing from the contract.
