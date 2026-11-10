---
name: Factory component ticket
about: One component of a loop (factory/LOOP.md). Never touches convex/. Lane follows browser_test.
title: "[TEMPO-Bxx-NN] <goal>"
labels: ["ticket:component"]
---
---
ticket: TEMPO-Bxx-NN
batch: Bxx
type: component
lane: claude             # browser_test: true -> cursor (preferred) or codex; false -> claude
browser_test: false      # true = DONE needs a real browser / Playwright run on a cloud computer
scope:
  - apps/web/components/<feature>/
depends_on: [TEMPO-Bxx-01]   # ticket 0 (Convex architecture), already on integration
contract:
  - api.<module>.<name>(args: {...}) -> <ReturnType>
overlap_test: false
expected_merge: clean
hold: false
---

FOR:
WHEN: loop Bxx, after ticket 0 landed on integration
WHY:
GOAL:
SCOPE: the folder above only. Size: about 3 files plus 1 test.
MUTATES:
STEPS:
1. Query the Graphify graph for the MUTATES files and their dependents.
2.
3. `bun run lint && bun run typecheck && bun run test`.
DONE:
EVIDENCE:
DO NOT:
- don't change convex/ (ticket 0 owns it; scope-guard fails the PR unless Amit labels it convex-arch)
- don't change files outside scope, .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews only the loop's batch PR)
REPORT:
