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
| Mandatory broad gates | Pending lead's serialized checks |
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
