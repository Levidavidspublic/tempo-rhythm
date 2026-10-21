# Page action recovery — #1249

WALK — BLOCKED for completion/merge: actual browser diagnostics reproduce a pre-existing A→B→A dirty-field race that this change does not fix. Candidate 3 addresses the two introduced ordering findings. Frozen install, mandatory lint and mandatory typecheck pass; all 30 feature cases pass in the hosted test job, which still fails globally on an unchanged KB67 hook timeout. Local full tests, scans, repository Playwright/build and complete remote CI/CodeRabbit clearance remain pending. This is not a production or preview completion claim.

Captured 2026-10-21 UTC with Bun 1.3.9. Base: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Original NotesScreen blob: `b9435f54157cc49a746aa07944f6fe615bf96708` (unchanged between the saved original base and this base). Candidate 1 tested NotesScreen blob: `ae6cab36d00cbae11109f6440e3229d952a8e258`. Candidate 1 test blob: `743d928492dc2140acda5720402f5a63a4e4d4a6`. Source, test and evidence are committed together; no provider, account or deployed environment was called.

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

Both scratch runs reproduced the defect: final typed title A, submitted writes `[A, B]`, persisted title B. The original run took 28.78 s and candidate 3 took 13.56 s. Each exited 0 because its assertion deliberately verifies the observed defect; these are negative diagnostics, not correctness/acceptance passes. The scratch-only diagnostic uses the same actual editor fixture, preserves all thirty committed cases and does not replace an acceptance check. No screenshot was overwritten during this comparison. Both owned browser/server instances closed and their temporary fixture directories were removed. Candidate 3's thirty feature cases have now passed in hosted CI, while a standalone local focused run has not been repeated. Local full validation remains outstanding. Keep the draft blocked for merge until the unresolved limitation and remaining gates are addressed through the authorized workflow.

## Results

| Command | Result |
| --- | --- |
| `PAGE_RECOVERY_BASELINE=<saved-original-NotesScreen.tsx> bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 3 pass, 0 fail; 26 expectations; 111.68 s. [Log](baseline.log). |
| `bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 19 pass, 0 fail; 83 expectations; 191.67 s. First browser candidate. [Log](candidate-1.log). |
| Scoped Biome lint from `apps/web`: `bun run node_modules/.bin/biome lint components/notes/NotesScreen.tsx ../../tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0, two files checked. Earlier root-cwd invocation failed resolving the existing shared config; correct package cwd fixed invocation without changing configuration. |
| Scoped `tsc --noEmit --pretty false --project <scratch-config-extending-web-tsconfig>` | Initial exit 2: fixture Response received a Buffer type unsupported by this DOM signature. Fixed with an owned ArrayBuffer. Subsequent pre-browser exit 0; this is not full repository typecheck. |
| Generated fixture entry/build TypeScript syntax parsing | Both parse without diagnostics. |
| `git diff --check` | Exit 0. |
| `bun install --frozen-lockfile` (Bun 1.3.9; 360-second bound) | Candidate 3: exit 0, 1,033 installs checked across 1,079 packages, no changes; 346.44 s. [Log](candidate-3-install.log). |
| `bun run lint` | Candidate 3: exit 0, 5/5 tasks, zero errors; nine existing web warnings. [Log](candidate-3-lint.log). |
| `bun run typecheck` | Candidate 3: exit 0, 5/5 tasks; 2m44.571s. [Log](candidate-3-typecheck.log). |
| Scoped Biome lint on source plus new test | Candidate 3 final: exit 0, two files checked. [Log](candidate-3-scoped-lint.log). Initial hook dependency errors and template-literal info were corrected without suppression; [retained diagnostic excerpt](candidate-3-scoped-lint-initial.log). |
| Hosted Test job on `8bd013c` | All 30 feature cases pass. Global result: 3,523 pass, 1 fail, 3 todo; 81,646 assertions; 373.10 s; exit 1. Sole failure: unchanged KB67 unnamed beforeEach/afterEach hook at 60,000.67 ms. [Run 39681857160 / job 119506069603](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39681857160/job/119506069603). [Connector-verified excerpt](candidate-3-hosted-test-excerpt.log) includes all 30 feature pass lines and the global failure/exit. This worker independently inspected that saved excerpt after direct log retrieval returned HTTP 403 from the Actions results receiver. No claim of green global CI. |
| `PAGE_RECOVERY_BASELINE=<saved original> bun --no-env-file test <scratch>/page-recovery-aba-diagnostic.test.tsx` | Defect reproduced on original source; exit 0; 1 diagnostic, 3 expectations; 28.78 s. Last typed A, submitted [A, B], persisted B. [Log](aba-original.log), [exit receipt](aba-original.exit). |
| `env -u PAGE_RECOVERY_BASELINE bun --no-env-file test <scratch>/page-recovery-aba-diagnostic.test.tsx` | Same defect reproduced on frozen candidate 3; exit 0; 1 diagnostic, 4 expectations; 13.56 s. Last typed A, submitted [A, B], persisted B. [Log](aba-current.log), [exit receipt](aba-current.exit). |
| Local full tests, four scans/notices, Playwright and placeholder-Convex build | UNKNOWN: not yet run; lead coordinates the shared heavy-validation slot. The hosted feature pass does not replace these required local gates. |

The baseline proves the original save rejection leaves Saving visible and the original pin rejection produces an unhandled fictional error. The current tests prove retained dirty title/body, explicit retry, duplicate suppression, ordered saves, stale-note isolation, dirty flush before delete, canceled delete intent, failure without URL/Undo change, successful deletion plus existing Undo, real coach flush rejection, pagehide/visibility recovery, and exact Markdown preservation for plain/daily/weekly/project/template pages. No caught action path emitted a console/page error. Only a successful removal changes the URL and starts the existing five-minute Undo.

## Actual candidate 1 screenshots

These local images prove candidate 1 only; candidate 3's feature cases ran in hosted CI, without replacing these local screenshots. The eight candidate-1 after images are preserved under dedicated filenames before any future local full test can overwrite the harness's generic after filenames. Each pair uses the same fictional body, retains the original page-meta bytes and was captured from the actual editor. Before images load the saved original NotesScreen; after images load the tested source. Both matrices use reduced motion. The after matrix also verifies visible keyboard focus, Enter retry, at least 44px retry height, EN/HE direction and no horizontal overflow.

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
- Remaining local full browser checks, full tests, scans/build and current CodeRabbit disposition. Hosted feature cases pass, but the global test job is red on KB67's hook timeout.
- Existing wiki-link creation and broader unmount recovery remain outside this ticket. Cleanup changed only as necessary to prevent the introduced write-order/lost-draft regressions. No sidebar/codec, checkbox, route, backend, model, schema or environment change.
- Older overlapping #1053/#1081 and held migration drafts #795/#805 were left untouched and need later reconciliation. KA #1101 expressly excludes NotesScreen. Protected #1193/#1198 and held #1110/#1112/#1129 were untouched.
