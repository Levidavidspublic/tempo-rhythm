# Chunk 5 — Stage E · Gen 1 (tickets TFV2-0317 … TFV2-0396, 80 tickets)

Draft under `docs/backlog/TICKET-STANDARD.md` (v2, 1 Nov 2026). Template: `_drafts/TEMPLATE.md`.
Sources: REWRITE-PLAN-v2.md §4–§7 · PRD F-30…F-36, F-90, F-100…F-103, F-120…F-121 · TRD §5a/§6/§7 ·
DESIGN.md · components.md §2.11/§2.17 · 13 mobile screen HTMLs · `convex/voice.ts`, `convex/lib/voicePolicy.ts`,
`convex/mcp.ts`, `convex/mcpTools.ts`, `convex/mcpHttp.ts`, `convex/connections.ts`, `convex/lib/connections/*`,
`convex/lib/mcp/*`. Fold-ins: #747, #748, #746. OPEN conflict §4.1 (voice stage) is assumed Gen 1; the stage
is marked `UNKNOWN` and names "Amit" wherever it changes a ticket.

---

### TFV2-0317 — Expo native shell foundation (newest stable SDK + NativeWind)
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD F-121 (one-to-one Expo native shell, not a WebView); TRD §1; DESIGN.md §8/§9; components.md §2.17.
- **GOAL:** `apps/mobile` runs on the newest stable Expo SDK with NativeWind wired, and the root `(tempo)/_layout.tsx` mounts the theme/safe-area/i18n providers so every later screen inherits them.
- **SCOPE:** `apps/mobile/package.json` · `apps/mobile/app/(tempo)/_layout.tsx` · `apps/mobile/app/_layout.tsx` · test `apps/mobile/components/v3/__tests__/shell-foundation.test.tsx`.
- **MUTATES:** `apps/mobile` dependencies and the root layout providers (no Convex, no schema, no env).
- **STEPS:** 1) Graphify code-map of `apps/mobile/app/_layout.tsx` and `apps/mobile/package.json`; 2) record the installed Expo SDK major and NativeWind major; 3) pin the newest stable Expo SDK major that Metro accepts with the locked `react-native` and `react-native-reanimated` (do NOT bump RN/Reanimated beyond what the SDK pairs); 4) ensure `_layout.tsx` wraps the tree in `SafeAreaProvider`, the theme provider (light/dark from `usePrefs`), and the i18n/RTL provider; 5) run the render test.
- **DONE:** `bun --filter tempo-rhythm-mobile run typecheck` → exit 0; `bun test apps/mobile/components/v3/__tests__/shell-foundation.test.tsx` → all pass.
- **EVIDENCE:** paste the SDK/NativeWind majors read in step 2, the `typecheck` exit code, and the test output.
- **DO NOT:** do not add new dependencies beyond the SDK pin; do not touch `convex/`, `.github/`, any `.env`, or workflow files; do not record a key value.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The layout renders an empty `(tempo)` stack inside `SafeAreaProvider`. Tokens used: `--tp-ground`, `--tp-paper`, `--tp-tabbar-h` (reserved padding). States: default (blank paper), loading (a `StateLoading` skeleton for the first provider hydration), offline (`StateOffline` banner `EN: You're offline. Changes save when you're back. / HE: אין חיבור. השינויים נשמרים כשתחזור.`). Breakpoints 390/768/1024/1280 (no sideways scroll at 390 per DESIGN.md §8). Motion none. The newest-stable SDK exact major is a build decision: `UNKNOWN` — answerer Amit (verify against the Expo release calendar at ticket time).
- **TESTS:** Given the root layout mounts / When the render tree is committed / Then `SafeAreaProvider`, the theme provider and the i18n provider are present exactly once, and no provider is nested inside another provider of the same kind. Given RTL locale `he` / When the provider hydrates / Then `I18nManager.isRTL` is true.
- **NUMBERS:** no sideways scroll at 390 px (DESIGN.md §8) · Expo SDK major → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** newest stable Expo SDK major — Amit.

### TFV2-0318 — TempoShell (MobileTopBar + screen frame + floating capture button)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0317 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0317.
- **WHY:** components.md §2.17 (MobileTopBar, `.tp-mtopbar.tp-glass`); DESIGN.md §5 (glass + solid fallback), §7 (motion), §10 (RTL).
- **GOAL:** `Shell.tsx` exposes a `TempoShell` that renders a glass `MobileTopBar` (`title`, optional `back`), the screen frame and the floating capture button, with the solid-glass fallback already used in the app.
- **SCOPE:** `apps/mobile/components/v3/Shell.tsx` · `apps/mobile/components/v3/primitives.tsx` (no-op unless a token is missing) · test `apps/mobile/components/v3/__tests__/shell.test.tsx`.
- **MUTATES:** `apps/mobile` UI only (no Convex, no schema).
- **STEPS:** 1) Graphify code-map of `Shell.tsx`; 2) verify the existing `TempoShell`/`MobileTopBar` exports and their `title`/`back` props against components.md §2.17; 3) add any missing `data-component`/`aria` wiring (`aria-label` on back, header `role="banner"`); 4) implement the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/shell.test.tsx` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not add a blur dependency (DESIGN.md §5 solid fallback is allowed); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Top bar is a solid glass surface (`--tp-glass-solid` fallback) at height `--tp-topbar-h`; title uses `--tp-text-lg` `--tp-font-serif`, `--tp-ink`. Back chevron `.tp-icon--flip` mirrors in RTL and is ≥ `--tp-touch` (24×24 CSS px min, WCAG 2.5.8; 44×44 native target). Floating capture button sits above the tab bar, accent `--tp-accent` with label `--tp-on-accent`. Copy: `EN: Back / HE: חזרה`. States: default, with-back, offline (banner). Keyboard: back is focusable, `Enter`/`Space` activates. Screen-reader: back labelled, top bar `role="banner"`. Breakpoints 390/768/1024/1280. Motion ≤250 ms (panel slide `--tp-ease-out`).
- **TESTS:** Given `title="Today"` / When the shell renders / Then the top bar shows `Today`, and no `Back` is present. Given `back` / When pressed / Then the router pops or replaces to `/coach`. Given `dir=rtl` / When the shell renders / Then the back chevron flips (`.tp-icon--flip`).
- **NUMBERS:** target ≥24×24 CSS px / 44×44 native px (WCAG 2.2 2.5.8; Apple HIG) · motion ≤250 ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0319 — MobileTabBar + TouchRow + `(tabs)` route layout
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0317 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0317.
- **WHY:** components.md §2.17 (MobileTabBar `.tp-tabbar.tp-glass[data-count]`, TouchRow `.tp-touch-row`); DESIGN.md §8 (tab bar at bottom under 768) and §10 (RTL).
- **GOAL:** `TabBar.tsx` renders the four glass tabs (Today, Coach, Tasks, Notes) with the active tab marked and a `TouchRow` primitive of at least 56 px, wired into `(tabs)/_layout.tsx`.
- **SCOPE:** `apps/mobile/components/v3/TabBar.tsx` · `apps/mobile/app/(tempo)/(tabs)/_layout.tsx` · test `apps/mobile/components/v3/__tests__/tabbar.test.tsx`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `TabBar.tsx` and `(tabs)/_layout.tsx`; 2) verify the four tabs and active state match the v3 target; 3) add `TouchRow` (≥56 px, chevron `.tp-icon--flip`) if missing; 4) implement the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/tabbar.test.tsx` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not add a fifth tab; do not change routes; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tab bar is glass `--tp-glass-solid` at height `--tp-tabbar-h`, fixed at the bottom. Four tabs with icon + label; the active tab uses `--tp-accent` for icon and `--tp-ink` label, inactive `--tp-ink-muted`; `aria-current` on the active tab. Copy `EN / HE`: Today `היום`, Coach `מאמן`, Tasks `משימות`, Notes `הערות`. `TouchRow`: icon `__icon`, label `__label`, value `__value`, chevron `__chev`, min height 56 px. States: default, active, offline. Breakpoints: under 768 fixed tab bar; ≥768 it is not rendered (web/desktop shell). Motion ≤250 ms. RTL: tab order flows inline-start→inline-end; chevrons flip.
- **TESTS:** Given the tabs layout / When rendered / Then exactly four tabs appear in order Today, Coach, Tasks, Notes. Given the Today route is active / When rendered / Then the Today tab carries `aria-current`. Given `dir=rtl` / When rendered / Then the tab order mirrors and the TouchRow chevron flips.
- **NUMBERS:** tab/TouchRow target ≥56 px (Apple HIG 44×44, min) · motion ≤250 ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0320 — MobileSheet (bottom sheet / drawer, focus trap + scroll lock)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0318 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0318.
- **WHY:** components.md §2.17 (MobileSheet `.tp-sheet.tp-glass[role=dialog][aria-labelledby][hidden]`, scrim); DESIGN.md §8 (coach and slash menu open as bottom sheets under 768).
- **GOAL:** `MobileSheet` opens a glass bottom sheet with grabber, `aria-labelledby` title, a scrim, Esc/back close, a Tab focus trap, and scroll lock, returning focus to the opener on close; at ≥768 it centres as a dialog.
- **SCOPE:** `apps/mobile/components/v3/Shell.tsx` (the `MobileSheet` portion) · test `apps/mobile/components/v3/__tests__/sheet.test.tsx`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of the `MobileSheet` in `Shell.tsx`; 2) verify grabber/head/body/foot structure, `hidden`, `aria-labelledby`, scrim `data-for`; 3) add the focus trap and focus-return if missing; 4) implement the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/sheet.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not implement a router inside the sheet; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Sheet slides from the bottom at <768 (`--tp-radius-xl` top corners, `--tp-shadow-modal`); ≥768 it centres with `--tp-radius-lg`. Scrim `--tp-scrim`. Grabber is a decorative `--tp-line` handle. States: open, closed, offline. Copy is caller-supplied (title prop), so no fixed copy. Keyboard: `Esc` and Android back close; Tab cycles within the sheet. Screen-reader: `role="dialog"`, `aria-labelledby` points at `__title`. Motion: open 240 ms `--tp-ease-out`, close 160 ms `--tp-ease-in`; `prefers-reduced-motion` → instant.
- **TESTS:** Given the sheet is opened / When `open-sheet` fires / Then the scrim shows, `hidden` is removed, body scroll is locked, and focus moves into the sheet. Given Tab / When pressed past the last focusable / Then focus wraps to the first. Given `Esc` / When pressed / Then the sheet closes and focus returns to the opener.
- **NUMBERS:** motion ≤250 ms (DESIGN.md §7) · focus trap wraps within 1 Tab cycle (WCAG 2.4.3 focus order).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0321 — Mobile i18n EN/HE strings + RTL (I18nManager) baseline
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0317 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0317.
- **WHY:** PRD F-70/F-71/F-72; TRD §5b; DESIGN.md §10; components.md §6 (Hebrew/RTL notes).
- **GOAL:** `i18n.ts`/`strings.ts` resolve every screen label from `en`/`he` dictionaries with English fallback for a missing key, and set `I18nManager.forceRTL` from the locale so all screens render correctly RTL.
- **SCOPE:** `apps/mobile/lib/v3/i18n.ts` · `apps/mobile/lib/v3/strings.ts` · test `apps/mobile/lib/v3/__tests__/i18n.test.ts`.
- **MUTATES:** `apps/mobile` strings only.
- **STEPS:** 1) Graphify code-map of `i18n.ts`/`strings.ts`; 2) confirm the dictionary shape and the fallback rule; 3) add missing shared labels (`Back`, `Retry`, `Loading…`, `Today`, `Coach`, `Tasks`, `Notes`, `Journal`, `Habits`, `Calendar`, `Routines`, `Templates`, `Settings`, `Onboarding`); 4) implement the unit test.
- **DONE:** `bun test apps/mobile/lib/v3/__tests__/i18n.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not invent Hebrew where a dictionary value is missing — keep the key and fall back to EN; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Locale `en`/`he` (any code accepted, default from device). RTL list `he`/`ar`/`fa`/`ur` → `I18nManager.forceRTL(true)`. Numbers/dates stay LTR via `tp-num` (`direction:ltr; unicode-bidi:isolate`). Copy pairs: `EN / HE` — Today `היום`; Coach `מאמן`; Tasks `משימות`; Notes `הערות`; Journal `יומן`; Habits `הרגלים`; Calendar `לוח שנה`; Routines `שגרות`; Templates `תבניות`; Settings `הגדרות`; Onboarding `תחילת השימוש`; Back `חזרה`; Retry `נסה שוב`; Loading… `טוען…`.
- **TESTS:** Given locale `he` / When a label is resolved / Then the Hebrew value returns. Given a key missing from `he` / When resolved / Then the English value returns. Given locale `he` / When the app mounts / Then `I18nManager.isRTL` is true.
- **NUMBERS:** 100% of shared labels present in both dictionaries (internal completeness, no external standard).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0322 — Mobile screen: Today
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; screen `docs/design/v3/screens/mobile/today.html`; DESIGN.md §8/§10; components.md §2.17.
- **GOAL:** `(tabs)/today.tsx` renders the Today screen (greeting, day's tasks, capture button) against the v3 tokens with all states wired to real queries.
- **SCOPE:** `apps/mobile/app/(tempo)/(tabs)/today.tsx` · `apps/mobile/lib/v3/daily-page.ts` (read-only reuse) · test `tests/e2e/mobile-today.spec.ts`.
- **MUTATES:** `apps/mobile` UI (no Convex, no schema).
- **STEPS:** 1) Graphify code-map of `today.tsx`; 2) align the layout with `today.html` and tokens; 3) wire default/loading/empty/error/offline states to the query; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-today.spec.ts` → all pass; `bun --filter tempo-rhythm-mobile run typecheck` → exit 0.
- **EVIDENCE:** Playwright output + typecheck exit code.
- **DO NOT:** do not edit `convex/` or `daily-page.ts` logic (reuse only); do not add copy beyond the screen; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Layout: top bar `Today`, greeting serif `--tp-text-2xl`, task list rows (TaskRow), floating capture `+`. Tokens: `--tp-ground`, `--tp-paper`, `--tp-ink`, `--tp-ink-muted`, `--tp-accent`, `--tp-space-*`, `--tp-radius-*`. States: default (list), loading (skeleton `StateLoading`), empty (`EN: Nothing planned for today. / HE: לא תוכנן כלום להיום.` with a next step), error (`StateError` `EN: Couldn't load your tasks. Your data is safe. / HE: לא הצלחנו לטעון את המשימות שלך. הנתונים שלך בטוחים.` + Retry), offline (banner `EN: You're offline. Changes save when you're back. / HE: אין חיבור. השינויים נשמרים כשתחזור.`), success. RTL: list flows inline-start; digits LTR via `tp-num`. Breakpoints 390/768/1024/1280 (no sideways scroll at 390). Motion ≤250 ms row drop-in.
- **TESTS:** Given a fresh account / When Today loads / Then the empty state copy shows. Given tasks exist / When the list renders / Then each task title shows and the capture button is reachable. Given offline / When rendered / Then the offline banner shows and content stays. Run at 390 and 1280, in EN and HE, asserting each state.
- **NUMBERS:** no sideways scroll at 390 px (DESIGN.md §8) · text contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px / 44×44 native (WCAG 2.5.8 / Apple HIG) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0323 — Mobile screen: Capture
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/capture.html`; DESIGN.md §8/§10.
- **GOAL:** `capture.tsx` renders the Capture screen (title input + body, quick-add), saving through the existing note/task path with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/capture.tsx` · test `tests/e2e/mobile-capture.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `capture.tsx`; 2) align layout with `capture.html`; 3) wire default/loading/empty/error/offline/success states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-capture.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not add copy beyond the screen; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Text input `--tp-field`/`--tp-input`, save button `--tp-btn` accent. Copy: `EN: Capture / HE: לכידה`; `EN: What's on your mind? / HE: מה על דעתך?`; save `EN: Save / HE: שמור`. States: default, loading (button spinner), empty (disabled save until non-empty), error, offline, success (toast `EN: Saved. / HE: נשמר.` + 5-min Undo). RTL: input `dir="auto"` per paragraph. Breakpoints 390/768/1024/1280. Motion ≤250 ms toast.
- **TESTS:** Given empty input / When rendered / Then Save is disabled. Given text / When Save is tapped / Then the success toast and Undo appear. Given offline / When Save is tapped / Then the offline banner shows and input is retained. Run at 390 and 1280, EN and HE, asserting each state.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0324 — Mobile screen: Coach
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121, F-20…F-25; `docs/design/v3/screens/mobile/coach.html`; components.md §2.10/§2.11; DESIGN.md §10.
- **GOAL:** `(tabs)/coach.tsx` renders the Coach tab (thread list + composer + mic entry) with all states wired and the mic button gated by the voice `availability` query.
- **SCOPE:** `apps/mobile/app/(tempo)/(tabs)/coach.tsx` · test `tests/e2e/mobile-coach.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `coach.tsx`; 2) align layout with `coach.html`; 3) wire default/loading/empty/error/offline states; 4) gate the mic button on `voice.availability` (show disabled + reason when unavailable); 5) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-coach.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not implement live voice here (that is TFV2-0389); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Thread list rows, composer `--tp-field`, mic entry (MicToggle accent). Copy: `EN: Coach / HE: מאמן`; `EN: Say hello, or tell the coach what's on your mind. / HE: אמור שלום, או ספר למאמן מה על דעתך.`; mic-unavailable reasons reuse the voice calm copy (`EN: Voice isn't switched on yet. Typing works as always. / HE: הקול עדיין לא מופעל. ההקלדה עובדת כרגיל.`). States: default, loading, empty (no threads), error, offline, mic-disabled. RTL: composer `dir="auto"`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no threads / When Coach loads / Then the empty state shows. Given threads / When rendered / Then each thread title shows. Given voice unavailable / When rendered / Then the mic button is disabled with the calm reason. Run at 390 and 1280, EN and HE, asserting each state.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0325 — Mobile screen: Voice call (layout + honest not-connected state)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-30; `docs/design/v3/screens/mobile/voice-call.html`; components.md §2.11; DESIGN.md §8/§10. OPEN conflict §4.1 (voice stage) — this ticket assumes Gen 1 layout only; live wiring is TFV2-0389.
- **GOAL:** `voice-call.tsx` renders the full call layout (title, state word, transcript, mic, hold-to-talk, interrupt, end-call, language chip, minutes) with the honest "Not connected" state and every control disabled, until TFV2-0389 wires it live.
- **SCOPE:** `apps/mobile/app/(tempo)/voice-call.tsx` · test `tests/e2e/mobile-voice-call.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `voice-call.tsx`; 2) align the layout with `voice-call.html` (transcript, audio-level bars, mic accent, hold-to-talk, interrupt, end-call, language chip, minutes); 3) keep every control disabled with the calm not-connected copy; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-voice-call.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not add a provider, key, or recording here; do not enable the mic; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Call with your coach / HE: שיחה עם המאמן שלך`; `EN: Not connected / HE: לא מחובר`; `EN: Live calls aren't ready yet. / HE: שיחות קול עוד לא מוכנות.`; `EN: Hold to talk / HE: החזק כדי לדבר`; `EN: Interrupt / HE: קטע`; `EN: End call / HE: סיים שיחה`; `EN: Back to chat / HE: חזרה לצ'אט`; `EN: English / HE: אנגלית`. States: default (not-connected), offline (banner `EN: You're offline. / HE: אין חיבור.`). Mic (`--tp-accent`), end-call (`--tp-danger`), interrupt secondary. RTL: language chip keeps each language name in its own `lang`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given the screen / When rendered / Then "Not connected" shows and Mic/Hold-to-talk/Interrupt are disabled. Given End call / When tapped / Then it returns to Coach. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** voice stage (Gen 1 vs later) — Amit (REWRITE-PLAN-v2 §4.1); this ticket assumes Gen 1.

