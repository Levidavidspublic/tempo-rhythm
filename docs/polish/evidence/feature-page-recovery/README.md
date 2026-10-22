# Page action recovery — #1249

WALK — BLOCKED for completion/merge: actual browser diagnostics reproduce a pre-existing A→B→A dirty-field race that this change does not fix. Candidate 3 addresses the two introduced ordering findings. All 30 feature cases pass locally and in the earlier hosted test job. Frozen install, lint, typecheck, four scans/notices and the placeholder-Convex build pass. The local full test is FAIL/incomplete (exit 143 after an actual unchanged KB66 wrapper timeout and a verified stalled parent); local repository Playwright fails with 25 pass, 89 skip and 3 fail. The earlier hosted global test also failed on an unchanged KB67 hook timeout. Source/tests are frozen after three candidates; complete remote CI/CodeRabbit clearance remains unverified. This is not a production or preview completion claim.

Captured 2026-10-21 UTC; remaining local gates completed 2026-10-22 UTC with Bun 1.3.9. Base: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Original NotesScreen blob: `b9435f54157cc49a746aa07944f6fe615bf96708` (unchanged between the saved original base and this base). Candidate 1 tested NotesScreen blob: `ae6cab36d00cbae11109f6440e3229d952a8e258`. Candidate 1 test blob: `743d928492dc2140acda5720402f5a63a4e4d4a6`. Source, test and evidence are committed together; no provider, account or deployed environment was called.

The fixture mounts the actual NotePage, PageEditorView, CodeMirror editor and CoachPageProvider. Stable synthetic query/mutation boundaries provide fictional notes and controllable rejections. The `Flush fixture page` button is test instrumentation. These are browser component tests, not authenticated persistence E2E.

## Review and retry ledger

1. Candidate 1, commit `a458b04`: baseline 3/3 and current 19/19 passed. Independent review then found a queued outgoing draft could be dropped when navigation invalidated its UI owner after the debounce cleared. The original screenshots and logs remain in that commit.
2. Candidate 2, inspected before browser execution: an immutable outgoing snapshot repaired that loss, but review found a second ordering gap. Reopening the same note created a new queue owner, so an older outgoing write could run after a newer reopened draft and overwrite it.
3. Candidate 3: a private per-note promise queue registers immutable snapshots immediately across remounts; owner and queue cleanup compare request identity. UI/ref settlement remains ownership-fenced. Pending-debounce cleanup uses the same writer, and clean reopened coach/delete paths wait for outgoing writes. The independent reviewer found both prior defects resolved and no further blocking introduced defect. Thirty feature cases preserve the original nineteen and add navigation/unmount, rejected predecessors, same-note A→B→C→D ordering, distinct-note independence, and clean coach/delete waits. No fourth repair candidate is authorized; source and the committed test remain frozen after candidate 3.

Current source blob: `fef2920792d718dd07c8855556450014b31413af`. Current test blob: `46617ece5085285b2a49910400dae1c9d9d4dff8`. The scratch static log filenames initially said candidate2; this ledger uses the corrected conservative candidate3 count.

## Pre-existing A→B→A limit — reproduced on both sources

Source comparison and the actual scratch browser comparison on 2026-10-21 found the following edge in both the saved original and candidate 3:

1. Save title A and keep its mutation pending.
2. Edit title B and let its debounce run. The original submits B immediately; candidate 3 enqueues B behind A.
3. Edit back to A, leaving the final debounce pending.
4. Resolve the first A save. Both implementations clear the title dirty flag solely because the current value equals the old snapshot, without checking its edit revision.
5. The final debounce can see no dirty patch and submit no final A. The outstanding B write can leave B stored while the last typed value was A; a Saved indicator or reactive adoption can then conceal the missed edit.

This is a pre-existing value-equality clearing defect, not a newly introduced queue defect. It still limits the ticket's stated newer-draft guarantee. No source/test repair was made after this finding and no fourth candidate is authorized. The minimum proposed correction would require the successful snapshot's edit revision to still be current before clearing dirty fields or showing Saved, with an A→B→A regression; this is a proposal only.

