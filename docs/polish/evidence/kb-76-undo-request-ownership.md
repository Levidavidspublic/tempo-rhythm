# KB-76: a completed Undo cannot dismiss a newer Undo

This polishes the existing `UndoToast` and adds **zero primary views**. Source/test commit: `499745a6670d4667d1265997ddb3d6e1f8de9230`. Integration base and frozen original: `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The original `shared.tsx` and unchanged `ProjectDetailScreen.tsx` were frozen at **2026-10-20 01:13 UTC**, before any production edit. The initial original-code browser reproduction completed before the repair; later original contact-sheet captures import that exact frozen module. The source/test files remain frozen after repair round 3.

The [before/after contact sheet](kb-76-undo-request-ownership.jpg) shows the actual unchanged `ProjectDetailScreen` at 390/1280 px, English/Hebrew, light/dark. Its existing checkboxes create toast A and toast B through the real caller callbacks. A's Undo waits, B replaces it, then A resolves. The original loses B; the changed shared toast keeps B and B's own Undo callback. The lower sheet compares the original toast in a standalone fixture with the new interactive gallery; there was no original production gallery. Each full 900 px viewport uses the same compiled app `globals.css`, actual v3 styles and icon sprite, with local font fallback. Desktop captures are scaled to fit their evidence column.

The hydrated fixture renders the actual shared exports and actual `ProjectDetailScreen`. Only Convex auth/query/mutation boundaries, generated API references and Next Link are fictional local substitutes. The real `LocaleProvider` and production pure helpers remain in use. The controlled browser clock advances the existing deadline without five-minute sleeps. No live account, provider, backend mutation or deployed persistence is verified.

## Behavior and contract

`ToastState`, `makeToast`, `UNDO_WINDOW_MS`, `UndoToast({toast,onClose})` and all caller signatures remain intact. Other existing shared exports are byte-for-byte unchanged, checked against pinned base-section SHA-256 values. The shared view calls only the supplied `onUndo()` with **zero arguments**, once per activation, and calls `onClose()` only for its own current mounted request. The original five-minute deadline remains unchanged; activation at or after the deadline is rejected even between ticks. No automatic retry, backend call, route or policy is added.

Ownership follows the toast **object** and an individual request token. Layout cleanup invalidates a replaced/unmounted owner, including replacements with the same `Date.now()` ID. StrictMode setup/cleanup/setup creates a fresh owner. Current rejection or a synchronous callback throw shows plain localized feedback and a keyboard/pointer reachable retry; a stale result cannot close, mark failed or focus a replacement. Dismissal still hides the receipt while an already-started operation may finish. The server remains authoritative about whether that operation succeeds.

The actual caller regression verifies the unchanged update arguments `{taskId:"maya",status:"todo"}` then `{taskId:"dana",status:"todo"}` for the two fictional tasks. This is mocked-boundary evidence, not a live write. `Kb76Gallery` reuses the existing toast with working fictional replacement, completion, rejection, long-title and no-Undo controls. Phone toast buttons measure at least 44×44 px, titles wrap, mixed text retains `dir="auto"`, and numeric countdowns retain their LTR isolation. Changing seconds stay `aria-hidden`; the screen-reader-only full window text stays stable. Visible keyboard focus is checked as an actual outline or shadow. Reduced-motion durations are at most 0.001 seconds. Screen/gallery each have one main/h1 and no horizontal overflow in all eight combinations.

Hebrew is machine-drafted for Amit's native review. Device screen-reader results, live backend Undo writes and deployed persistence remain UNKNOWN.

## Test results (cloud agent sandbox)

| Command/check | Exit, counts and result |
|---|---|
| `bun --version` | exit 0; `1.3.9`. |
| `bun install --frozen-lockfile` | UNKNOWN: first attempt stalled at dependency resolution and was terminated (143); bounded repeat after cached-directory bootstrap timed out (124). |
| `bun install --frozen-lockfile --offline` | UNKNOWN: also stalled resolving and was terminated (143). |
| Cache bootstrap | All ignored node_modules directories linked from KB-75 after byte comparison confirmed identical lockfile and every workspace package.json. Every declared dependency is present and every workspace dependency resolves inside this checkout. **Not an exact-install PASS.** |
| `bun run lint` | UNKNOWN: queued under the shared validation lock. |
| `bun run typecheck` | UNKNOWN: queued under the shared validation lock. |
| `bun run test` | UNKNOWN: queued under the shared validation lock. |
| `bun run scan:forbidden-tech` | UNKNOWN: queued. |
| `bun run scan:ram-only-audit` | UNKNOWN: queued. |
| `bun run scan:design-tokens` | UNKNOWN: queued. |
| `bun run check:notices` | UNKNOWN: queued. |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: queued; local-only command, expected credential-gated skips must still be counted. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN: queued. Planned process-only `TURBO_CACHE=local:r`, no config change. |
| Final `bun test tests/unit/kb-76.test.tsx` (repair round 3) | exit 0; **27 pass, 0 fail**, 81 outer wrapper assertions, 141.08 s. The isolated child exercises all 27 actual cases once. |
| Scoped `biome lint` | exit 0; 3 production files checked, no fixes. |
| Frozen-original regression | expected exit 1; 0 pass/1 fail, 2 wrapper assertions; actual caller expected 1 toast, received 0 after A settled. |
| Repair round 1 focused check | exit 1; 23 pass/1 fail, 71 outer assertions, 200.14 s. Retry pointer action timed out at `performing click action`; initial run did not retain a trace/screenshot for that timeout. |
| Repair round 2 focused check | exit 0; 26 pass/0 fail, 78 outer assertions, 121.94 s. Keyboard retry plus added dismissal/expiry rejection cases; no claim this older run covered the later extra pointer case. |
| Separate pointer diagnostic on round-2 product | exit 0; 1 pass/0 fail, 3 wrapper assertions, 10.67 s. Exact default pointer retry after a 5 s clock jump. Enabled button rect: x33/y763/165.2×44; elementFromPoint belonged to the button. Trace: first click 563 ms, retry 93 ms, no error. Both pointer and keyboard retry remain in the final 27-case suite. |

The initial pointer timeout is preserved as an observed failure; the later trace proves the later diagnostic succeeded, not why the initial timeout happened. Three implementation/check repair rounds have been used; no fourth source/test repair is authorized. Current scoped source/test work is frozen. Required long checks run in AGENTS order, including later steps after any failure. Full validation uses the outer validation lock; embedded browser tests also take fixture then E2E locks. Fixture-only jobs take fixture then E2E locks and launch no Next server. Existing Chromium is used through a process-only browser path.

## Named final cases

1. current success closes once
2. current rejection retains a reachable retry
3. retry success closes without extending the deadline
4. pointer retry remains clickable after countdown updates
5. same-tick duplicate activation calls Undo once
6. synchronous callback throw is a safe error
7. resolution after replacement keeps the new toast
8. rejection after replacement leaves the new toast clean
9. dismissal then replacement ignores the old resolution
10. expiry during a pending request cannot close a later toast
11. rejection after dismissal leaves a replacement clean
12. rejection after expiry leaves a replacement clean
13. activation at the deadline is rejected before the timer tick
14. a toast without Undo has only dismissal
15. replacement clears old busy and error feedback
16. the callback receives no arguments
17. StrictMode cleanup does not disable the current request
18. same-id replacement ignores the previous request
19. real ProjectDetail caller keeps B after A settles
20. real ProjectDetail caller ignores A rejection after B
21. English and Hebrew new dictionary keys and feedback match
22. gallery controls drive the actual shared toast
23. keyboard focus is visible and a late completion cannot steal it
24. countdown changes stay out of live announcements
25. real screen and gallery fit both widths languages and themes
26. reduced motion stays below one millisecond
27. all unrelated shared exports remain identical to the base

## Preserved failure tails (last 20 lines, or full shorter log)

Frozen-original regression (expected red proof)

```text
+ Received: 0
+ Timeout:  5000ms
+
+ Call log:
+   - Expect "to.have.count" with timeout 5000ms
+   - waiting for locator('[data-component="UndoToast"]')
+     14 × locator resolved to 0 elements
+        - unexpected value "0"
+ "

