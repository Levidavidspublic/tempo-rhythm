# KB-70 notification action and focus evidence

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
