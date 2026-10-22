# WALK — Optional onboarding goal, 22 October 2026

status: blocked (mandatory full-test/E2E failures and remaining viewport/review evidence; candidate 3 source frozen)
ticket: #1293

## Code map and behavior

The base is a49aecff60ee53ead608bf56b0a2b1a7f6bd058b, on t/1293-onboarding-goal, prepared from frozen #1158 onboarding polish and current integration by the lead. Existing OnboardingFlow has five steps, NameStep in step two, and a separate create/update notes path in step four. GoalsScreen reads goals.list and creates with goals.create; goals.update validates ownership and returns the same goal ID. This ticket changes none of those backend functions or the five-step completion contract. Legacy #477/#278 and protected PRs are untouched.

Step four now mounts OnboardingGoal after the existing brain-dump textarea. A title and optional description are controlled by the parent flow. A separately labeled Add goal button calls goals.create with trimmed title and nonempty optional description, only after explicit action. Blank input submits nothing. The parent owns the submitted snapshot, one in-flight request identity and the successful goal ID through Back/Continue and conditional panel unmounts. Subsequent explicit saves call goals.update on that ID; clearing the description sends an empty string. Duplicate clicks are fenced before awaiting the mutation.

Skip and Finish never submit or retry a goal. Note creation/update remains separate and unchanged. An unconfirmed save preserves the draft and shows no Saved claim; the copy directs people to check Goals before retrying. A successful save exposes the normal /goals link and explains editing after setup. There is no inferred goal selection, task creation, coach-context integration, target date, AI call or browser-storage draft. This is direct user-authored goal creation, not an AI Accept operation.

OnboardingGoalGallery exports a local fictional example of the same controlled mounted panel. All copy is in the self-contained onboarding-goal group; English/Hebrew are complete and Hebrew is machine-drafted for Amit's native read. The panel uses existing token classes, logical sizing, auto direction for entered text, native buttons and associated labels. No CSS/central registration/config/route/package/backend/schema/environment change.

## Test results (cloud agent sandbox)

Historical feature-worker focused checks below: Bun 1.3.9, no browser or external account/provider requests. The later mandatory browser run is recorded separately.

| Check | Actual result |
| --- | --- |
| New mounted React DOM suite, candidate 1 | Setup error: root test could not resolve react/jsx-dev-runtime; no cases ran |
| Candidate 2 | Setup error: naked next/link could not resolve from root test; no cases ran |
| Candidate 3 | 14 pass, 0 fail, 56 assertions, 5.14s |
| Existing OnboardingFlow suite unchanged | 11 pass, 0 fail, 35 assertions, 2.18s |
| Existing releaseOnboardingGate suite unchanged | 14 pass, 0 fail, 46 assertions, 2.19s |
| Candidate 3 scoped Biome | 5 errors: Bun global undeclared at new test lines319–323 |
| git diff --check | Pass |

The runtime implementation was unchanged across these attempts. Test fixes replaced JSX with createElement in the root harness and resolved framework imports/mocks from the web workspace, following the existing release-gate harness. The final tests mount real React components in a small synthetic DOM. They cover blank/explicit create, payload trimming, empty-description omission, duplicate clicks, failure/draft retention, update/description clearing, Skip and Finish independence, successful and pending IDs across step navigation, failed-update retry, unchanged brain dump, labels/focus, Hebrew text/direction, and zero implicit creation. They do not establish actual browser geometry, keyboard event delivery, focus painting or network behavior.

The precise remaining lint correction is a named resolveSync import from bun and replacement of five Bun.resolveSync references. It was not applied after the third candidate's failure. The three-attempt rule is being honored; the lead has the exact blocker. No assertion, deadline or configuration was weakened.

At the feature-worker handoff, mandatory commands and browser evidence were pending. The authorized actual-checkout mandatory results are recorded below. Gallery/flow screenshots at390/1280 EN/HE light/dark, no-overflow/touch/focus rendering, native Hebrew read and current hosted CI/CodeRabbit/guards remain separate pending requirements. No fabricated screenshot or preview claim.

## Actual-checkout mandatory validation — 22 October 2026 UTC

**WALK — blocked: all 14 new goal cases passed in the full run, but mandatory full tests and local E2E are not all green.** Source remains frozen after candidate 3; no fourth implementation/test correction, unchanged-command rerun, guard or deadline edit was made. The earlier standalone four-file Biome failure remains a historical failure. Actual `bun run lint` passed because its workspace coverage differs; it does not establish that the advisory root-test errors were fixed.