- Expected  - 1
+ Received  + 13

      at <anonymous> (/workspace/work/kb-76/tests/unit/kb-76.test.tsx:209:138)
(fail) KB-76: real ProjectDetail caller keeps B after A settles [2.64ms]

 0 pass
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [16.62s]
```

Repair round 1 focused check

```text
(pass) KB-76: the callback receives no arguments
(pass) KB-76: StrictMode cleanup does not disable the current request
(pass) KB-76: same-id replacement ignores the previous request [0.02ms]
(pass) KB-76: real ProjectDetail caller keeps B after A settles
(pass) KB-76: real ProjectDetail caller ignores A rejection after B
(pass) KB-76: English and Hebrew new dictionary keys and feedback match
(pass) KB-76: gallery controls drive the actual shared toast
(pass) KB-76: keyboard focus is visible and a late completion cannot steal it
(pass) KB-76: countdown changes stay out of live announcements
(pass) KB-76: real screen and gallery fit both widths languages and themes
(pass) KB-76: reduced motion stays below one millisecond
(pass) KB-76: all unrelated shared exports remain identical to the base

1 tests failed:
(fail) KB-76: retry success closes without extending the deadline [1.54ms]

 23 pass
 1 fail
 71 expect() calls
Ran 24 tests across 1 file. [200.14s]
```

Exact install after cache bootstrap (UNKNOWN timeout)

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

```text
status: blocked
ticket: #1180
evidence: source 499745a6670d4667d1265997ddb3d6e1f8de9230; final focused browser 27 pass/0 fail; real frozen caller reproduction expected1 toast/received0 before repair; full repository gates queued
changed: three scoped production files, one test and two scoped evidence artifacts; zero new primary views
unknowns: exact frozen install stalled; full repository gates/CI queued; device screen reader; live backend writes and deployed persistence
notes for ticket sync: third repair round exhausted; preserve all original shared APIs, callback arguments and deadline; Hebrew machine-drafted; no scope/backend/config/route change
```
