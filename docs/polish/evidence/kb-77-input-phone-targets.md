# KB-77 shared Input phone targets

Existing shared Input fields now have a 44px minimum phone target below 768px. Default desktop height remains 40px; explicit taller/narrower caller classes and custom minimum sizes retain their desktop behavior. The component layer permits intentional caller utility overrides. Native props, events, controlled/uncontrolled values, form behavior, ARIA, ref, and displayName are preserved. No route, caller, backend, config or dependency version changed. A pure, explicitly bilingual gallery adds zero primary production views.

Baseline: integration `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. Original Input frozen before editing (SHA-256 `8f5e338505257a77383bed56015ff08132bd65c133e4f4f9470cb2af6be41b30`). Exact implementation/test source commit: `758a0fc5e876393ea21ee900b6b00d0456b24cad`. The first frozen caller run passed before implementation edits, and its original 16 frames are preserved separately. Viewports are 390×1100 and 1280×1100. Both phases of the comparative fixture use one identical compiled globals/v3/Tailwind stylesheet; only the current phase adds scoped kb-77.css. Before mode loads the byte-for-byte frozen Input; after loads the production module. All other caller source remains unchanged.

The real DayPlanPanel, with real TodayGreeting in the existing Today frame, and the real TimeBlockDialog/Radix dialog are mounted with fictional Maya/Dana/Yoni query/mutation boundaries. These are labeled production caller slices, not full authenticated routes. The fixture stubs auth, locale and Convex query/mutation boundaries only, never Input or either caller. Existing Today blur and Plan title/time submit interactions verify the original API argument shapes through spies; no live account or write is used. The matrix contains 16 before/current caller pairs and eight current gallery frames at 390/1280, en/he, light/dark, with one h1/main, no horizontal overflow, visible keyboard focus and reduced motion. Native time editing worked in installed Chromium. The Input minimum is scoped; existing buttons, selects and dialog close targets remain outside this ticket.

Font provenance is a fixture limitation. Production font files exist under apps/web/fonts/source-sans-3 and apps/web/fonts/assistant. The lightweight fixture serves JS/CSS and returns HTML for font asset URLs; it does not serve those files. Both before/current captures therefore use system fallback fonts. A narrow supplemental metadata probe compiled the same unchanged globals through the fixture's PostCSS/Tailwind pipeline and routing. It records non-custom Noto Sans for sampled Latin text/input and Liberation Sans plus Noto Sans for its Hebrew text sample, Source Sans 3 and Assistant faces in error status, and requests for `/fonts/source-sans-3/SourceSans3-latin.woff2`, `/fonts/assistant/Assistant-latin.woff2` and `/fonts/assistant/Assistant-hebrew.woff2`. It records warning-level `Failed to decode downloaded font` and `OTS parsing error: invalid sfntVersion: 1008821359`. This probe is font metadata, not another real-caller pass; the original captures do not retain per-element font metadata. Production-font text geometry remains UNKNOWN. The named console case collects page errors and console error-level events only; its pass does not establish a warning-free console. Original capture warnings were not retained. The contact sheet explicitly labels this limitation.

Hebrew in kb-77.ts is machine-drafted for Amit's native read. Native-device/VoiceOver/TalkBack behavior remains UNKNOWN. Native time controls use the installed Chromium locale; Hebrew page copy does not prove device-localized time chrome. Browser extension tools were unavailable in this runtime after tool discovery; the ticket explicitly permits the installed Playwright Chromium fixture. No provider or hook was added for the gallery.

## Test results (cloud agent sandbox)

| Command | Result |
| --- | --- |
| `bun --version` | 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: resolver timed out after 120s, actual exit 124. Root plus all six workspace manifests and bun.lock matched prepared kb-75 byte-for-byte; all ignored dependency folders restored with no broken links, no tracked changes and no Turbo archives. |
| `KB77_BEFORE_ONLY=1 bun test tests/unit/kb-77.test.tsx` | PASS, actual exit 0; 1 test/3 Bun assertions; unchanged real Today/Plan fields measured 40px at both widths before implementation edits; 16 original frames. |
| `bun test tests/unit/kb-77.test.tsx` | 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions; focused actual exit 0; browser assertions exercise actual callers and native controls. |
| `bun run lint` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run typecheck` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run test` | FAIL; actual exit 1; 3318 pass, 3 todo, 1 fail, 0 error(s); 81072 Bun assertions |
| `bun run scan:forbidden-tech` | PASS; actual exit 0; scan OK |
| `bun run scan:ram-only-audit` | PASS; actual exit 0; scan OK |
| `bun run scan:design-tokens` | PASS; actual exit 0; scan OK |
| `bun run check:notices` | PASS; actual exit 0; scan OK |
| `CI=1 bunx playwright test --reporter=line` | FAIL; actual exit 1; 27 passed, 89 skipped, 1 failed |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS; actual exit 0; 1 successful, 1 total |

The full-unit failure is the unchanged history normalization UTF-8 cap emoji case: 5921.66ms exceeded its 5000ms limit. All 18 KB-77 cases passed in this full run as well as the focused run. Local E2E failed in the existing core task views case while navigating to /projects at tests/e2e/task-views-core.spec.ts:38, exceeding the 30000ms test limit. The 89 skipped tests remain credential-gated; no live account was supplied. These local failures are retained separately from the all-green initial evidence head eab626d02c8a41cc2bd069f71aa5a562b8d044c3 GitHub checks. No source/config/baseline repair or broad retry was made for them.

## Named regression cases

- original and current real Today intention geometry
- original and current real Plan title and native time geometry
- phone defaults reach 44 px and desktop stays 40 px
- explicit taller and narrower caller classes remain usable
- controlled change keeps the native event value
- uncontrolled input preserves its editable default value
- forwarded ref focuses the real input
- name type required autocomplete and native form behavior survive
- disabled and readOnly remain native and do not change
- invalid state and description stay associated
- English and Hebrew gallery dictionaries have exact parity
- pure gallery mounts real inputs with one main and heading
- long Hebrew labels wrap and user text keeps its direction
- keyboard focus remains visible with reduced motion
- real Today blur saves the existing intention argument
- real Plan title and time submit the existing native arguments
- caller and gallery matrix fits both widths languages and themes
- browser identity content and console stay healthy

## Failure evidence

The frozen install produced this complete log (exit 124):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Final 20 lines of bun run test (exit 1):

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.58ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.75ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.45ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


1 tests failed:
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "😀" [5921.66ms]
  ^ this test timed out after 5000ms.

 3318 pass
 3 todo
 1 fail
 81072 expect() calls
Ran 3322 tests across 202 files. [149.22s]
error: script "test" exited with code 1
```

