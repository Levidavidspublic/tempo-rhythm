# KB-78 ConfirmSheet pending focus evidence

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
| `bun run lint` | PENDING |
| `bun run typecheck` | PENDING |
| `bun run test` | PENDING |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PENDING |
| `CI=1 bunx playwright test --reporter=line` | PENDING |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PENDING |

After the install timeout, bun.lock and all seven root/workspace manifests were verified byte-identical to the existing KB75 worktree; all six ignored dependency directories were copied, with no Turbo archives. The first formatting invocation from repo root could not resolve the app's relative Biome config; the same scoped command passed from apps/web, without a config or product-source correction.

Install timeout log (all available lines):
```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Formal gates are pending at the first source push; their exact results and any failure's actual last 20 lines will be added to this evidence and the PR report after they finish. No done/deployment claim is made here.
