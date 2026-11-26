---
ticket: TEMPO-B04-02
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/templates-library/
depends_on: [TEMPO-B04-01]
contract:
  - 'api.templates.list(args: {scope?: "all"|"starter"|"mine"}) -> Template[]'
  - 'api.templates.remove(args: {templateId: Id<"templates">}) -> null'
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people browsing templates at /templates
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §5 "Templates as architecture": "Starting set adapted from popular public Joplin, Notesnook, Notion and Obsidian templates (structure, not text)." §4.1 A4: every control on every signed-in screen works.
GOAL: /templates shows the starter set and the user's own templates, with Use (opens /templates/run/<id>), Edit (opens /templates/editor/<id>, own templates only) and Delete (confirm, soft delete).
SCOPE: apps/web/components/templates-library/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/templates-library/TemplatesLibrary.tsx (new), apps/web/components/templates-library/TemplateCard.tsx (new), apps/web/components/templates-library/TemplatesLibrary.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Build `TemplatesLibrary` (client component, `useQuery(api.templates.list, {scope: "all"})`) with a loading skeleton, an empty state, and filter tabs All / Starter / Mine.
3. Build `TemplateCard` (name, description, period badge, section headings preview). Use -> `/templates/run/${templateId}`; Edit and Delete only when `source === "user"`; Delete asks for confirmation, then calls `templates.remove`. A "New template" button links to `/templates/builder`.
4. Starter ids contain a colon: URL-encode them in links.
5. Add or extend one test for the behaviour (apps/web/components/templates-library/TemplatesLibrary.test.tsx, Vitest + Testing Library, mock `convex/react`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows starter cards render, Delete is absent on starter cards and calls `templates.remove` on user cards after confirm; checks green.
EVIDENCE: test output plus a screenshot of /templates on the preview (path in the PR).
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
- don't use shame wording (PRD §6)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(tempo)/templates/page.tsx must import `TemplatesLibrary` (hot file, merge agent wires it).
