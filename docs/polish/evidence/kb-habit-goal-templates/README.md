# Habit/Goal personal template draft evidence

Issue: #1303 — TEMPO-KB-HABIT-GOAL-DRAFTS. State: **coded; validation pending**. This draft publication makes the source reviewable while the lead schedules the exclusive validation slot. It establishes no runtime, live preview or real persistence result.

## Frozen source and candidate ledger

Branch: `t/1303-habit-goal-templates`. Verified integration parent: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. The final candidate 3 publication commit is the PR head; no local validation command has run against that head. Hosted candidate 2 failures below are historical and remain preserved. Exactly three implementation files and one test file, plus this scoped evidence README. Existing CSS is reused to respect AGENTS.md's three-source cap instead of the older new-CSS convention.

| Candidate | Source-only review | Validation |
| --- | --- | --- |
| 1, frozen 2026-10-22 13:15:47 UTC | Lead and independent peer identified a test cleanup defect: rejected browser close could skip server stop, and the owned temporary directory was not removed. No concrete production draft/locale/editor/Save defect found statically. Original four-file snapshot and manifest preserved in the task's external scratch directory. | UNKNOWN; no test/compiler/browser/install/build run. |
| 2, frozen 2026-10-22 13:21:50 UTC | Scoped test-only correction starts browser close, server stop and removal of the exact owned temporary directory independently; aggregates every cleanup error and retains its cause. Lead reviewed the correction. Production hashes and all 22 cases/assertions/deadlines retained. Candidate 1 remains preserved. | Hosted eea93b9: Lint FAIL (one native-status semantic error), Test FAIL (fixture beforeAll scheduler read error; 3492 pass / 3 todo / 2 fail overall); zero own cases reached. Local checks UNKNOWN. |
| 3, frozen 2026-10-22 14:00:57 UTC | Lead and independent peer statically reviewed native output correction and standalone child bundling with file-based diagnostics; no further concrete defect found statically. All 22 cases/assertions/deadlines unchanged. | Current local and hosted gates UNKNOWN. **Final attempt: 3 of 3 used; no fourth source/test candidate.** |

Candidate 1 test SHA256: `465bfe55b0c94389a3dff7ac903489910ba374deeebcb9da1f1add0c42e0c1ea`. Candidate 2 frozen hashes:

| File | SHA256 |
| --- | --- |
| `apps/web/components/template-builder/TemplateBuilder.tsx` | `da19e69650ef6c87c9b5f5b1f9c0bb4604ba4895b1682ef2ef3761f627f320ef` |
| `apps/web/components/template-builder/HabitGoalTemplates.tsx` | `dc39dda32a24b27d955b5097fecdce70126511b22531998c776f30d5c7c1c03f` |
| `apps/web/lib/i18n-groups/habit-goal-templates.ts` | `f3765af494fabdfbbcd0a2c3daa21a45bcc0afbe32a5bc83060085ac1572841c` |
| `tests/unit/tempo-habit-goal-templates.test.tsx` | `1fc7d8c13178da9a172539ec62cf65ba6c036c16896290f4b374822a5e1c2ea8` |


Candidate 3 final frozen hashes (candidate 2 hashes above remain historical):

| File | SHA256 |
| --- | --- |
| `apps/web/components/template-builder/TemplateBuilder.tsx` | `da19e69650ef6c87c9b5f5b1f9c0bb4604ba4895b1682ef2ef3761f627f320ef` |
| `apps/web/components/template-builder/HabitGoalTemplates.tsx` | `85f56159715fe7bfa60b1119c5b7018c96aae84638bf89f9553d4954be95d9a1` |
| `apps/web/lib/i18n-groups/habit-goal-templates.ts` | `f3765af494fabdfbbcd0a2c3daa21a45bcc0afbe32a5bc83060085ac1572841c` |
| `tests/unit/tempo-habit-goal-templates.test.tsx` | `e311976cbaa59649682ac79ee40a9f8dca3bfecd3ab35b01507508aa417c882b` |

Only the disabled-selection reason changes in production: native `<output>` preserves its existing class/id and implicit status semantics. Browser fixture compilation now runs in a standalone scratch Bun child importing no test module or suite mocks. The parent retains all actual tests, browser/server and independent cleanup. Child stdout/stderr target exact owned regular files; authoritative exit is bounded at 90s, TERM grace at 5s, KILL notification at 2s, and each bounded diagnostic read at 5s/256 KiB. Missing exit notification, timeout, nonzero exit, diagnostic overflow/read failure and signal errors all fail setup. Existing 120s setup and matrix deadlines are unchanged.

## Hosted candidate 2 failure receipts (historical)

Head `eea93b9fc0d468b776fe5ce885bfc772bed288f7`; CI checked merge `d18f6316e8d4a1c2155ec063bfe9cda6160a4757` into integration parent `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`, using Bun `1.3.9+cf6cdbbba`. [CI run 39788308365](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39788308365).