### TFV2-0326 — Mobile screen: Tasks
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/tasks.html`; DESIGN.md §8/§10.
- **GOAL:** `(tabs)/tasks.tsx` renders the Tasks screen (list + complete toggle + add) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/(tabs)/tasks.tsx` · `apps/mobile/components/v3/TaskRow.tsx` (reuse only) · test `tests/e2e/mobile-tasks.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `tasks.tsx`; 2) align layout with `tasks.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-tasks.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not change TaskRow's contract; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Tasks / HE: משימות`; `EN: No tasks yet. / HE: אין משימות עדיין.`; `EN: Couldn't load your tasks. Your data is safe. / HE: לא הצלחנו לטעון את המשימות שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. Changes save when you're back. / HE: אין חיבור. השינויים נשמרים כשתחזור.`. States: default, loading, empty, error, offline, success (checkmark pops 180 ms). RTL rows inline-start; due times LTR `tp-num`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no tasks / When loaded / Then empty state shows. Given tasks / When one is toggled / Then it completes and the checkmark pops. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0327 — Mobile screen: Notes
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/notes.html`; DESIGN.md §8/§10.
- **GOAL:** `(tabs)/notes.tsx` renders the Notes list/tree with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/(tabs)/notes.tsx` · test `tests/e2e/mobile-notes.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `notes.tsx`; 2) align layout with `notes.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-notes.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not add copy beyond the screen; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Notes / HE: הערות`; `EN: No notes yet. / HE: אין הערות עדיין.`; error `EN: Couldn't load your notes. Your data is safe. / HE: לא הצלחנו לטעון את ההערות שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline. RTL tree inline-start; note titles `dir="auto"`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no notes / When loaded / Then empty state shows. Given notes / When rendered / Then each title shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0328 — Mobile screen: Journal
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/journal.html`; DESIGN.md §8/§10.
- **GOAL:** `journal.tsx` renders the Journal screen (entries list + new entry) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/journal.tsx` · `apps/mobile/lib/v3/journal.ts` (reuse only) · test `tests/e2e/mobile-journal.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `journal.tsx`; 2) align layout with `journal.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-journal.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/` or `journal.ts` logic; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Journal / HE: יומן`; `EN: No entries yet. / HE: אין רשומות עדיין.`; error `EN: Couldn't load your journal. Your data is safe. / HE: לא הצלחנו לטעון את היומן שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline. Entry body `dir="auto"`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no entries / When loaded / Then empty state shows. Given entries / When rendered / Then each entry's first line shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0329 — Mobile screen: Habits
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/habits.html`; DESIGN.md §8/§10.
- **GOAL:** `habits.tsx` renders the Habits screen (habit list + today's check-ins) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/habits.tsx` · `apps/mobile/lib/v3/habits.ts` (reuse only) · test `tests/e2e/mobile-habits.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `habits.tsx`; 2) align layout with `habits.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-habits.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/` or `habits.ts` logic; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Habits / HE: הרגלים`; `EN: No habits yet. / HE: אין הרגלים עדיין.`; error `EN: Couldn't load your habits. Your data is safe. / HE: לא הצלחנו לטעון את ההרגלים שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline, success (today's dot `data-logged`). Streak counts LTR `tp-num`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no habits / When loaded / Then empty state shows. Given a habit / When logged for today / Then today's dot fills. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0330 — Mobile screen: Calendar
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/calendar.html`; DESIGN.md §8/§10; components.md §2.5.
- **GOAL:** `calendar.tsx` renders the Calendar screen (month grid + day's events) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/calendar.tsx` · `apps/mobile/lib/v3/dates.ts` (reuse only) · test `tests/e2e/mobile-calendar.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `calendar.tsx`; 2) align layout with `calendar.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-calendar.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/` or `dates.ts` logic; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Calendar / HE: לוח שנה`; `EN: No events. / HE: אין אירועים.`; error `EN: Couldn't load your calendar. Your data is safe. / HE: לא הצלחנו לטעון את לוח השנה שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline. Dates/times LTR `tp-num` (mono). RTL: weekday header flows inline-start, week starts Monday (`UNKNOWN` week start — see OPEN). Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no events / When loaded / Then empty state shows. Given events / When a day is selected / Then its events show. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start Sunday vs Monday — Amit (REWRITE-PLAN-v2 §4.10); code currently uses Monday.

### TFV2-0331 — Mobile screen: Routines
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/routines.html`; DESIGN.md §8/§10.
- **GOAL:** `routines.tsx` renders the Routines screen (routine list + run) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/routines.tsx` · `apps/mobile/lib/v3/routine-run.ts` (reuse only) · test `tests/e2e/mobile-routines.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `routines.tsx`; 2) align layout with `routines.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-routines.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/` or `routine-run.ts` logic; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Routines / HE: שגרות`; `EN: No routines yet. / HE: אין שגרות עדיין.`; error `EN: Couldn't load your routines. Your data is safe. / HE: לא הצלחנו לטעון את השגרות שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline, running (progress). Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no routines / When loaded / Then empty state shows. Given routines / When rendered / Then each routine name shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0332 — Mobile screen: Templates
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/templates.html`; DESIGN.md §8/§10.
- **GOAL:** `templates.tsx` renders the Templates screen (template list + apply) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/templates.tsx` · test `tests/e2e/mobile-templates.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `templates.tsx`; 2) align layout with `templates.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-templates.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Templates / HE: תבניות`; `EN: No templates yet. / HE: אין תבניות עדיין.`; error `EN: Couldn't load your templates. Your data is safe. / HE: לא הצלחנו לטעון את התבניות שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no templates / When loaded / Then empty state shows. Given templates / When rendered / Then each template name shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0333 — Mobile screen: Settings
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/settings.html`; DESIGN.md §8/§10; components.md §2.9.
- **GOAL:** `settings.tsx` renders the Settings screen (profile, preferences, accessibility, language) with every state wired.
- **SCOPE:** `apps/mobile/app/(tempo)/settings.tsx` · test `tests/e2e/mobile-settings.spec.ts`.
- **MUTATES:** `apps/mobile` UI only (preferences read/write via existing `preferences` functions).
- **STEPS:** 1) Graphify code-map of `settings.tsx`; 2) align layout with `settings.html`; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-settings.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not add a BYOK section (that is TFV2-0364); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Settings / HE: הגדרות`; `EN: Profile / HE: פרופיל`; `EN: Preferences / HE: העדפות`; `EN: Accessibility / HE: נגישות`; `EN: Language / HE: שפה`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, error, offline. Switch rows use On/Off words. RTL: chevrons flip. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given the screen / When rendered / Then Profile, Preferences, Accessibility, Language rows show. Given a switch / When toggled / Then `aria-checked` updates and On/Off word shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0334 — Mobile screen: Onboarding
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0319, TFV2-0321 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0319 and TFV2-0321.
- **WHY:** PRD F-121; `docs/design/v3/screens/mobile/onboarding.html`; DESIGN.md §8/§10; components.md §2.15.
- **GOAL:** `(auth)/onboarding.tsx` renders the Onboarding flow (welcome + first preferences) with every state wired.
- **SCOPE:** `apps/mobile/app/(auth)/onboarding.tsx` · test `tests/e2e/mobile-onboarding.spec.ts`.
- **MUTATES:** `apps/mobile` UI only (initial preferences write via existing `preferences` functions).
- **STEPS:** 1) Graphify code-map of `onboarding.tsx`; 2) align layout with `onboarding.html`; 3) wire default/loading/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-onboarding.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not change the sign-in/sign-up gating; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Onboarding / HE: תחילת השימוש`; `EN: Welcome to Tempo / HE: ברוכים הבאים ל-Tempo`; `EN: Get started / HE: להתחלה`; `EN: Skip / HE: דלג`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, error, offline. Breakpoints 390/768/1024/1280. Motion ≤250 ms step transition.
- **TESTS:** Given the flow / When "Get started" is tapped / Then the first preferences step shows. Given "Skip" / When tapped / Then the flow completes to Today. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0335 — Study track: SM-2 algorithm (`convex/lib/sm2.ts`)
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first (study track; after chunk D coach artifacts F-28 which produce flashcards).
- **WHY:** PRD F-90 (SM-2); TRD §5c; the SM-2 spec (https://super-memory.com/english/ol/sm2.htm).
- **GOAL:** `convex/lib/sm2.ts` exports a pure `scheduleSm2` function that maps (quality, previous state) to the next (intervalDays, repetitions, easeFactor).
- **SCOPE:** `convex/lib/sm2.ts` · test `convex/lib/sm2.test.ts`.
- **MUTATES:** none (pure module; no schema).
- **STEPS:** 1) Graphify code-map to confirm no `sm2.ts` exists; 2) implement `scheduleSm2(prev, quality)` with the canonical formulas; 3) clamp EF at 1.3; 4) write the unit test.
- **DONE:** `bun test convex/lib/sm2.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not persist anything; do not import Convex server types; do not touch `convex/schema.ts` (schema is TFV2-0336); do not weaken a check.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Signature: `scheduleSm2(prev: { repetitions: number; easeFactor: number; intervalDays: number }, quality: 0|1|2|3|4|5): { repetitions: number; easeFactor: number; intervalDays: number }`. Rules: quality < 3 resets repetitions to 0 and returns intervalDays 1 (relearn). Otherwise: repetitions n+1; interval = n===1 ? 1 : n===2 ? 6 : round(prev.intervalDays * prev.easeFactor); EF' = prev.easeFactor + (0.1 − (5−q)·(0.08 + (5−q)·0.02)), clamped to ≥1.3. Error cases: quality out of 0–5 → throw `RangeError`; non-finite easeFactor/interval → throw `RangeError`. Limits: EF ≥1.3 always; intervalDays integer ≥1.
- **TESTS:** Given quality 5, repetitions 0, EF 2.5 / When scheduled / Then repetitions 1, intervalDays 1. Given quality 5, repetitions 2, EF 2.5, interval 6 / When scheduled / Then intervalDays 15. Given quality 0 / When scheduled / Then repetitions 0, intervalDays 1. Given EF 1.3 and quality 0 / When scheduled / Then EF stays ≥1.3. Given quality 6 / When scheduled / Then throws RangeError.
- **NUMBERS:** SM-2 EF floor 1.3, I(1)=1 day, I(2)=6 days (https://super-memory.com/english/ol/sm2.htm).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0336 — Study track: `studyCards` table (schema + indexes)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0335 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md` (needs `convex-arch` label per AGENTS.md rule 4).
- **WHEN:** after TFV2-0335.
- **WHY:** PRD F-90 (record → notes → flashcards → test); BACKEND-SCHEMA (generic tables rule); TRD §7 (soft delete, userId isolation).
- **GOAL:** `convex/schema.ts` gains a `studyCards` table (front/back, source note, SM-2 scheduling fields) plus the indexes the review queries need.
- **SCOPE:** `convex/schema.ts` · test `convex/studyCards.test.ts` (schema-shape assertion only).
- **MUTATES:** `convex/schema.ts` (new table + indexes).
- **STEPS:** 1) Graphify code-map of `schema.ts`; 2) add `studyCards` with the fields below and indexes `by_userId`, `by_userId_dueAtMs`, `by_sourceNoteId`; 3) write a test that inserts a row and asserts the fields/round-trip.
- **DONE:** `bun test convex/studyCards.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not touch any other table; do not touch `convex/auth*`, `.env`, workflows; do not write a key value.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `studyCards: defineTable({ userId: v.id("users"), front: v.string(), back: v.string(), sourceNoteId: v.optional(v.id("notes")), repetitions: v.number(), easeFactor: v.number(), intervalDays: v.number(), dueAtMs: v.number(), status: v.union(v.literal("new"), v.literal("learning"), v.literal("reviewing")), createdAt, updatedAt, deletedAt: v.optional(v.number()) })` with the three indexes. Every row is scoped by `userId` (TRD §7 rule 4); soft delete via `deletedAt`.
- **TESTS:** Given a card / When inserted / Then all fields round-trip and `dueAtMs` is a finite number. Given the `by_userId_dueAtMs` index / When queried / Then cards sort by due time for that user only.
- **NUMBERS:** no industry number applies → `UNKNOWN` (none needed).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0337 — Study track: `convex/study.ts` (deck + review + schedule)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0336 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0336.
- **WHY:** PRD F-90; TRD §7 (auth → entitlement → quota; userId filter; soft delete).
- **GOAL:** `convex/study.ts` exposes `createCard`, `listDue`, `reviewCard` (which applies `scheduleSm2`) with auth and every error case.
- **SCOPE:** `convex/study.ts` · test `convex/study.test.ts`.
- **MUTATES:** `studyCards` table (via the functions only).
- **STEPS:** 1) Graphify code-map to confirm `study.ts` is missing; 2) implement the three mutations/query; 3) call `scheduleSm2` from TFV2-0335; 4) write the unit test covering every error case.
- **DONE:** `bun test convex/study.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not edit `convex/schema.ts` (done in TFV2-0336); do not call a model here; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `createCard({ front, back, sourceNoteId? }) → id` (requireUser; front/back non-empty ≤2000 chars each; insert status "new", repetitions 0, EF 2.5, intervalDays 0, dueAtMs now). `listDue({ limit? }) → cards[]` (query; default limit 50, max 100; returns cards with dueAtMs ≤ now). `reviewCard({ cardId, quality }) → next` (requireUser; owner check; quality 0–5 else error; applies `scheduleSm2`; sets status "learning" if repetitions 0–1 else "reviewing", dueAtMs = now + intervalDays·86_400_000). Error cases: not owner → `ConvexError` "Card not found"; bad quality → `RangeError`; missing front/back → `ConvexError`.
- **TESTS:** Given user A's card / When B reviews it / Then error, nothing changes. Given quality 5 on a new card / When reviewed / Then repetitions 1 and dueAtMs advances. Given quality < 3 / When reviewed / Then repetitions reset to 0. Given empty front / When createCard / Then error. Given limit 500 / When listDue / Then clamped to 100.
- **NUMBERS:** SM-2 intervals (https://super-memory.com/english/ol/sm2.htm); list limit default 50 / max 100 (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0338 — Study track: flashcards from a note (note → cards)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0337 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0337.
- **WHY:** PRD F-90 (record → notes → flashcards) and F-28 (coach artifacts feed the study track).
- **GOAL:** `convex/study.ts` gains `cardsFromNote({ noteId })` that turns a note's markdown into flashcard candidates as proposals (never silently saved), reusing the accept/reject path.
- **SCOPE:** `convex/study.ts` · test `convex/study.test.ts`.
- **MUTATES:** `studyCards` and `pageProposals` (proposals only).
- **STEPS:** 1) Graphify code-map of the proposal guard (`convex/lib/coachProposalGuard.ts`); 2) implement `cardsFromNote` to split the note into Q/A pairs (headings or `- ` bullet pairs) and return them as a proposal, not saved; 3) wire accept to `createCard`; 4) write the unit test.
- **DONE:** `bun test convex/study.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not auto-save (every mutation surfaces a confirm/reject per HARD_RULES §6.2); do not call a model (deterministic split only); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `cardsFromNote({ noteId }) → { cards: { front, back }[], proposalId }`. Deterministic split: for each `## heading` followed by a paragraph → front = heading, back = paragraph (≤500 chars); for each `- Q: … / - A: …` pair → front/back. Limits: at most 100 cards per call. Errors: note not owner → `ConvexError`; empty note → empty proposal. Accept path calls `createCard` per card (each still an individual proposal with Undo).
- **TESTS:** Given a note with `## X` + paragraph / When cardsFromNote / Then one card front X, back paragraph. Given a note with `- Q:`/`- A:` pairs / When cardsFromNote / Then paired cards. Given another user's note / When cardsFromNote / Then error. Given an empty note / When cardsFromNote / Then empty proposal.
- **NUMBERS:** max 100 cards per call (internal guard).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0339 — Study track: scoped RAG (study context retrieval)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0336 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0336.
- **WHY:** PRD F-90 (scoped RAG); TRD §5 (memory/embeddings); `convex/search.ts` (existing vector search).
- **GOAL:** `convex/study.ts` gains `retrieveContext({ deckNoteIds, query, limit? })` that returns the most relevant note passages scoped strictly to the deck's source notes.
- **SCOPE:** `convex/study.ts` · test `convex/study.test.ts`.
- **MUTATES:** none (reads `notes` + `search.ts` indexes).
- **STEPS:** 1) Graphify code-map of `convex/search.ts` and its embedding index; 2) implement `retrieveContext` to embed `query` and rank only passages whose note is in `deckNoteIds`; 3) write the unit test.
- **DONE:** `bun test convex/study.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not persist raw messages (RAM-only scan rule); do not leak other users' notes (strict `userId` filter); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `retrieveContext({ deckNoteIds, query, limit? }) → { passage, noteId, score }[]`. Embed `query` (same seam as `search.ts`), filter candidate passages to `note.userId === caller` AND `note._id ∈ deckNoteIds`, return top-k by cosine similarity, k default 5 max 20. Errors: query empty → `ConvexError`; deckNoteIds empty → empty array; caller not owner of any → empty array. RAM-only: no new persisted copies.
- **TESTS:** Given a query and a deck with one matching note / When retrieveContext / Then that note's passage ranks first. Given a note outside the deck / When retrieveContext / Then it is never returned. Given another user's note id / When retrieveContext / Then it is excluded. Given limit 50 / When retrieveContext / Then clamped to 20.
- **NUMBERS:** top-k default 5 / max 20 (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0340 — Study track: Anki export
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0337 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0337.
- **WHY:** PRD F-90 (Anki export).
- **GOAL:** `convex/study.ts` gains `exportAnki({ deckNoteIds? })` returning an Anki-importable plain-text file (front tab back, one card per line) for the user's cards.
- **SCOPE:** `convex/study.ts` · test `convex/study.test.ts`.
- **MUTATES:** none (reads `studyCards`).
- **STEPS:** 1) Graphify code-map; 2) implement `exportAnki` as a mutation returning UTF-8 text in Anki's "Basic" import format (`front<TAB>back`); 3) write the unit test.
- **DONE:** `bun test convex/study.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not add a dependency for `.apkg` (text import is the deterministic, dependency-free form); do not write files to disk; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `exportAnki({ deckNoteIds? }) → { text, count }`. Each card becomes one line `front\tback` (escape tab/newline inside fields as spaces); cards filtered to caller's own and, when `deckNoteIds` given, to those source notes. Limits: max 10,000 cards; over → `ConvexError`. Errors: no cards → `{ text: "", count: 0 }`.
- **TESTS:** Given 3 cards / When exportAnki / Then text has 3 lines with tab separators. Given a card whose fields contain a newline / When exported / Then the newline is replaced by a space. Given deckNoteIds excludes one card / When exported / Then that card is omitted. Given another user's card id / When exported / Then it is never included.
- **NUMBERS:** Anki plain-text import format (https://docs.ankiweb.net/importing/text-files.html) · max 10,000 cards per export (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0341 — Study track: Flashcard component (card-flip)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0336 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` (+ web reuse), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0336.
- **WHY:** components.md §2.2 (Flashcard, `card-flip`/`card-step`); PRD F-90; DESIGN.md §7 motion.
- **GOAL:** A `Flashcard` component flips front↔back and steps through a deck, exposing `data-side`, `aria-pressed` and a counter.
- **SCOPE:** `apps/mobile/components/v3/Flashcard.tsx` · test `apps/mobile/components/v3/__tests__/flashcard.test.tsx`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `apps/mobile/components/v3/Flashcard.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `Flashcard` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/flashcard.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not call the backend (props only); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Card surface `--tp-paper`, radius `--tp-radius-lg`, shadow `--tp-shadow-card`. Front/back toggle via flip (only `transform`+`opacity`, ≤250 ms `--tp-ease-out`). Copy (caller-supplied, no fixed copy) + counter `EN: n of m / HE: n מתוך m` (digits `tp-num`). States: front, back, disabled, reduced-motion (no flip). Screen-reader: `aria-pressed` on flip, counter `aria-live=polite`. RTL: counter order mirrors.
- **TESTS:** Given a card / When rendered / Then front shows and `aria-pressed` is false. Given a tap / When flip fires / Then back shows and `aria-pressed` true. Given reduced motion / When rendered / Then no transform animation runs. Run at 390 and 1280, EN and HE.
- **NUMBERS:** motion ≤250 ms (DESIGN.md §7) · target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0342 — Study track: Quiz component (quiz-check)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0336 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile` (+ web reuse), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0336.
- **WHY:** components.md §2.2 (Quiz, `quiz-check`); PRD F-90 (recall quiz); DESIGN.md §7.
- **GOAL:** A `Quiz` component renders a question with choices and marks an answer `data-checked`/`data-result` after `quiz-check`.
- **SCOPE:** `apps/mobile/components/v3/Quiz.tsx` · test `apps/mobile/components/v3/__tests__/quiz.test.tsx`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map of `apps/mobile/components/v3/Quiz.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `Quiz` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/mobile/components/v3/__tests__/quiz.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not call the backend (props only); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Question `--tp-ink` `--tp-text-lg`; choices as radios (role=radio, `aria-checked`); after answer, correct choice gets `data-result=correct` (`--tp-done`), wrong `data-result=wrong` (`--tp-danger`). Copy: `EN: Question n of m / HE: שאלה n מתוך m`; `EN: Check / HE: בדוק`; `EN: Correct / HE: נכון`; `EN: Not quite / HE: לא בדיוק`. States: unanswered, answered-correct, answered-wrong, disabled. RTL: choice order inline-start. Motion ≤250 ms feedback.
- **TESTS:** Given a question / When rendered / Then no choice is checked. Given a choice / When checked and Check tapped / Then `data-result` shows on the chosen and correct rows. Given answered / When re-checked / Then input is disabled. Run at 390 and 1280, EN and HE.
- **NUMBERS:** motion ≤250 ms (DESIGN.md §7) · target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0343 — Study track: deck list screen (mobile)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0337, TFV2-0341, TFV2-0342 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0337, TFV2-0341, TFV2-0342.
- **WHY:** PRD F-90 (separate mode, never mixed into Today); DESIGN.md §8/§10.
- **GOAL:** `apps/mobile/app/(tempo)/study/index.tsx` lists the user's study decks/cards with due counts, as a separate mode reachable outside Today.
- **SCOPE:** `apps/mobile/app/(tempo)/study/index.tsx` · test `tests/e2e/mobile-study-decks.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map; 2) build the deck list on `study.ts` queries; 3) wire default/loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-study-decks.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not mix study into the Today tab; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Study / HE: לימוד`; `EN: No decks yet. / HE: אין ערכות עדיין.`; `EN: n due today / HE: n מתוכננים להיום` (digits `tp-num`); `EN: Start review / HE: להתחלת חזרה`; error `EN: Couldn't load your study. Your data is safe. / HE: לא הצלחנו לטעון את הלימוד שלך. הנתונים שלך בטוחים.`; offline `EN: You're offline. / HE: אין חיבור.`. States: default, loading, empty, error, offline. RTL inline-start. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no decks / When loaded / Then empty state shows. Given decks / When rendered / Then each deck name and due count show. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0344 — Study track: review screen (mobile)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0343 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0343.
- **WHY:** PRD F-90; DESIGN.md §8/§10.
- **GOAL:** `apps/mobile/app/(tempo)/study/review.tsx` runs a flashcard review session calling `study.reviewCard` on each answer, with all states.
- **SCOPE:** `apps/mobile/app/(tempo)/study/review.tsx` · test `tests/e2e/mobile-study-review.spec.ts`.
- **MUTATES:** `apps/mobile` UI only (calls `study.reviewCard`).
- **STEPS:** 1) Graphify code-map; 2) render Flashcard + quality buttons (Again/Hard/Good/Easy → quality 0/3/4/5); 3) wire `reviewCard`; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-study-review.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not auto-advance without a quality choice; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Review / HE: חזרה`; `EN: Again / HE: שוב`; `EN: Hard / HE: קשה`; `EN: Good / HE: טוב`; `EN: Easy / HE: קל`; `EN: Session complete / HE: החזרה הסתיימה`. States: loading, active (card), answered (feedback), complete, error, offline. Quality maps: Again→0, Hard→3, Good→4, Easy→5. RTL inline-start. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given a due card / When loaded / Then the front shows. Given a quality button / When tapped / Then `reviewCard` advances to the next card. Given the last card / When answered / Then "Session complete" shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0345 — Study track: test screen (recall quiz) (mobile)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0343 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0343.
- **WHY:** PRD F-90 (recall quiz / test); DESIGN.md §8/§10.
- **GOAL:** `apps/mobile/app/(tempo)/study/test.tsx` runs a recall quiz (typed or chosen answers) over a deck and scores it, with all states.
- **SCOPE:** `apps/mobile/app/(tempo)/study/test.tsx` · test `tests/e2e/mobile-study-test.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map; 2) render Quiz questions from the deck; 3) score locally and show a result; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-study-test.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not mix into Today; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Test / HE: מבחן`; `EN: You scored n of m / HE: קיבלת n מתוך m`; `EN: Try again / HE: נסה שוב`. States: loading, active, answered, complete (score), error, offline. RTL inline-start; digits `tp-num`. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given a deck / When Test loads / Then question 1 shows. Given answers / When all answered / Then the score shows. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0346 — Study track: stats/progress screen (mobile)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0337 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0337.
- **WHY:** PRD F-90; DESIGN.md §8/§10; components.md §2.7 (charts).
- **GOAL:** `apps/mobile/app/(tempo)/study/stats.tsx` shows per-deck mastery (due, learning, mature counts) with every state.
- **SCOPE:** `apps/mobile/app/(tempo)/study/stats.tsx` · test `tests/e2e/mobile-study-stats.spec.ts`.
- **MUTATES:** `apps/mobile` UI only.
- **STEPS:** 1) Graphify code-map; 2) aggregate `studyCards` by status; 3) render counts/chart; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-study-stats.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not edit `convex/`; do not invent metrics; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Progress / HE: התקדמות`; `EN: New / HE: חדש`; `EN: Learning / HE: בלמידה`; `EN: Reviewing / HE: בחזרה`; empty `EN: No study activity yet. / HE: אין פעילות לימוד עדיין.`; offline `EN: You're offline. / HE: אין חיבור.`. Counts are real (digits `tp-num`); no invented percentages. States: default, loading, empty, error, offline. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no cards / When loaded / Then empty state shows. Given cards across statuses / When rendered / Then the three counts match the data. Given offline / When rendered / Then the offline banner shows. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0347 — Connectors: Executor connect/setup verify (fold-in #748)
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** #748
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first (connectors; `convex/connections.ts` already exists on `integration`).
- **WHY:** PRD F-100; TRD §6; issue #748 (Executor connector setup); `docs/research/EXECUTOR-IN-TEMPO.md` §5.1 (if present).
- **GOAL:** The Executor connect flow (`startExecutorConnect` → OAuth callback → `confirmExecutorConnect`) is verified end-to-end against `fakeExecutor.testkit.ts`, with one live usable row per person and nonce-confirmed tokens.
- **SCOPE:** `convex/connections.ts` (fix only if a defect) · `convex/lib/connections/fakeExecutor.testkit.ts` · test `convex/connections.test.ts`.
- **MUTATES:** `connections`, `connectionSecrets`, `oauthPending`, `connectionLimits` (via existing functions; no schema change).
- **STEPS:** 1) Graphify code-map of `startExecutorConnect`, `handleExecutorCallback`, `confirmExecutorConnect`; 2) run the existing `connections.test.ts`; 3) add any missing coverage for the connect happy path and the nonce-expiry path; 4) re-run.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not change the OAuth flow shape; do not record a key/token value (names only); do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Verified invariants: only one `connected`/`needs_reauth`/`unavailable` row per person+provider; `pending_confirm` rows are unusable until the nonce (SHA-256 stored, alive ≤ `CONFIRM_TTL_MS`) confirms; confirming retires the previous row; connect attempts capped at `CONNECT_ATTEMPTS_PER_HOUR` via `connectionLimits`. Executor's call shape/env names remain `UNKNOWN` (TRD §6). Error cases: expired nonce → error; double-confirm → same answer; revoked token → `needs_reauth`.
- **TESTS:** Given a connect attempt / When the OAuth callback returns a code / Then a `pending_confirm` row with a nonce hash is staged and no token is usable. Given the owner confirms / When `confirmExecutorConnect` runs / Then the row becomes `connected` and the prior row retires. Given an expired nonce / When confirmed / Then it errors and nothing changes. Given a connect attempt over the hourly cap / When started / Then it is refused.
- **NUMBERS:** `CONFIRM_TTL_MS` 10 min, `CONNECT_ATTEMPTS_PER_HOUR` 5, `CALLS_PER_HOUR` 30 (repo constants, `convex/connections.ts`).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Executor call shape + env var names — Amit (TRD §6).

