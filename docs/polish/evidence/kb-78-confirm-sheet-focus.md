# KB-78 ConfirmSheet pending focus evidence

**Status: stuck.** Candidate 3 exhausted the permitted three review/check candidates. The source-head CI Test job failed two new callback/StrictMode cases even though the 21-case focused run and the full local unit suite passed. No fourth source/test repair was attempted. Local install remains UNKNOWN after its authorized timeout. The draft is reviewable but is not done or merge-ready.

This polishes the existing `ConfirmSheet` in `components/you/Controls.tsx` and adds **zero primary views**. The confirm button remains focusable with `aria-disabled` and an explicit busy guard, while the dialog reports `aria-busy`. Tab containment also recovers focus lost outside the open dialog. The parent still supplies `busy`, owns accepted request lifetime/success/error and decides whether an explicit close proceeds. Confirm and close callbacks receive no arguments. Existing Cancel initial focus, Escape/Close/Cancel behavior and opener restoration remain available. Segmented/Switch source and runtime behavior are unchanged.

## Baseline and real mount

Baseline: integration `52bf2803e9105b25c2538aedd81a754a9fbfdedb`, frozen before editing. Original Controls SHA256: `2c5f1998fe329c67acbf604782eb1af2c2f90d94b270f5c91575c6436140ee9a`. The exact frozen source is embedded in the one scoped test to make the original/current comparison reproducible in a clean CI checkout. The original lead proof was reused only after exact source hashes matched; its JSON/log were copied into ignored `work/kb78-baseline/`.

Read-only mount: `app/(tempo)/settings/integrations/page.tsx` → `IntegrationsList` → actual unchanged `ExecutorConnection` → actual `ConfirmSheet`. The browser fixture renders that real host with fictional query/auth and deferred existing action boundaries. It sends exactly `connections.disconnect({provider:"executor"})` once; no live connection or account is read or changed. This is a screen slice with the existing page/main/heading supplied by the fixture, not a full authenticated route or deployed-service check. The gallery mounts the production ConfirmSheet itself.

Original trace: Enter on Confirm → active element BODY → Tab to background `#after` while alertdialog stays open. Current trace: Enter → active element BUTTON → Tab remains inside the still-open dialog. Shift+Tab remains contained. Repeated Enter, Space and real mouse-coordinate clicks while busy produce one accepted action. The unchanged caller closes and updates its own state on success; rejection remains its safe error/close path.

## Focused browser validation

Command: `bun test tests/unit/kb-78.test.tsx` using Bun `1.3.9` and installed Chromium under validation → fixture → E2E locks. **PASS: 21 tests, 0 failures, 24 expectations; 138.15 seconds.** Run/capture interval: 2026-10-20 03:33:29–03:35:47 UTC. All 24 captures completed at 390/1280 px, en/he and light/dark, covering frozen original caller, corrected caller and real gallery. Current cases assert one main/h1, 44 px minimum dialog targets, no horizontal overflow, visible focus, near-zero reduced motion, bilingual copy and RTL. Browser page/console errors: none.

The initial queue from 02:28:58 was interrupted during an environment/session interval before Bun started: log size zero, no retained exit and no live process. It is UNKNOWN, not a test pass. The pre-run review candidate still counts toward the three-candidate limit. Two test-only pre-run review corrections were applied before the first actual run: use real pointer coordinates for aria-disabled controls, and accept the app's existing `0.01ms !important` reduced-motion rule. No global CSS/config changed.

Named regression cases:

- dictionary parity and exact frozen source preserve the other exports
- actual caller original escape and current Enter pending Tab containment
- Shift Tab stays inside the busy real caller
- pointer accepted action retains focus while pending
- busy Enter Space and pointer repeat send one unchanged call
- normal forward and reverse wrapping includes available body controls
- lost outside focus recovers in either direction
- Cancel receives initial safe focus
- Escape Close and Cancel restore the existing opener
- busy explicit closing still follows the parent callback
- real parent success closes and updates its own connection state
- real parent rejection owns error and closing without raw detail
- fresh callbacks receive no event arguments
- StrictMode unmount removes listeners and restores once
- Segmented and Switch keep their existing runtime behavior
- parent busy remains authoritative without an inferred lifetime
- English Hebrew RTL and real gallery states
- exact UTF8 production copy and actual shell icons render
- visible focus and reduced motion stay available while busy
- 390 1280 light dark matrix has 44px targets and no overflow
- real fonts are served and fixture console stays clean

## Capture and font provenance