Both scratch runs reproduced the defect: final typed title A, submitted writes `[A, B]`, persisted title B. The original run took 28.78 s and candidate 3 took 13.56 s. Each exited 0 because its assertion deliberately verifies the observed defect; these are negative diagnostics, not correctness/acceptance passes. The scratch-only diagnostic uses the same actual editor fixture, preserves all thirty committed cases and does not replace an acceptance check. No screenshot was overwritten during this comparison. Both owned browser/server instances closed and their temporary fixture directories were removed. Candidate 3's thirty feature cases passed both in the earlier hosted CI job and in the local full test on 2026-10-22; no standalone focused run was repeated. The local full test failed/incompletely terminated after the unrelated KB66 wrapper stall, and local Playwright has three failures. Keep the draft blocked for merge until the unresolved limitation and remaining gates are addressed through the authorized workflow.

## Results

| Command | Result |
| --- | --- |
| `PAGE_RECOVERY_BASELINE=<saved-original-NotesScreen.tsx> bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 3 pass, 0 fail; 26 expectations; 111.68 s. [Log](baseline.log). |
| `bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 19 pass, 0 fail; 83 expectations; 191.67 s. First browser candidate. [Log](candidate-1.log). |
| Scoped Biome lint from `apps/web`: `bun run node_modules/.bin/biome lint components/notes/NotesScreen.tsx ../../tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0, two files checked. Earlier root-cwd invocation failed resolving the existing shared config; correct package cwd fixed invocation without changing configuration. |
| Scoped `tsc --noEmit --pretty false --project <scratch-config-extending-web-tsconfig>` | Initial exit 2: fixture Response received a Buffer type unsupported by this DOM signature. Fixed with an owned ArrayBuffer. Subsequent pre-browser exit 0; this is not full repository typecheck. |
| Generated fixture entry/build TypeScript syntax parsing | Both parse without diagnostics. |
| `git diff --check` (source/test and README before adding raw command receipts) | Exit 0. |
| `git diff --cached --check` before evidence normalization | Exit 2, limited to original output whitespace in the build/E2E logs/tails. [Diagnostic](candidate-3-pre-normalization-diff-check.log), [exit](candidate-3-pre-normalization-diff-check.exit), [lossless original](candidate-3-pre-normalization-diff-check.log.raw.gz). |
| `git diff --cached --check` after evidence normalization | Exit 0 for the full staged diff, including all evidence. Raw output remains losslessly archived; no product/test/guard/command change. |
| `bun install --frozen-lockfile` (Bun 1.3.9; 360-second bound) | Candidate 3: exit 0, 1,033 installs checked across 1,079 packages, no changes; 346.44 s. [Log](candidate-3-install.log). |
| `bun run lint` | Candidate 3: exit 0, 5/5 tasks, zero errors; nine existing web warnings. [Log](candidate-3-lint.log). |
| `bun run typecheck` | Candidate 3: exit 0, 5/5 tasks; 2m44.571s. [Log](candidate-3-typecheck.log). |
| Scoped Biome lint on source plus new test | Candidate 3 final: exit 0, two files checked. [Log](candidate-3-scoped-lint.log). Initial hook dependency errors and template-literal info were corrected without suppression; [retained diagnostic excerpt](candidate-3-scoped-lint-initial.log). |
| Hosted Test job on `8bd013c` | All 30 feature cases pass. Global result: 3,523 pass, 1 fail, 3 todo; 81,646 assertions; 373.10 s; exit 1. Sole failure: unchanged KB67 unnamed beforeEach/afterEach hook at 60,000.67 ms. [Run 39681857160 / job 119506069603](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39681857160/job/119506069603). [Connector-verified excerpt](candidate-3-hosted-test-excerpt.log) includes all 30 feature pass lines and the global failure/exit. This worker independently inspected that saved excerpt after direct log retrieval returned HTTP 403 from the Actions results receiver. No claim of green global CI. |
| `PAGE_RECOVERY_BASELINE=<saved original> bun --no-env-file test <scratch>/page-recovery-aba-diagnostic.test.tsx` | Defect reproduced on original source; exit 0; 1 diagnostic, 3 expectations; 28.78 s. Last typed A, submitted [A, B], persisted B. [Log](aba-original.log), [exit receipt](aba-original.exit). |
| `env -u PAGE_RECOVERY_BASELINE bun --no-env-file test <scratch>/page-recovery-aba-diagnostic.test.tsx` | Same defect reproduced on frozen candidate 3; exit 0; 1 diagnostic, 4 expectations; 13.56 s. Last typed A, submitted [A, B], persisted B. [Log](aba-current.log), [exit receipt](aba-current.exit). |
| `bun run test` (local frozen candidate 3) | FAIL/incomplete; exit 143 after the actual KB66 wrapper timeout and an authorized termination of the verified stalled owned Bun parent. All 30 feature cases pass. Observed named log lines: 1588 pass, 1 fail, 3 todo; these are not a final aggregate. No final aggregate exists. [Full log](candidate-3-full-test.log), [receipt](candidate-3-full-test.json), [observed counts](candidate-3-full-test-observed-counts.json), [last 20 lines](candidate-3-full-test.tail.txt). |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | Exit 0; all four report OK, 66 dependencies documented. [Log](candidate-3-scans.log), [receipt](candidate-3-scans.json). |
| `CI=1 bunx playwright test --reporter=line` | Exit 1; 25 passed, 89 skipped, 3 failed; 5.4 minutes. Calendar Add event click, sign-out visibility and task-view navigation each exceed the existing 30,000 ms test timeout. No root cause is asserted. [Full log](candidate-3-local-e2e.log), [receipt](candidate-3-local-e2e.json), [last 20 lines](candidate-3-local-e2e.tail.txt). |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Exit 0; 1/1 task, 2m22.134s. [Log](candidate-3-build.log), [receipt](candidate-3-build.json). |

The baseline proves the original save rejection leaves Saving visible and the original pin rejection produces an unhandled fictional error. The current tests prove retained dirty title/body, explicit retry, duplicate suppression, ordered saves, stale-note isolation, dirty flush before delete, canceled delete intent, failure without URL/Undo change, successful deletion plus existing Undo, real coach flush rejection, pagehide/visibility recovery, and exact Markdown preservation for plain/daily/weekly/project/template pages. No caught action path emitted a console/page error. Only a successful removal changes the URL and starts the existing five-minute Undo.

## Local remaining gates — 2026-10-22

The human-readable command logs/tails below normalize only CRLF/CR to LF, trailing spaces/tabs and terminal blank lines. Every original is preserved losslessly in its corresponding `.raw.gz` artifact; the [SHA256 map](candidate-3-raw-output-sha256.json) records each original filename, original hash, byte count, archive filename and normalized hash. The pre-normalization whitespace-check failure is retained the same way. No command result, failure content or test was changed.

These commands ran once, in mandatory order, on [frozen head 7c59ad11d212ceadc080b220f2d6e0faf8e5e2b5](https://github.com/Levidavidspublic/tempo-rhythm/tree/7c59ad11d212ceadc080b220f2d6e0faf8e5e2b5). Product source remains the third candidate in [4d183cdfe5a168c6ab1988276960f3454e6aaa30](https://github.com/Levidavidspublic/tempo-rhythm/commit/4d183cdfe5a168c6ab1988276960f3454e6aaa30); later commits before this run changed evidence only. Source blob `fef2920792d718dd07c8855556450014b31413af`, test blob `46617ece5085285b2a49910400dae1c9d9d4dff8` and lock blob `aaa67ac9516b6a324de35af1771b3d1524713d19` matched before and after. There was no source/test/config/deadline repair or failed-command rerun.

The full test began at 00:00:02 UTC. All 30 Page recovery cases passed, including its eight current screenshots. At KB66, an existing parent wrapper at tests/unit/kb-66.test.tsx:35 timed out after 240021.18 ms against its existing 240000 ms deadline. The log states “killed 1 dangling process.” The child born at 00:14:24 was a zombie, and at 00:18:23 and 00:19:02 the parent remained in epoll wait with unchanged 00:03:49 CPU time. The wrapper reuses one result promise for subsequent cases; it remained unsettled. These observations establish the stall; they do not establish its underlying cause. With lead authorization, only the reverified owned Bun processes were terminated; the untouched runner captured exit 143 at 00:19:35. [Before snapshot](candidate-3-test-stall-before.txt), [after snapshot](candidate-3-test-stall-after.txt), [termination ownership](candidate-3-test-termination-ownership.txt). A transient exec transport failure occurred during monitoring; the original test process continued and was not restarted.

Playwright completed normally with its failing exit. The owned local server had no live group members and port 3000 was free before cleanup. Only the exact ignored, realpath-matched, nonsymlink apps/web/.next/dev directory was removed to recover build space, using Bun rmSync with recursive true and force false after all ownership checks. [Cleanup receipt](candidate-3-dev-cache-cleanup.json). The build then passed. At 00:28:59 UTC all owned command groups had no live members and port 3000 remained free; the heavy slot was released. [Final process snapshot](candidate-3-final-owned-processes.txt). No live/preview URL or account storage was supplied.

Full-test last 20 lines ([lossless original tail](candidate-3-full-test.tail.txt.raw.gz) and original SHA256 preserved):

```text
(pass) KB-59 web search preference request ownership > synchronous callback throw is recoverable
(pass) KB-59 web search preference request ownership > unmounted request cannot announce into surviving SettingsScreen
(pass) KB-59 web search preference request ownership > older mount cannot change replacement row
(pass) KB-59 web search preference request ownership > parent removal commit fences a settling request
(pass) KB-59 web search preference request ownership > StrictMode lifecycle still permits current success
(pass) KB-59 web search preference request ownership > unavailable provider stays off and locked
(pass) KB-59 web search preference request ownership > daily remaining count stays clamped without a new quota lock
(pass) KB-59 web search preference request ownership > UTC midnight refresh preserves latest intent and cleans timer
(pass) KB-59 web search preference request ownership > query boundary keeps the preferences page usable
(pass) KB-59 web search preference request ownership > keyboard switching retains focus and phone targets
(pass) KB-59 web search preference request ownership > caller and gallery render English Hebrew responsive theme matrix
(pass) KB-59 web search preference request ownership > gallery shares production save and recover behavior
(pass) KB-59 web search preference request ownership > fixture interactions avoid uncaught app errors and extra operations
(pass) KB-59 web search preference request ownership > request settlement during either query loading retains feedback ownership