Frozen source: [`15221038ee51d3d0746ab827fdbe3dae5282d9bb`](https://github.com/Levidavidspublic/tempo-rhythm/commit/15221038ee51d3d0746ab827fdbe3dae5282d9bb). Bun **1.3.9**, existing local Chromium/cache, configured synthetic local E2E values only. No preview/live URL, account storage-state, provider operation, secret/environment-file read or deployment. Every AGENTS command ran once in the exact required order, including all commands after failures.

| Exact command | Actual result | Start → end (UTC) |
| --- | --- | --- |
| `bun install --frozen-lockfile` | PASS (exit 0): 1033 installs checked across 1079 packages, no changes, 313.79 s | 2026-10-22T09:34:45Z → 2026-10-22T09:39:59Z |
| `bun run lint` | PASS (exit 0): 5/5 tasks; 4/5 cached; 2.308s; root test advisory coverage differs | 2026-10-22T09:40:05Z → 2026-10-22T09:40:07Z |
| `bun run typecheck` | PASS (exit 0): 5/5 tasks; 4/5 cached; 16.983s | 2026-10-22T09:40:19Z → 2026-10-22T09:40:36Z |
| `bun run test` | FAIL (exit 1): 3481 pass / 11 fail / 3 todo / 2 errors; 81385 assertions, 3495 tests / 213 files, 2330.27 s; own goal file 14 pass / 0 fail | 2026-10-22T09:40:46Z → 2026-10-22T10:19:36Z |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS (exit 0): all four checks OK; 66 documented dependencies | 2026-10-22T10:19:45Z → 2026-10-22T10:19:48Z |
| `CI=1 bunx playwright test --reporter=line` | FAIL (exit 1): 14 pass / 14 fail / 89 skip, 117 cases, 11.4m | 2026-10-22T10:20:07Z → 2026-10-22T10:31:36Z |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS (exit 0): 1/1 tasks; 0/1 cached; 3m36.757s | 2026-10-22T10:32:10Z → 2026-10-22T10:35:51Z |

The full command completed normally with exit 1; it was never terminated. The table uses its authoritative final aggregate, not a count of individual log lines. The scoped file's completed block independently proves all 14 goal cases passed. Existing focused 11-case OnboardingFlow and 14-case release-gate results above remain historical focused results, separate from the full-run aggregate. The 89 expected local E2E skips do not prove authenticated/live behavior. Cached tasks are explicitly identified; no fresh compiler work is claimed for a cached task.

### All full-test failures and source attribution

- [`tests/unit/kb-74.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-74.test.tsx): KB-74 real shell drawer focus > mounted shell and gallery fit both languages, themes and widths [60013.60ms]
- [`tests/unit/kb-74.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-74.test.tsx): KB-74 real shell drawer focus > reduced motion uses the existing near-zero CSS policy [2690.30ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-64.test.tsx): KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [30878.17ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-64.test.tsx): KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [1515.36ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-64.test.tsx): KB64 Undo recovery > large text wraps and reduced motion has no toast animation [475.97ms]
- [`tests/unit/kb-59.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/tests/unit/kb-59.test.tsx): (unnamed) [600040.09ms]
- [`packages/utils/src/historyImport.test.ts`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/packages/utils/src/historyImport.test.ts): history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "😀" [5534.11ms]
- [`packages/utils/src/historyImport.test.ts`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/packages/utils/src/historyImport.test.ts): history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "\ud800" [6667.14ms]
- [`packages/utils/src/historyImport.test.ts`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/packages/utils/src/historyImport.test.ts): history normalization (synthetic fixtures only) > duplicate identities compare large and deep malformed fields structurally [6542.37ms]
- [`packages/utils/src/page-summary.test.ts`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/packages/utils/src/page-summary.test.ts): pathological bodies stay linear > closingTagsOpenOnEveryLine [4825.87ms]
- [`apps/web/components/notes/NotesScreen.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/15221038ee51d3d0746ab827fdbe3dae5282d9bb/apps/web/components/notes/NotesScreen.test.tsx): a waiting save is sent when the page goes away > with nothing waiting, pagehide sends nothing, and typing still waits 500 ms [1119.60ms]

KB74's language/theme/width matrix exceeded its existing 60000 ms test deadline; the following reduced-motion case failed at newPage before its CSS assertion. KB64's later gallery case exceeded its existing 30000 ms deadline; its following two cases saw a closed browser. The aggregate reports two errors, and the log also records pending browser-operation rejections. The closure initiator and the exact slow matrix operation remain UNKNOWN. These logged failures do not establish a defect in the new goal feature, or permission to repair another ticket.

KB59's isolated child exited with raw process status 0 and remained a zombie while its parent waited in epoll. Its existing 600000 ms hook eventually timed out at 600040.09 ms, logged as an unnamed failure; Bun then advanced itself into the new goal suite. No termination was needed. The child status is not substituted for unreported KB59 case results. The three history-import failures exceeded existing 5000 ms deadlines. The page-summary and note-save failures remain as logged, with their cause unverified.

Root disclosed one concurrent standalone four-line TypeScript diagnostic for a separate #1299 fixture around 10:18 UTC, lasting 6.66 s, with `--noResolve --types bun --lib ES2021`. It was not an app graph/full check/browser run. This overlap does not prove it caused a 5000 ms failure; all failures are retained.

### Exact local E2E failures

- [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
- [chromium] › tests/e2e/fix/calendar-add.spec.ts:26:7 › calendar add event › local mode: form renders and adds without a sign-in message
- [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ──
- [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
- [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
- [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
- [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
- [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
- [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
- [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/profile mounts its component
- [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:26:7 › habits, brain dump and search wiring › /search mounts SearchScreen
- [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
- [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
- [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component

These are FAIL results, not an inferred preview, font or browser-download exception. Navigation errors/timeouts and any unmet assertion remain in the raw receipts. No E2E or full-test repair/rerun followed them.

### Failure tails

These are the original last 20 lines, with **only CRLF→LF and trailing spaces/tabs normalized** for Markdown. No raw browser launch arguments or URLs are published. Raw byte-exact logs and verified lossless gzip copies stay outside the checkout; hashes identify their originals.

**test**, original log SHA256 `29cf44575d3baad7710f5b3518136da0b3a3c7916f6bbe480c42d7225a1afb8a`:

```text
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [1515.36ms]
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [475.97ms]
(fail) (unnamed) [600040.09ms]
  ^ a beforeEach/afterEach hook timed out for this test.
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "😀" [5534.11ms]
  ^ this test timed out after 5000ms.
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "\ud800" [6667.14ms]
  ^ this test timed out after 5000ms.
(fail) history normalization (synthetic fixtures only) > duplicate identities compare large and deep malformed fields structurally [6542.37ms]
  ^ this test timed out after 5000ms.
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [4825.87ms]
(fail) a waiting save is sent when the page goes away > with nothing waiting, pagehide sends nothing, and typing still waits 500 ms [1119.60ms]

 3481 pass
 3 todo
 11 fail
 2 errors
 81385 expect() calls
Ran 3495 tests across 213 files. [2330.27s]
error: script "test" exited with code 1

```

**e2e**, original log SHA256 `cc2337453f39ecdd1e7364ff0b58354f50c2d0b7792b2cac8379126969362d1c`:

```text
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  14 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/fix/calendar-add.spec.ts:26:7 › calendar add event › local mode: form renders and adds without a sign-in message
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:26:7 › habits, brain dump and search wiring › /search mounts SearchScreen
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/profile mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
  89 skipped
  14 passed (11.4m)

```

### Sanitized browser lifecycle diagnostics

Root authorized `DEBUG=pw:browser` only in the full-test runner environment before it started. The exact command remained `bun run test`; cases, assertions, source, configuration and deadlines were unchanged. The 118 raw diagnostic lines stay outside the checkout. The following sanitizer retains only timestamps, numeric PIDs, whitelisted lifecycle events and exit code/signal; all launch arguments, URLs and arbitrary stderr are excluded. It records observations, not a verified closure cause. Existing successful isolated wrappers can consume/discard their own captured child stderr, so absence of a lifecycle event is not proof the event did not happen.

| UTC timestamp | PID | Event | Exit code | Signal |
| --- | --- | --- | --- | --- |
| 2026-10-22T09:46:21.106Z | 310786 | launched | — | — |
| 2026-10-22T09:49:22.590Z | 310786 | gracefully close start | — | — |
| 2026-10-22T09:49:23.138Z | 310786 | process-exit | 0 | null |
| 2026-10-22T09:49:23.151Z | 310786 | gracefully close end | — | — |
| 2026-10-22T09:50:00.022Z | 312876 | launched | — | — |
| 2026-10-22T09:54:59.687Z | 312876 | process-exit | 0 | null |
| 2026-10-22T09:58:16.150Z | 314851 | launched | — | — |
| 2026-10-22T10:03:11.841Z | 314851 | process-exit | 0 | null |
| 2026-10-22T10:14:58.670Z | 319232 | launched | — | — |
| 2026-10-22T10:17:04.548Z | 319232 | gracefully close start | — | — |
| 2026-10-22T10:17:06.040Z | 319232 | process-exit | 0 | null |
| 2026-10-22T10:17:06.081Z | 319232 | gracefully close end | — | — |

### Frozen hashes, receipts and remaining evidence

| File | Git blob throughout mandatory run |
| --- | --- |
| `apps/web/components/onboarding/OnboardingFlow.tsx` | `b002fda3972612a39fa15120004ade128862643a` |
| `apps/web/components/onboarding/OnboardingGoal.tsx` | `8715f2d1d2d9155c72721b391043ceac3e140458` |
| `apps/web/lib/i18n-groups/onboarding-goal.ts` | `5ce22f0261894cb3ab0d677a1c32695653dfb7ad` |
| `tests/unit/tempo-onboarding-goal.test.tsx` | `d8972b08c00f5fd4a78d091276367bb76df2aa78` |
| `bun.lock` | `aaa67ac9516b6a324de35af1771b3d1524713d19` |

Scratch: `/workspace/work/overnight/onboarding-goal-gates/1522103`. Each stage retains the exact command, start/end, exit, full source/test/lock identifiers, Bun version, owner, disk receipts, raw log and last-20 tail. The 61 stage files have verified lossless gzip copies in `raw-gzip/`; `sha256-map.json` maps original and compressed SHA256. Raw DEBUG logs/gzip are not published. The sanitized lifecycle receipt and KB59 process observation are separate scratch artifacts. Only this existing README is updated for validation, preserving the feature worker's source and earlier evidence.

| Raw log | SHA256 |
| --- | --- |
| `install.log` | `de7575cee40760830a20f60050cac4cdd3766e3e8a0dc1beefad0ae06405780d` |
| `lint.log` | `f65ae5a3ec42e0e3a6645f0b6c319a74c47b702c8f3d2dcef2d8d7dd1cca74e9` |
| `typecheck.log` | `f338e7ea6c520a4ad5b05287c8bbb6a1cc4cffa33142ea9f04d2416407bc6188` |
| `test.log` | `29cf44575d3baad7710f5b3518136da0b3a3c7916f6bbe480c42d7225a1afb8a` |
| `scans.log` | `69e266a48dd9cf3df8575e0bed6adff0a7afa19f84c8f1e3893ebb0ef040b069` |
| `e2e.log` | `cc2337453f39ecdd1e7364ff0b58354f50c2d0b7792b2cac8379126969362d1c` |
| `build.log` | `532d86afe20f1b1ee1f3973b599adeb05617d95a8d9b24cce81ed5389449f24b` |

The pre-E2E snapshot proved no live worktree processes and port 3000 free. E2E completed normally, then its own server/browser processes exited. Free disk was below the 2 GiB build guard, so only the exact ignored `/workspace/tempo-rhythm/apps/web/.next/dev` cache was removed after verifying every ancestor was a nonsymlink directory, exact realpath, ignored status, no live owned E2E groups and a free port 3000. The guarded Bun removal used `recursive:true, force:false`; the cleanup receipt remains outside checkout. Final snapshot at 2026-10-22T10:36:08.120Z proved no live worktree processes and a free port 3000. Heavy/browser slot released at 2026-10-22T10:36:10.048Z. Root coordinates separate 390/1280 EN/HE light/dark before/after viewport evidence, native Hebrew read, current hosted CI/guards/CodeRabbit, parent #1158 reconciliation and publication/merge. This run does not claim those remaining requirements are complete.

## Delivery

Four scoped files are listed with SHA256 in source-hashes.json and the scratch manifest. Evidence preserves the initial setup failures, passing focused receipts and exact advisory lint failure. The initial feature worker performed no public write or commit; the assigned validation worker subsequently updated only this README with the mandatory results. Root coordinates publication, shared status and all merge gates.

changed: OnboardingFlow.tsx, OnboardingGoal.tsx, onboarding-goal.ts, tempo-onboarding-goal.test.tsx, scoped evidence
unknowns: causes of logged mandatory failures; viewport/native Hebrew evidence; current hosted review gates
notes for ticket sync: optional real goal only; wider personalization remains separate. No fourth repair attempt performed.
