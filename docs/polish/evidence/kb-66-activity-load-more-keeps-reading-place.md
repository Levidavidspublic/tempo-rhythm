# KB-66 — activity load more keeps the reader's place

The mounted `/activity` screen now keeps keyboard readers on the first row revealed by Show older. After the final click removes that button, the focused new row remains in the list and a quiet message says that all **currently available** activity is shown. The existing query returns at most 50 recent records, so this message does not claim to cover all historical activity. The current seven-day grouping, row destinations and exact query calls are unchanged.

![Before and after contact sheet, with viewport, language and theme labels](kb-66-activity-load-more-keeps-reading-place.jpg)

## Capture method and limits

The **before** images use the exact original mounted `ActivityScreen.tsx` source, frozen before any scoped edit in ignored `work/before/ActivityScreen.tsx` (SHA-256 `21dd14aea1e40b703b64039fca24326c5c4a6702441f567e72967f607f4d20d8`). An isolated browser fixture imports that frozen production component with fictional Maya, Dana and Yoni rows and mocked `activity.list`/profile responses. The browser capture itself ran later in the shared validation queue, after code editing began; its import stays pinned to the original source. It exercised the two Show older clicks that remove the final button; `document.activeElement` was then `<body>` in all eight before frames. These are production-component fixture captures, not authenticated `/activity` route captures.

The **after** images use the changed mounted `ActivityScreen` in the same kind of isolated hydrated fixture, with the same fictional 31-item feed. The contact sheet compares the bottom of the list after the final click at 390 and 1280 px, English and Hebrew, light and dark. The visible `Other action` button is a fixture-only control used to test focus moved elsewhere. An interactive `Kb66Gallery` also imports the same `ActivityLoadMore`, `ActivityEndStatus` and row views used by production. No real account data appears.

## Browser findings

- Show older reveals 10 more items per press; 21 and 30 items end after one press, 31 after two, and exactly 20 shows the end message immediately.
- Keyboard activation focuses the first newly revealed row, including after the final button disappears. That row has `tabIndex=-1`, so it adds no extra Tab stop. Moving focus to another control during the update is respected.
- A reactive new row does not itself move focus; subsequent paging uses the last visible row as its boundary. StrictMode does not duplicate the live count.
- Count and time text remain left-to-right inside Hebrew direction. The fixture checks one `main`/`h1`, 44 px targets, visible keyboard focus, reduced motion, large text, and no horizontal viewport overflow.

The unchanged authenticated `/activity` E2E spec requires `TEMPO_E2E_STORAGE_STATE` and skips without it. Authenticated data, the backend snapshot beyond its 50-item cap, device VoiceOver/TalkBack and native Hebrew copy review remain **UNKNOWN** in this sandbox. Hebrew strings are machine-drafted for Amit's native read.
