# KB-09 project detail evidence

The production `/projects/[id]` screen mounts `ProjectTaskActions` in each task row and `ProjectDetailNotice` beside the project name. The page keeps the existing Convex query and mutation calls and uses their original arguments. The gallery is a controlled fictional view; the browser fixture also mounts the actual screen with fictional query and mutation responses.

The [contact sheet](./kb-09-project-details-keep-task-actions-in-reach.jpg) compares the saved pre-edit source with the new mounted screen at 390 and 1280 px, in English and Hebrew, light and dark. Both browser bundles use the same fictional Maya and Dana task data and the v3 tokens. The contact sheet crops blank viewport space to keep the screen content legible; browser assertions used the full viewport. The before bundle is taken from commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb`, copied before the first edit. The project detail's visible action label was not present before; its completion checkbox was present.

## Browser findings

- The mounted screen shows an inline pending notice on rename, then a saved or error notice tied to the name field. A rejected mutation leaves the typed name intact. A stale response does not mark a newer draft as saved.
- For a new project with no tasks, leaving the name opens the first-task form and focuses its field. Canceling creation returns focus to the Add control on the mounted screen and in the gallery.
- The task completion control is keyboard reachable, has a task-specific accessible name, updates its checked state, and measures at least 44 px in each axis at 390 px.
- The hydrated gallery exercises default, empty, loading, error, disabled, and long-title states. At 390 and 1280 px it renders one `main` and one `h1`, and the document does not scroll horizontally.
- Hebrew uses RTL direction and machine-drafted copy. User-written task text uses `dir=auto`. Reduced motion was enabled for the browser checks.

The full command table and failure tails are in draft PR #1150. The fixture uses fictional data; these checks do not claim a live signed-in route or real backend writes. Device screen-reader results remain **UNKNOWN** until tested on a device. Hebrew wording needs Amit's native read.

## Review repair — 21 Oct 2026

Source commit: `4a1389b15e34751c60c7a9ebfc960acd2b658942`, based on `31d5cf554fdcb368eb7275aca175b93ad70a1deb`. Verified [review comment 4335091840](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150#discussion_r4335091840): the gallery previously shared one completion boolean across every task. Completion now belongs to each append-only gallery row, with a functional update that preserves the other rows. The mounted screen's existing task mutations and optimistic updates are unchanged.

The hydrated regression `gallery tasks complete and reopen independently, including newly added rows` adds a second task, completes each separately, adds a third task after both are complete, and reopens the first. It checks that the second remains complete and the new third task starts unchecked. Existing screenshot evidence remains applicable because this repair changes gallery interaction state rather than its initial layout.

Repair validation used Bun **1.3.9** and system Chromium, with workspace packages linked to this ticket's own worktree and only third-party packages shared from the installed cache.

| Command | Exit | Result |
| --- | --- | --- |
| `bun --version` | 0 | `1.3.9` |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: bounded at 120 seconds while resolving dependencies |
| `bun run lint` | 0 | 5 successful tasks, 5 total; existing warnings |
| `bun run typecheck` | 0 | 5 successful tasks, 5 total |
| `bun test tests/unit/kb-09.test.tsx` | 0 | 14 pass, 0 fail, 0 skip; 22 assertions; 66.84 seconds |

The focused run re-captured the 16 before/current mounted-screen screenshots across both widths, languages and themes. Remaining mandatory full-suite, scan, E2E and build results are tracked separately in PR #1150 and must not be inferred from this focused run.

The complete frozen-install failure tail was:

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```


## Isolated fixture validation — 21 Oct 2026

Test source commit: `cd1174d51cef38da5c7ed0e33bb6b8bb2e7c475f`, based on `9abb1ef`. This pass changes only the scoped test and this evidence. The per-row gallery completion repair and all production files remain unchanged. The existing contact sheet still represents the initial visual state.

Attempt accounting: `930909a` introduced the implementation, `fc9e60a` completed its initial fixture/capture setup, `a8efce5` supplied the subsequent review repair, and `9abb1ef` recorded evidence only. Under the owner’s clarified accounting (multiple commands against one unchanged candidate are one attempt; evidence-only commits are not repair rounds), this fixture isolation is the third normal candidate, not another exceptional repair.

