# KB-73 landing theme control evidence

The existing public `/` landing page mounts `ThemeToggle` through `LandingPage` without a route change. Source/test commits: `762ae648fd00638012cf3cb8cc01c11b83ad9a4a` and CI correction `40c77346305743c73db6fa2b718541995412182a` on `t/1170-kb-73` (base `52bf2803e9105b25c2538aedd81a754a9fbfdedb`). The exact original `ThemeToggle.tsx` and unchanged `LandingPage.tsx` were frozen under `/workspace/work/kb-73-capture/` before editing. Their SHA-256 values, `d8f7f7aa116cb12a5dc870b72e2ba9b7496f7ced795b0de827d6e72551d24ad3` and `c5d6cff3896d00d0b5fe07f65d81c8532d74cc15a1800f0c8db32dc874160d8f`, exactly match integration commit `52bf280`. The before capture imported those frozen originals after the source branch already contained the new control; its fixture did not import the revised host. Both contact-sheet fixtures served the same compiled integration marketing CSS and local font assets from KB-44 source `4a3b908` (main stylesheet SHA-256 `c7f0d1f7674e36d2b13cdcffc6c89533a0e595ebd378224d36e86148d124016e`); marketing source in that build is unchanged from this ticket's integration base. The after capture added only this ticket's bundled scoped CSS. The separate hydrated browser test compiles the app's actual `globals.css` through its installed Tailwind PostCSS plugin. Both capture fixtures render the actual `LandingPage` and actual `@tempo/ui` brand and icon modules. Only ThemeProvider, LocaleProvider and Next Link are replaced at their external boundaries with fictional local context/navigation. No account or backend is exercised.

The existing control had `h-9 w-9` with compiled 4 px spacing, giving 36×36 px. It also used an English-only accessible name. The changed control retains the real `useTheme().resolvedTheme` decision, 16 px Moon/Sun SVG and `setTheme(next)` callback. Its next-action accessible name is selected from a typed English/Hebrew dictionary, and its scoped v3 CSS sets a 44×44 px target and visible focus treatment. The exported `Kb73Gallery` reuses this exact control with working locale and preference controls; it is not a product route or another primary view.

The [contact sheet](kb-73-landing-theme-control-has-a-reachable-localized-name.jpg) compares the mounted landing page in English and Hebrew, light and dark, at 390 and 1280 px. It shows the first 420 px of each phone capture and the first 840 px of each desktop capture scaled to the same 420 px row. The full 900 px viewport screenshots remain in the scratch evidence directory. All eight before cases measured the original button at 36×36 px and used English action names even on the Hebrew page. All eight after cases measured 44×44 px; the Hebrew action names were `מעבר למצב כהה` and `מעבר למצב בהיר`. Every capture reported one `main`, one `h1`, no horizontal overflow and no browser page error. Both captures used the same compiled marketing CSS and fonts; only the updated host added `kb-73.css`.

The first scratch-only before capture failed on `Could not resolve: "react/jsx-dev-runtime"` from the frozen entry. A resolver patch then failed to parse (`Expected "}" but found "=>"`). After correcting that patch, a browser-free source parse and actual frozen-before Bun bundle both passed; the final eight-state before capture exited 0. These attempts changed only the ignored capture harness, not product or test files.

New named cases in `tests/unit/kb-73.test.tsx`:

1. English light shows Moon, names dark action, and sets explicit dark
2. English dark shows Sun, names light action, and sets explicit light
3. Hebrew light names the dark action with Moon
4. Hebrew dark names the light action with Sun
5. system preference resolved light chooses explicit dark
6. system preference resolved dark chooses explicit light
7. keyboard Tab, Enter and Space show focus and each activate once
8. gallery language switch updates the name without changing theme
9. gallery preference controls use the theme provider
10. phone target measures at least 44 by 44 pixels
11. mounted landing fits phone and desktop across languages and themes
12. English and Hebrew copy keys match

GitHub CI at source/test head `40c77346305743c73db6fa2b718541995412182a` passed full Test (3313 pass, 3 todo, 0 fail), Lint, Typecheck, Build, E2E and e2e-preview, scans, notices, secrets and scope/config guards. The first CI attempt at `762ae64` failed Lint on two gallery `div role=group` semantics and Test on a relative Tailwind package-directory import; `40c77346305743c73db6fa2b718541995412182a` corrected those specific issues. A clean-child browser fixture prevents its Bun resolver from altering later unit tests. All 12 named new cases passed in the second CI Test job.

## Test results (cloud agent sandbox)

