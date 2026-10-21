# Editable page checkbox evidence

WALK — Issue #1205, Lane 2. Integration baseline: `39b564ec329705587df5262ed5a061bbec9a1e8f`. These are local fictional editor fixtures, not preview or live-account proof.

## Defect and change

The shared editor's `TaskMarker` branch returned without drawing a checkbox whenever its line held the caret. A direct CodeMirror state reproduction returned zero widgets for `- [ ] ` at caret 6, and for `- [ ] Task` at caret 10; moving to the following line drew the checkbox.

Checkboxes now remain controls while the line is edited. Their native input sits inside a token-sized 44-pixel label target, with logical spacing and visible keyboard focus. Toggling changes only the Markdown marker and restores keyboard focus to the replacement widget. No new copy, schema, route, dependency or backend behavior is introduced.

Real mounts remain `DailyPage → NotePage → PageEditorView → LivePreviewEditor`, with weekly and ordinary pages using the same editor. The browser fixture mounts that actual `LivePreviewEditor`; it does not reproduce its implementation.

## Validation

| Check | Result |
|---|---|
| Bun | 1.3.9 |
| Existing editor tests: today-live-preview, round-trip, markdown-model, clipboard | 57 pass / 0 fail; 272 assertions |
| Active-line CodeMirror state after change | 1 checkbox widget; original document bytes unchanged |
| Scoped product lint | Passed |
| Scoped test TypeScript compilation | Passed |
| New mounted browser tests | 8 pass / 0 fail; 39 assertions; 56.19 seconds; authoritative exit 0 |
| Mandatory broad gates | Source-specific results are recorded below; current-head merge gates remain with the lead |
| Preview behavior | UNKNOWN; no preview deployment or real account was exercised |

The first before-image capture hit its unchanged 60-second matrix deadline after seven images. Bun reported 0 pass / 1 fail / 1 error, with seven other cases filtered out. That was a screenshot-fixture run before the product fix, not a passing regression run. The failing operation was a screenshot after its browser was closed by the deadline. Fixture setup now reuses its page and inserts the screenshot text in one input operation; the actual typing regression still types the exact prefix. The deadline is unchanged. The offline stylesheet loader also now removes the complete one-line font import, including URL semicolons.

Failure tail (initial before-image capture):

```text
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

 log: [ "  - taking page screenshot", "  - waiting for fonts to load...", "  - fonts loaded" ],

      at /workspace/work/lane2-pages/tests/unit/tempo-pages-checkbox.test.tsx:196:15
      at processTicksAndRejections (native:7:39)
-------------------------------

(fail) editable page checkboxes > captures the actual mounted page editor in both languages and widths [60470.24ms]
  ^ this test timed out after 60000ms.

 0 pass
 7 filtered out
 1 fail
 1 error
 17 expect() calls
Ran 1 test across 1 file. [66.66s]
```

Before images under `before/` show the actual original editor at 390 and 1280 pixels in English and Hebrew; all four light-theme combinations exist. Fonts use available local fallbacks, with no external font fetch. No real account data appears.

The final mounted run passed all eight cases, including the unchanged 60-second screenshot matrix (12.33 seconds). The cases cover the exact typed empty prefix, continued typing, checked/empty items, click and Undo/Redo, keyboard activation with retained visible focus, selected-title editing and cursor motion, code fences/inline code, Hebrew, a 44-pixel phone target and no horizontal overflow. All pages reported zero browser/console errors. Eight after images cover both widths, languages and themes. The owned Bun and Chromium processes exited; the temporary bundle directory, browser and server were cleaned up.

| View | Before | After |
|---|---|---|
| English, 390, light | [Before](before/en-390-light.jpg) | [After](after/en-390-light.jpg) |
| English, 1280, light | [Before](before/en-1280-light.jpg) | [After](after/en-1280-light.jpg) |
| Hebrew, 390, light | [Before](before/he-390-light.jpg) | [After](after/he-390-light.jpg) |
| Hebrew, 1280, light | [Before](before/he-1280-light.jpg) | [After](after/he-1280-light.jpg) |

After images at both widths were also captured in dark mode. The before run captured three dark combinations before its deadline; Hebrew/1280/dark before is unavailable and is not fabricated. The checkbox color token is unchanged.

## Ownership and limits

KA-08/#1101 and older drafts #1081/#1053 also touch `live-preview.ts`. They were not changed. Their future merges need reconciliation with this narrow fix. No Lane 1 files, #1193 or #1198 were edited. The test builds browser code through a bounded fresh Bun CLI process, avoiding inherited process-global mocks; it has no dependency on the unmerged shared harness.

AT — Hebrew fixture labels need native review before production. No production release is authorized.

## Review correction and source-specific broad results