### TFV2-0348 — Connectors: Executor reads adapter (list/search)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0347 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0347.
- **WHY:** PRD F-100 (reads plus light writes, heavy writes hard-refused); `convex/connections.ts` `searchExecutorFor` and `lib/connections/mcpClient.ts`.
- **GOAL:** `searchExecutorFor` and a new `listExecutorFor` read through the Executor MCP client return normalized results scoped to the caller, with reads audited and rate-limited.
- **SCOPE:** `convex/connections.ts` · `convex/lib/connections/mcpClient.ts` · test `convex/connections.test.ts`.
- **MUTATES:** `connectionCalls` audit rows (reads); no external writes.
- **STEPS:** 1) Graphify code-map of `searchExecutorFor` and `mcpClient.ts`; 2) verify reads are rate-limited (`reserveCall`) and audited (`recordCall`); 3) add `listExecutorFor` (list tasks/notes) if missing; 4) write the test.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not perform writes; do not expose raw tokens; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `listExecutorFor(ctx, userId, { kind: "tasks"|"notes", limit? }) → items[]` and `searchExecutorFor` normalize Executor results to `{ id, title, … }`. Auth: caller's own connection only; `requireApprovedUser`. Limits: `CALLS_PER_HOUR` 30; read results ≤ `DEFAULT_LIMIT` 50. Errors: no connected row → `ConvexError`; provider rate-limit → `rate_limited`; timeout → `timeout`; each recorded in `connectionCalls` (`outcome`).
- **TESTS:** Given a connected row / When `listExecutorFor` runs / Then normalized items return and a `tool_call` audit row is written. Given no connection / When called / Then error, nothing audited as `ok`. Given over the hourly cap / When called / Then `rate_limited`. Given a provider timeout / When called / Then `timeout` outcome is recorded.
- **NUMBERS:** 30 calls/hour, 50 default read limit (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Executor MCP tool names beyond `search` — Amit (TRD §6).

### TFV2-0349 — Connectors: Executor light writes (hard-refuse heavy writes)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0348 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0348.
- **WHY:** PRD F-100 ("reads plus light writes, heavy writes hard-refused, every external write confirmed").
- **GOAL:** `convex/connections.ts` gains `executorWrite` that permits only light writes (create/update a task or event) and hard-refuses heavy writes (delete, bulk, destructive) before any external call.
- **SCOPE:** `convex/connections.ts` · test `convex/connections.test.ts`.
- **MUTATES:** `connectionCalls` audit rows; external Executor writes (light only).
- **STEPS:** 1) Graphify code-map; 2) add a policy table of permitted/refused Executor write tools; 3) implement `executorWrite` with the hard-refuse check first; 4) write the test.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not permit delete/bulk/destructive writes; do not bypass the confirmation gate (TFV2-0350); do not record tokens; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `executorWrite(ctx, userId, { tool, args }) → { id }`. Permit list: `task_create`, `task_update`, `calendar_create`, `calendar_update` (light). Refuse list: any delete, bulk, move, account, or unknown tool → `ConvexError` `blocked` BEFORE the external call, recorded with `decision: "blocked"`. Every permitted write records `decision: "approved"`/`"auto"` and `outcome`. Errors: no connection, rate-limit, timeout, unauthorized — mirror TFV2-0348.
- **TESTS:** Given `task_create` / When `executorWrite` runs / Then it succeeds and audits `ok`. Given a delete tool / When `executorWrite` runs / Then it is hard-refused with `blocked` and NO external call. Given an unknown tool / When called / Then `blocked`. Given no connection / When called / Then error.
- **NUMBERS:** 30 calls/hour cap (repo constant) · light-write permit list = 4 tools (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Executor write-tool names — Amit (TRD §6).

### TFV2-0350 — Connectors: external write confirmation (every write confirmed)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0349 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0349.
- **WHY:** PRD F-100/F-131 ("every external write confirmed"); HARD_RULES §6.2 (accept/reject before mutation).
- **GOAL:** Every `executorWrite` requires a prior confirmed proposal; an unconfirmed write is refused, and the confirmation returns a 5-minute Undo path.
- **SCOPE:** `convex/connections.ts` · test `convex/connections.test.ts`.
- **MUTATES:** `pageProposals`/`connectionCalls` (proposal + audit); external writes only after confirm.
- **STEPS:** 1) Graphify code-map of the proposal guard; 2) add a `proposalId` arg to `executorWrite` and verify it is confirmed; 3) refuse unconfirmed writes; 4) write the test.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not auto-apply an external write; do not weaken the confirm gate; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `executorWrite(ctx, userId, { tool, args, proposalId })`. A `proposalId` whose proposal is not the caller's, or not confirmed, → `ConvexError` and NO external call. Confirmed → perform the light write, then surface an Undo (undo reissues a compensating light write where one exists, else a notice). Errors: missing proposalId → `ConvexError`.
- **TESTS:** Given no proposalId / When `executorWrite` runs / Then it is refused and no external call happens. Given an unconfirmed proposal / When called / Then refused. Given a confirmed proposal / When called / Then the write runs and an Undo is returned.
- **NUMBERS:** Undo window 5 minutes (HARD_RULES §6.2 / PRD F-131).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0351 — Connectors: connectionCalls audit + rate limits verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0347 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0347.
- **WHY:** PRD F-100; `convex/connections.ts` `reserveCall`/`recordCall`/`markStatus`; research doc §4.5 (audit).
- **GOAL:** The `connectionCalls` audit is verified: one content-free row per call/disconnect with a SHA-256 input digest, and the fixed-window limits are enforced.
- **SCOPE:** `convex/connections.ts` (fix only) · test `convex/connections.test.ts`.
- **MUTATES:** `connectionCalls` (audit only).
- **STEPS:** 1) Graphify code-map of `reserveCall`/`recordCall`/`markStatus`; 2) verify no inputs/results are persisted (digest only) and `resultBytes`/`durationMs` are set; 3) add missing coverage; 4) re-run.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not persist raw input/result; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Audit row fields: `kind`, `tool`/`path`, `decision`, `outcome`, `inputDigest` (SHA-256), `resultBytes`, `durationMs`, `messageId?`, timestamps; soft-deleted with the account. Limits: `CALLS_PER_HOUR` 30, `HOUR_MS` 60 min, `SWEEP_BATCH` 50.
- **TESTS:** Given a call / When audited / Then a row exists with a digest, no raw input, and `outcome` set. Given a call over the cap / When attempted / Then `rate_limited` and no external call. Given a disconnect / When recorded / Then a `disconnect` audit row exists.
- **NUMBERS:** 30 calls/hour, sweep batch 50 (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0352 — Connectors: Executor disconnect/revoke + sweep verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0347 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0347.
- **WHY:** PRD F-100; TRD §7 rule 5/6 (soft delete, scrub secrets); `convex/connections.ts` `disconnect`/`revokeConnection`/`sweep`.
- **GOAL:** Disconnect revokes tokens at Executor, retires the connection, scrubs `connectionSecrets` ciphertexts, and the sweep removes stale rows.
- **SCOPE:** `convex/connections.ts` (fix only) · test `convex/connections.test.ts`.
- **MUTATES:** `connections`, `connectionSecrets`, `connectionCalls` (disconnect audit).
- **STEPS:** 1) Graphify code-map of `disconnectFlow`/`revokeConnection`/`sweep`; 2) verify ciphertexts go to `undefined` + `deletedAt`; 3) add missing coverage; 4) re-run.
- **DONE:** `bun test convex/connections.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not hard-delete secrets rows (scrub + `deletedAt` only, HARD_RULES §5); do not record tokens; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `disconnect` → `revokeConnection` (provider revoke, `revokedAtProvider`), row → `disconnected`/`revoking` tombstoned, `disconnectGeneration`++ so in-flight connects never confirm. `sweep` batches `SWEEP_BATCH` stale rows. Errors: provider unreachable → `unavailable`/`needs_reauth`, not silent success.
- **TESTS:** Given a connected row / When disconnected / Then the row tombstones, secrets scrub to `undefined`, and a disconnect audit row is written. Given an in-flight connect / When a newer disconnect runs / Then the old connect cannot confirm. Given stale rows / When sweep runs / Then only the batch is scrubbed.
- **NUMBERS:** `SWEEP_BATCH` 50, `REVOKE_GRACE_MS` 1 hour (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0353 — MCP: tool catalog + input schemas verify (`lib/mcp/tools.ts`)
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first (MCP; `convex/lib/mcp/tools.ts` exists).
- **WHY:** PRD F-101; `convex/mcp.ts`, `convex/mcpTools.ts`, `convex/lib/mcp/*`; issue #747 (adjacent).
- **GOAL:** The MCP tool catalog (`lib/mcp/tools.ts`) and its JSON schemas are verified to list every implemented read/write/action tool with correct input validation, and `findTool` resolves names.
- **SCOPE:** `convex/lib/mcp/tools.ts` · `convex/lib/mcp/schema.ts` (fix only) · test `convex/lib/mcp/mcp.test.ts`.
- **MUTATES:** none (catalog only).
- **STEPS:** 1) Graphify code-map of `tools.ts`/`schema.ts`; 2) verify the catalog covers `tasks_list`, `task_create`, `task_update`, `notes_list`, `note_create`, `note_update`, `calendar_list`, `calendar_create`, `calendar_update`, `today_plan_get`, `brain_dump`; 3) verify each `inputSchema` validates required fields; 4) run the test.
- **DONE:** `bun test convex/lib/mcp/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not add tools here (today_plan_set is TFV2-0354); do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Catalog shape `McpTool { name, kind: "query"|"mutation"|"action", description, inputSchema }`. `findTool(name)` returns the tool or `undefined`. Errors: unknown tool → caller-side `Unknown tool: <name>`.
- **TESTS:** Given `findTool("tasks_list")` / When resolved / Then kind query and a valid schema return. Given `findTool("nope")` / When resolved / Then undefined. Given each catalog tool / When its schema validates a minimal valid input / Then it passes; and an input missing a required field fails.
- **NUMBERS:** catalog completeness = 11 tools (internal, must equal the implemented set).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0354 — MCP: `today_plan_set` write tool (fold-in #747)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** #747
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101; issue #747 (`today_plan_set`); `convex/dayPlans.ts` (existing day-plan write functions).
- **GOAL:** `mcpTools.ts` gains a `today_plan_set` mutation tool that sets a day plan (intention, energy, reflection, top tasks) for a date, scoped to the token owner, returning the saved plan.
- **SCOPE:** `convex/mcpTools.ts` · `convex/lib/mcp/tools.ts` (catalog entry) · test `convex/mcp.test.ts`.
- **MUTATES:** `dayPlans` (via the existing plan function); no schema change.
- **STEPS:** 1) Graphify code-map of `dayPlans.ts` and `runWriteTool`; 2) add `today_plan_set` to `runWriteTool` and the catalog; 3) validate timezone/date and plan fields; 4) write the test.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not edit `convex/schema.ts`; do not add a second day-plan writer (reuse `dayPlans.ts`); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `today_plan_set({ date?, timezone?, intention?, energy?, reflection?, topTaskIds? }) → { plan }`. Auth: token-owner `userId` (internal, via `authorizeCall`). Validation: timezone `isValidTimeZone` (default UTC); date `YYYY-MM-DD` (default today in that zone); intention/reflection ≤ 2000 chars; energy ∈ `low|medium|high`|undefined; `topTaskIds` ≤ 10 and all owned. Errors: unknown timezone → `ConvexError`; too many topTaskIds → `ConvexError`; a foreign taskId → `ConvexError`; invalid date → `ConvexError`.
- **TESTS:** Given valid args / When `today_plan_set` runs / Then the plan is saved and returned. Given a bad timezone / When called / Then error. Given 11 topTaskIds / When called / Then error. Given a foreign taskId / When called / Then error and nothing saved.
- **NUMBERS:** topTaskIds ≤ 10, intention/reflection ≤ 2000 chars (internal guards).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0355 — MCP: read tools verify (`tasks_list`, `notes_list`, `calendar_list`, `today_plan_get`)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101; `convex/mcpTools.ts` `runReadTool`.
- **GOAL:** The four read tools return normalized views scoped to the token owner, with limit/range validation and every error case covered.
- **SCOPE:** `convex/mcpTools.ts` (fix only) · test `convex/mcp.test.ts`.
- **MUTATES:** none (reads only).
- **STEPS:** 1) Graphify code-map of `runReadTool`; 2) verify each view shape and limit; 3) add missing error-case coverage; 4) run the test.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not change view shapes; do not cross user boundaries; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tasks_list({status, dueFrom, dueTo})`, `notes_list({pinnedOnly})`, `calendar_list({fromMs, toMs})` (range ≤ `maxCalendarRangeMs`), `today_plan_get({timezone, date})`. All read through `list*ForUser` scoped to `userId`. Errors: calendar `toMs ≤ fromMs` → `ConvexError`; range too large → `ConvexError`; bad timezone → `ConvexError`.
- **TESTS:** Given user A's tasks / When B calls `tasks_list` / Then only B's tasks return. Given `toMs ≤ fromMs` / When `calendar_list` / Then error. Given a range over `maxCalendarRangeMs` / When `calendar_list` / Then error. Given a bad timezone / When `today_plan_get` / Then error.
- **NUMBERS:** `DEFAULT_LIMIT` 50 (repo constant) · calendar range ≤ `maxCalendarRangeMs` (repo constant).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0356 — MCP: write tools verify (`task_create/update`, `note_create/update`, `calendar_create/update`)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101; `convex/mcpTools.ts` `runWriteTool`.
- **GOAL:** The six write tools create/update only the token owner's rows and return normalized views, with every error case covered.
- **SCOPE:** `convex/mcpTools.ts` (fix only) · test `convex/mcp.test.ts`.
- **MUTATES:** `tasks`, `notes`, `calendarEvents` (via existing `*ForUser` helpers).
- **STEPS:** 1) Graphify code-map of `runWriteTool`; 2) verify owner-scoped helpers and id normalization; 3) add missing error-case coverage; 4) run the test.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not edit `convex/schema.ts`; do not write outside the owner's rows; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `task_create({title, notes?, dueAtMs?, priority?, energy?})`, `task_update({taskId, title?, notes?, dueAtMs?, completed?})`, `note_create({title, body?})`, `note_update({noteId, title?, body?, pinned?})`, `calendar_create({title, startsAtMs})`, `calendar_update({eventId, title?, startsAtMs?})`. Ids are normalized; foreign/unknown ids → `ConvexError` "not found".
- **TESTS:** Given a foreign taskId / When `task_update` runs / Then error and the foreign row is unchanged. Given a title-only create / When run / Then a row is created for the caller. Given a malformed id / When any update runs / Then error. Given `calendar_create` with missing title / When run / Then error.
- **NUMBERS:** no industry number applies → `UNKNOWN` (none needed).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0357 — MCP: `brain_dump` action verify (crisis guard)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101, F-24; `convex/mcpTools.ts` `runBrainDump`.
- **GOAL:** `runBrainDump` is verified to run the planner, short-circuit crisis text to the fixed card (never a model call), and only save when `accept` is true.
- **SCOPE:** `convex/mcpTools.ts` (fix only) · test `convex/mcp.test.ts`.
- **MUTATES:** `tasks` (only on `accept`); no schema change.
- **STEPS:** 1) Graphify code-map of `runBrainDump` and `lib/crisisWords.ts`; 2) verify crisis short-circuit and accept flow; 3) add missing coverage; 4) run the test.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not let crisis text reach the model; do not auto-accept; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `runBrainDump({userId, text, accept?})`. If `isCrisisText(text)` → return `{ crisis: true, accepted: false, created: 0, resources: crisisCardText(CRISIS_CARD) }` with NO model call. Else plan via `planBrainDump`; `accept:false` returns the plan; `accept:true` with items saves tasks via `acceptBrainDump`.
- **TESTS:** Given crisis text / When `runBrainDump` runs / Then `crisis` true and no tasks created. Given normal text with `accept:false` / When run / Then a plan returns and nothing is saved. Given normal text with `accept:true` / When run / Then tasks are created. Given empty priorities / When accepted / Then `created: 0`.
- **NUMBERS:** no industry number applies → `UNKNOWN` (none needed).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0358 — MCP: Streamable HTTP endpoint verify (`mcpHttp.ts`)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101; `convex/mcpHttp.ts` (TEMPO-MCP-01); `convex/lib/mcp/jsonrpc.ts`, `origin.ts`, `token.ts`.
- **GOAL:** `mcpPost` is verified to enforce origin, bearer token, protocol version, body size, and rate-limit, returning JSON-RPC responses and 202 for notifications.
- **SCOPE:** `convex/mcpHttp.ts` (fix only) · test `convex/mcp.test.ts`.
- **MUTATES:** none (HTTP endpoint behaviour only).
- **STEPS:** 1) Graphify code-map of `mcpPost`/`mcpOptions`/`mcpNotAllowed`; 2) verify each guard; 3) add missing coverage; 4) run the test.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not weaken origin/token/rate checks; do not add server-initiated streams (GET stays 405); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `POST` with `Authorization: Bearer tmcp_…` and allowed `Origin`; JSON-RPC 2.0. Guards: bad origin → 403; missing/malformed token → 401 + `WWW-Authenticate`; unsupported `MCP-Protocol-Version` → 400; pending account → 403; rate-limited → 429 + `Retry-After: 60`; body > `MAX_BODY_BYTES` → 413; parse error → 400; batches → 400 (unsupported); notification → 202. `GET`/`DELETE` → 405; `OPTIONS` → 204 with CORS for allowed origins.
- **TESTS:** Given a bad origin / When POST / Then 403. Given a missing token / When POST / Then 401. Given rate-limit exceeded / When POST / Then 429. Given a notification / When POST / Then 202. Given GET / When called / Then 405. Given an oversized body / When POST / Then 413.
- **NUMBERS:** `MAX_BODY_BYTES` 256 KB, rate 120/min (repo constants) · HTTP status codes per JSON-RPC 2.0 spec (https://www.jsonrpc.org/specification).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0359 — MCP: CLI client (Streamable HTTP)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0358 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend` (new `packages/mcp-cli`), lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0358.
- **WHY:** PRD F-101 (MCP server + CLI + REST).
- **GOAL:** `packages/mcp-cli` is a Bun CLI (`tempo-mcp`) that connects to the Streamable HTTP endpoint with a `tmcp_` token, lists tools, and calls a read tool.
- **SCOPE:** `packages/mcp-cli/package.json` · `packages/mcp-cli/src/index.ts` · test `packages/mcp-cli/src/index.test.ts`.
- **MUTATES:** adds a workspace package under `packages/` (auto-included by the `packages/*` glob); no Convex/schema/env.
- **STEPS:** 1) Graphify code-map to confirm no CLI exists; 2) implement `initialize` + `tools/list` + `tools/call` over Streamable HTTP; 3) read the token from `TEMPO_MCP_TOKEN` env (name only); 4) write the unit test against a local JSON-RPC stub.
- **DONE:** `bun test packages/mcp-cli/src/index.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not embed or print a token value; do not add native deps; do not touch `.env` (read the env var name only), workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** CLI commands: `tempo-mcp tools` (list), `tempo-mcp call <name> [json]`, `tempo-mcp init <url>`. Sends `Authorization: Bearer $TEMPO_MCP_TOKEN`, header `MCP-Protocol-Version`. Errors: missing token → exit 1 with `EN: Missing TEMPO_MCP_TOKEN / HE: חסר TEMPO_MCP_TOKEN`; non-2xx → exit 1 with the JSON-RPC error message. No secrets logged.
- **TESTS:** Given a stubbed JSON-RPC server / When `tools` runs / Then the tool list prints. Given a missing token / When run / Then exit 1 with the missing-token message. Given a server 401 / When `call` runs / Then exit 1 and the error prints. Given `call tasks_list` / When run / Then the JSON-RPC body carries the method/params.
- **NUMBERS:** JSON-RPC 2.0 (https://www.jsonrpc.org/specification).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0360 — MCP: token lifecycle + rate limit verify (`mcp.ts`)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0353 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0353.
- **WHY:** PRD F-101; `convex/mcp.ts` (create/list/revoke/resolve/authorize); `convex/lib/mcp/token.ts`.
- **GOAL:** `createToken` returns the plaintext once (hash-only stored), `listTokens` hides it, `revokeToken` blocks it, and `authorizeCall` enforces the 120/min rate limit and approval.
- **SCOPE:** `convex/mcp.ts` (fix only) · test `convex/mcp.test.ts`.
- **MUTATES:** `mcpTokens` (via existing functions).
- **STEPS:** 1) Graphify code-map of `mcp.ts` and `lib/mcp/token.ts`; 2) run `convex/mcp.test.ts`; 3) add missing coverage (rate limit, revoke); 4) re-run.
- **DONE:** `bun test convex/mcp.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store or return the plaintext; do not raise `MAX_ACTIVE_TOKENS_PER_USER`; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `createToken({name}) → { tokenId, token, prefix }` (plaintext once; only `tokenHash` + `prefix` stored); `listTokens()` returns `prefix` only; `revokeToken` sets `revokedAt`; `authorizeCall` resolves hash → ok/pending/rate_limited/unauthorized. Errors: empty name → `ConvexError`; > max active → `ConvexError`.
- **TESTS:** Given a create / When stored / Then the stored row has no plaintext. Given a list / When run / Then no `tokenHash`/plaintext appears. Given a revoked token / When authorized / Then `unauthorized`. Given 121 calls in a minute / When the 121st runs / Then `rate_limited`.
- **NUMBERS:** rate 120/min, `MAX_ACTIVE_TOKENS_PER_USER` (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0361 — BYOK key vault: `byokKeys` table + per-user crypto
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md` (needs `convex-arch` label).
- **WHEN:** first (BYOK; reuse `convex/lib/connections/crypto.ts` AES-256-GCM).
- **WHY:** PRD F-102 (BYOK, encrypted per user); TRD §7 rule 6 (BYOK keys encrypted per user, never returned to client).
- **GOAL:** `convex/schema.ts` gains a `byokKeys` table storing only ciphertext (AES-256-GCM, key from `TEMPO_CONNECTIONS_KEY`), plus a crypto helper that encrypts/decrypts a user-supplied OpenAI-compatible key.
- **SCOPE:** `convex/schema.ts` · `convex/lib/byokCrypto.ts` · test `convex/byok.test.ts`.
- **MUTATES:** `convex/schema.ts` (new table).
- **STEPS:** 1) Graphify code-map of `convex/schema.ts` and `lib/connections/crypto.ts`; 2) add `byokKeys`; 3) add `byokCrypto.ts` (encrypt/decrypt, reusing the GCM helper); 4) write the test.
- **DONE:** `bun test convex/byok.test.ts` → all pass; `bun run typecheck` → exit 0.
- **EVIDENCE:** test output + typecheck exit code.
- **DO NOT:** do not store plaintext; do not return a key to the client; do not write a key value (names only: `TEMPO_CONNECTIONS_KEY`); do not touch `convex/auth*`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `byokKeys: defineTable({ userId, provider: v.literal("openai_compatible"), label, keyCipher, endpointUrl, keyVersion, lastCheckedAt?, lastCheckOk?, createdAt, updatedAt, deletedAt })` indexed `by_userId`. `byokCrypto.encrypt(plaintext) → { cipher, keyVersion }`, `decrypt(cipher, keyVersion) → plaintext`; GCM nonce unique per encryption. Errors: missing key env → throw (fail closed); bad cipher → throw.
- **TESTS:** Given a plaintext / When encrypted then decrypted / Then it round-trips. Given two encryptions of the same text / When compared / Then nonces differ (ciphertexts differ). Given tampered ciphertext / When decrypted / Then throws. Given a stored row / When listed / Then no `keyCipher` is returned by the public path.
- **NUMBERS:** AES-256-GCM (NIST SP 800-38D) · nonce ≥ 96 bits unique per message.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0362 — BYOK: set/list-masked/delete + endpoint health-check
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0361 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0361.
- **WHY:** PRD F-102; TRD §7 rule 6.
- **GOAL:** `convex/byok.ts` exposes `setKey`, `listKeys` (masked), `deleteKey`, and `checkKey` (a one-call health probe to the endpoint), never returning the plaintext.
- **SCOPE:** `convex/byok.ts` · test `convex/byok.test.ts`.
- **MUTATES:** `byokKeys` (via functions).
- **STEPS:** 1) Graphify code-map; 2) implement the mutations/action; 3) return only masked labels (`sk-…` + last 4) in `listKeys`; 4) write the test.
- **DONE:** `bun test convex/byok.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not return plaintext anywhere; do not log the endpoint probe body; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `setKey({ label, key, endpointUrl? }) → { id }` (requireApprovedUser; encrypt; one active key per user or allow many — allow many, ≤ 10; endpoint must be `https://`). `listKeys() → { id, label, masked, endpointUrl, lastCheckedAt?, lastCheckOk? }[]` (masked = first 3 + `…` + last 4). `deleteKey({ id })` soft-deletes. `checkKey({ id })` action: a minimal `GET /models` probe (or `POST /chat/completions` with 1 token) → set `lastCheckedAt`/`lastCheckOk`. Errors: > 10 keys → `ConvexError`; non-https endpoint → `ConvexError`; foreign id → `ConvexError`.
- **TESTS:** Given a setKey / When listed / Then only the masked form appears. Given a setKey / When checkKey probes a stub / Then `lastCheckOk` reflects it. Given 11 keys / When setKey / Then error. Given a foreign id / When deleteKey / Then error and nothing changes.
- **NUMBERS:** ≤ 10 keys per user (internal) · endpoint must be HTTPS (TRD §7 rule 6 / security).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0363 — BYOK: runtime model routing via `ai_router` seam
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0362 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0362.
- **WHY:** PRD F-102; TRD §3/§7 (seam is the source of truth; BYOK overrides default); `convex/lib/ai_router.ts`.
- **GOAL:** `ai_router.ts` gains a route that, when the caller has an active BYOK key, sends their model calls to their own OpenAI-compatible endpoint/key, else the default DeepInfra seam; the key never leaves the server.
- **SCOPE:** `convex/lib/ai_router.ts` · test `convex/lib/ai_router.test.ts`.
- **MUTATES:** none (routing only; reads `byokKeys`).
- **STEPS:** 1) Graphify code-map of `ai_router.ts`; 2) add `resolveRuntimeRoute(userId)` returning either `{ kind: "byok", endpoint, key }` (decrypted in-process, never returned) or the default; 3) keep the existing callers' signatures; 4) write the test.
- **DONE:** `bun test convex/lib/ai_router.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not log or return the key; do not change the default model id; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `resolveRuntimeRoute(userId): Promise<Route>` where `Route = { kind: "default" } | { kind: "byok"; endpoint: string }`. The key is decrypted and used only inside the `fetch`; the caller never sees it. Errors: BYOK endpoint unhealthy (`lastCheckOk === false`) → fall back to default (or throw with a clear error if `strict` is set); no active key → default.
- **TESTS:** Given a user with a healthy BYOK key / When a call routes / Then it hits the BYOK endpoint. Given no BYOK key / When a call routes / Then it uses the default. Given an unhealthy BYOK key / When routed / Then it falls back to default. Given any route / When serialized / Then no key material appears in logs/returns.
- **NUMBERS:** no industry number applies → `UNKNOWN` (none needed).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0364 — BYOK: key vault screen (settings)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0362 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0362.
- **WHY:** PRD F-102; DESIGN.md §8/§10; components.md §2.9.
- **GOAL:** `apps/web/app/(tempo)/settings/byok/page.tsx` lists masked keys and lets the user add (label + endpoint + key, key never echoed back), test-connect, and delete, with all states.
- **SCOPE:** `apps/web/app/(tempo)/settings/byok/page.tsx` · test `tests/e2e/byok.spec.ts`.
- **MUTATES:** `apps/web` UI only (calls `convex/byok.ts`).
- **STEPS:** 1) Graphify code-map; 2) build the list + add/test/delete forms; 3) wire loading/empty/error/offline states; 4) implement the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/byok.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not echo the key back; do not store the key client-side; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy: `EN: Bring your own key / HE: הבא מפתח משלך`; `EN: Add key / HE: הוסף מפתח`; `EN: Label / HE: תווית`; `EN: Endpoint / HE: נקודת קצה`; `EN: API key / HE: מפתח API`; `EN: Test connection / HE: בדיקת חיבור`; `EN: Connected / HE: מחובר`; `EN: Couldn't reach that endpoint / HE: לא הצלחנו להגיע לנקודת הקצה`; `EN: Delete / HE: מחק`. States: default, loading, empty (no keys), error, offline, testing, tested-ok, tested-fail. Key input `type=password autocomplete=off dir=ltr`, never pre-filled. RTL: labels inline-start; endpoint/key LTR. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given no keys / When loaded / Then empty state shows. Given a masked key / When listed / Then only the masked form shows. Given an invalid endpoint / When Test connection runs / Then the fail copy shows. Given Delete / When confirmed / Then the key leaves the list. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0365 — Voice: `voicePolicy` minutes cap + tier limits verify
- **Stage:** E · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** first (live voice; `convex/lib/voicePolicy.ts` exists).
- **WHY:** PRD F-35, F-30; TRD §5a; HARD_RULES §9; `convex/lib/voicePolicy.ts`; `convex/voice.ts`.
- **GOAL:** `voicePolicy` limits (per-user daily minutes, tier caps, global ceiling, TTS char cap, lease windows) are verified against HARD_RULES §9 and unit-tested.
- **SCOPE:** `convex/lib/voicePolicy.ts` (fix only) · test `convex/lib/voicePolicy.test.ts`.
- **MUTATES:** none (policy constants + pure functions).
- **STEPS:** 1) Graphify code-map of `voicePolicy.ts`; 2) run `voicePolicy.test.ts`; 3) verify `dailyMinutesFor` caps each tier under the preview cap and fails closed for unknown tiers; 4) add missing coverage.
- **DONE:** `bun test convex/lib/voicePolicy.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not raise a limit or lower a threshold to pass; do not remove the preview cap; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `TIER_LIVE_MINUTES = { none:0, basic:30, pro:90, max:180, god:180 }`; `VOICE_LIMITS.dailyMinutesPerUser = 15` preview cap that only lowers a tier; `dailyMinutesFor(tier)` = min(tier, 15), unknown tier → 0 (fail closed). `leaseMs`/`leaseExpired` count a stale lease only to last renewal + `renewEveryMs`, never past `maxSessionMs`. `localDateKey`/`utcDateKey` partition per-user vs global.
- **TESTS:** Given tier `pro` / When `dailyMinutesFor` / Then 15 (min of 90 and the 15 preview cap). Given tier `max` / When called / Then 15. Given an unknown tier / When called / Then 0. Given a lease past `maxSessionMs` / When `leaseMs` / Then it counts to `startedAt + maxSessionMs`. Given a stale lease / When `leaseExpired` / Then true.
- **NUMBERS:** 30/90/180 min per tier, 15 min preview cap, 20,000 TTS chars/day, 120 global min/day (HARD_RULES §9 + `voicePolicy.ts`).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** voice stage (Gen 1 vs later) — Amit (REWRITE-PLAN-v2 §4.1); this ticket assumes Gen 1.

### TFV2-0366 — Voice: `availability` + admission order verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** TRD §7 rule 3 (auth → entitlement → quota order); `convex/voice.ts` `availability`.
- **GOAL:** `voice.availability` returns the correct `{available, reason, minutesLeft}` for off/language/budget/resting/pending, in the admission order, and is unit-tested for each reason.
- **SCOPE:** `convex/voice.ts` (fix only) · test `convex/voice.test.ts`.
- **MUTATES:** none (read-only query).
- **STEPS:** 1) Graphify code-map of `availability`; 2) run `voice.test.ts`; 3) verify the admission order (approved → keys → language → minutes → sessions → global); 4) add missing coverage.
- **DONE:** `bun test convex/voice.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not reorder admission (A-1); do not weaken a gate; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Returns `{ available: boolean, reason: null|"off"|"language"|"budget"|"resting"|"pending", minutesLeft }`. `off` = a provider key missing; `language` = no lane for locale (Hebrew off until a Hebrew crisis list is approved); `budget` = own minutes/sessions spent; `resting` = global ceiling spent; `pending` = account not approved.
- **TESTS:** Given keys missing / When `availability` / Then reason `off`. Given Hebrew locale / When called / Then reason `language`. Given paid user with minutes left / When called / Then `available` true. Given unapproved user / When called / Then reason `pending`. Given global ceiling spent / When called / Then reason `resting`.
- **NUMBERS:** `minStartMs` 60,000 ms gate; `sessionsPerUserPerDay` 40 (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Hebrew crisis phrase list approval — Amit (voicePolicy `laneFor`); voice stage — Amit (REWRITE-PLAN-v2 §4.1).

### TFV2-0367 — Voice: lease lifecycle start/renew/stop verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** PRD F-30; TRD §5a; `convex/voice.ts` `start`/`renew`/`stop`.
- **GOAL:** The `voiceSessions` lease lifecycle is verified: one active lease per person, idempotent re-start on the same `clientKey`, heartbeat renewal, and idempotent stop.
- **SCOPE:** `convex/voice.ts` (fix only) · test `convex/voice.test.ts`.
- **MUTATES:** `voiceSessions` (via functions).
- **STEPS:** 1) Graphify code-map of `start`/`renew`/`stop`/`endLease`; 2) run `voice.test.ts`; 3) verify A-1…A-5; 4) add missing coverage.
- **DONE:** `bun test convex/voice.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store audio/transcript/token in a lease; do not weaken `endLease` counting; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `start({conversationId, clientKey})` ends an existing active lease (reason `replaced`) and returns `{sessionId, language, renewEveryMs, minutesLeft}`; same `clientKey` + live conversation + unexpired → same lease idempotently. `renew` returns `ok|revoked|exhausted|expired` and ends the lease accordingly. `stop` is idempotent. Errors: voice off, language, daily limit, global rest → calm `ConvexError` codes.
- **TESTS:** Given an active lease / When `start` with a new clientKey / Then the old lease ends `replaced` and a new one starts. Given the same clientKey / When `start` again / Then the same lease id returns. Given an expired lease / When `renew` / Then `expired` and the lease ends. Given `stop` twice / When run / Then idempotent (second no-op).
- **NUMBERS:** `renewEveryMs` 15,000; `leaseExpiresAfterMs` 45,000; `maxSessionMs` 15 min (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0368 — Voice: Deepgram STT token grant verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0367 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0367.
- **WHY:** PRD F-32/F-33; TRD §5a step 1 and §7 rule 2 (30-second token, key never leaves the server); `convex/voice.ts` `grant`/`admitGrant`/`releaseGrant`.
- **GOAL:** `voice.grant` is verified to mint a 30-second Deepgram token for a live lease, reserve/release the grant on failure, and never log the key or token.
- **SCOPE:** `convex/voice.ts` (fix only) · test `convex/voice.test.ts`.
- **MUTATES:** `voiceSessions.grants` (reserve/release only).
- **STEPS:** 1) Graphify code-map of `grant`/`admitGrant`/`mintDeepgramToken`; 2) run `voice.test.ts`; 3) verify grant-count cap and release-on-failure; 4) add missing coverage.
- **DONE:** `bun test convex/voice.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store or log the token; do not raise `grantsPerLease`; do not call the real provider in tests (stub `fetch`); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `grant({sessionId}) → { token, url }` (action; `requireApprovedForAi`; uses `DEEPGRAM_API_KEY`). `admitGrant` increments `grants` (cap `grantsPerLease` 3); `releaseGrant` decrements on a failed mint so failures don't consume the lease. Provider errors surface as `voice_connect` (nothing about the body).
- **TESTS:** Given a live lease / When `grant` runs against a stubbed Deepgram / Then a token + the server-chosen `url` return and `grants` increments. Given a stub that fails / When `grant` runs / Then `releaseGrant` runs and `grants` does not grow. Given 3 grants used / When a 4th is admitted / Then `voice_session_ended`. Given a stub returning an unusable token / When `grant` runs / Then `voice_connect`.
- **NUMBERS:** token TTL 30 s (`tokenTtlSeconds`), `grantsPerLease` 3 (repo constants / TRD §5a).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0369 — Voice: Chatterbox TTS `speak` + sentence admit/release verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0367 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0367.
- **WHY:** PRD F-32/F-33; TRD §5a step 4; `convex/voice.ts` `speak`/`admitSentence`/`releaseSentence`.
- **GOAL:** `voice.speak` is verified to resolve one sentence of a coach reply (never the crisis card), count read-aloud chars, synthesize audio, and release the sentence on failure.
- **SCOPE:** `convex/voice.ts` (fix only) · test `convex/voice.test.ts`.
- **MUTATES:** `voiceSessions.sentences`/`ttsChars` (admit/release only).
- **STEPS:** 1) Graphify code-map of `speak`/`admitSentence`/`synthesize`/`audioFrom`; 2) run `voice.test.ts`; 3) verify crisis-card exclusion and char cap; 4) add missing coverage.
- **DONE:** `bun test convex/voice.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store audio; do not read the crisis card aloud; do not raise `dailyTtsCharsPerUser`; do not call the real provider in tests; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `speak({sessionId, messageId, index}) → {status:"audio", audio, mime, count} | {status:"done"} | {status:"exhausted"}`. `admitSentence` resolves sentence `index` server-side from the assistant message (never client text), refuses the crisis card (`modelUsed === "crisis-card"`), enforces `dailyTtsCharsPerUser`, and counts before synthesis. `releaseSentence` gives back the chars on failure.
- **TESTS:** Given a coach reply / When `speak` index 0 against a stubbed TTS / Then audio returns and `ttsChars` increments. Given the crisis card / When `speak` runs / Then status `done` and no audio. Given char cap exceeded / When `admitSentence` / Then `exhausted`. Given a stub failure / When `speak` runs / Then `releaseSentence` restores the count.
- **NUMBERS:** `dailyTtsCharsPerUser` 20,000; `maxAudioBytes` 4 MB; `maxSentenceChars` 300 (repo constants).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0370 — Voice: `speechSentences` split + `ttsLanguage` verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** TRD §5a (sentence-at-a-time); `convex/lib/voicePolicy.ts` `speechSentences`/`ttsLanguage`.
- **GOAL:** `speechSentences` deterministically splits a markdown reply into speakable sentences (markdown marks dropped, long sentences cut under the limit), and `ttsLanguage` maps a lane to the Chatterbox language id.
- **SCOPE:** `convex/lib/voicePolicy.ts` (fix only) · test `convex/lib/voicePolicy.test.ts`.
- **MUTATES:** none (pure functions).
- **STEPS:** 1) Graphify code-map of `speechSentences`/`ttsLanguage`; 2) run the test; 3) verify determinism (same reply → same sentences) and markdown stripping; 4) add missing coverage.
- **DONE:** `bun test convex/lib/voicePolicy.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not change the sentence grammar; do not allow the crisis card into TTS (caller-level, but keep the split deterministic); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Split after `. ! ? … 。 ！ ？` and line breaks; strip code fences, inline code, images, links, heading/list marks; a sentence > `maxSentenceChars` (300) is cut at a comma/space. `ttsLanguage("en")→"en"`, `ttsLanguage("he")→"he"`.
- **TESTS:** Given `"Hi **there**.\nHow are you?"` / When `speechSentences` / Then two sentences, bold stripped. Given a 500-char sentence / When split / Then no piece exceeds 300 and no words are lost. Given the same input twice / When split / Then identical output. Given `ttsLanguage("he")` / When called / Then `"he"`.
- **NUMBERS:** `maxSentenceChars` 300 (repo constant).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0371 — Voice: Deepgram STT WebSocket client (browser)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0368 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0368.
- **WHY:** TRD §5a step 2; PRD F-32/F-33.
- **GOAL:** A browser client opens the Deepgram `/listen` WebSocket with the 30-second token, streams `MediaRecorder` mic audio, and emits interim + final transcripts plus end-of-turn.
- **SCOPE:** `apps/web/lib/voice-stt.ts` · test `apps/web/lib/voice-stt.test.ts`.
- **MUTATES:** none (client-side streaming; no storage).
- **STEPS:** 1) Graphify code-map of `apps/web/lib/voice-call.ts` and `apps/web/components/coach/voice/voiceSession.ts`; 2) implement (or verify) the socket open (token as `bearer` subprotocol), mic capture, and transcript events; 3) write the unit test with a fake WebSocket.
- **DONE:** `bun test apps/web/lib/voice-stt.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store or log audio or transcripts; do not embed a key; do not call the real provider in tests; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `openSttSocket({ url, token, onInterim, onFinal, onUtteranceEnd, onError })` returns a handle with `close()`. Audio is WebM/Opus (`MediaRecorder`); the socket sends binary frames. Interim transcripts feed `onInterim` (live transcript); final feed `onFinal`; `vad_events`/`utterance_end` drive `onUtteranceEnd` (end-of-turn and barge-in signal). Errors surface as `voice_connect` copy.
- **TESTS:** Given a fake WebSocket / When opened / Then the subprotocol carries the token and the URL is unchanged. Given a final transcript event / When received / Then `onFinal` fires with the text. Given an utterance-end event / When received / Then `onUtteranceEnd` fires. Given a socket error / When fired / Then `onError` fires.
- **NUMBERS:** token TTL 30 s (opens once, valid at connect) (TRD §5a).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0372 — Voice: Deepgram STT WebSocket client (native/Expo)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0368 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0368.
- **WHY:** TRD §5a step 2; PRD F-121/F-32/F-33.
- **GOAL:** The mobile voice-call screen can open the same Deepgram socket on Expo (RN WebSocket + `expo-av`/mic) and emit the same interim/final/utterance events.
- **SCOPE:** `apps/mobile/lib/v3/voice-stt.ts` · test `apps/mobile/lib/v3/__tests__/voice-stt.test.ts`.
- **MUTATES:** none (client streaming; no storage).
- **STEPS:** 1) Graphify code-map of `apps/mobile/app/(tempo)/voice-call.tsx`; 2) implement `openSttSocket` on RN WebSocket + mic capture; 3) write the unit test with a fake socket.
- **DONE:** `bun test apps/mobile/lib/v3/__tests__/voice-stt.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not record/persist audio; do not embed a key; do not call the real provider; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Same contract as TFV2-0371 (`openSttSocket({url, token, onInterim, onFinal, onUtteranceEnd, onError})`), RN-native: `WebSocket` from `react-native`, mic via `expo-av` (or the platform mic API), binary frames. Mic permission denied → `onError` with calm copy.
- **TESTS:** Given a fake RN socket / When opened / Then the subprotocol carries the token. Given mic permission denied / When opened / Then `onError` fires with the permission copy. Given a final event / When received / Then `onFinal` fires.
- **NUMBERS:** token TTL 30 s (TRD §5a).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0373 — Voice: TTS playback sentence queue
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0369 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0369.
- **WHY:** TRD §5a step 4 (speech starts before the whole reply); `VOICE_LIMITS.sentencesAhead` 2.
- **GOAL:** The client fetches sentences `K=2` ahead, plays them in order, and stops on an interrupt signal, without skipping or duplicating audio.
- **SCOPE:** `apps/web/lib/voice-tts.ts` · test `apps/web/lib/voice-tts.test.ts`.
- **MUTATES:** none (client playback only).
- **STEPS:** 1) Graphify code-map of the existing playback in `apps/web/components/coach/voice/`; 2) implement a queue that prefetches `sentencesAhead` and plays in order; 3) expose `stop()`; 4) write the test.
- **DONE:** `bun test apps/web/lib/voice-tts.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store audio beyond playback; do not call the real provider; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `TtsQueue({ speak })` with `enqueue(messageId, count)`, `play()`, `stop()`. Prefetch the next 2 sentences while the current plays; `stop()` cancels the current audio and the pending fetches. Emits `onDone` when `count` sentences have played or `done` is returned.
- **TESTS:** Given a reply of 3 sentences / When played / Then sentences play in index order with no duplicates. Given `stop()` / When called mid-playback / Then the current audio stops and no further sentence plays. Given `done` returned / When the queue drains / Then `onDone` fires.
- **NUMBERS:** `sentencesAhead` 2 (repo constant).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0374 — Voice: barge-in (interrupt playback on speech)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0373 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0373.
- **WHY:** TRD §5a step 5 (barge-in); PRD F-30.
- **GOAL:** When the user speaks mid-reply (Deepgram reports speech), the client stops TTS at once and starts the new turn.
- **SCOPE:** `apps/web/components/coach/voice/useVoiceCall.ts` (or the state hook) · test `apps/web/components/coach/voice/useVoiceCall.test.ts`.
- **MUTATES:** none (client behaviour).
- **STEPS:** 1) Graphify code-map of `useVoiceCall.ts`; 2) wire `onUtteranceStart` (speech detected) to `TtsQueue.stop()` + new turn; 3) write the test.
- **DONE:** `bun test apps/web/components/coach/voice/useVoiceCall.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not restart TTS until the new reply; do not record audio; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** On `speechDetected` while `playing`: stop audio immediately (≤ 250 ms), clear the transcript's live state, and start the user's turn. Interrupt button fires the same handler. Playback never resumes for the interrupted sentence.
- **TESTS:** Given playing audio / When speech is detected / Then `stop()` is called and the turn flips to user. Given an Interrupt press / When fired / Then the same stop+turn happens. Given no speech / When the reply ends / Then playback completes normally.
- **NUMBERS:** interrupt latency ≤ 250 ms (DESIGN.md §7 / TRD §5a ack < 0.2 s).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0375 — Voice: call client state machine + heartbeat renew
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0367, TFV2-0371 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0367 and TFV2-0371.
- **WHY:** TRD §5a; `convex/voice.ts` `renew` (heartbeat A-3).
- **GOAL:** The client call state machine (`idle → connecting → live → ending`) drives the UI and renews the lease every `renewEveryMs`, tearing down on `revoked|exhausted|expired`.
- **SCOPE:** `apps/web/components/coach/voice/useVoiceCall.ts` · test `apps/web/components/coach/voice/useVoiceCall.test.ts`.
- **MUTATES:** none (client state; calls `voice.start`/`renew`/`stop`).
- **STEPS:** 1) Graphify code-map of `useVoiceCall.ts`; 2) implement the state machine + heartbeat timer; 3) map each `renew` status to a teardown; 4) write the test.
- **DONE:** `bun test apps/web/components/coach/voice/useVoiceCall.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not start the heartbeat before `start` succeeds; do not continue after `revoked`/`exhausted`; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** States `idle | connecting | live | ending | error`. Transitions: mic press → `connecting`; `voice.start` ok → `live` + schedule `renew` every `renewEveryMs`; `renew` `ok` → keep `minutesLeft`; `revoked|exhausted|expired` → teardown to `ending` then `idle` with the calm reason; `stop` → `ending` → `idle`. Any `voice_*` error → `error` state with the copy.
- **TESTS:** Given `start` ok / When run / Then state `live` and a renew timer is scheduled. Given `renew` returns `exhausted` / When it fires / Then teardown to `idle`. Given `start` returns `voice_off` / When run / Then state `error` with the off copy. Given `stop` / When called / Then state `idle` and the timer clears.
- **NUMBERS:** `renewEveryMs` 15,000 (repo constant).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0376 — Voice: `VoiceCall` component (full-screen dialog)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0375 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0375.
- **WHY:** components.md §2.11 (VoiceCall `.tp-call[data-state][data-ended]`, `role="dialog" aria-modal="true"`, `.tp-call__state` `aria-live`); PRD F-30.
- **GOAL:** `VoiceCall` renders the full-screen call dialog (top/title, stage, state word, hint, transcript dock, docked controls) driven by the call state, with Esc pausing.
- **SCOPE:** `apps/web/components/coach/voice/VoiceCall.tsx` · test `apps/web/components/coach/voice/VoiceCall.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `VoiceCall.tsx`; 2) align structure/classes with components.md §2.11; 3) wire states (`idle/connecting/live/ending/error`) and `data-state`/`data-ended`; 4) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/VoiceCall.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not implement the child controls here (own tickets); do not call the backend; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Layout: `__top` (title), `__title` (`EN: Call with your coach / HE: שיחה עם המאמן שלך`), `__stage` (transcript/AudioLevel), `__state` (`aria-live`: `EN: Speaking / HE: מדבר`; `EN: Not connected / HE: לא מחובר`), `__hint` (`EN: Talk any time. You can cut in while the coach speaks. / HE: דבר בכל עת. אפשר לקטוע את המאמן בזמן שהוא מדבר.`), `__dock` (MicToggle, Interrupt, PushToTalk, EndCall). States: idle, connecting, live, ending, error, offline. `role="dialog" aria-modal="true"`; Esc pauses. RTL inline-start. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given state `live` / When rendered / Then `data-state="live"` and the live hint shows. Given `connecting` / When rendered / Then the state word shows connecting. Given Esc / When pressed / Then the call pauses (mic off). Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0377 — Voice: `AudioLevel` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (AudioLevel `.tp-level` > `.tp-level__bar` `--level`, `aria-hidden`, static under reduced motion).
- **GOAL:** `AudioLevel` renders the microphone level bars from `levels[]` with the current level via `--level`, static under reduced motion.
- **SCOPE:** `apps/web/components/coach/voice/AudioLevel.tsx` · test `apps/web/components/coach/voice/AudioLevel.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/AudioLevel.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `AudioLevel` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/AudioLevel.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not animate under `prefers-reduced-motion`; do not expose the level to a screen reader (`aria-hidden`); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `AudioLevel({ levels: number[] })`. Bars use `--tp-accent`; the active bar height reflects `--level` (0…1). `aria-hidden="true"`. Reduced motion → static max bars, no pulse. RTL: bars flow inline-start.
- **TESTS:** Given levels `[0.2,0.8]` / When rendered / Then the highest bar carries the larger level. Given reduced motion / When rendered / Then no animation class is applied. Given any render / When inspected / Then the element is `aria-hidden`.
- **NUMBERS:** motion ≤250 ms; static under reduced motion (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0378 — Voice: `LiveTranscript` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (LiveTranscript `ol.tp-call__transcript[aria-live=polite]`, `.tp-call-line[data-who][data-live]`); PRD F-30 (read-back).
- **GOAL:** `LiveTranscript` renders the rolling transcript (you / coach) with live lines marked and a ReadAloud action per coach line.
- **SCOPE:** `apps/web/components/coach/voice/LiveTranscript.tsx` · test `apps/web/components/coach/voice/LiveTranscript.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/LiveTranscript.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `LiveTranscript` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/LiveTranscript.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not store transcripts; do not mark user lines as live; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `LiveTranscript({ lines: { who:"user"|"coach", text, live? }[] })`. Rows `data-who`; `data-live` only on the streaming coach line. `ol` is `aria-live=polite`. Copy `EN: You / HE: אתה` and `EN: Coach / HE: מאמן`. RTL: text `dir="auto"` per line; who label inline-start. ReadAloud button per coach line (TFV2-0387).
- **TESTS:** Given two lines / When rendered / Then each shows with the right `data-who`. Given a live coach line / When rendered / Then only that line has `data-live`. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0379 — Voice: `MicToggle` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (MicToggle `.tp-call__mic[aria-pressed]`, "The one accent on the call screen").
- **GOAL:** `MicToggle` is the single accent mic button, `aria-pressed`, with the `call-mic` action.
- **SCOPE:** `apps/web/components/coach/voice/MicToggle.tsx` · test `apps/web/components/coach/voice/MicToggle.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/MicToggle.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `MicToggle` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/MicToggle.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not add a second accent element on the call screen; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `MicToggle({ pressed, onToggle })`. Accent `--tp-accent` when off (inviting), `--tp-danger` muted state. Copy: `EN: Mic on / HE: מיקרופון פועל` / `EN: Mic off / HE: מיקרופון כבוי`. `aria-pressed` reflects state; `call-mic` event. Target ≥ 24×24 CSS px. RTL: label inline-start.
- **TESTS:** Given `pressed=false` / When rendered / Then `aria-pressed=false` and the accent style applies. Given `pressed=true` / When rendered / Then the muted style and `Mic off` label show. Given a tap / When fired / Then `onToggle` runs.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8) · contrast 4.5:1 (WCAG 2.2 AA).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0380 — Voice: `Interrupt` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (Interrupt `.tp-btn--secondary[data-action=call-interrupt]`, hand icon, enabled only while the coach speaks).
- **GOAL:** `Interrupt` is a secondary button that fires `session.interrupt()`, disabled unless the coach is speaking.
- **SCOPE:** `apps/web/components/coach/voice/Interrupt.tsx` · test `apps/web/components/coach/voice/Interrupt.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/Interrupt.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `Interrupt` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/Interrupt.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not enable while the user speaks; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `Interrupt({ enabled, onInterrupt })`. Copy: `EN: Interrupt / HE: קטע`. Secondary style (`--tp-btn--secondary`), hand icon. Disabled state greyed. `data-action=call-interrupt` → `session.interrupt()`.
- **TESTS:** Given the coach speaking / When rendered / Then enabled. Given the user speaking / When rendered / Then disabled. Given a press / When fired / Then `onInterrupt` runs.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8) · contrast 4.5:1 (WCAG 2.2 AA).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0381 — Voice: `EndCall` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (EndCall `.tp-btn--danger[data-action=call-end]`, phone-off icon, word "End call").
- **GOAL:** `EndCall` is a danger button that ends the session (`voice.endSession`) then closes the call.
- **SCOPE:** `apps/web/components/coach/voice/EndCall.tsx` · test `apps/web/components/coach/voice/EndCall.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/EndCall.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `EndCall` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/EndCall.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not skip `voice.endSession` before `call-close`; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `EndCall({ onEnd })`. Copy: `EN: End call / HE: סיים שיחה`. Danger style `--tp-danger`. `data-action=call-end` → `voice.endSession`; then `call-close`.
- **TESTS:** Given a live call / When End call is pressed / Then `onEnd` fires once. Given `onEnd` / When pressed twice fast / Then it fires once (no double end). Run at 390 and 1280, EN and HE.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8) · contrast 4.5:1 (WCAG 2.2 AA).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0382 — Voice: `PushToTalk` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** PRD F-35 (walkie-talkie on every tier); components.md §2.11 (PushToTalk `button.tp-ptt[data-pressed]`, pointer hold or Space/Enter hold).
- **GOAL:** `PushToTalk` is a hold-to-talk button on every tier, active on pointer/Space/Enter hold, with `data-pressed`.
- **SCOPE:** `apps/web/components/coach/voice/PushToTalk.tsx` · test `apps/web/components/coach/voice/PushToTalk.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/PushToTalk.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `PushToTalk` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/PushToTalk.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not gate push-to-talk by tier (it is every tier); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `PushToTalk({ onPressStart, onPressEnd })`. Copy: `EN: Hold to talk / HE: החזק כדי לדבר`. Pointer down/Space/Enter keydown → `data-pressed` + `onPressStart`; up → `onPressEnd`. `aria-pressed`. RTL label inline-start.
- **TESTS:** Given a pointer hold / When held / Then `onPressStart` fires and `data-pressed` is set. Given release / When fired / Then `onPressEnd` fires. Given Space held / When keydown / Then `onPressStart` fires.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0383 — Voice: `CallMinutes` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** components.md §2.11 (CallMinutes `.tp-call__minutes[data-low]`, clock icon + "12 minutes left today"); PRD F-35.
- **GOAL:** `CallMinutes` shows the minutes left today from `voice.availability`/`renew`, with a low state when running low.
- **SCOPE:** `apps/web/components/coach/voice/CallMinutes.tsx` · test `apps/web/components/coach/voice/CallMinutes.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/CallMinutes.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `CallMinutes` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/CallMinutes.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not compute minutes client-side beyond what the server returns; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `CallMinutes({ minutesLeft })`. Copy: `EN: n minutes left today / HE: נותרו n דקות היום` (n LTR `tp-num`); low state `EN: running low / HE: אוזל` with `data-low` at ≤ 5 min. Clock icon.
- **TESTS:** Given `minutesLeft=12` / When rendered / Then "12 minutes left today" shows. Given `minutesLeft=3` / When rendered / Then `data-low` and "running low" show. Run at 390 and 1280, EN and HE.
- **NUMBERS:** low threshold ≤ 5 min (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0384 — Voice: `CallActionConfirm` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (CallActionConfirm `.tp-call-action[data-undone]`; "Added 'call the bank' to Today · Undo"); PRD F-22/F-131 (5-min Undo).
- **GOAL:** `CallActionConfirm` is an inline sonner confirming a spoken action with a 5-minute Undo.
- **SCOPE:** `apps/web/components/coach/voice/CallActionConfirm.tsx` · test `apps/web/components/coach/voice/CallActionConfirm.test.tsx`.
- **MUTATES:** `apps/web` UI only (Undo calls the existing restore mutation).
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/CallActionConfirm.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `CallActionConfirm` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/CallActionConfirm.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not hide the Undo before 5 min; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `CallActionConfirm({ text, onUndo })`. Copy: `EN: Added "<text>" to Today / HE: הוספתי את "<text>" להיום`; `EN: Undo / HE: בטל`. `data-undone` after Undo. Countdown 5:00.
- **TESTS:** Given a confirm / When rendered / Then the added copy and Undo show. Given Undo / When pressed / Then `onUndo` fires and `data-undone` is set. Run at 390 and 1280, EN and HE.
- **NUMBERS:** Undo window 5 min (PRD F-131).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0385 — Voice: `LanguageChip` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376.
- **WHY:** components.md §2.11 (LanguageChip `button.tp-lang-chip[data-lang][data-lang-current]`, each name in its own `lang`); PRD F-73.
- **GOAL:** `LanguageChip` toggles the call language (en/he) with each name in its own `lang`, calling `voice.setLanguage`.
- **SCOPE:** `apps/web/components/coach/voice/LanguageChip.tsx` · test `apps/web/components/coach/voice/LanguageChip.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/LanguageChip.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `LanguageChip` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/LanguageChip.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not switch the app-wide locale here (call language only); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `LanguageChip({ lang, onSet })`. Options `English` (`lang="en"`) / `עברית` (`lang="he"`), each name in its own `lang`. `data-lang-current` on the active. `call-lang` → `voice.setLanguage`.
- **TESTS:** Given `lang="en"` / When rendered / Then "English" shows with `data-lang-current`. Given `lang="he"` / When rendered / Then "עברית" shows. Given a tap / When fired / Then `onSet` runs. Run at 390 and 1280, EN and HE.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Hebrew lane gated on a Hebrew crisis list — Amit (voicePolicy `laneFor`).

### TFV2-0386 — Voice: calm error copy EN/HE + offline state
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** `convex/voice.ts` `VOICE_ERRORS`; PRD F-70/F-71; components.md §2.18 (StateOffline).
- **GOAL:** Every `voice_*` machine code maps to calm EN/HE copy, and the call screen shows the offline state without clearing content.
- **SCOPE:** `apps/web/lib/voice-strings.ts` · `apps/web/messages/en.json` · `apps/web/messages/he.json` (or the existing message dictionaries) · test `apps/web/lib/voice-strings.test.ts`.
- **MUTATES:** `apps/web` strings only.
- **STEPS:** 1) Graphify code-map of the message dictionaries and `VOICE_ERRORS`; 2) map each code to EN/HE; 3) add the offline string; 4) write the test.
- **DONE:** `bun test apps/web/lib/voice-strings.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not change a code's meaning; do not drop the English fallback; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Pairs `EN / HE`: voice_off `Voice isn't switched on yet. Typing works as always. / הקול עדיין לא מופעל. ההקלדה עובדת כרגיל.`; voice_language `Voice in this language isn't ready yet. Typing works as always. / הקול בשפה הזו עדיין לא מוכן. ההקלדה עובדת כרגיל.`; voice_daily_limit `That's today's voice time. Typing works as always. / נגמר זמן הקול להיום. ההקלדה עובדת כרגיל.`; voice_resting `Voice is resting for today. Typing works as always. / הקול נח היום. ההקלדה עובדת כרגיל.`; voice_session_ended `This voice session has ended. Start it again when you like. / השיחה הקולית הסתיימה. אפשר להתחיל שוב מתי שתרצה.`; voice_connect `Voice couldn't connect just now. Try again in a moment. / לא הצלחנו להתחבר עכשיו. נסה שוב עוד רגע.`. Offline: `EN: You're offline. Changes save when you're back. / HE: אין חיבור. השינויים נשמרים כשתחזור.`
- **TESTS:** Given code `voice_off` / When resolved in `he` / Then the Hebrew copy returns. Given a missing key / When resolved / Then English returns. Given every `VOICE_ERRORS` key / When resolved / Then a non-empty EN and HE string exists.
- **NUMBERS:** 100% of `VOICE_ERRORS` codes covered in both languages (internal).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0387 — Voice: `ReadAloudButton` component
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0369 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0369.
- **WHY:** components.md §2.10 (ReadAloudButton `read-aloud` → `voice.speak({text,lang})`); PRD F-36 (audio recap).
- **GOAL:** `ReadAloudButton` reads a coach/text reply aloud via `voice.speak`, `aria-pressed`, and toggles on/off.
- **SCOPE:** `apps/web/components/coach/voice/ReadAloudButton.tsx` · test `apps/web/components/coach/voice/ReadAloudButton.test.tsx`.
- **MUTATES:** `apps/web` UI only.
- **STEPS:** 1) Graphify code-map of `apps/web/components/coach/voice/ReadAloudButton.tsx` (the unit may already exist inside the call screen — then verify/extract); 2) implement `ReadAloudButton` per the SPEC; 3) write the render test.
- **DONE:** `bun test apps/web/components/coach/voice/ReadAloudButton.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not read the crisis card; do not read arbitrary client text as coach (server resolves sentences); do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `ReadAloudButton({ messageId, lang })`. Copy: `EN: Read aloud / HE: הקרא בקול`; active `EN: Stop / HE: עצור`. `aria-pressed` reflects. Calls the TTS queue, never reads the crisis card.
- **TESTS:** Given an idle button / When rendered / Then "Read aloud" shows. Given a press / When fired / Then `aria-pressed` true and "Stop" shows. Given the crisis card id / When rendered / Then the button is hidden/disabled.
- **NUMBERS:** target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0388 — Voice: web `/coach` voice in/out integration (fold-in #746)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0376, TFV2-0387 · **Folds-in:** #746
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0376 and TFV2-0387.
- **WHY:** PRD F-30/F-31; issue #746 (`/coach` voice in/out); `apps/web/components/coach/CoachPanel.tsx`, `CoachChat.tsx`.
- **GOAL:** The web `/coach` panel offers a mic entry that starts the live `VoiceCall` (STT in, TTS out, barge-in), with the mic gated by `voice.availability`, and ReadAloud on text replies.
- **SCOPE:** `apps/web/components/coach/CoachPanel.tsx` · `apps/web/components/coach/CoachChat.tsx` · test `apps/web/components/coach/CoachPanel.test.tsx`.
- **MUTATES:** `apps/web` UI only (wires existing voice modules).
- **STEPS:** 1) Graphify code-map of `CoachPanel.tsx`/`CoachChat.tsx` and the existing `components/coach/voice/`; 2) add the mic entry (disabled + reason when unavailable); 3) mount `VoiceCall` on start; 4) add ReadAloud to text replies; 5) write the render test.
- **DONE:** `bun test apps/web/components/coach/CoachPanel.test.tsx` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not bypass the availability gate; do not implement the voice pipeline (own tickets); do not call a paid provider; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Mic entry (MicToggle) in the coach composer; disabled with the `availability` reason when not available; on start mounts the full-screen `VoiceCall`. Text replies get a `ReadAloudButton`. Copy reuses TFV2-0386. States: default, voice-off, voice-language, voice-budget, live.
- **TESTS:** Given availability `off` / When rendered / Then the mic is disabled with the off copy. Given available / When the mic is pressed / Then `VoiceCall` mounts. Given a text reply / When rendered / Then a ReadAloud button is present. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** voice stage (Gen 1 vs later) — Amit (REWRITE-PLAN-v2 §4.1); this ticket assumes Gen 1.

### TFV2-0389 — Voice: mobile voice-call live wiring
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0388, TFV2-0376 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `mobile`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0388 and TFV2-0376.
- **WHY:** PRD F-30/F-121; `docs/design/v3/screens/mobile/voice-call.html`; replaces the placeholder from TFV2-0325.
- **GOAL:** `apps/mobile/app/(tempo)/voice-call.tsx` replaces the "Not connected" placeholder with the live call (native STT, TTS queue, barge-in, minutes, language chip), gated by `voice.availability`.
- **SCOPE:** `apps/mobile/app/(tempo)/voice-call.tsx` · `apps/mobile/lib/v3/voice-stt.ts` (reuse) · test `tests/e2e/mobile-voice-call.spec.ts`.
- **MUTATES:** `apps/mobile` UI only (wires existing voice modules).
- **STEPS:** 1) Graphify code-map of `voice-call.tsx`; 2) wire the state machine + STT socket + TTS queue + barge-in; 3) keep the not-connected fallback when unavailable; 4) update the Playwright click-through.
- **DONE:** `bunx playwright test tests/e2e/mobile-voice-call.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not add a provider/key; do not record audio; do not enable the mic when availability is off; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy reuses TFV2-0325 + TFV2-0386. States: not-connected (unavailable), connecting, live (AudioLevel + LiveTranscript), ending, error, offline. Mic accent `--tp-accent`; end-call `--tp-danger`. RTL inline-start; digits LTR. Breakpoints 390/768/1024/1280. Motion ≤250 ms.
- **TESTS:** Given availability off / When rendered / Then "Not connected" and disabled controls. Given available + a mocked socket / When mic pressed / Then the live state (AudioLevel + transcript) shows. Given End call / When pressed / Then returns to Coach. Run at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA) · target ≥24×24 CSS px (WCAG 2.5.8) · motion ≤250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** voice stage (Gen 1 vs later) — Amit (REWRITE-PLAN-v2 §4.1); this ticket assumes Gen 1.

### TFV2-0390 — Voice: call preferences (language + push-to-talk default)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** PRD F-35/F-73; `convex/preferences.ts` (userPreferences).
- **GOAL:** `convex/preferences.ts` (or `voice.ts`) persists per-user voice prefs (preferred call language, push-to-talk default) and they are read on session start.
- **SCOPE:** `convex/preferences.ts` · test `convex/preferences.test.ts`.
- **MUTATES:** `userPreferences` (additive fields only).
- **STEPS:** 1) Graphify code-map of `preferences.ts`; 2) add `voiceLanguage`/`voicePushToTalk` upsert; 3) read them in `voice.start` (language is still server-decided from locale/lane); 4) write the test.
- **DONE:** `bun test convex/preferences.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not let the client override the server-chosen lane/model; do not edit `convex/schema.ts` unless the fields already exist (else mark UNKNOWN and stop); do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `setVoicePrefs({ voicePushToTalk?: boolean, voiceLanguage?: "en"|"he" })` and `getVoicePrefs()`. Push-to-talk default false (live conversation) or true (walkie-talkie) — persisted. Errors: none beyond requireUser.
- **TESTS:** Given a set / When `getVoicePrefs` / Then the saved values return. Given `voicePushToTalk:true` / When a session starts / Then the client starts in push-to-talk mode. Given an unknown field / When set / Then it is ignored.
- **NUMBERS:** no industry number applies → `UNKNOWN` (none needed).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether the prefs columns already exist in `userPreferences` — verify; if not, Amit (schema change).

### TFV2-0391 — Voice: minutes usage + reset-at-midnight verify
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0365.
- **WHY:** PRD F-35; `.cursorrules` (daily caps reset at local midnight); `convex/lib/voicePolicy.ts` `localDateKey`.
- **GOAL:** Daily minutes are counted per the user's local midnight (not UTC) and reset when the local date rolls over.
- **SCOPE:** `convex/lib/voicePolicy.ts` (fix only) · test `convex/lib/voicePolicy.test.ts`.
- **MUTATES:** none (pure date-key logic).
- **STEPS:** 1) Graphify code-map of `localDateKey`/`utcDateKey`; 2) verify a local-midnight boundary changes `dateKey`; 3) add missing coverage.
- **DONE:** `bun test convex/lib/voicePolicy.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not switch the cap to UTC; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `localDateKey(now, timeZone)` returns `YYYY-MM-DD` in the user's zone (UTC fallback on unknown). Minutes sum per `dateKey`, so a new local day resets the personal cap; the global ceiling stays on `utcDateKey`.
- **TESTS:** Given `now` just before local midnight in `Asia/Jerusalem` / When `localDateKey` / Then one date; given just after / Then the next date. Given an unknown zone / When `localDateKey` / Then UTC date. Given two leases across midnight / When summed / Then they fall in different date keys.
- **NUMBERS:** daily reset at local midnight (`.cursorrules` / HARD_RULES §9).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0392 — Voice: crisis-safety integration (transcript → fixed card)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0371 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0371.
- **WHY:** PRD F-24; TRD §7 rule 7; `convex/lib/crisisWords.ts`; `convex/voice.ts` (crisis card never spoken, L-12).
- **GOAL:** A spoken crisis turn is verified to route to the fixed crisis card with no model call and no TTS, exactly as the text path.
- **SCOPE:** `convex/voice.ts` (fix only) · `convex/messages.ts` (fix only if the send path is there) · test `convex/voice.test.ts`.
- **MUTATES:** none (verification of the transcript send path).
- **STEPS:** 1) Graphify code-map of how the final transcript reaches the coach send and `isCrisisText`; 2) verify the transcript passes through the same crisis guard as typed text; 3) verify the crisis card is never read aloud; 4) add missing coverage.
- **DONE:** `bun test convex/voice.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not let crisis text reach a model; do not read the crisis card aloud; do not change the crisis card copy; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The final transcript goes through the ordinary coach send (same as typed text), so `isCrisisText` short-circuits to `crisisCardText(CRISIS_CARD)` with no model call. `admitSentence` already returns `done` for `modelUsed === "crisis-card"`, so no TTS. Hebrew crisis phrases remain gated (English list only) → UNKNOWN/Amit.
- **TESTS:** Given a crisis transcript / When the turn runs / Then the fixed card returns and no model call is made. Given a crisis reply / When TTS is requested / Then `done`, no audio. Given a normal transcript / When run / Then the normal coach path runs.
- **NUMBERS:** crisis card is fixed content, never model-written (TRD §7 rule 7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Hebrew crisis phrase list — Amit (REWRITE-PLAN-v2 §4.1 / voicePolicy).

### TFV2-0393 — Voice: proposal/Undo path for spoken actions
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0384 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0384.
- **WHY:** PRD F-31/F-22/F-131; HARD_RULES §6.2 (every mutation a proposal with Undo).
- **GOAL:** Every spoken coach action surfaces as a `CallActionConfirm` with a 5-minute Undo, never auto-applied, verified end-to-end.
- **SCOPE:** `apps/web/components/coach/voice/useVoiceCall.ts` (fix only) · test `apps/web/components/coach/voice/useVoiceCall.test.ts`.
- **MUTATES:** none (client presentation of existing proposals).
- **STEPS:** 1) Graphify code-map of how voice turns surface proposals (the same Accept/Reject as text); 2) verify each proposal renders as `CallActionConfirm`; 3) verify Undo fires the restore; 4) write the test.
- **DONE:** `bun test apps/web/components/coach/voice/useVoiceCall.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not auto-apply any voice action; do not shorten the Undo window; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Voice has no action path of its own (L-16); the final transcript goes through the normal coach send, so every change is still a proposal. Each accepted proposal shows `CallActionConfirm` with the Undo toast (5:00).
- **TESTS:** Given a spoken "add a task" / When the coach proposes / Then a CallActionConfirm shows, not an auto-apply. Given Undo / When pressed / Then the restore runs and `data-undone` is set. Given a rejected proposal / When surfaced / Then no confirm shows.
- **NUMBERS:** Undo window 5 min (PRD F-131).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0394 — Voice: end-to-end smoke (Playwright, mocked providers)
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0388, TFV2-0389 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0388 and TFV2-0389.
- **WHY:** PRD F-30; AGENTS.md (E2E smoke); the voice path end-to-end.
- **GOAL:** A Playwright smoke clicks the coach mic → live call → transcript → end call, with Deepgram/Chatterbox mocked, asserting every state.
- **SCOPE:** `tests/e2e/voice-smoke.spec.ts` · (fixture) `tests/e2e/fixtures/voice-mock.ts`.
- **MUTATES:** none (test only; mocks providers).
- **STEPS:** 1) Graphify code-map; 2) mock `fetch`/WebSocket for Deepgram and the TTS; 3) write the click-through: open coach, press mic, assert live state, end call; 4) run.
- **DONE:** `bunx playwright test tests/e2e/voice-smoke.spec.ts` → all pass.
- **EVIDENCE:** Playwright output.
- **DO NOT:** do not use real keys/providers; do not set `PLAYWRIGHT_BASE_URL`; do not weaken an assertion; do not touch `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Covers the states from TFV2-0375/0388: idle → connecting → live (AudioLevel + LiveTranscript) → end → idle; and the unavailable path (mic disabled with reason). EN and HE, 390 and 1280.
- **TESTS:** Given mocked providers / When the mic is pressed / Then the call reaches `live` with a transcript line. Given End call / When pressed / Then back to `idle` with the mic available again. Given availability off / When rendered / Then the mic is disabled with the reason.
- **NUMBERS:** smoke asserts every state (internal completeness); no latency number without measurement → `UNKNOWN`.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0395 — Voice: Hebrew lane (Nova-3) + RTL verification
- **Stage:** E · **Pass:** 1 · **Depends:** TFV2-0371, TFV2-0365 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `backend`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0371 and TFV2-0365.
- **WHY:** PRD F-33 (Hebrew Nova-3 → Chatterbox multilingual), F-71/F-72; TRD §5a; `convex/lib/voicePolicy.ts` `LANES.he`.
- **GOAL:** The Hebrew lane is verified (Nova-3 `he` socket URL, Chatterbox `he` TTS) and gated off until a Hebrew crisis phrase list is approved, with RTL verified in the call UI.
- **SCOPE:** `convex/lib/voicePolicy.ts` (fix only) · `apps/web/components/coach/voice/VoiceCall.tsx` (RTL) · test `convex/lib/voicePolicy.test.ts`.
- **MUTATES:** none (lane gating + RTL).
- **STEPS:** 1) Graphify code-map of `LANES.he`/`laneFor`; 2) verify the `he` lane returns the Nova-3 `he` URL only when the Hebrew crisis list is approved; 3) verify call UI RTL; 4) write the test.
- **DONE:** `bun test convex/lib/voicePolicy.test.ts` → all pass.
- **EVIDENCE:** test output.
- **DO NOT:** do not enable `he` before the Hebrew crisis list is approved; do not hard-code a Hebrew model choice beyond the lane; do not touch `convex/schema.ts`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `LANES.he = { language:"he", url:"wss://api.deepgram.com/v1/listen?model=nova-3&language=he&interim_results=true&smart_format=true&endpointing=500&utterance_end_ms=1500&vad_events=true" }`. `laneFor("he")` returns `null` until the Hebrew crisis phrase list is approved (today's list is English-only). RTL: transcript lines `dir="auto"`, controls inline-start.
- **TESTS:** Given locale `he` and no approved Hebrew crisis list / When `laneFor` / Then null (voice off for Hebrew). Given `en` / When `laneFor` / Then the Flux en lane. Given an approved Hebrew list (flag) / When `laneFor("he")` / Then the Nova-3 he lane.
- **NUMBERS:** Deepgram Nova-3 `he` model (PRD F-33, known fact) · Hebrew crisis list approval → `UNKNOWN` (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** Hebrew crisis phrase list approval — Amit (REWRITE-PLAN-v2 §4.1); voice stage — Amit.

### TFV2-0396 — Voice: latency + performance budget
- **Stage:** E · **Pass:** 2 · **Depends:** TFV2-0394 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); area `web`, lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0394.
- **WHY:** TRD §5a step 6 (ack < 0.2 s, response ≈ 1 s); TICKET-STANDARD NUMBERS rule.
- **GOAL:** The voice path is instrumented with measured acknowledgment and first-audio/first-text latency, reported honestly (measured or UNKNOWN), without inventing numbers.
- **SCOPE:** `apps/web/lib/voice-perf.ts` · test `apps/web/lib/voice-perf.test.ts`.
- **MUTATES:** none (measurement only).
- **STEPS:** 1) Graphify code-map; 2) instrument timers for acknowledge (mic→socket open) and first-text (→ first transcript) and first-audio (→ first sentence playback); 3) expose them for CI/logging without storing audio; 4) write the test.
- **DONE:** `bun test apps/web/lib/voice-perf.test.ts` → all pass.
- **EVIDENCE:** test output + a measured sample if available, else the `UNKNOWN` record.
- **DO NOT:** do not invent a latency value; do not block on a provider to measure; do not store audio; do not touch `convex/`, `.env`, workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recordLatency(kind, ms)` for `ack`, `first_text`, `first_audio`; a `summary()` returning the last values or null. No threshold is asserted until measured; the TRD budget (ack < 0.2 s, response ≈ 1 s) is the target to check against.
- **TESTS:** Given a recorded `ack` of 150 ms / When summarized / Then it reports 150. Given no measurement / When summarized / Then null (never a fabricated number). Given a recorded `first_audio` / When summarized / Then the value is a finite ms.
- **NUMBERS:** ack < 0.2 s, response ≈ 1 s (TRD §5a step 6, target) · first-audio latency `UNKNOWN` until measured (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** first-audio latency — Amit (TRD §5a: "first-audio latency is UNKNOWN until measured"); voice stage — Amit (REWRITE-PLAN-v2 §4.1).

