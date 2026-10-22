# Habit/Goal personal template draft evidence

Issue: #1303 — TEMPO-KB-HABIT-GOAL-DRAFTS. State: **coded; validation pending**. This draft publication makes the source reviewable while the lead schedules the exclusive validation slot. It establishes no runtime, live preview or real persistence result.

## Frozen source and candidate ledger

Branch: `t/1303-habit-goal-templates`. Verified integration parent: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. The publication commit is the PR head; no validation command has run against that head. Exactly three implementation files and one test file, plus this scoped evidence README. Existing CSS is reused to respect AGENTS.md's three-source cap instead of the older new-CSS convention.

| Candidate | Source-only review | Validation |
| --- | --- | --- |
| 1, frozen 2026-10-22 13:15:47 UTC | Lead and independent peer identified a test cleanup defect: rejected browser close could skip server stop, and the owned temporary directory was not removed. No concrete production draft/locale/editor/Save defect found statically. Original four-file snapshot and manifest preserved in the task's external scratch directory. | UNKNOWN; no test/compiler/browser/install/build run. |
| 2, frozen 2026-10-22 13:21:50 UTC | Scoped test-only correction starts browser close, server stop and removal of the exact owned temporary directory independently; aggregates every cleanup error and retains its cause. Lead reviewed the correction. Production hashes and all 22 cases/assertions/deadlines retained. Candidate 1 remains preserved. | UNKNOWN; exclusive slot pending. No fourth candidate authorized; maximum three source/test candidates including review rounds. |

Candidate 1 test SHA256: `465bfe55b0c94389a3dff7ac903489910ba374deeebcb9da1f1add0c42e0c1ea`. Candidate 2 frozen hashes:

| File | SHA256 |
| --- | --- |
| `apps/web/components/template-builder/TemplateBuilder.tsx` | `da19e69650ef6c87c9b5f5b1f9c0bb4604ba4895b1682ef2ef3761f627f320ef` |
| `apps/web/components/template-builder/HabitGoalTemplates.tsx` | `dc39dda32a24b27d955b5097fecdce70126511b22531998c776f30d5c7c1c03f` |
| `apps/web/lib/i18n-groups/habit-goal-templates.ts` | `f3765af494fabdfbbcd0a2c3daa21a45bcc0afbe32a5bc83060085ac1572841c` |
| `tests/unit/tempo-habit-goal-templates.test.tsx` | `1fc7d8c13178da9a172539ec62cf65ba6c036c16896290f4b374822a5e1c2ea8` |

## Test results (cloud agent sandbox)

**Bun version: UNKNOWN — not run; required executable is Bun 1.3.9.** All runtime stages await the lead's explicit exclusive slot; no earlier baseline result is claimed as current-source evidence. Publication does not waive any stage. Start/end, exact checked commit, authoritative exit, counts and the last 20 lines of any failure will be appended after execution; preserve every attempt.

| Command or evidence | Current result |
| --- | --- |
| `git diff --check` | Passed during source preparation; a whitespace-only Git check, not an application check. |
| `bun --version` | UNKNOWN — exclusive validation slot pending. |
| `bun install --frozen-lockfile` | UNKNOWN — exclusive validation slot pending. |
| `bun test tests/unit/tempo-habit-goal-templates.test.tsx` | UNKNOWN — 22 named focused cases prepared, zero executed. |
| `bun run lint` | UNKNOWN — exclusive validation slot pending. |
| `bun run typecheck` | UNKNOWN — exclusive validation slot pending. |
| `bun run test` | UNKNOWN — exclusive validation slot pending. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | UNKNOWN — exclusive validation slot pending. |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN — exclusive validation slot pending. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN — exclusive validation slot pending. |
| Current CI, actual CodeRabbit coverage and all merge guards | UNKNOWN — required before integration merge. |
| Actual mounted screenshots/contact sheet, live preview, real persistence | UNKNOWN — none captured or verified. |

## Focused coverage prepared

The single test file contains 22 named cases after loop expansion: two pure cases and twenty real mounted Chromium cases. This is a planned count, not a passing count. The browser bundle uses actual TemplateBuilderScreen, TemplateBodyEditor, ReadView, LocaleProvider and ThemeProvider. Only Convex and navigation/link boundaries are substituted with fictional local data. No process-global module mocks, real accounts or provider calls are used.

1. English/Hebrew dictionary parity and nonempty values.
2. Four distinct ordinary Markdown outlines, five headings and a checklist, reusable `periodType: "none"`.
3. Preview/close renders actual ReadView without draft edits, writes or navigation; restores focus.
4. Explicit Habit choice populates the actual editor and both fields.
5. Explicit Goal choice populates the actual editor and both fields.
6. Dirty-name replacement guard.
7. Dirty-description replacement guard.
8. Dirty-body replacement guard.
9. Preview opened before later typing cannot replace the draft.
10. Clearing prior edits does not regain untouched status.
11. A selected outline cannot be replaced by a second outline.
12. Pending Save disables selection and sends a single create call.
13. Source-copy initialization omits the selector and retains its draft.
14. Existing-template editing omits the selector and retains its draft.
15. Sketch initialization omits the selector and retains its draft.
16. Invalid incoming sketch also omits the selector.
17. Locale changes update controls without rewriting selected/typed fields or editor content.
18. Save sends exactly the current edited payload through existing create.
19. Rejected Save retains all fields/editor and does not navigate.
20. Retry submits the retained Hebrew draft and navigates only after success.
21. Keyboard preview/close/Choose, visible focus and actual editor population.
22. Eight-view 390/1280, EN/HE, light/dark matrix: 44px gallery targets, one main/h1, no overflow, reduced motion, guarded replacement and editable selected body.

## Before/after capture pending

No screenshots are attached because no browser has run. The separately prepared external scratch capture mechanism loads immutable actual-parent TemplateBuilder bytes through a browser-bundle override; it does not change this checkout. Later capture eight **actual parent before** views and corresponding **candidate gallery after** / **selected edited draft after** views. The new gallery before selection is an after state, not the pre-change baseline. The labeled contact sheet and diagnostics remain pending. Evidence directories remain separate from each fixture's exact owned temporary directory.

These mounted tests and captures use a mocked create result. They can demonstrate UI payload, error/retry behavior and navigation; they cannot demonstrate real persistence, an authenticated template list, a deployed preview or every-page completion.

## Mutation and ownership contract

Preview, close, Choose and UI language changes make zero backend calls. Explicit pristine selection only initializes local fields. The existing BuilderForm Save owns `templates.create({ name, description?, periodType: "none", body })`, returns a personal template ID, navigates to `/templates` only after success and retains the draft on rejection. Existing copy/edit/sketch and later Edit/Use flows keep their existing responsibilities.

No backend, schema, route, environment, configuration, dependency, root translation registration or deployment change. No built-in server catalog or new habit/goal entity. TemplatesLibrary and its owners #1081/#1053/KA1104, protected PRs #1193/#1198 and old release #728 remain untouched; future movement of #728 may need reconciliation. Hebrew is machine-drafted for Amit's later native read.

## AGENTS report

status: blocked — validation slot pending; source published as a draft only

ticket: #1303

evidence: `git diff --check` passed; mandatory/runtime checks and screenshots UNKNOWN

changed: three scoped implementation files, one scoped test file, this evidence README

unknowns: focused/broad checks, mounted runtime behavior/screenshots, current CI, actual CodeRabbit coverage, merge guards, live preview, real persistence and native Hebrew review

notes for ticket sync: execute every mandatory stage in the exclusive slot even after failures; retain all attempts; integration merge requires all gates; no production/default direct push or deployment
