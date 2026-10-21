---
ticket: TEMPO-B03-05
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/coach-crisis/
depends_on: [TEMPO-B03-01]
contract:
  - api.crisis.resourcesCard(args: {}) -> {title: string, body: string, resources: {label: string, detail: string}[]}
  - api.crisis.check(args: {text: string}) -> {isCrisis: boolean}
  - api.coach.sendMessage(args: {conversationId, content}) -> {success: true, crisis?: boolean}   # EXISTING, extended
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-02 (crisis API) -->

FOR: Tempo Flow users in distress who type crisis words to the coach
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §6 "Crisis words return a fixed resources card, with no model call. The text is never model-written (EXTRAPOLATED rule). The per-country data source is UNKNOWN."; §2 "Escalation: Three nights without sleep, severe distress or an escalating crisis: show real resources and stop coaching."
GOAL: A reusable crisis card renders the fixed resources text, and a hook tells the coach chat when text is crisis text, so the chat stops coaching and shows the card.
SCOPE: apps/web/components/coach-crisis/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/coach-crisis/CrisisResourcesCard.tsx (client component rendering the backend card); new apps/web/components/coach-crisis/useCrisisGuard.ts (hook calling `api.crisis.check`); new apps/web/components/coach-crisis/crisisCopy.ts (pure: resource line formatting and fixed fallback text); new apps/web/components/coach-crisis/crisisCopy.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md and apps/web/components/coach/CoachChat.tsx (read only); use `api` from `@/convex/_generated/api`.
2. `crisisCopy.ts`: `formatResource({label, detail})` -> "label: detail", and `FALLBACK_CARD`, fixed English text: "If you are in danger or thinking of hurting yourself, contact your local emergency number now. You can also reach out to someone you trust." It is used only while the query has not loaded or has failed, so the card is never empty. Flag in REPORT that this fixed text needs Amit's review (the per-country source is UNKNOWN).
3. `CrisisResourcesCard.tsx`: no props; reads `api.crisis.resourcesCard`; renders title, body and resource list with `role="alert"`; says Tempo is a coach, not a therapist or counselor (PRD §1); no emoji, no coaching or "try again" language, no model call.
4. `useCrisisGuard.ts`: `guard(text)` returns `{ isCrisis: boolean }` from `api.crisis.check` (via `useConvex().query`); on error return `{ isCrisis: false }` and never block sending.
5. Export the card and hook from their files so the merge agent can import them into `CoachChat` and the coach page (hot-file work, not this ticket).
6. Put the pure logic in `crisisCopy.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/coach-crisis` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/coach-crisis` passes (format and fallback cases); the card renders the backend resources on the preview; `grep -rn 'callLLM\|brain_dump.prioritize' apps/web/components/coach-crisis` prints nothing; lint and typecheck green.
EVIDENCE: the `bun test` output and a screenshot path of the card, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't edit apps/web/components/coach/CoachChat.tsx or the coach page; the merge agent wires the card in (contract: hot files)
- don't let any model write or rephrase the card text
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN (the per-country resource source).