Completed local validation on unchanged source/test revision `40c77346305743c73db6fa2b718541995412182a` is recorded below. Non-test checks have no test pass/fail/skip count. No product/test repair was made during evidence finalization.

| Check | Local result |
| --- | --- |
| `bun --version` | exit 0; `1.3.9`. |
| `bun install --frozen-lockfile --offline` | exit 0 previously; 2000 packages. |
| `bun install --frozen-lockfile` | exit 0; 1033 installs checked across 1079 packages, no changes. |
| `bun run lint` | exit 0; 5/5 tasks, 0 errors; web lint reports 9 warnings. |
| `bun run typecheck` | exit 0; 5/5 tasks. |
| `bun run test` | exit 0; 3313 pass, 0 fail, 3 todo; 3316 tests / 202 files; 81030 outer assertions. All 12 KB-73 wrapper cases pass; its clean child runs the actual browser cases once. |
| `bun run scan:forbidden-tech` | exit 0; OK. |
| `bun run scan:ram-only-audit` | exit 0; OK (6 hard deletes, baseline 10). |
| `bun run scan:design-tokens` | exit 0; OK (arbitrary hex 4/18, raw hex 2/2). |
| `bun run check:notices` | exit 0; OK (66 documented). |
| `CI=1 bunx playwright test --reporter=line` | exit 1; 27 pass, 1 fail, 89 skipped. Failure: task-views-core expected edited task title on Priority at line 47; test timeout/session closed. Local E2E is not green. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | exit 0; 1/1 task successful, 0 cached. Also used process-only `TURBO_CACHE=local:r`; no config/file change. |
| `bun test tests/unit/kb-73.test.tsx` | exit 0; 12 pass, 0 fail, 12 outer wrapper assertions in 166.66s; child browser cases ran once, eight screenshots saved. |
| frozen-before mounted capture | final exit 0 (`before-final.log`), superseding earlier scratch-only errors; 8/8 states, 36×36 px button, English action name in both locales. |
| current mounted after capture | exit 0; 8/8 states, 44×44 px button, en/he action name. |

Scans ran individually in their prescribed order to retain each result; existing Chromium used a process-only browser path. A read-only search found no separate existing landing-specific route wiring test. The unchanged full local E2E suite was run. On 2026-10-20 the contact sheet was visually reviewed and frozen host/landing hashes were rechecked against the base: both match. Eight successful before rows and eight after rows confirm button dimensions, one main/h1 and no horizontal overflow. The early `fixture-results.txt` `before exit=1` entry belongs to the superseded scratch harness run, not the final frozen-before capture.

Hebrew is machine-drafted for Amit's native review. Device screen-reader behavior and live theme persistence beyond the isolated fixture remain UNKNOWN.


## Failure logs (last 20 lines, or entire shorter log)

`CI=1 bunx playwright test --reporter=line`

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:127765) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:127856) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.6m)
```

Historical scratch-only frozen-before capture: missing JSX runtime alias

```text
error: Could not resolve: "react/jsx-dev-runtime". Maybe you need to "bun install"?
    at /workspace/work/kb-73-capture/entry-before.tsx

Bun v1.3.9 (Linux x64)
```

Historical scratch-only frozen-before capture: resolver syntax typo

```text
24 | er: /^react\/jsx-(dev-)?runtime$/, args => ({ path: join(web, "node_modules/react", `${args.path.slice("react/".length)}
                                                                       ^
error: Expected "}" but found "=>"
    at /workspace/work/kb-73-capture/capture.tsx:24:67

Bun v1.3.9 (Linux x64)
```

The current local E2E failure is outside the scoped theme control. No unrelated task test or product file was changed, and no repeat was run solely to replace the observed failure with green. The source-head GitHub checks were independently observed green; that does not erase this failed local requirement. Evidence-head checks may run again and are not claimed green.

```text
status: blocked
ticket: #1170
evidence: source 40c77346305743c73db6fa2b718541995412182a; install/lint/typecheck/four scans/build pass; full test 3313 pass/0 fail/3 todo; own focused browser 12 pass/0 fail; before/after capture 8/8 each; local E2E 27 pass/1 fail/89 skipped
changed: apps/web/components/marketing/ThemeToggle.tsx; apps/web/lib/i18n-groups/kb-73.ts; apps/web/app/v3/kb-73.css; tests/unit/kb-73.test.tsx; two scoped evidence artifacts
unknowns: device screen reader; live theme persistence beyond the fixture
notes for ticket sync: DONE remains blocked by local task-views-core E2E failure outside scope; Hebrew machine-drafted for native review; no backend/route/config changes
```
