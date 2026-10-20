# Mobile Today evidence

All people and tasks are fictional. These screenshots mount the actual `TempoShell` and signed-in `TodayScreen` through `tests/fixtures/mobile-today-server.ts`, with a fictional reactive Convex transport. They verify source UI and client interactions; they do not verify live authentication, a deployed backend, paid providers, or physical devices.

The immutable baseline is integration `52bf280`. Its `apps/web` tree was preserved before production edits and rendered separately. Before and after use the same local Newsreader and IBM Plex Mono assets, RootLayout font variables, UTF-8, viewport dimensions, fictional task data and compiled v3 styles. Hebrew copy is machine-drafted for native review.

| Capture | Before | After |
| --- | --- | --- |
| 390 × 844, English, light | [Before](before-390-en-light.png) | [After](after-390-en-light.png) |
| 390 × 844, English, dark | [Before](before-390-en-dark.png) | [After](after-390-en-dark.png) |
| 390 × 844, Hebrew, light | [Before](before-390-he-light.png) | [After](after-390-he-light.png) |
| 390 × 844, Hebrew, dark | [Before](before-390-he-dark.png) | [After](after-390-he-dark.png) |
| 768 × 844, English | [Before](before-768-en-light.png) | [After](after-768-en-light.png) |
| 768 × 844, Hebrew | [Before](before-768-he-light.png) | [After](after-768-he-light.png) |
| 1280 × 844, English | [Before](before-1280-en-light.png) | [After](after-1280-en-light.png) |
| 1280 × 844, Hebrew | [Before](before-1280-he-light.png) | [After](after-1280-he-light.png) |

At 390 × 844 the baseline shows no task rows in the first viewport. The mobile layout shows seven open rows, each 48 CSS pixels tall. The fifth row ends at y=572.59375; the ask bar starts at y=708. The ask bar and tabs remain in the viewport after scrolling. Every checkbox target is at least 44 × 44. The completed group starts collapsed. Every captured viewport has no horizontal overflow and no browser page errors.

The four desktop/boundary image pairs are byte-identical:

| Viewport / locale | SHA-256 of both PNGs |
| --- | --- |
| 768 / en | `803b335a0acef1216b1e4796d15746f7158b6e4ec6a45b0b20ee40fffabef4ed` |
| 768 / he | `76048efb517073a1f941faea171636ead3d24d762e2207c9b85bba643ced5c87` |
| 1280 / en | `65c7c107873d8c83316aef16d3560f7104034fcd1d561d803032f3189eb2c583` |
| 1280 / he | `37e21401f708284efa62b54b81dccd31f443b3174b25049652d9644c597b4201` |

The browser spec uses iPhone 13 emulation with an explicit 390 × 844 viewport and Pixel 7 emulation under the existing Chromium project. A separate case navigates the real local Next routes. Source-fixture tests cover quick add, completion, drawer focus, planning handoff and draft recovery, safe public errors, accepted IDs, placement retry, Undo, and account changes without calling a provider.

Provenance: draft recovery adapts the production view from #1153 / PR #1160; the shared hook preserves the existing `brain-dump-session.ts` store. Drawer focus ownership selectively reuses #1171 / PR #1174. Mobile task visibility and collapsed completed tasks follow #756, while the desktop three-row cap stays unchanged. This feature does not duplicate #1099's DayPlanPanel, DayPlanSummary or energy-picker restyle.

Final command results and source commit are recorded in the PR's `Test results (cloud agent sandbox)` section. Live backend, real voice-provider availability and physical-device screen-reader checks remain UNKNOWN.