The retained hosted run passed the KB-09 case bodies but then reported an unnamed 60,002.39 ms hook timeout, followed by an `EISDIR` scheduler read while setting up KB-67. The excerpt is retained at `/workspace/work/kb-finish/hosted-1150-failure-excerpt.log`; no KB-67 code was changed. The focused proof below does not establish that the integrated full-suite failure is resolved.

The fixture now runs in a clean child process, keeping `setDefaultTimeout`, `Bun.build`, and `Bun.serve` out of the main suite process. All 14 original cases, assertions, and child timeouts remain intact, including the independent gallery-row completion regression. The parent caches the whole child result once, maps each named case from its JUnit status (rejecting missing, duplicate, failed, or skipped results), and separately requires a zero child exit and the exact report count. A failed child cannot become a pass through matching an earlier output substring. The 300-second parent envelope supervises the whole child; it does not change the child’s 60-second defaults, 120-second setup timeout, or 300-second screenshot case timeout.

Fixture and report directories use unique names under ignored `work/`. Cleanup stops the loopback server before closing Chromium, removes temporary captures and bundles in a `finally`, and kills an unfinished child during parent cleanup. The successful run left no `work/kb09-run-*` or `work/kb09-fixture-*` directories. Child output is retained in the focused log before temporary JUnit cleanup.

### Test results (cloud agent sandbox)

Validation used Bun **1.3.9**, system Chromium, and this worktree’s own workspace links and real `.bun` cache directory. The focused browser command held `/workspace/work/kb-finish/heavy-check.lock`. These are scoped/light diagnostics; the final ordered AGENTS command sequence remains with the integrating owner.

| Command | Exit | Fresh result |
| --- | --- | --- |
| `bun --version` | 0 | `1.3.9` |
| `bun install --frozen-lockfile` | UNKNOWN | Not rerun in this pass; prior 120-second unresolved dependency-resolution timeout remains recorded above |
| `bun run lint` | 0 | 5/5 tasks; 10 existing warnings, no errors |
| `bun run typecheck` | 0 | 5/5 tasks |
| `bun test tests/unit/kb-09.test.tsx` | 0 | Child: 14 pass, 0 fail, 0 skip, 22 Bun assertions, 92.97 s; parent: 14 named case reports plus 1 infrastructure gate, 15 pass, 0 fail, 17 metadata assertions, 94.61 s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK |
| `bun run test` | UNKNOWN | Not rerun after this patch; the earlier hosted failure is retained below; integrating owner owns the complete suite |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN | Not rerun in this scoped pass; integrating owner owns the complete E2E gate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN | Not rerun in this scoped pass; integrating owner owns the build gate |

The parent’s 15 reports are not 15 independent functional cases and must not be added to the child’s 14 cases. The preserved cases are:

- `en/he dictionary keys match`
- `first task pending keeps the draft name beside the add field`
- `rename pending appears at the field`
- `rename error keeps the typed text and has field association`
- `stale rename result does not overwrite a newer draft`
- `task toggle updates checked state and action text`
- `gallery tasks complete and reopen independently, including newly added rows`
- `long title wraps with no phone overflow`
- `focus returns to add after cancel`
- `mounted project returns focus to add after cancel`
- `Hebrew gallery is RTL and keeps one main and h1`
- `phone task action is at least 44px in both axes`
- `gallery states and controls work at desktop width`
- `browser evidence covers widths, locales, and themes`

Fresh logs are `/workspace/work/kb-finish/kb09/isolation-version.log`, `isolation-lint.log`, `isolation-typecheck.log`, `isolation-scans.log`, and `isolation-focused.log`. No full-suite, E2E, build, or live-backend pass is claimed from this focused result. No child or browser runner was left active at handoff.

The last 20 lines of the retained hosted failure excerpt are:

```text
2026-10-21T10:16:13.4231291Z (todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages
2026-10-21T10:16:13.4231976Z
2026-10-21T10:16:13.4231984Z
2026-10-21T10:16:13.4232130Z 2 tests failed:
2026-10-21T10:16:13.4232913Z (fail) KB-09 project detail > (unnamed) [60002.39ms]
2026-10-21T10:16:13.4233604Z   ^ a beforeEach/afterEach hook timed out for this test.
2026-10-21T10:16:13.4234411Z (fail) KB-67 selected-nag phrase editing > (unnamed) [28.00ms]
2026-10-21T10:16:13.4234859Z
2026-10-21T10:16:13.4235005Z  3413 pass
2026-10-21T10:16:13.4235321Z  3 todo
2026-10-21T10:16:13.4235648Z  2 fail
2026-10-21T10:16:13.4235985Z  81383 expect() calls
2026-10-21T10:16:13.4236485Z Ran 3418 tests across 208 files. [217.99s]
2026-10-21T10:16:13.4746768Z error: script "test" exited with code 1
2026-10-21T10:16:13.4757858Z ##[error]Process completed with exit code 1.
2026-10-21T10:16:13.4887724Z Post job cleanup.
2026-10-21T10:16:13.5867965Z [command]/usr/bin/git version
2026-10-21T10:16:13.5910661Z git version 2.55.0
2026-10-21T10:16:13.5953478Z Temporarily overriding HOME='/home/runner/work/_temp/dd740c1f-12c4-4b01-9079-5a03c6957c72' before making global git config changes
2026-10-21T10:16:13.5955038Z Adding repository directory to the temporary git global config as a safe directory
```


## Final owner-authorized extra repair — 21 Oct 2026

Source/test commit: `29c21c10be6c7abf395681848c50ef33d0a9e3a8`, based on `d16aa69f3cc913028574ce2300f63a3d8aa7582b`. The owner confirmed that the existing one-extra-pass authorization covers KB-09; its initial exhausted-ticket examples were not a closed permission list. The three normal candidates recorded above remain consumed. This is the single extra, fourth/final cohesive repair candidate. Lint corrections made during this implementation, before final commit/handoff, remain within that same pass; no additional review-fix round is claimed.

### Verified review findings and repair