tests/unit/kb-66.test.tsx:
killed 1 dangling process
(fail) load-more view names the currently visible count and preserves LTR numerals [240021.18ms]
  ^ this test timed out after 240000ms.
error: script "test" was terminated by signal SIGTERM (Polite quit request)
```

Playwright last 20 lines (display whitespace trimmed; [lossless original tail](candidate-3-local-e2e.tail.txt.raw.gz) and its original SHA256 are preserved):

```text
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:261439) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:261487) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  3 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  25 passed (5.4m)
```

## Actual candidate 1 screenshots

These dedicated local images prove candidate 1 only. The original images were preserved before the local candidate 3 run and their SHA256 hashes still match the [protected-image manifest](candidate-3-candidate-1-screenshots.sha256). The eight candidate-1 after images are preserved under dedicated filenames before any future local full test can overwrite the harness's generic after filenames. Each pair uses the same fictional body, retains the original page-meta bytes and was captured from the actual editor. Before images load the saved original NotesScreen; after images load the tested source. Both matrices use reduced motion. The after matrix also verifies visible keyboard focus, Enter retry, at least 44px retry height, EN/HE direction and no horizontal overflow.

| Width / language / theme | Before | After |
| --- | --- | --- |
| 390 / EN / light | [Before](before-390-en-light.png) | [After](candidate-1-after-390-en-light.png) |
| 390 / EN / dark | [Before](before-390-en-dark.png) | [After](candidate-1-after-390-en-dark.png) |
| 390 / HE / light | [Before](before-390-he-light.png) | [After](candidate-1-after-390-he-light.png) |
| 390 / HE / dark | [Before](before-390-he-dark.png) | [After](candidate-1-after-390-he-dark.png) |
| 1280 / EN / light | [Before](before-1280-en-light.png) | [After](candidate-1-after-1280-en-light.png) |
| 1280 / EN / dark | [Before](before-1280-en-dark.png) | [After](candidate-1-after-1280-en-dark.png) |
| 1280 / HE / light | [Before](before-1280-he-light.png) | [After](candidate-1-after-1280-he-light.png) |
| 1280 / HE / dark | [Before](before-1280-he-dark.png) | [After](candidate-1-after-1280-he-dark.png) |

Visual inspection: the EN desktop notice sits above the existing page; the HE mobile dark notice flows RTL and retains the focused retry target. Existing translated copy and token classes are reused; Hebrew remains for Amit's native read before production.

## Actual candidate 3 screenshots

The full local test captured these eight images from frozen candidate 3 after successful recovery. The existing 30-case fixture still mounts the actual editor with synthetic boundaries; these images do not prove authenticated persistence. Dedicated filenames distinguish them from the protected candidate 1 matrix, even where the rendered pixels match.

| Width / language / theme | Candidate 3 after |
| --- | --- |
| 390 / EN / light | [Candidate 3](candidate-3-after-390-en-light.png) |
| 390 / EN / dark | [Candidate 3](candidate-3-after-390-en-dark.png) |
| 390 / HE / light | [Candidate 3](candidate-3-after-390-he-light.png) |
| 390 / HE / dark | [Candidate 3](candidate-3-after-390-he-dark.png) |
| 1280 / EN / light | [Candidate 3](candidate-3-after-1280-en-light.png) |
| 1280 / EN / dark | [Candidate 3](candidate-3-after-1280-en-dark.png) |
| 1280 / HE / light | [Candidate 3](candidate-3-after-1280-he-light.png) |
| 1280 / HE / dark | [Candidate 3](candidate-3-after-1280-he-dark.png) |

## Preserved diagnostic failures

Initial scoped type diagnostic (full output in [scoped-types-initial.log](scoped-types-initial.log)):

```text
tests/unit/tempo-page-error-recovery.test.tsx(92,36): error TS2345: Argument of type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit | null | undefined'.
  Type 'Buffer<ArrayBufferLike>' is missing the following properties from type 'URLSearchParams': size, append, delete, get, and 2 more.
```

Initial scoped lint invocation, from the wrong directory:

```text
Failed to resolve the configuration from ../../packages/config/biome.json
module not found
```

No product check was weakened. Browser cleanup closed owned pages, browser and server and removed only its temporary fixture build directory.

## UNKNOWN and follow-ups

- Exact cause of the preview red three-error badge.
- Authenticated persistence, deployed preview behavior and real-device screen-reader behavior.
- Current remote CI and CodeRabbit disposition. Local commands are recorded above: the full test is failed/incomplete on the KB66 wrapper stall and local Playwright has three timeout failures. Their underlying causes remain unverified. The earlier hosted global test job is red on KB67's hook timeout.
- Existing wiki-link creation and broader unmount recovery remain outside this ticket. Cleanup changed only as necessary to prevent the introduced write-order/lost-draft regressions. No sidebar/codec, checkbox, route, backend, model, schema or environment change.
- Older overlapping #1053/#1081 and held migration drafts #795/#805 were left untouched and need later reconciliation. KA #1101 expressly excludes NotesScreen. Protected #1193/#1198 and held #1110/#1112/#1129 were untouched.
