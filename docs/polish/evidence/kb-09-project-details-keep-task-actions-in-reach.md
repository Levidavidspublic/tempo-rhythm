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
