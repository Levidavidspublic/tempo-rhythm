---
ticket: TEMPO-B04-09
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/global-search/
depends_on: [TEMPO-B04-01]
contract:
  - "api.search.all(args: {query: string}) -> {notes: {_id, title, snippet}[], tasks: {_id, title, status}[], habits: {_id, name}[], goals: {_id, title}[]}"
overlap_test: false
expected_merge: clean
hold: false
---

FOR: signed-in people on /search
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §5 "Unified surface: calendar + tasks + notes over one markdown layer"; §4.1 A4: every control works, with a reload check.
GOAL: /search takes a query (also from `?q=`), shows grouped results for notes, tasks, habits and goals, and each result opens its page.
SCOPE: apps/web/components/global-search/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/global-search/SearchScreen.tsx (new), apps/web/components/global-search/ResultGroup.tsx (new), apps/web/components/global-search/SearchScreen.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. `SearchScreen`: input with a 250 ms debounce, syncs `?q=` via `useSearchParams`/`router.replace`; uses `useQuery(api.search.all, q ? {query: q} : "skip")`.
3. `ResultGroup`: heading with count, rows linking to `/notes/<id>`, `/tasks`, `/habits`, `/goals`; empty groups hidden; a whole-screen "No matches" state, and a prompt state when the query is empty.
4. Keyboard: Enter on the input focuses the first result.
5. Add or extend one test for the behaviour (apps/web/components/global-search/SearchScreen.test.tsx, Vitest + Testing Library, mock `convex/react` and `next/navigation`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows the query is skipped when empty, groups render with links, and "No matches" appears when all groups are empty; checks green.
EVIDENCE: test output; screenshot of /search with results.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/tempo/CommandPalette.tsx (hot file)
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(tempo)/search/page.tsx must import `SearchScreen` (hot file, merge agent wires it).