Final 20 lines of CI=1 bunx playwright test --reporter=line (exit 1):

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:223733) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:223845) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.6m)
```

## Factory report

```text
status: blocked
ticket: #1184
evidence: draft PR https://github.com/Levidavidspublic/tempo-rhythm/pull/1186; source 758a0fc; 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions focused; full unit 3318 pass, 3 todo, 1 fail, 0 error(s); 81072 Bun assertions; E2E 27 passed, 89 skipped, 1 failed; baseline caller 40px -> phone 44px, desktop 40px; lint exit 0; typecheck exit 0; test exit 1; forbidden exit 0; ram exit 0; tokens exit 0; notices exit 0; e2e exit 1; build exit 0; contact sheet and exact failure tails
changed: apps/web/components/ui/input.tsx; apps/web/lib/i18n-groups/kb-77.ts; apps/web/app/v3/kb-77.css; tests/unit/kb-77.test.tsx; docs/polish/evidence/kb-77-input-phone-targets.md and .jpg
unknowns: frozen install resolver timed out (124); production-font geometry (fixture font URLs return HTML and system fallbacks are used); device screen-reader and native device behavior; live account/deployed writes; exact evidence-head remote CI recorded in PR
notes for ticket sync: existing Input polish adds zero primary views; Hebrew machine draft needs Amit's native read; existing KA-owned callers remain read-only; no retry budget reset or backend/caller changes
```
