---
ticket: TEMPO-B03-06
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/nags/
depends_on: [TEMPO-B03-01]
contract:
  - api.nags.list(args: {}) -> Nag[]
  - api.nags.create(args: {label: string}) -> Id<"nags">
  - api.nags.setEnabled(args: {nagId, enabled: boolean}) -> {success: true}
  - api.nags.remove(args: {nagId}) -> {success: true}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-07 (nags API) -->

FOR: Tempo Flow users who want reminders ("nags") in their own words
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Nags: Phrases are the user's own words or derived from them. No stock copy, no emoji. A nag with no accepted phrase can't be switched on."; §11 Q2 (delivery beyond in-app is UNKNOWN, so this ticket is in-app settings only).
GOAL: In nag settings the user creates named nags, sees how many phrases each has accepted, and can switch a nag on only when it has at least one accepted phrase.
SCOPE: apps/web/components/nags/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/nags/NagList.tsx (client component: create-nag form, list with accepted-phrase count, on/off switch, delete); new apps/web/components/nags/nagRules.ts (pure: `canEnable`, `acceptedPhrases`, `validateLabel`, `enableHint`); new apps/web/components/nags/nagRules.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md for the `Nag` shape; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `nagRules.ts`: `acceptedPhrases(nag)` (status "accepted"), `canEnable(nag)` (at least one accepted), `validateLabel(label)` (trim, 1 to 60 characters, no emoji via `\p{Extended_Pictographic}`), `enableHint(nag)` returning "Add a phrase in your own words to switch this on." when blocked.
3. `NagList.tsx`: `useQuery(api.nags.list)`; a create form calling `api.nags.create`; each row shows the label, "N phrases accepted", and a switch that is disabled (with `enableHint` as its description) when `!canEnable`, otherwise calls `api.nags.setEnabled`. A Delete button calls `api.nags.remove` after an inline confirm line (no browser `confirm`).
4. Show backend error text (for example "Add a phrase you accept first.") inline when `setEnabled` throws. No stock nag templates or sample phrases anywhere. The empty state says "No nags yet. Name one to start; the words will be yours."
5. Accept an optional `onSelect(nagId)` prop on each row so the merge agent can link a row to the phrase editor (TEMPO-B03-07). Do not import from that ticket's folder.
6. Put the pure logic in `nagRules.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/nags` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/nags` passes (canEnable with 0 accepted, 1 accepted, and only proposed phrases; label validation); on the preview a nag with no accepted phrase cannot be switched on; lint and typecheck green.
EVIDENCE: the `bun test` output and a screenshot path of the list including a blocked switch, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't create apps/web/app/(tempo)/settings/nags/page.tsx or touch the nav; the merge agent wires it (contract: hot files)
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
