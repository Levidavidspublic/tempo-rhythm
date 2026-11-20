# Anti-slop delivery gate — Tempo v3

Build Package C11-delivery, 12 Oct 2026.

This report records what the design **intends**. Nothing listed here was rendered, opened or checked in a browser by this package. Every checklist line is authored intent, not a verified result.

## 1. Owner direction followed (R-37)

The owner's brief wins on look and feel (DESIGN.md "Precedence"). The PRD, APP-FLOW, UI-BRIEF and HARD_RULES win on features, data, copy rules and accessibility. Where the owner's direction replaces an anti-slop default, it is listed below as an override, not hidden.

- Direction: warm editorial calm. Parchment grounds, near-black ink, serif page titles, generous space.
- Craft-style pages: page tree, centred paper page, block handles, slash menu, inline Tempo blocks, "Linked here".
- Claude.ai-style coach beside the page: proposals with Accept, Edit and Reject, and a 5-minute Undo.
- Live voice as feature number one, on web and mobile.
- English and Hebrew, LTR and RTL, from the same markup.

## 2. Owner overrides (recorded on purpose)

From DESIGN.md §12.

1. **Glass on floating chrome.** Anti-slop caps glass at one or two elements. The owner asked for glass on the top bar, command palette, slash menu, coach button and panel, sheets, toasts, popovers and the mobile tab bar. Each has a solid fallback (`?glass=off`, reduced transparency, no `backdrop-filter` support).
2. **Parchment ground.** The anti-cliché default bans warm beige grounds. The owner chose them for calm. Contrast is computed in DESIGN.md §6.
3. **Source Sans 3 body face.** HARD_RULES §7.2 says Inter. The owner asked for a humanist sans. Hebrew uses Assistant.
4. **Accent change.** `#D97757` → `#A3461F` (light) / `#EE9468` (dark). The old value matched Claude.ai's accent.
5. **R-30: patterns only.** Claude.ai and Craft supply layout patterns. No logos, wording or exact colours are copied (`references/mobbin-refs.md`).

## 3. Banned-pattern checklist (authored intent, not verified)

| Pattern | Intent in this design |
|---|---|
| Gradient hero, purple / blue AI gradient | Not used. Flat parchment and paper surfaces. |
| Glass everywhere | Glass only on floating chrome (override 1). Content surfaces are solid. |
| More than one accent action per screen | One `.tp-btn--primary` per screen at most; the accent also marks the focus ring. |
| Large tinted accent areas | Accent never fills a large area; `--tp-accent-wash` only on small selected chips. |
| Emoji as UI, emoji in nags | No emoji. Icons are one line set with words beside them. |
| Invented metrics, fake logos, testimonials | Marketing pages state no invented numbers or customer logos. |
| "Sample data" labels, JSON, ids, developer words in UI | Not shown. JSON blocks draw as elements. |
| Shaming copy ("failed", "overdue", "streak lost", "must") | Not used. Empty states are kind and offer a next step. |
| Streak counters as pressure | Habits show days, not streaks. |
| Stock nag copy | Nags are the user's own words or derived from them (F-60). |
| Colour alone carries meaning | A word always sits with colour (chips, states). |
| Text under 13 px | Minimum text size 13 px. |
| Motion over 250 ms, layout-property animation | 250 ms or less, transform and opacity only; reduced motion honoured. |
| Physical left / right CSS | Logical properties; explicit `[dir="rtl"]` rules only where a transform is physical. |
| "User" as a name, real people | Fictional people only (Maya Ronen, Dana, Yoni). |
| Hidden prices | Prices always visible (F-110). |
| Model-written crisis copy | Crisis card text is fixed and human-written (F-24). |

## 4. Gates

- Owner direction recorded: yes (sections 1 and 2).
- Overrides listed, not hidden: yes (section 2).
- Banned patterns: authored intent only (section 3).
- Run it and click everything: partly run, rendered, on 13 Oct 2026 (section 6). Signed-in screens with real data are still unchecked.

## 5. Known open items carried to review

See README "Open notes": Hebrew copy needs native review; crisis services (ERAN 1201, SAHAR, MDA 101) must be verified; Convex names are proposals; tier differences beyond voice minutes are unconfirmed; footer legal links point to `#`; kanban moves have no Undo toast; calendar month / week arrows are display-only; some mobile note rows have no target screen.

## 6. Rendered check (v3 run 2, 13 Oct 2026, design polish PR)

This section was rendered and measured, not authored. Local `next dev` with the E2E auth bypass and a placeholder Convex URL, so screens that need data show their loading, empty or browser-storage states. Playwright on Chromium 1194. Routes: `/sign-in`, `/calendar`, `/tasks`, `/notes`, `/templates`, `/coach`, `/today`, `/search`. Each route ran at 390 and 1280 px, light and dark, English and Hebrew: 64 renders before the polish (`integration`) and 64 after.

| Build | Renders | Horizontal scroll | Smallest text | Most primary buttons | Gradients* | Longest motion | Page errors | Ground grain |
|---|---|---|---|---|---|---|---|---|
| before | 64 | 0 | 13 px | 1 | 0 | 240 ms | 0 | 0/64 |
| after | 64 | 0 | 13 px | 1 | 0 | 240 ms | 0 | 64/64 |

\* Visible elements with a CSS gradient, not counting the design's own skeleton shimmer and page-cover ruling.

Fallbacks, after the polish:
- Reduced motion: the longest animation or transition is 0.01 ms.
- `?glass=off` and `prefers-reduced-transparency: reduce`: every `.tp-glass` surface has `backdrop-filter: none` and the solid `--tp-glass-solid` ground. `?glass=off` was not wired in the app before; the polish PR adds it to the pre-hydration script.
- Forced colours and `prefers-contrast: more`: no grain.

Contrast. The colour tokens are unchanged, so every pair in DESIGN.md §6 keeps its number. The grain only moves the ground away from the text, measured on a plain ground strip:
- Light: every pixel is at or above `--tp-ground`, at most +7 levels.
- Dark: every pixel is at or below it, at most −4 levels.
- Variation is about 0.6 levels.

So no pair on the ground drops below its §6 number.

Headings after the polish: page titles render at 42 px / 560 at 1280 and 32 px at 390. Section titles render at 26 px / 560.

Banned patterns (section 3), checked on these renders: no gradient hero, glass only on floating chrome, one primary action at most, no emoji in UI, no text under 13 px, motion at or under 250 ms. Not checked here: copy rules, prices, and every signed-in screen with real data.

