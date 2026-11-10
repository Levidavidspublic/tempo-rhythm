---
ticket: TEMPO-B04-03
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/template-run/
depends_on: [TEMPO-B04-01]
contract:
  - "api.templates.get(args: {templateId: string}) -> Template | null"
  - "api.templates.proposeForPage(args: {periodType, title?}) -> {templateId, name, reason} | null"
  - 'api.templates.applyToNote(args: {templateId: string, title?: string}) -> Id<"notes">'
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people creating a page from a template at /templates/run/[id]
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §5 "Templates as architecture": "The app proposes the right template when a page is created; the user never hand-builds one." §6: "Accept / reject is law: the model proposes, the user accepts, code writes."
GOAL: /templates/run/[id] previews a template, shows the app's proposal reason, and on Accept creates the page and opens it; Reject goes back to /templates.
SCOPE: apps/web/components/template-run/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/template-run/TemplateRun.tsx (new), apps/web/components/template-run/ProposalBanner.tsx (new), apps/web/components/template-run/TemplateRun.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Build `TemplateRun({templateId})`: `useQuery(api.templates.get, {templateId})`; null -> a calm "This template was not found" state with a link back to /templates (no crash on a bad id).
3. Show the template name, a rendered markdown preview (no raw JSON), an optional title input, and `ProposalBanner` using `api.templates.proposeForPage` for the template's periodType, showing its `reason` text.
4. Accept calls `templates.applyToNote({templateId, title})` then `router.push("/notes/" + id)`; Reject is a plain button to /templates. Disable Accept while pending and show an inline error on failure.
5. Add or extend one test for the behaviour (apps/web/components/template-run/TemplateRun.test.tsx, Vitest + Testing Library, mock `convex/react` and `next/navigation`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows: not-found state for a null template, Accept calls `applyToNote` once and navigates to /notes/<id>, Reject navigates to /templates; checks green.
EVIDENCE: test output; screenshot of the run screen.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
- don't call a model; the page is created only after the user clicks Accept
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(bare)/templates/run/[id]/page.tsx must import `TemplateRun` (hot file, merge agent wires it).
