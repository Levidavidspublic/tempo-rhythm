---
ticket: TEMPO-B03-08
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/memory/
depends_on: [TEMPO-B03-01]
contract:
  - api.memory.list(args: {sector?: Sector, limit?: number}) -> Memory[]
  - api.memory.recall(args: {query: string, limit?: number}) -> Memory[]
  - api.memory.remember(args: {content: string, sector?: Sector}) -> Id<"memories">
  - api.memory.forget(args: {memoryId}) -> {success: true}
  - api.memory.context(args: {limit?: number}) -> {text: string, count: number}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-09 (memory settings) -->

FOR: Tempo Flow users who want to see and control what Tempo remembers about them
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Memory: One adapter (remember / recall / context / forget / export) on Convex over the existing `memories` table. Kept as written."; §6 "The user never sees JSON, on any screen."
GOAL: In memory settings the user sees what Tempo remembers, searches it, adds a memory, previews the context given to the coach, and forgets any item.
SCOPE: apps/web/components/memory/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/memory/MemoryManager.tsx (client component: search box, sector filter, list with Forget, add-memory form, "What the coach sees" preview); new apps/web/components/memory/memoryView.ts (pure: sector labels, `validateMemory`, `sortForDisplay`); new apps/web/components/memory/memoryView.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md for the `Memory` shape; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `memoryView.ts`: `SECTOR_LABELS` (semantic "Facts", episodic "Events", procedural "How I do things", emotional "Feelings", general "General"), `validateMemory(text)` (trim, 1 to 500 characters), `sortForDisplay(memories)` (salience descending, then updatedAt descending).
3. `MemoryManager.tsx`: with an empty search call `api.memory.list` (optional sector filter); with 2 or more characters (debounced 250 ms) call `api.memory.recall`. Each row shows the content and sector label and a Forget button calling `api.memory.forget`, with an inline "Forgotten" state (no browser `confirm`).
4. The add form calls `api.memory.remember` with the chosen sector and shows `validateMemory` errors inline. "What the coach sees" is a collapsed section rendering `api.memory.context` `text` as plain lines with the count.
5. States: loading skeleton; empty ("Nothing remembered yet."); error with retry. Never render raw JSON or the `metadata` field.
6. Put the pure logic in `memoryView.ts` with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/memory` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/memory` passes (labels, validation, sort order); on the preview remembering then forgetting an item removes it from the list; lint and typecheck green.
EVIDENCE: the `bun test` output and a screenshot path of the list and the preview section, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't import from apps/web/components/memory-export/ (another ticket's folder); don't edit routes or nav
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