Three review/check candidates were used and two focused runs executed. The first executed run passed 20 cases but root visual review found fixture mojibake and a missing shell icon sprite; those captures are invalid locale/visual evidence and are archived only under ignored `work/kb78-round1/`. Candidate 3 changes only the fixture: explicit UTF-8 HTML/JS/CSS headers and meta, the actual TpIconSprite, and exact production-language/icon assertions. The product source stayed unchanged through those fixture corrections. The final sheet contains only the 24 third-candidate captures, verified against the recorded run interval (ended timestamps have one-second resolution). No fourth source/test repair is permitted.

The [contact sheet](./kb-78-confirm-sheet-focus.jpg) uses actual unmodified browser screenshots, resized only for the labelled grid. The production components, real LocaleProvider and compiled app Tailwind/v3 styles are used. The fixture serves app font files at equivalent `/fonts/...` URLs, waits for `document.fonts.ready` and asserts loaded Source Sans 3/Assistant in the language matrix. Actual requested faces: /fonts/newsreader/Newsreader-latin.woff2, /fonts/source-sans-3/SourceSans3-latin.woff2, /fonts/frank-ruhl-libre/FrankRuhlLibre-latin.woff2, /fonts/assistant/Assistant-latin.woff2, /fonts/frank-ruhl-libre/FrankRuhlLibre-hebrew.woff2, /fonts/assistant/Assistant-hebrew.woff2. Next's generated font class names and fallback-metric adjustment are not recreated; the local Newsreader face supplies the root variable directly. IBM Plex Mono is not exercised here and uses a generic monospace fallback if requested. No remote font/provider call occurs.

Hebrew additions are machine-drafted for Amit's native read. Native device/screen-reader behavior and live disconnect authorization/writes remain UNKNOWN. The screenshot sheet proves appearance only; the hydrated assertions prove focus, activation and callback results.

## Ownership and scoped source

Refresh: 116 open PRs. Compared with the complete 113-PR cache, new #1185/#1186/#1187 and changed #1183/#1140 are disjoint from Controls. The existing complete file audit shows Controls only in release promotion #728; the active-issue cache has no Controls scope owner. KA #1118's separate ExecutorConnection mount stays read-only.

Other-export section SHA256 remains `5124c4660af9f99eedd876eec519225125106eefb3492c0e42f8d9ff114aa9ed`. Source hashes at the passing focused run:

- `apps/web/components/you/Controls.tsx`: `d1c1e8ae2b983a82501e75d3a9080db44572cf7761723a9419792771bc656a02`
- `apps/web/lib/i18n-groups/kb-78.ts`: `b33a4250292c74f4ed114ccade89f7f39e79e63150b658fc62f6fd7c44094d56`
- `apps/web/app/v3/kb-78.css`: `dd1c39a72c58e89396d65fa5e7035e11518d352e85078ba5725ffe83f2845cff`
- `tests/unit/kb-78.test.tsx`: `9a9186725bb3369b815fe8acda6cc87ec92a9bfd6129a8fa0f9f92237d7e2a0a`

## Test results (cloud agent sandbox)

| Exact command | Result |
| --- | --- |
| `bun --version` | PASS: 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: exit 124 at the authorized 120-second limit, stalled at Resolving dependencies |
| Scoped Biome check from apps/web | PASS: 3 files, no fixes/errors |
| `bun test tests/unit/kb-78.test.tsx` | PASS: 21 pass, 0 fail, 24 expectations |
| `bun run lint` | PASS: exit 0, 5/5 tasks, 9 existing warnings |
| `bun run typecheck` | PASS: exit 0, 5/5 tasks |
| `bun run test` | PASS: exit 0, 3322 pass, 3 todo, 0 fail; 81042 expectations, 3325 tests / 202 files, 130.25s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS: exit 0; all four scans OK, 66 notices documented |
| `CI=1 bunx playwright test --reporter=line` | FAIL: exit 1; 2 failed, 89 skipped, 26 passed (5.2m) |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS: exit 0; 1/1 tasks |

After the install timeout, bun.lock and all seven root/workspace manifests were verified byte-identical to the existing KB75 worktree; all six ignored dependency directories were copied, with no Turbo archives. The first formatting invocation from repo root could not resolve the app's relative Biome config; the same scoped command passed from apps/web, without a config or product-source correction.

