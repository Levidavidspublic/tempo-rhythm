---
ticket: TEMPO-B03-04
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/coach-proposal/
depends_on: [TEMPO-B03-01]
contract:
  - api.coach.getSettings(args: {}) -> {dial: number, taskLoad: number, panicUntil: number|null, acceptedStreak: number}
  - api.coach.badDay(args: {}) -> {isBadDay: boolean, reason: "panic"|"low_activity"|null, suggestedLoad: number}
  - api.coach.currentProposal(args: {}) -> CoachProposal | null
  - api.coach.createProposal(args: {}) -> Id<"coachProposals">
  - api.coach.decideProposal(args: {proposalId, decision: "accept"|"reject"}) -> {status: "accepted"|"rejected", taskLoad: number}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-03 (coachSettings dial/panic/load) -->

FOR: Tempo Flow users who want the coach to propose a realistic day, which they can accept or turn down
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Adaptive coach: ... bad-day detection, 10-second action, realism checker, forgiveness contract, graduated load 2→4 tasks. Accept / reject is law."; §6 "Never shame ... Streaks are dosing data, never pressure."
GOAL: On /coach the user sees today's proposed 2 to 4 tasks with a 10-second first action and a realism note, and accepts or rejects the whole proposal; rejecting carries no penalty.
SCOPE: apps/web/components/coach-proposal/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/coach-proposal/CoachProposalCard.tsx (client component: "Plan my day", proposal list, 10-second action, realism note, bad-day banner, Accept / "Not today"); new apps/web/components/coach-proposal/proposalView.ts (pure view model and wording); new apps/web/components/coach-proposal/proposalView.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md for the `CoachProposal` shape; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `proposalView.ts`: `toView(proposal, settings, badDay)` returning `{heading, taskLines, tenSecondAction, realismNote, loadNote}`. `loadNote` reads "Today: 2 tasks", and on a bad day "Lighter day: 2 tasks". When `realism.ok` is false the note is "This is a lot for the time you have. Want fewer?". No overdue, missed or failed wording anywhere.
3. `CoachProposalCard.tsx`: when `currentProposal` is null show "Plan my day", which calls `createProposal`. When `badDay.isBadDay` show the calm banner "Rough day? Keeping it light." (no diagnosis words).
4. Accept calls `decideProposal` with "accept"; "Not today" calls it with "reject" and then shows "No problem. We can try again whenever." Show the returned `taskLoad` as "Next time: N tasks". This component only displays backend data and sends the user's decision.
5. States: loading skeleton; empty ("Nothing to plan yet. Add a task or do a brain dump."); error with retry.
6. Put the pure logic in `proposalView.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/coach-proposal` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/coach-proposal` passes (view model for ok, not-ok realism, bad day, empty); on the preview Accept and "Not today" each change the proposal state; `grep -rniE 'failed|overdue|streak lost' apps/web/components/coach-proposal` prints nothing; lint and typecheck green.
EVIDENCE: the `bun test` output, a screenshot path of an accepted and a rejected proposal, and the empty grep result, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't edit apps/web/app/(tempo)/coach/page.tsx; the merge agent wires `CoachProposalCard` in (contract: hot files)
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
