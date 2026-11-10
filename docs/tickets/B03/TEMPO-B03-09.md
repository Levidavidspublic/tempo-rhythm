---
ticket: TEMPO-B03-09
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/memory-export/
depends_on: [TEMPO-B03-01]
contract:
  - api.memory.exportAll(args: {}) -> {filename: string, exportedAt: number, count: number, markdown: string}
  - api.memories.getMemoryStats(args: {}) -> {total: number, sectors: {sector, count, avgSalience}[], avgSalience: number}   # EXISTING, convex/memories.ts
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-08 (memory settings) -->

FOR: Tempo Flow users who want to take their memories with them
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Memory: One adapter (remember / recall / context / forget / export) on Convex over the existing `memories` table."; §6 "The user never sees JSON, on any screen."
GOAL: In memory settings the user sees how many things Tempo remembers per sector and downloads all of them as a readable markdown file.
SCOPE: apps/web/components/memory-export/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/memory-export/MemoryExport.tsx (client component: counts per sector, "Download my memories" button, status line); new apps/web/components/memory-export/download.ts (pure: `safeFilename`, `summaryLine`, `toBlobParts`); new apps/web/components/memory-export/download.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md and convex/memories.ts (`getMemoryStats`, read only); use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `download.ts`: `safeFilename(name)` (keep `[a-z0-9._-]`, fall back to `tempo-memories.md`), `summaryLine(stats)` ("N memories across M sections"; "Nothing to export yet." when total is 0), `toBlobParts(markdown)` returning `{parts: [markdown], type: "text/markdown;charset=utf-8"}`.
3. `MemoryExport.tsx`: read `api.memories.getMemoryStats` and show `summaryLine` plus a count per sector with plain labels. The export button calls `useConvex().query(api.memory.exportAll, {})` on click only (not subscribed), builds a Blob, and downloads it through a temporary anchor named with `safeFilename(filename)`, then revokes the object URL.
4. Disable the button when `total` is 0 or while exporting. On failure show "That export didn't work. Try again?" On success show "Saved N memories to your downloads." Never display the markdown or any JSON on screen.
5. Put the pure logic in `download.ts` with the test beside it, so the test runs without a browser.
6. `bun test apps/web/components/memory-export` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/memory-export` passes (filename sanitising, summary line, empty state); on the preview the button downloads a `.md` file whose item count equals `count`; lint and typecheck green.
EVIDENCE: the `bun test` output, a screenshot path of the panel, and the first 5 lines of a downloaded file (no secrets), pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't import from apps/web/components/memory/ (another ticket's folder); don't edit routes or nav
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