Install timeout log (all available lines):
```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

All six mandatory formal stages ran on frozen source head `6e66869056df56fde7f5873f946a8cfc054316a7`; SHA256 checks confirm all three implementation files and the scoped test remained byte-identical after every stage completed. Heavy commands were serialized. Build used process-only `TURBO_CACHE=local:r` to avoid cache-archive disk growth; its required command and placeholder Convex URL were otherwise unchanged. No failed gate was rerun. Exact per-stage timings/exits are retained in ignored `work/kb78-validation/results.json`.

## Source-head GitHub checks

At source head `6e66869056df56fde7f5873f946a8cfc054316a7`, [CI run 39365351106](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39365351106) completed with aggregate ci **FAIL**. Test: **3320 pass, 3 todo, 2 fail**, 81042 expectations, 3325 tests / 202 files, 60.89s. The two new failures were:

- `fresh callbacks receive no event arguments`: close callback expected `{version:3,args:0}`, received `{version:2,args:0}`.
- `StrictMode unmount removes listeners and restores once`: expected close count 1, received 2.

Read-only inspection suggests the tests issue Escape immediately after `evaluate(setState)` without awaiting the React commit. That is an unverified timing hypothesis; neither a product nor a harness cause has been established. Both failures remain unresolved and disclosed, even if a later evidence-only head happens to pass. No rerun or further repair is authorized by the exhausted budget.

All other source-head checks passed: Typecheck 5/5; Build 1/1; E2E 28 pass / 89 credential-gated skips; preview smoke 4 pass (preview job used Bun 1.3.14, while primary CI used 1.3.9); lint; scans/notices; scope/config/secret guards; secret self-tests. Primary CI dependency installs succeeded; that does not replace the local install timeout.

CI failed command actual last 20 lines (trailing whitespace omitted) before job cleanup:
```text
2026-10-20T03:39:46.4441919Z
2026-10-20T03:39:46.4442269Z ##[endgroup]
2026-10-20T03:39:46.4442444Z
2026-10-20T03:39:46.4442952Z 3 tests todo:
2026-10-20T03:39:46.4443578Z (todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
2026-10-20T03:39:46.4444782Z (todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
2026-10-20T03:39:46.4445396Z (todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages
2026-10-20T03:39:46.4445676Z
2026-10-20T03:39:46.4445688Z
2026-10-20T03:39:46.4445767Z 2 tests failed:
2026-10-20T03:39:46.4446161Z (fail) KB-78 actual confirm pending focus > fresh callbacks receive no event arguments [1.00ms]
2026-10-20T03:39:46.4446715Z (fail) KB-78 actual confirm pending focus > StrictMode unmount removes listeners and restores once
2026-10-20T03:39:46.4446995Z
2026-10-20T03:39:46.4447069Z  3320 pass
2026-10-20T03:39:46.4447242Z  3 todo
2026-10-20T03:39:46.4447420Z  2 fail
2026-10-20T03:39:46.4447592Z  81042 expect() calls
2026-10-20T03:39:46.4447836Z Ran 3325 tests across 202 files. [60.89s]
2026-10-20T03:39:46.4807279Z error: script "test" exited with code 1
2026-10-20T03:39:46.4817185Z ##[error]Process completed with exit code 1.
```

Local `CI=1 bunx playwright test --reporter=line` actual last 20 lines (trailing whitespace omitted):
```text
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[110/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:247475) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:247540) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  2 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  26 passed (5.2m)
```

Local E2E diagnostics (actual log excerpts):
```text
  1) [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date

    Test timeout of 30000ms exceeded.

    Error: locator.fill: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByRole('textbox', { name: 'Event title' })


      16 |   await page.waitForLoadState("networkidle");
      17 |
    > 18 |   await page.getByRole("textbox", { name: "Event title" }).fill("Boundary planning call");
         |                                                            ^
      19 |   await page.getByLabel("Event date").fill("2026-08-01");
      20 |   await page.getByRole("button", { name: "Add event" }).click();
      21 |
        at /workspace/work/kb-78/tests/e2e/calendar-views.spec.ts:18:60

    Error Context: test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/trace.zip
  2) [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record

    Test timeout of 30000ms exceeded.

    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
    Call log:
      - navigating to "http://localhost:3000/tasks", waiting until "load"


      27 |     await expect(page.getByText(taskTitle)).toBeVisible();
      28 |
    > 29 |     await page.goto("/tasks");
         |                ^
      30 |     await expect(main.getByRole("heading", { name: "Inbox" })).toBeVisible();
      31 |     await expect(page.getByText(taskTitle)).toBeVisible();
      32 |
        at /workspace/work/kb-78/tests/e2e/task-views-core.spec.ts:29:16

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
```
