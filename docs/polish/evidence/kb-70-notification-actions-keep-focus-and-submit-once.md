# KB-70 notification action and focus evidence

## Authorized v3 focus wait — 2026-10-21

PR open — the matching-row focus wait is corrected and all local validation passes on source `730308b68af3717e7192104cf1721a35bf97d9dc`, continuing draft #1196 for reopened issue #1166. Amit's AT-12 answer authorizes this one scoped further pass. This supersedes the earlier “no further candidate authorized” hold only for the prescribed focus-wait correction.

The reopened issue records hosted jobs `119186508145` and `119199655001`, where the earlier test queried unread rows before React committed the preceding read update. The initial corrective PR waited for named read rows, but CodeRabbit finding [4336607766](https://github.com/Levidavidspublic/tempo-rhythm/pull/1196#discussion_r4336607766) identified a remaining gap: the Dana read-only row exists during the commit, before `NoticeRow`'s `useEffect` focuses it. The prior 13-case local and hosted passes did not disprove that race. No new before-failure count is invented for that static finding.

The test now waits until the exact read-only row containing “Dana has a reminder” is also `document.activeElement`. The original zero-unread wait and active-element assertion immediately afterward remain. All 13 case names, every existing assertion and all setup/test deadlines are unchanged; no fixed sleep or wider timeout was introduced. The existing Playwright wait is sufficient, so this independent timing correction adds no shared-harness dependency. Product code and the original contact sheet are unchanged.

Focused proof: `bun test tests/unit/kb-70.test.tsx` → 13 pass, 0 fail, 13 parent assertions, exit 0 in 4.79 s. The existing parent wrapper requires its isolated child's authoritative exit 0 for every case. This run's parent count is distinct from the historical child 115-assertion receipt below. It covers both delayed-read focus paths, single-flight submission, failure/retry/success and the original gallery matrix.

### Test results (cloud agent sandbox)

Bun 1.3.9, final source `730308b68af3717e7192104cf1721a35bf97d9dc`. Exact frozen install reached only “Resolving dependencies” and was externally terminated at the 120 s bound (exit 124): UNKNOWN. After installer exit, six dependency trees from the verified prior KB-02 worktree were copied preserving relative workspace links. No package, lockfile or environment configuration changed. The original mandatory sequence completed before any further dependency operation. Because earlier worktree installs took roughly 303 s, a separate coordinator-authorized 360 s observation of the same exact frozen-install command follows those checks. Both receipts are retained; no test is rerun and no acceptance condition changes.

| Command | Final-source result |
|---|---|
| `bun --version` | PASS, 1.3.9, exit 0. |
| `bun install --frozen-lockfile`, first observation | UNKNOWN, exit 124 at 120 s, before the fallback dependency copy. |
| `bun install --frozen-lockfile`, longer final observation | PASS, exit 0 after 301.91 s (Bun reports 301.87 s), checked 1033 installs across 1079 packages, no changes. |
| `bun run lint` | PASS, 5/5 tasks (cached), 0 errors, 9 existing warnings, exit 0. |
| `bun run typecheck` | PASS, 5/5 tasks (cached), exit 0. |
| `bun run test` | PASS, 3493 pass, 0 fail, 3 existing todo, 81526 assertions across 211 files, exit 0 in 267.64 s. All 13 KB-70 cases passed within this run. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS, all four OK, exit 0. |
| `CI=1 bunx playwright test --reporter=line` (serialized with `flock`) | PASS, 28 pass, 0 fail, 89 expected credential-gated skips, exit 0. The unchanged notifications route wiring passed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, 1/1 task (cached), exit 0. |

On source `730308b`, hosted CI run `39671540331`, preview run `39671540377` and Security run `39671540305` all completed successfully. The final evidence head must still satisfy current CI and every repository guard. CodeRabbit explicitly resolved finding 4336607766 after reviewing the supplied matching-row focus wait; zero unresolved threads were observed. Final current-head review and repository guards remain the coordinator's merge gates; no merge is claimed here.

First frozen-install output (complete output; exit 124):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Longer frozen-install output (complete output; exit 0):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
Resolved, downloaded and extracted [36]

Checked 1033 installs across 1079 packages (no changes) [301.87s]
```

The longer observation resolves the exact-install UNKNOWN for this final source. The first 120 s termination remains a historical receipt. The successful install reported no dependency changes, and no tests were rerun.

Earlier receipts remain below. Native Hebrew review and physical-device screen-reader checks are required before production; live-account behavior remains UNKNOWN. No production change or deployment occurred.


The mounted `/notifications` screen still uses the same profile/list queries and `markRead({ notificationId })` and `markAllRead({})` mutations. A read row now returns focus only when the person stayed on its unread button while a delayed query update arrived. If focus moved to the preferences link or another control, the row leaves it there. “Mark all read” accepts one in-flight submission and shows a short localized pending explanation beside its unchanged button label; its existing success and error copy remain.

The [contact sheet](./kb-70-notification-actions-keep-focus-and-submit-once.jpg) pairs the original checked-in mounted component saved before editing, the updated mount during a delayed “Mark all read” request, and the controlled gallery at 390 and 1280 px in English and Hebrew, light and dark. All 16 mounted before/after frames had one heading and no horizontal overflow: the recorded `scrollWidth` equaled the viewport width. Before, the action remained available with no pending explanation; after, it is disabled and its pending explanation appears beside it. The eight gallery frames show the real row and feedback exports. Screens use fictional Maya, Dana and Yoni notices and mocked auth/query/mutation boundaries. These are component comparisons, not claims about a live account. The original source capture was saved before editing at `/workspace/work/kb-70-evidence/NotificationsScreen.before.tsx`.

The hydrated browser fixture exercises delayed `markRead` updates in both focus paths, double submission and failure/success of `markAllRead`, plus the exported gallery’s default, pending, success, error, disabled, empty and overflow views. It checks keyboard interaction, one h1/main, RTL, reduced motion, 44 px phone targets and horizontal overflow. The focused run passed all 13 cases with 115 assertions. The source commit is `3c39803`.

New Hebrew is machine-drafted for Amit's native review. Device screen-reader and live-account behavior remain UNKNOWN.

## Owner-authorized fixture follow-up — 21 Oct 2026

PR #1167 merged as `1b9f0a4e13bfe07e1d8596897c3e28b2118909f0`. The original report records three source/review rounds (`4f036f1`, `a02cd74`, `3c39803`). The later evidence commit `0df8649`, rebased to `0e929b6`, did not change the test or mounted component; those source files still matched the third round at merge. This follow-up uses the owner's single previously authorized additional repair pass on the same issue #1166. The lead owns its follow-up draft PR and integration; this does not reset the attempt budget.

Hosted job `119186508145` exposed a strict-locator failure after the fixture scheduled Maya's read-state render: both legitimate unread buttons still existed when the test waited on all unread buttons. One unchanged retry passed, while KB-75's unchanged retry (job `119199655001`) independently reproduced the same KB-70 strict locator failure with all 23 KB-75 cases passing (3,474 suite passes, three todo, one failure). The failure is intermittent across runs and has two retained hosted reproductions. Source inspection nevertheless confirms that waiting for an unread Dana does not establish that Maya's read-state commit happened before checking focus. The test now waits for the named Maya and Dana read-only rows, then performs the existing focus checks; the reset waits specifically for Maya's unread button. It retains the zero-unread wait. The later KB-78 timeout in that log is not proof of a causal relationship or a mounted notifications defect.

The isolated wrapper also cached child output before its one-time exit check. Later parent cases could match names in failed-child output and pass after the first case failed. The cached child exit now rejects every parent case. All 13 case names, every existing assertion line, and all setup/test deadlines are unchanged. Production code, callbacks, query/mutation arguments, copy, styling and the existing contact sheet are unchanged.

Current follow-up validation uses Bun 1.3.9 with a real worktree-local `.bun` directory hardlinked to the identical installed cache and local workspace package links:

| Command | Exit | Follow-up result |
| --- | ---: | --- |
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: resolver remained at `Resolving dependencies` at the authorized 120-second bound |
| `bun run lint` | 0 | 5 successful, 5 total |
| `bun run typecheck` | 0 | 5 successful, 5 total; 4 minutes 41.499 seconds |
| `bun test tests/unit/kb-70.test.tsx` | 0 | 13 passed, 0 failed, 13 parent assertions; real isolated child exited 0; 26.03 seconds |
| `python3 /workspace/work/kb-finish/kb70-followup/check-child-failure.py` | 0 | Controlled negative proof passed: injected browser exit 73, test exit 1, all 13 parent cases failed, zero parent passes, owned fixture directories removed |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK; 66 documented notices |
| `bun run test` | — | Pending lead validation on the integrated candidate |
| `CI=1 bunx playwright test --reporter=line` | — | Pending lead validation on the integrated candidate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | Pending lead validation on the integrated candidate |

The controlled negative probe used a disposable browser executable that printed every expected case name as successful-looking stale output and exited 73. The real isolated child failed, and all 13 parent cases rejected its cached nonzero exit rather than accepting those names. The probe harness verified no fixture directories remained and removed its disposable browser cache. This expected failing test command is a passing failure-propagation check, not a claim of a new product failure.

Frozen-install output (exit 124):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

The original 13-case/115-assertion result above remains historical. Device screen-reader and live-account limits remain UNKNOWN; the unchanged hosted retry does not prove absence of future timing races. The lead records the final integrated source commit and remaining broad results.
