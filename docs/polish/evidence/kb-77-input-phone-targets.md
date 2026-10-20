# KB-77 shared Input phone targets

Existing shared Input fields now have a 44px minimum phone target below 768px. Default desktop height remains 40px; explicit taller/narrower caller classes and custom minimum sizes retain their desktop behavior. The component layer permits intentional caller utility overrides. Native props, events, controlled/uncontrolled values, form behavior, ARIA, ref, and displayName are preserved. No route, caller, backend, config or dependency version changed. A pure, explicitly bilingual gallery adds zero primary production views.

Baseline: integration `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. Original Input frozen before editing (SHA-256 `8f5e338505257a77383bed56015ff08132bd65c133e4f4f9470cb2af6be41b30`). Exact implementation/test source commit: `758a0fc5e876393ea21ee900b6b00d0456b24cad`. The first frozen caller run passed before implementation edits, and its original 16 frames are preserved separately. Viewports are 390×1100 and 1280×1100. Both phases of the comparative fixture use one identical compiled globals/v3/Tailwind stylesheet; only the current phase adds scoped kb-77.css. Before mode loads the byte-for-byte frozen Input; after loads the production module. All other caller source remains unchanged.

The real DayPlanPanel, with real TodayGreeting in the existing Today frame, and the real TimeBlockDialog/Radix dialog are mounted with fictional Maya/Dana/Yoni query/mutation boundaries. These are labeled production caller slices, not full authenticated routes. The fixture stubs auth, locale and Convex query/mutation boundaries only, never Input or either caller. Existing Today blur and Plan title/time submit interactions verify the original API argument shapes through spies; no live account or write is used. The matrix contains 16 before/current caller pairs and eight current gallery frames at 390/1280, en/he, light/dark, with one h1/main, no horizontal overflow, visible keyboard focus and reduced motion. Native time editing worked in installed Chromium. The Input minimum is scoped; existing buttons, selects and dialog close targets remain outside this ticket.

Hebrew in kb-77.ts is machine-drafted for Amit's native read. Native-device/VoiceOver/TalkBack behavior remains UNKNOWN. Browser extension tools were unavailable in this runtime after tool discovery; the ticket explicitly permits the installed Playwright Chromium fixture. No provider or hook was added for the gallery.

## Test results (cloud agent sandbox)

| Command | Result |
| --- | --- |
| `bun --version` | 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: resolver timed out after 120s, actual exit 124. Root plus all six workspace manifests and bun.lock matched prepared kb-75 byte-for-byte; all ignored dependency folders restored with no broken links, no tracked changes and no Turbo archives. |
| `KB77_BEFORE_ONLY=1 bun test tests/unit/kb-77.test.tsx` | PASS, actual exit 0; 1 test/3 Bun assertions; unchanged real Today/Plan fields measured 40px at both widths before implementation edits; 16 original frames. |
| `bun test tests/unit/kb-77.test.tsx` | 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions; focused actual exit 0; browser assertions exercise actual callers and native controls. |
| `bun run lint` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run typecheck` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run test` | PENDING under the shared validation/fixture/E2E/build locks |
| `bun run scan:forbidden-tech` | PENDING under the shared validation/fixture/E2E/build locks |
| `bun run scan:ram-only-audit` | PENDING under the shared validation/fixture/E2E/build locks |
| `bun run scan:design-tokens` | PENDING under the shared validation/fixture/E2E/build locks |
| `bun run check:notices` | PENDING under the shared validation/fixture/E2E/build locks |
| `CI=1 bunx playwright test --reporter=line` | PENDING under the shared validation/fixture/E2E/build locks |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PENDING under the shared validation/fixture/E2E/build locks |

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

## Factory report

```text
status: blocked
ticket: #1184
evidence: source 758a0fc; 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions focused; baseline caller 40px -> phone 44px, desktop 40px; lint exit 0; typecheck exit 0; test exit PENDING; forbidden exit PENDING; ram exit PENDING; tokens exit PENDING; notices exit PENDING; e2e exit PENDING; build exit PENDING; contact sheet and exact failure tails
changed: apps/web/components/ui/input.tsx; apps/web/lib/i18n-groups/kb-77.ts; apps/web/app/v3/kb-77.css; tests/unit/kb-77.test.tsx; docs/polish/evidence/kb-77-input-phone-targets.md and .jpg
unknowns: frozen install resolver timed out (124); device screen-reader and native device behavior; live account/deployed writes; exact evidence-head remote CI recorded in PR
notes for ticket sync: existing Input polish adds zero primary views; Hebrew machine draft needs Amit's native read; existing KA-owned callers remain read-only; no retry budget reset or backend/caller changes
```
