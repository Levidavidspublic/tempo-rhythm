---
ticket: TEMPO-B04-04
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/template-builder/
depends_on: [TEMPO-B04-01]
contract:
  - "api.templates.get(args: {templateId: string}) -> Template | null"
  - 'api.templates.create(args: {name, description?, periodType, body}) -> Id<"templates">'
  - 'api.templates.update(args: {templateId, name?, description?, periodType?, body?}) -> Id<"templates">'
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people who want to adjust a template at /templates/builder and /templates/editor/[id]
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §5 "Templates as architecture": the app proposes templates; "the user never hand-builds one" (so the builder starts from a proposed starter via `?from=<id>`, not a blank canvas). §6: "The user never sees JSON".
GOAL: the builder creates a template (prefilled from a starter via `?from=<id>`) and the editor edits an existing user template, both through one shared form.
SCOPE: apps/web/components/template-builder/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/template-builder/TemplateForm.tsx (new), apps/web/components/template-builder/TemplateBuilder.tsx (new, exports `TemplateBuilderScreen` and `TemplateEditorScreen`), apps/web/components/template-builder/TemplateForm.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Build `TemplateForm` with name (required), description, periodType select, and a markdown body textarea with live preview; Save is disabled until the name is non-empty.
3. `TemplateBuilderScreen({fromId?})`: if `fromId`, prefill from `templates.get`; Save calls `templates.create`, then `router.push("/templates")`.
4. `TemplateEditorScreen({templateId})`: load with `templates.get`; a starter template (`source === "starter"`) is read-only with a "Make my own copy" button that opens the builder with `?from=`; user templates Save via `templates.update`. Null -> a not-found state.
5. Add or extend one test for the behaviour (apps/web/components/template-builder/TemplateForm.test.tsx, Vitest + Testing Library, mock `convex/react`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows Save disabled for an empty name, create called with the form values, starter shown read-only; checks green.
EVIDENCE: test output; screenshots of builder and editor.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
- don't add drag-and-drop block editing or any feature the PRD does not list
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(bare)/templates/builder/page.tsx must import `TemplateBuilderScreen` and apps/web/app/(tempo)/templates/editor/[id]/page.tsx must import `TemplateEditorScreen` (hot files, merge agent wires them).