| Historical command | UTC start/end | Authoritative result |
| --- | --- | --- |
| `bun run lint` | 13:36:34.8326869 / 13:36:36.1233690, 2026-10-22 | Exit 1. Web one error: `HabitGoalTemplates.tsx:37 lint/a11y/useSemanticElements` requires native output. Nine web warnings also reported. |
| `bun run test` | 13:36:36.3180559 / 13:41:09.5768808, 2026-10-22 | Exit 1. 3492 pass / 3 todo / 2 fail, 3497 tests across 212 files. Own beforeAll failed after 55ms before any of the 22 cases ran: unexpected scheduler/index.js read. Later shared-codec browser bundle reported react-dom-server imports inside zod/index.js. Resolver contamination is **unproven**; the new isolated fixture remedy has not run. |

Full masked logs and SHA256 receipts remain preserved in external task scratch. Log SHA256: lint `5ca9498170ab6fdfeadcf370dc830d1d9406f778c3653ee55f0f21205024e9cf`; test `0e8cb4613b27b1e861acc154dc0495ad270aaaa57fa718ca11bbd73967c8f5e7`. Historical types/build/E2E/scans/notices passed in that run; none establish final candidate 3 results. No claim of actual CodeRabbit coverage.

Historical lint command failure tail (last 20 lines through authoritative exit; trailing whitespace trimmed, raw logs preserved):

```text
2026-10-22T13:36:36.1227063Z
2026-10-22T13:36:36.1227164Z
2026-10-22T13:36:36.1227334Z Checked 482 files in 770ms. No fixes applied.
2026-10-22T13:36:36.1227627Z Found 1 error.
2026-10-22T13:36:36.1227846Z Found 9 warnings.
2026-10-22T13:36:36.1228391Z lint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-10-22T13:36:36.1228693Z
2026-10-22T13:36:36.1228898Z   × Some errors were emitted while running checks.
2026-10-22T13:36:36.1229184Z
2026-10-22T13:36:36.1229283Z
2026-10-22T13:36:36.1229443Z error: script "lint" exited with code 1
2026-10-22T13:36:36.1229637Z
2026-10-22T13:36:36.1229763Z  Tasks:    4 successful, 5 total
2026-10-22T13:36:36.1230042Z Cached:    0 cached, 5 total
2026-10-22T13:36:36.1230282Z   Time:    1.232s
2026-10-22T13:36:36.1230545Z Failed:    tempo-rhythm-web#lint
2026-10-22T13:36:36.1231000Z
2026-10-22T13:36:36.1231161Z  ERROR  run failed: command  exited (1)
2026-10-22T13:36:36.1231500Z error: script "lint" exited with code 1
2026-10-22T13:36:36.1233690Z ##[error]Process completed with exit code 1.
```

Historical test command failure tail (last 20 lines through authoritative exit; trailing whitespace trimmed, raw logs preserved):

```text
2026-10-22T13:41:09.5179470Z
2026-10-22T13:41:09.5179800Z ##[endgroup]
2026-10-22T13:41:09.5179941Z
2026-10-22T13:41:09.5180033Z 3 tests todo:
2026-10-22T13:41:09.5180719Z (todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
2026-10-22T13:41:09.5181676Z (todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
2026-10-22T13:41:09.5182472Z (todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages
2026-10-22T13:41:09.5182852Z
2026-10-22T13:41:09.5182858Z
2026-10-22T13:41:09.5182955Z 2 tests failed:
2026-10-22T13:41:09.5183326Z (fail) Habit/Goal personal template drafts > (unnamed) [55.00ms]
2026-10-22T13:41:09.5184115Z (fail) shared codec is browser-safe > a browser-target bundle of the public entry reaches no Convex, Node or external module [4.00ms]
2026-10-22T13:41:09.5184839Z
2026-10-22T13:41:09.5184933Z  3492 pass
2026-10-22T13:41:09.5185242Z  3 todo
2026-10-22T13:41:09.5185434Z  2 fail
2026-10-22T13:41:09.5185642Z  81356 expect() calls
2026-10-22T13:41:09.5185935Z Ran 3497 tests across 212 files. [273.20s]
2026-10-22T13:41:09.5747562Z error: script "test" exited with code 1
2026-10-22T13:41:09.5768808Z ##[error]Process completed with exit code 1.
```

## Test results (cloud agent sandbox)

**Bun version: UNKNOWN — not run; required executable is Bun 1.3.9.** All runtime stages await the lead's explicit exclusive slot; no earlier baseline result is claimed as current-source evidence. Publication does not waive any stage. Preserve start/end, exact checked commit, authoritative exit, counts and the last 20 lines of any failure in external receipts and the PR evidence after execution. Do not create an evidence-only follow-up commit after validation.

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

The single test file contains 22 named cases after loop expansion: two pure cases and twenty real mounted Chromium cases. This is a planned count, not a passing count. The browser bundle uses actual TemplateBuilderScreen, TemplateBodyEditor, ReadView, LocaleProvider and ThemeProvider. Only Convex and navigation/link boundaries are substituted with fictional local data. No process-global module mocks, real accounts or provider calls are used. Only fixture bundling/CSS compilation moves to a fresh child; every existing behavior assertion stays in its original test.

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
