---
name: Factory data ticket
about: Ticket 0 of a loop - the ONE ticket that owns convex/ (schema, indexes, queries/mutations/actions, generated types) for every component in the loop. See factory/LOOP.md.
title: "[TEMPO-Bxx-01] <goal>"
labels: ["ticket:data"]
---
---
ticket: TEMPO-Bxx-01
batch: Bxx
type: data
lane: claude             # ticket 0 (data) is always claude
browser_test: false
scope:
  - convex/
depends_on: []
contract:                # every name this ticket must create, exactly as component tickets will call it
  - api.<module>.<name>(args: {...}) -> <ReturnType>
overlap_test: false
expected_merge: clean
hold: false              # ignored for data tickets: they are never held
---

FOR:
WHEN:
WHY:
GOAL:
SCOPE: convex/ only (schema, functions, AND the regenerated convex/_generated/ files)
MUTATES:
STEPS:
1. Change convex/ (schema + functions) to provide every name in `contract:`.
2. Regenerate the generated code with `bunx convex codegen` and COMMIT `convex/_generated/` in this PR (codegen needs Convex auth, see AGENTS.md 8.8). Component PRs typecheck against these files; without them they fail.
3. `bun run typecheck && bun run test`.
DONE: every `contract:` name exists in convex/_generated/api.d.ts; checks green.
EVIDENCE:
DO NOT: deploy anything (merge to integration deploys to TEST ceaseless-dog-617 via convex-deploy-test; live is Amit's); touch files outside convex/.
REPORT:
