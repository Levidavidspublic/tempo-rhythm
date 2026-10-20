# KB-61 — HabitSheet request ownership

Final source passed 21 focused browser cases, repository lint and typecheck. Remaining mandatory gates are in progress; this is not a production-readiness claim.

## Scope and existing contracts

The existing shared HabitSheet is mounted by the unchanged `/habits` HabitsScreen and `/habits/[id]` HabitDetail. The sheet calls only `onSubmit({ name: trimmedName, cadence: "daily" | "weekly" })`; both callbacks continue to use their existing create/update operations. Closing the sheet does not cancel, compensate or roll back a submitted save. Zero new primary production views are added.

Changed production files are HabitSheet.tsx, its directly imported typed `kb-61.ts` copy dictionary and scoped `kb-61.css`. No callers, backend, routes, central copy/styles, dependencies, configuration or test baselines change.

## Frozen original reproduction

- Base: `52bf2803e9105b25c2538aedd81a754a9fbfdedb` (`integration`).
- Original source was frozen in ignored `work/kb61/before.tsx` before product edits; its SHA-256 and commit were recorded separately.
- Command: `KB61_FIXTURE_CHILD=1 KB61_ORIGINAL_PROOF=1 bun tests/unit/kb-61.test.tsx`, using Bun 1.3.9 and fixture/e2e locks.
- Real unchanged HabitsScreen was bundled with its real HabitSheet, real locale provider and actual compiled Tailwind/v3 styles. Only auth/query/mutation boundaries and Next Link are fictional; no live account or backend/model call occurs.
- Submit A through the existing create callback, close A, reopen B, type `New draft stays here`, then resolve A: original result `{open:0,draft:null,focused:false}`. B and its unsaved draft disappear.
- Reject A instead: original result `{open:1,draft:"New draft stays here",focused:true}`. This distinction was recorded before repair.

## Source round 1

A synchronous request token prevents duplicate submissions. Each explicit Close, Cancel, Escape or scrim interaction immediately invalidates that instance's ownership. Success/error from an old request cannot close or update a newer sheet. Pending saves preserve their submitted snapshot: the name is read-only and focusable, the cadence is disabled, and localized status explains that closing does not cancel saving. Current rejection retains the draft and enables explicit retry; synchronous callback throws are contained.

`bun test tests/unit/kb-61.test.tsx`: **20 pass, 0 fail**, 20 assertions, 79.45 seconds. The controlled browser cases cover exact trimmed name/cadence, length/empty validation, synchronous duplicate submission, current success, rejection/retry, synchronous throw, real-caller old success/rejection, all four close paths, close-before-unmount, pending snapshot and explanation, StrictMode, focus trap/opener/body scroll, interactive gallery, English/Hebrew and RTL, 390/1280 light/dark targets/wrapping, visible focus, reduced motion and uncaught browser errors.

The independent review edge was reproduced: resolving the pending save from the parent’s layout effect during removal invoked the old close callback once (expected zero). Layout-effect lifecycle cleanup now invalidates that request during the removal commit, while the existing focus/scroll effect remains unchanged. The expanded suite passes this regression.

Final source round 3: **21 pass, 0 fail**, 21 parent assertions, 122.57 seconds. A semantic fieldset/legend groups gallery controls. Workspace-local Biome checks all three production files with zero errors. The source/test files are frozen; no fourth repair is authorized.

Repair ledger: round 1 implemented the main fix (20 focused cases passed), then review reproduced the parent-removal edge; round 2 repaired that lifecycle boundary (21 cases passed) and identified a gallery semantic lint error; round 3 corrected the fieldset/CSS and passed the final 21-case suite. Intentional original-regression proof is separate from these implementation rounds.

## Test results (cloud agent sandbox)

Bun: **1.3.9**.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | **UNKNOWN** — timed out after 120 seconds at `Resolving dependencies`, exit 124. All lockfile/workspace manifests were compared byte for byte to KB-75, then its existing ignored node_modules caches were copied for every workspace. No Turbo archives were copied. |
| `bun test tests/unit/kb-61.test.tsx` | Final round 3: 21 pass, 0 fail (122.57 seconds). |
| `bun run lint` | PASS — exit 0, 5/5 tasks, zero errors; 9 existing warnings (14.3 seconds). |
| `bun run typecheck` | PASS — exit 0, 5/5 tasks (79.2 seconds). |
| `bun run test` | Pending |
| Four scans/notices | Pending |
| `CI=1 bunx playwright test --reporter=line` | Pending |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Pending |

The Browser plugin skill is listed, but its required JavaScript runtime tool is not callable in this tool inventory. The approved ticket explicitly permits the isolated Playwright/installed Chromium fixture used here. It runs on an ephemeral 127.0.0.1 port with fictional data, actual compiled CSS and system fallback fonts. This proves local UI behavior; deployed persistence, native screen readers and Hebrew native review remain UNKNOWN. Referenced root `RULES.md` is absent from this integration snapshot; AGENTS, SLOTS, HARD_RULES and the cited design/product sections were read.

## Evidence

The final source SHA-256 hashes are below. The baseline capture refresh re-bundles the immutable original component inside the unchanged real caller after source edits; it does not substitute an older caller snapshot. Both original and current fixtures include the real icon sprite. The immutable-original refresh completed on 20 Oct 2026; it reproduced the same close/reopen result. Current matrix captures are from final round 3. The contact sheet was composed at 2026-10-20T01:54:01Z and independently reviewed alongside full-resolution English/light and Hebrew/dark phone caller images. No visual blocker was identified.

Contact sheet: `kb-61-habit-sheet-request-ownership.jpg`, 1880 × 6354, 1,072,046 bytes; SHA-256 `364aa5b832a6af74b1de42cf85c2a00a1bb5d83ae187a63b5ae639adf1e9e364`. It shows original caller/current caller/current gallery in all eight width/language/theme combinations; separate original direct-sheet harness captures are retained in the ignored workspace. All 32 PNG source capture hashes are retained in ignored `work/kb61/capture-sha256.txt`.

- Original HabitSheet: `dacd593a92480e8b39149d6e093b50eff5b5574590ac81c8b9168a46ac2d31dc`.
- Current HabitSheet: `5e52db6c8a8debf626b1e8dd5e0e30acc95475d16f7617b08f7533b7e61598d9` (Git blob `79fa2b22f931c9e683b095e00b62c2055d63e8c7`).
- Dictionary: `b425b4e0c30a095e3d07576d521c0f080eb174a6716a75880a7a6e46b7f96663`.
- CSS: `02a39bb06adf35f76a89a2e9e74f8dc07f6b4debdfe41f24c8adc2bcf0d6667d`.
- Test: `5f9cf113aeff3f2a141725ac6c14b8fd4b56710519eb1bd34cc3382f6eb9f413`. Original/current source labels refer to the actual caller; gallery images use the real shared sheet and fictional deferred saves. No private account data is captured.
