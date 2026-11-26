---
ticket: TEMPO-B03-03
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/coach-controls/
depends_on: [TEMPO-B03-01]
contract:
  - api.coach.getSettings(args: {}) -> {dial: number, taskLoad: number, panicUntil: number|null, acceptedStreak: number}
  - api.coach.setDial(args: {dial: number}) -> {success: true}
  - api.coach.pressPanic(args: {}) -> {panicUntil: number, action: {text: string}}
  - api.coach.clearPanic(args: {}) -> {success: true}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-04 (coachSettings dial/panic/load) -->

FOR: Tempo Flow users who want to control how hard the coach pushes, and need a way out when overwhelmed
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Adaptive coach: Dial 0–10, panic button, bad-day detection, 10-second action ..."; §6 "Never shame."; §2 Escalation "Three nights without sleep, severe distress or an escalating crisis: show real resources and stop coaching."
GOAL: On /coach the user sets how much the coach pushes (dial 0 to 10) and can press a panic button that shows one 10-second action and quiets the coach until cleared.
SCOPE: apps/web/components/coach-controls/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/coach-controls/CoachControls.tsx (client component: dial, panic button, panic card with the 10-second action and an "I'm okay now" button); new apps/web/components/coach-controls/dial.ts (pure: clamp to integer 0-10, label, minutes left); new apps/web/components/coach-controls/dial.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md and apps/web/components/coach/CoachChat.tsx (read only) for the Convex hook pattern; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `dial.ts`: `clampDial(n)` (integer 0 to 10, NaN -> 5), `dialLabel(n)` (0-3 "Gentle", 4-6 "Steady", 7-10 "Firm"), `panicMinutesLeft(panicUntil, now)` (never negative).
3. `CoachControls.tsx`: read `api.coach.getSettings`; render a range input (min 0, max 10, step 1, visible text label, `aria-valuetext`) that calls `api.coach.setDial` on release and shows a "Saved" state.
4. Panic button calls `api.coach.pressPanic` and shows a card with `action.text` in large type and the minutes left. "I'm okay now" calls `api.coach.clearPanic`. If `panicUntil` is in the future on load, show the card again; when only `panicUntil` is known, show "Take a breath. Nothing is due right now." Never invent action text client-side.
5. States: loading, and on failure keep the previous dial value and say "That didn't save. Try again?". All controls keyboard operable.
6. Put the pure logic in `dial.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/coach-controls` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/coach-controls` passes (clamp, label, minutes-left cases); the dial persists across reload on the preview; pressing panic shows the 10-second action returned by the backend; lint and typecheck green.
EVIDENCE: the `bun test` output and a screenshot path of the dial and the panic card, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't edit apps/web/app/(tempo)/coach/page.tsx or apps/web/components/coach/; the merge agent wires `CoachControls` in (contract: hot files)
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
