---
ticket: TEMPO-FEATURE-CHECKBOX
batch: FEATURE
type: component
lane: sol
wave: 1
browser_test: true
scope:
  - apps/web/components/editor/live-preview.ts
  - tests/unit/tempo-pages-checkbox.test.tsx
  - docs/polish/evidence/feature-checkbox/
depends_on: []
overlap_test: false
expected_merge: clean
hold: false
---

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE.
WHEN: Amit's 21 October second-lane steer; independent worktree, shared register, four total worktrees across both lanes. No Lane 1 writer owns live-preview.ts. KA-08 #1101 and older drafts #1081/#1053 touch this file; leave those PRs untouched and record required later reconciliation. This is the explicitly requested narrow bug fix, not their broad polish scope.
WHY: docs/HARD_RULES.md and docs/design/v3/DESIGN.md; Amit's explicit preview feature request.
GOAL: Typing - [ ] followed by a space renders a real checkbox on the active editable line; its text remains editable and checkbox toggles preserve Markdown and Undo.
SCOPE: Exactly the listed paths, at most three implementation files plus one test; evidence is metadata only.
MUTATES: UI and scoped tests only; no backend, schema, routes, dependencies, environment or deployment.
CONTRACT: Existing UI props only; no new backend calls or paid runtime behavior.
STEPS:
1. Code map: Read LivePreviewEditor.tsx pageSurface/pageLanguage, live-preview.ts inlineDecorations and CheckboxWidget, PageEditorView.tsx, DailyPage.tsx and today-live-preview.test.ts. Reproduce the active-line TaskMarker suppression before editing.
2. Implement the smallest fix using existing design tokens and mounted components. Preserve existing copy unless the scope explicitly includes translation. No orphan components.
3. Mounted editor regression for typing the exact prefix, completed/empty items, toggling, undo/redo, cursor/selection editing, code fences and Hebrew; existing editor tests retained. Capture actual editor before/after at phone and desktop sizes.
4. Run Bun1.3.9 and all AGENTS mandatory commands in order; preserve every existing check, assertion and timeout. Report exact failures and UNKNOWN.
DONE: Focused tests and current-head CI, CodeRabbit review and all guards pass before queueing into integration. bun run lint 0errors; bun run typecheck5/5; bun run test0fail; four scans/notices pass; local Playwright and build results reported exactly. A draft or local fixture is not proof of preview deployment.
EVIDENCE: Scoped evidence folder records source commit, focused test counts, command table/failure tails, before/after images at390/1280 in en/he, with fictional fixtures.
DO NOT: No forbidden technology, raw colors/pixel values outside tokens, test weakening/skips, new paid calls, keys/env access, deployment, production/default branch push, labels or bot commands. Do not change #1193/#1198 or any Lane 1 files. No live charges. Preserve reduced motion, keyboard access, visible focus,44px phone targets, one main/h1 and RTL. New Hebrew copy, if any, requires native read before production.
REPORT: Draft PR into integration with Closes issue reference and AGENTS status/ticket/evidence/changed/unknowns/notes format. Lead updates docs/kitchen/kb/OVERNIGHT-REPORT.md.
