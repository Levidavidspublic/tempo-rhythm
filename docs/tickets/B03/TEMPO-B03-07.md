---
ticket: TEMPO-B03-07
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/nag-phrases/
depends_on: [TEMPO-B03-01]
contract:
  - api.nags.list(args: {}) -> Nag[]
  - api.nags.addPhrase(args: {nagId, text: string, source: "user"|"derived"}) -> {phraseId: string}
  - api.nags.decidePhrase(args: {nagId, phraseId: string, decision: "accept"|"reject"}) -> {success: true}
  - api.nags.proposePhrases(args: {nagId}) -> {proposals: string[]}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-06 (nags API) -->

FOR: Tempo Flow users who write the words their own nags will say
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Nags: Phrases are the user's own words or derived from them. No stock copy, no emoji." and "Accept / reject is law"; §6 "the model proposes, the user accepts, code writes. The model never writes to the database."
GOAL: For one nag the user writes phrases in their own words, can ask for derived suggestions, and accepts or rejects each suggestion; nothing derived is saved until accepted.
SCOPE: apps/web/components/nag-phrases/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/nag-phrases/NagPhraseEditor.tsx (client component, prop `nagId`: own-words input, accepted / proposed / rejected sections, "Suggest from my words", Accept and Reject buttons); new apps/web/components/nag-phrases/phraseInput.ts (pure: `validatePhraseText`, `splitByStatus`); new apps/web/components/nag-phrases/phraseInput.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md for the `Nag` and `NagPhrase` shapes; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `phraseInput.ts`: `validatePhraseText(text)` returns `{ok: true, text}` or `{ok: false, message}`: trim; empty -> "Write a phrase in your own words."; over 140 characters -> "Keep it under 140 characters."; emoji (`\p{Extended_Pictographic}`) -> "No emoji in nags." `splitByStatus(phrases)` returns `{accepted, proposed, rejected}`.
3. `NagPhraseEditor.tsx`: find the nag in `api.nags.list` by `nagId`. The own-words form validates with `validatePhraseText`, then calls `addPhrase` with source "user" (stored as accepted).
4. "Suggest from my words" calls `useAction(api.nags.proposePhrases)`. Each returned string shows with Accept (calls `addPhrase` with source "derived", then `decidePhrase` "accept" with the returned `phraseId`) and Reject (dismisses locally; nothing is written). When the list is empty say "Add a phrase of your own first so suggestions can come from your words."
5. Show any saved proposed phrases with Accept / Reject through `decidePhrase`; list rejected phrases collapsed. No default or sample phrases anywhere.
6. Put the pure logic in `phraseInput.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/nag-phrases` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/nag-phrases` passes (empty, too long, emoji, ok, splitByStatus); on the preview an emoji phrase is blocked in the form and a derived suggestion is stored only after Accept; lint and typecheck green.
EVIDENCE: the `bun test` output and a screenshot path of the editor with one accepted and one suggested phrase, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't import from apps/web/components/nags/ (another ticket's folder); don't edit routes or nav
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
