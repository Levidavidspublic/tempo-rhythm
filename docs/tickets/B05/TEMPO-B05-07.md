---
ticket: TEMPO-B05-07
batch: B05
loop: f3-2
type: component
lane: claude
browser_test: false
scope:
  - apps/web/app/(tempo)/settings/nags/
  - apps/web/app/(tempo)/settings/memory/
  - apps/web/lib/tempo-nav.ts
  - tests/e2e/wiring/settings-nags-memory.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people managing their nags and what Tempo remembers
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B03.md "Hot files": NEW settings/nags/page.tsx: NagList + NagPhraseEditor; NEW settings/memory/page.tsx: MemoryManager (+ MemoryExport, which does not exist yet: skip and report); Sidebar/Topbar: nav entries for the two new settings routes (entries live in apps/web/lib/tempo-nav.ts). CHECKLIST §3 (#652, #654, #653).
GOAL: new /settings/nags shows NagList and, for the selected nag, NagPhraseEditor; new /settings/memory shows MemoryManager; both appear in the Settings navigation.
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: apps/web/app/(tempo)/settings/nags/page.tsx (new, + a small client screen in that folder), apps/web/app/(tempo)/settings/memory/page.tsx (new), apps/web/lib/tempo-nav.ts, tests/e2e/wiring/settings-nags-memory.spec.ts (new)
STEPS:
1. Read NagList (`onSelect`), NagPhraseEditor (`nagId`) and MemoryManager.
2. /settings/nags: client screen holding the selected nag id; NagList onSelect opens NagPhraseEditor for it. /settings/memory: MemoryManager.
3. Add two Settings entries to apps/web/lib/tempo-nav.ts (Nags -> /settings/nags, Memory -> /settings/memory) using existing icons.
4. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
5. Add tests/e2e/wiring/settings-nags-memory.spec.ts: both routes render their component marker and the Settings nav links exist.
6. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: the spec passes in CI; both routes exist and are linked from the sidebar.
EVIDENCE: Playwright output.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
- don't change apps/web/components/tempo/Topbar.tsx (TEMPO-B05-06 owns it)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. Under `notes for ticket sync`: MemoryExport (B03 contract) does not exist yet.