WALK — CodeRabbit identified that the Undo test used a Control shortcut on every platform. The installed CodeMirror history keymap binds Undo to Mod-z; Redo is Mod-y, overridden by Mod-Shift-z on macOS. Its extra Ctrl-Shift-z binding is Linux-only. The test now reads the actual browser platform and uses Meta+z / Meta+Shift+z on Mac, Control+z / Control+y elsewhere. All eight cases, assertions and deadlines are retained; product source is unchanged. Mac and Windows execution remain UNKNOWN: this environment verified Linux only.

Integration commit `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac` was merged normally as `1c40f6e11e6f54e7b93ed6f2f67f350679e730a8`; it changes the KB-70 test and its evidence. With the shortcut correction applied, focused browser validation passed **8 / 0**, 39 assertions, authoritative exit 0 in 87.87 seconds. The screenshot matrix passed within its unchanged 60-second deadline. The owned Bun/server/browser exited before the next browser slot was released. Lint passed 5/5; scoped test TypeScript compilation and whitespace checks passed. Full current-head validation and hosted CI/review remain with the lead.

The following broader results are explicitly for earlier product head `f23f324`, before that integration merge and test correction. They are not a passing current-head gate.

| Command | Result on f23f324 |
|---|---|
| Bun version | 1.3.9 |
| Frozen install, initial observation | UNKNOWN: execution bound reached at120s, exit124 during resolution |
| Frozen install, longer observation | Exit1 after314s: NoSpaceLeft creating node-gyp tempdir; retained as infrastructure failure |
| Frozen install, after capacity recovery | Exit0 in324.06s;1033 installs/1079 packages checked, no changes; lockfiles unchanged |
| Lint | Exit0,5/5; existing warnings |
| Typecheck | Exit0,5/5 |
| Full test, first run | UNKNOWN: environment restart interrupted the process before a terminal receipt |
| Full test, recovery run | Exit1;3464pass/37fail/3todo/1error;81388assertions,212files,1426.08s. Failures in unchanged KB-74,KB-64,KB-66; all8checkbox cases passed |
| Four scans/notices | Exit0 for forbidden-tech,ram-only-audit,design-tokens,check:notices |
| Exact local Playwright | Exit1;25pass/3fail/89existing credential-gated skips,4.3minutes |
| Placeholder build | Authoritative exit0;1/1build job successful. Bun/Turbo's later real exit was observed before crediting success |

No earlier failure was removed or retried unchanged. The first install timeout, later disk error and interrupted suite remain in the lead's command ledger. Capacity recovery justified the final install observation, which completed without dependency or lockfile changes. The full test and E2E failures remain blockers until the lead's required gates pass; fixture success is not preview proof.

Full-suite failure tail:

```text
(fail) no entries retain the mounted empty view and no paging control [0.10ms]
(fail) exactly 20 items show a current-snapshot end without a button [0.11ms]
(fail) 21 items focus the new row after final-button removal [0.03ms]
(fail) 30 exactly completes in one chunk and keeps the new row in view [0.06ms]
(fail) 31 items require two chunks and focus rows 21 then 31 [0.03ms]
(fail) focus moved elsewhere during a load remains there [0.17ms]
(fail) Hebrew direction, time and counts remain readable [0.40ms]
(fail) StrictMode announces each loaded count once and transfers focus once [0.05ms]
(fail) reactive insertion alone does not steal focus and next chunk uses its stable boundary [0.03ms]
(fail) pending load keeps its older boundary when the anchor disappears beside a new top row [0.22ms]
(fail) gallery controls and retry callback remain operable [2.06ms]
(fail) mounted production view and gallery fit phone and desktop in both languages and themes [1.19ms]

 3464 pass
 3 todo
 37 fail
 1 error
 81388 expect() calls
Ran 3504 tests across 212 files. [1426.08s]
error: script "test" exited with code 1
```

Playwright failure tail:

```text
(node:179578) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)


[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:179838) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:179886) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  3 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  89 skipped
  25 passed (4.3m)
```

Failed install tail:

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
Resolved, downloaded and extracted [36]
error: NoSpaceLeft creating node-gyp tempdir
```

## Browser prerequisite for a fresh checkout

WALK — A checkout without a supported installed browser cannot run this mounted regression through `bun run test` alone. After installing the repository dependencies with Bun 1.3.9, provision Chromium using the existing command from `.github/workflows/ci.yml`'s Playwright job, then run the root suite:

```sh
bunx playwright install --with-deps chromium
bun run test
```

The fixture checks Playwright's configured Chromium executable first, then `/usr/bin/chromium` and `/usr/bin/google-chrome`. It fails explicitly when none exists. This prerequisite also applies to existing browser-backed unit fixtures; the CI Test job itself does not run the provisioning command above. This paragraph documents setup and the browserless-checkout limitation; it does not claim automated provisioning was added or repaired.

If the browser CDN is blocked, including a 403 response, AGENTS.md permits an already-installed Chromium fallback. If no supported browser is available, report the infrastructure limitation as UNKNOWN; do not skip the mounted cases or treat them as passing. No test hook, workflow, dependency, package script or product file changed for this clarification, and no browser command was run for this evidence-only update.