| Finding | Verified cause and scoped repair |
| --- | --- |
| [Codex 4336341625](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150#discussion_r4336341625) | The draft ref held raw whitespace while the submitted/query name was trimmed, so acknowledgment never released the guard. A nonempty blur records the canonical name in the acknowledgment ref while preserving raw input text, revision ownership and genuinely newer edits. Later authoritative names can sync and newly created tasks use that latest name. |
| [CodeRabbit 4336367703](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150#discussion_r4336367703) | Both completion-name templates split the visible label around the task title. English now uses `Mark done: {title}` and Hebrew `סימון כהושלמה: {title}`. Reopen names and visible labels are unchanged. Hebrew remains machine-drafted for native review. |
| [CodeRabbit 4336367722](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150#discussion_r4336367722) | Idle returned no status node. A native `output` retains its implicit status role and node identity across idle/pending/saved/error; empty states use the existing visually-hidden utility. A separate alert retains error copy, unique identifier and field association. The paragraph wrapper preserves the notice’s existing block layout. Actual assistive-technology announcement delivery remains UNKNOWN. |
| [Review-body stale-result nitpick](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150#pullrequestreview-5599128383) | The existing negative assertions could run before the held mutation reached the query/render. The test now waits for the mock’s real query acknowledgment and flushes pending React commits through the fixture’s installed React DOM before keeping both original assertions. |

The new named child regressions are:

- `acknowledged padded rename accepts later stored names and task creation`: English/Hebrew mounted screen; exact trimmed mutation payload, normalized acknowledgment, subsequent external query name, and exact create payload using that newest name.
- `padded rename settlement preserves a genuinely newer raw draft`: submits a second padded draft, leaves the field unfocused, then settles the older request; the newer raw text remains and no stale Saved notice appears.
- `task accessible names contain their visible localized action and title`: English/Hebrew actual screen and shared gallery, both complete/reopen states, computed accessible name and unchanged completion state.
- `rename status stays mounted through idle saving saved and separate error`: English/Hebrew native status semantics, empty idle accessibility exposure, stable node identity through pending/saved/idle/error, exact localized copy, raw error draft, correct alert association and unique IDs.

All original 14 child cases, assertions and deadlines remain. The child now has 18 cases. The parent has 18 case reports plus a distinct mixed-report parser regression and the authoritative child-exit/report gate; these are not 20 additional functional cases.

### Frozen red proof and reporting correction

Before any production edit, the unchanged `d16aa69` product ran the added regressions. Child result: **15 pass, 3 fail, 24 Bun assertions, 133.32 s**. The failures were exactly the three verified product defects: expected `Maya and Dana` but received `  Maya and Dana  `; expected accessible-name substring `Mark done` but received `Mark Plan with Dana done`; expected one idle status node but received zero. The original 14 cases and the newer-draft case passed. Frozen baseline source, hashes and the red test snapshot remain in ignored `work/kb09-extra/`; the actual log is `/workspace/work/kb-finish/kb09-extra/red.log`. The later unfocused/newer-draft strengthening retained all three red assertions.

That deliberately failing child exposed an additional reporting defect: the old greedy JUnit attribute pattern could absorb a self-closing passed case into a later failed case. It failed closed but misreported individual outcomes: the initial parent showed **9 pass / 10 fail**, rather than faithfully reflecting the child. The pattern now ends attributes at the first matching tag boundary. The distinct parent regression covers passed/failed/passed/skipped XML results and prevents both lost passing cases and a failed result becoming passed. The single cached child result, exact named-case checks and nonzero-exit failure gate remain mandatory.

The intermediate browser verification within this cohesive pass passed **18 child cases / 0 failures / 49 Bun assertions in 265.35 s**; its parent passed **20 reports / 0 failures / 22 metadata assertions in 271.27 s**. Its lint failed because a paragraph with an explicit status role must use native output. The first native-output correction retained an explicit redundant role and lint rejected that too. Both original failures remain at `lint.log` and `lint-final.log`; the final native output uses its implicit status role, and the test explicitly checks `toHaveRole("status")` instead of depending on a redundant HTML attribute. No lint suppression or rule/configuration change was used.

### Test results (cloud agent sandbox)

Bun **1.3.9**, system Chromium, worktree-local workspace links and the existing installed dependencies. Each browser command separately held `/workspace/work/kb-finish/heavy-check.lock`. Final source/test hashes were frozen before verification and checked afterward. The contact sheet remains applicable to the initial layout: visible labels/styles are unchanged and the persistent empty region has no visible layout.

| Command | Final result |
| --- | --- |
| `bun --version` | PASS, exit 0: `1.3.9` |
| `bun install --frozen-lockfile` | UNKNOWN: not rerun in this scoped extra pass; previous resolver timeout remains recorded above |
| `bun run lint` | PASS, exit 0: 5/5 tasks, 10 existing warnings, no errors |
| `bun run typecheck` | PASS, exit 0: 5/5 tasks, 58.984 s |
| `bun test tests/unit/kb-09.test.tsx` | PASS, exit 0: child 18 pass, 0 fail, 0 skip, 49 Bun assertions, 202.73 s; parent 18 case reports plus parser/exit-report gates, 20 pass, 0 fail, 22 metadata assertions, 206.31 s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS, exit 0: all four OK |
| `bun run test` | UNKNOWN: root owns the final integrated full-suite gate; no full-suite result is inferred from scoped proof |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: root owns the complete E2E gate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN: root owns the build gate |

Historical source/test SHA-256 for the earlier scoped pass ending at `e39ac6b` (including unchanged CSS). These values precede the overnight v3 correction and are retained as historical evidence:

```text
b38e92b16389cf4b4e83bde5db55029c5ae25799a546ee4eb5e28266b6598560  apps/web/components/projects/ProjectDetailScreen.tsx
ace4cdbfafd48b4fcc7bb35f390d37732a517f256127ba011e28bd8b292e1a78  apps/web/lib/i18n-groups/kb-09.ts
6e3ca5a93e981fb887c5937142b7dd80414acb53c41ff03d62233b1004d2b1c1  apps/web/app/v3/kb-09.css
038dc21bb481a5592c42c603d2f4ade2dc537fcb489c6f94f4b802fb452eb251  tests/unit/kb-09.test.tsx
```

Root owns the planned consolidated mandatory validation in `/workspace/work/kb-validation`, recording compatible final ticket input commits. Per-PR hosted CI, review and queue outcomes remain separate; none is inferred from this scoped proof.

Final logs: `/workspace/work/kb-finish/kb09-extra/version.log`, `lint-verified.log`, `typecheck-verified.log`, `scans-verified.log`, and `focused-verified.log`. The preceding red/semantic-lint runs are retained separately. No caller, backend, API contract, route, dependency, configuration, CSS or screenshot artifact changed. Root owns final ordered mandatory gates, rebase and all remote actions. No live backend/device/production claim is made. Final verification left no per-run fixture/report/capture directories or active worker runners.

### Retained failure tails from this pass

Deliberate red command, exit 1, actual final 20 lines (parent reporting defect disclosed above):

```text
(pass) browser evidence covers widths, locales, and themes [0.01ms]
56 |     }, 300_000);
57 |   }
58 |   const gateName = "isolated KB-09 child exits successfully and reports every case";
59 |   test(gateName, async () => {
60 |     const completed = await run();
61 |     expect(completed.code).toBe(0);
                                ^
error: expect(received).toBe(expected)

Expected: 0
Received: 1

      at <anonymous> (/workspace/work/kb-09/tests/unit/kb-09.test.tsx:61:28)
(fail) isolated KB-09 child exits successfully and reports every case [0.97ms]

 9 pass
 10 fail
 10 expect() calls
Ran 19 tests across 1 file. [135.50s]
```

Initial paragraph/status lint, exit 1, actual final 20 lines:

```text
tempo-rhythm-web:lint:     443 │         {statusVisible ? text : ""}
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:   i For examples and more information, see WAI-ARIA Roles
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:
tempo-rhythm-web:lint: lint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:   × Some errors were emitted while running checks.
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:
tempo-rhythm-web:lint: error: script "lint" exited with code 1
 ERROR  tempo-rhythm-web#lint: command (/workspace/work/kb-09/apps/web) /workspace/work/kb/bin/bun run lint exited (1)

 Tasks:    4 successful, 5 total
Cached:    4 cached, 5 total
  Time:    6.933s
Failed:    tempo-rhythm-web#lint

 ERROR  run failed: command  exited (1)
error: script "lint" exited with code 1
```

Initial native-output/explicit-role lint, exit 1, actual final 20 lines:

```text
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:
tempo-rhythm-web:lint: Checked 476 files in 5s. No fixes applied.
tempo-rhythm-web:lint: Found 2 errors.
tempo-rhythm-web:lint: Found 9 warnings.
tempo-rhythm-web:lint: lint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:   × Some errors were emitted while running checks.
tempo-rhythm-web:lint:
tempo-rhythm-web:lint:
tempo-rhythm-web:lint: error: script "lint" exited with code 1
 ERROR  tempo-rhythm-web#lint: command (/workspace/work/kb-09/apps/web) /workspace/work/kb/bin/bun run lint exited (1)

 Tasks:    4 successful, 5 total
Cached:    4 cached, 5 total
  Time:    6.209s
Failed:    tempo-rhythm-web#lint

 ERROR  run failed: command  exited (1)
error: script "lint" exited with code 1
```


## Overnight v3 prescribed title repair — 2026-10-21

PR open — owner AT-14 authorizes one scoped correction for the two verified review findings. Role: WORKHORSE. This continues issue #1145 / draft #1150 and preserves the prior attempt ledger and failures above.

The gallery input now holds only the logical project title. Its overflow suffix remains derived display text in a separate paragraph, so typing, leaving overflow and reentering cannot feed the suffix into editable state. The title formatter now uses a function replacer, preserving user-written dollar sequences literally in accessible completion/reopen labels. No other layout, dictionary copy, mutation contract, backend or route changes. Existing CSS and the historical contact sheet remain unchanged; that sheet documents the earlier normal mounted states, while the new overflow behavior is verified by browser assertions below.

New named regressions in the existing test file:

- `task accessible names preserve dollar sequences literally in both languages`: a title containing `$$`, `$&`, dollar-backtick and dollar-apostrophe stays literal in complete and reopen labels, in English/Hebrew and the real screen/gallery.
- `gallery overflow never feeds its display suffix into editable title state`: actual typing in both languages survives repeated default/overflow switches; the separate long display stays visible and the phone viewport does not overflow.

All 18 previous child cases remain byte-for-byte intact in the test file, along with the parent parser and exit gate, all original assertion lines and deadlines. Two added child cases produce 20 child / 22 parent reports. The existing isolated fixture was sufficient for this proof, so no shared merge or harness change is included in this ticket's pass. The globally frozen shared prerequisite remains separately tracked by root.

Before product correction, the new regressions failed against `e39ac6b` product source on current integration: child **18 pass / 2 fail**, 41 assertions, 25.67 seconds; parent **19 pass / 3 fail**, 20 assertions, 26.07 seconds. The failures are exactly the two new cases plus the authoritative parent exit gate. All 18 old child cases passed. The accessible label converted the literal dollars into replacement syntax, and the overflow input contained the long display suffix instead of the logical title.

After correction: `bun test tests/unit/kb-09.test.tsx` → exit 0; child **20 pass / 0 fail**, 45 assertions, 18.61 seconds; parent **22 pass / 0 fail**, 24 assertions, 19.37 seconds. Both locales, both screen/gallery label paths and both complete/reopen states passed. No original case was skipped or weakened.

Bun 1.3.9. Frozen install remained at Resolving dependencies and reached the external 120-second bound (exit 124): UNKNOWN. The lockfile matches the installed shared-worktree cache; installed trees were copied locally with workspace links preserved. No package or lockfile changed. Mandatory checks completed in order on source b67700e; final receipts follow below.

Logs: `/workspace/kb-run-logs/kb09-install.log`, `kb09-before-focused.log`, `kb09-after-focused.log`, `kb09-0.log` through `kb09-5.log`, and `kb09-results.json`. Required PR attachment was attempted separately but host completion is UNKNOWN after the tool hung. Device, live-account and native Hebrew checks remain UNKNOWN.

Before-correction failure, actual last 20 lines:

```text
(pass) browser evidence covers widths, locales, and themes
65 |     }, 300_000);
66 |   }
67 |   const gateName = "isolated KB-09 child exits successfully and reports every case";
68 |   test(gateName, async () => {
69 |     const completed = await run();
70 |     expect(completed.code).toBe(0);
                                ^
error: expect(received).toBe(expected)

Expected: 0
Received: 1

      at <anonymous> (/workspace/kb09/tests/unit/kb-09.test.tsx:70:28)
(fail) isolated KB-09 child exits successfully and reports every case [0.28ms]

 19 pass
 3 fail
 20 expect() calls
Ran 22 tests across 1 file. [26.07s]
```


### Current frozen source/test provenance

The overnight v3 focused and mandatory results below use source commit `b67700e6e1fb7a4c8c697648d73bfb5bb0f4ce69`. SHA-256 values were checked against that commit and the current working tree; all four source/test files still match byte-for-byte. Subsequent commits change evidence only. The earlier hash block is historical, not the final source for this pass.

```text
28997b7bba4612ab09b53778ac7e420ecb19a98934c7b3df0203dfa563d25375  apps/web/components/projects/ProjectDetailScreen.tsx
0a15c8f6e144aec1c493300445123e478fb530f2aef078da63e09a229db89e82  apps/web/lib/i18n-groups/kb-09.ts
6e3ca5a93e981fb887c5937142b7dd80414acb53c41ff03d62233b1004d2b1c1  apps/web/app/v3/kb-09.css
cb2c8356911f8c2c93d697a7d73a164928e2eb975c1245c7be429d74ae1b235d  tests/unit/kb-09.test.tsx
```

### Final mandatory receipts for the prescribed pass

Blocked — both title defects are fixed, but the required local E2E command failed. Source `b67700e6e1fb7a4c8c697648d73bfb5bb0f4ce69` was frozen throughout validation; this final update changes evidence only. No shared harness merge is present. No unchanged retry or unrelated task-view correction was attempted.

| Command | Actual result |
| --- | --- |
| `bun run lint` | PASS, exit 0, 5/5 tasks, 1.07s |
| `bun run typecheck` | PASS, exit 0, 5/5 tasks, 18.91s |
| `bun run test` | PASS, exit 0, 3515 pass / 0 fail / 3 existing todo; 3518 tests across 212 files, 81550 assertions, 463.27s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS, exit 0; all four checks OK |
| `CI=1 bunx playwright test --reporter=line` | FAIL, exit 1; 27 pass / 1 fail / 89 credential-gated skips, 126.13s; serialized with the shared browser lock |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, exit 0, 1/1 task, 0 cached, 66.51s wrapper / 65.523s task |

The E2E failure is `core task views > today, inbox, project, priority, and energy views share one persisted task record`: the existing 30000ms test deadline expired at `tests/e2e/task-views-core.spec.ts:50`, `page.goto("/tasks/energy")`, with `net::ERR_ABORTED; maybe frame was detached?`. It is outside this correction's scope; its cause remains UNKNOWN. The full unit suite's successful KB-61 run does not erase KB-61 failures on other branches. Likewise, all hosted checks observed green on b67700e do not erase this local E2E failure.

Existing CodeRabbit findings 4336923463 and 4336923476 received fix/evidence replies and were resolved after the red/green proof. At final evidence preparation there were zero open review threads, but the requested new source review had not yet posted. Final-head hosted guards and actual review coverage remain required. This pass is frozen and the PR stays draft; no merge, ready transition or issue closure was performed.

E2E failure, actual last 20 lines:

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:219586) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:219911) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (2.1m)
```
