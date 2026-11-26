# Tempo v3 — Design system

Stage 1 · direction for owner approval · 12 Oct 2026

Tempo is an ADHD-friendly planner. Every page is a Markdown document, and Tempo blocks render inside it as quiet cards. This file is the single reference for the look. `tokens.css` holds every value, `tempo.css` holds every shared component, and `tempo.js` holds shared behaviour. Screens add layout only.

**Precedence.** The owner's brief wins on look and feel. `PRD.md`, `APP-FLOW.md`, `UI-BRIEF.md` and `HARD_RULES.md` win on features, data, copy rules and accessibility. Departures from the docs are listed in §12 "Owner overrides".

---

## 1. Direction in one line

The direction is warm editorial calm: parchment grounds, near-black ink, serif page titles and generous space. Pages work the way they do in Craft: a page tree, a centred paper page, block handles, a slash menu, inline Tempo blocks and "Linked here". Liquid glass appears only on floating chrome. Orange appears only on the single primary action and the focus ring.

## 2. Colour tokens

All values live in `tokens.css` as `--tp-*`. Dark mode is chosen independently, not inverted.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--tp-ground` | page ground (parchment) | `#F3EEE4` | `#161412` |
| `--tp-paper` | the paper page, cards, popovers | `#FBF9F4` | `#201D1A` |
| `--tp-sunken` | rail, wells, segmented track | `#EAE3D6` | `#110F0D` |
| `--tp-hover` | row hover / selected wash | `#EDE6DA` | `#2A2622` |
| `--tp-ink` | primary text | `#1B1916` | `#F2ECE2` |
| `--tp-ink-muted` | secondary text | `#57514A` | `#B5AC9F` |
| `--tp-ink-subtle` | tertiary text, never below 13 px | `#6B645C` | `#9E9588` |
| `--tp-line` | hairlines, dividers | `#D9D0C1` | `#38332D` |
| `--tp-line-strong` | card edges (decorative) | `#B9AE9C` | `#5C554C` |
| `--tp-line-control` | checkbox, input and button outlines | `#877C6B` | `#7F7669` |
| `--tp-accent` | **one** primary action per screen, focus ring | `#A3461F` | `#EE9468` |
| `--tp-on-accent` | label on the accent | `#FFFFFF` | `#1B1916` |
| `--tp-accent-wash` | selected chip ground (small only) | `#F3E2D6` | `#3A2A20` |
| `--tp-done` / `-wash` | done, added | `#3B6948` / `#E3EBDF` | `#8FC09C` / `#1F2D23` |
| `--tp-info` / `-wash` | fixed time, moved | `#36628C` / `#E0E7EE` | `#94B8DA` / `#1C2632` |
| `--tp-caution` / `-wash` | flexible time | `#7E5A0C` / `#F1E6CC` | `#DDB45E` / `#30281A` |
| `--tp-danger` / `-wash` | destructive, removed | `#9E3B27` / `#F3DFD7` | `#EE9A86` / `#35211C` |
| `--tp-glass` | floating chrome surface | `rgba(251,249,244,.82)` | `rgba(36,33,29,.86)` |
| `--tp-glass-solid` | glass fallback | `#FBF9F4` | `#24211D` |

**Accent.** The accent moves off `#D97757`. That was Tempo's old orange, and it is the exact Claude.ai accent, which R-30 forbids copying. `#A3461F` is deeper and distinct, and white text on it reaches 6.08:1. The accent never fills a large area: no tinted sections, no orange headers, no gradients.

**Colour is never the only signal.** Every semantic colour comes with a word or an icon: "Fixed" / "Flexible" chips, "Add" / "Move" signs, a check mark on done.

## 3. Type

| Role | Latin | Hebrew | Why |
|---|---|---|---|
| Page titles, headings | **Newsreader** (opsz 6–72) | **Frank Ruhl Libre** | Newsreader is Tempo's current serif, kept as the brief asked. Frank Ruhl Libre is the classic Hebrew book face, also high-contrast and calm, so a Hebrew title sits at the same editorial weight as an English one. |
| UI and body | **Source Sans 3** | **Assistant** | Source Sans 3 is humanist: open apertures and clear letter shapes, kinder for dyslexic readers than geometric Inter. Assistant is Source Sans extended to Hebrew, so both scripts share x-height, stroke weight and rhythm, and mixed paragraphs don't jump. |
| Times, numbers, code | **IBM Plex Mono** | (same) | Tabular figures keep times aligned. Always rendered left-to-right. |
| Dyslexia mode | **OpenDyslexic** (bundled in `fonts/`, SIL OFL) → **Atkinson Hyperlegible** fallback | Assistant + extra spacing | See §11. |

All fonts are open. Everything except OpenDyslexic loads from Google Fonts. OpenDyslexic is not on Google Fonts, so it ships as a local file with its licence.

**Scale** (base 17 px, minimum 13 px):

| Token | px | Use |
|---|---|---|
| `--tp-text-xs` | 13 | captions, chip labels (the floor) |
| `--tp-text-sm` | 15 | meta, buttons, rail |
| `--tp-text-md` | 17 | body |
| `--tp-text-lg` | 20 | coach title, h3 |
| `--tp-text-xl` | 26 | h2 sections |
| `--tp-text-2xl` | 32 | Next up title, mobile page title |
| `--tp-text-3xl` | 42 | page title |
| `--tp-text-4xl` | 48 | marketing display |

Page and section titles use weight 560 with tighter tracking (−0.02em / −0.01em; Hebrew keeps 0). Run 2 polish raised xl / 2xl / 3xl from 24 / 30 / 38 for a firmer heading scale. Body line height is 1.6, snug is 1.35, headings 1.18. Text width is at most `68ch` (`--tp-measure`). The user's S / M / L text-size setting (`data-text-size`) moves the base to 15 / 17 / 20 px.

## 4. Spacing, radius, elevation

- **Spacing:** a 4 px scale. `--tp-space-1…20` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Nothing off-scale.
- **Radius:** 6 (controls, rows), 10 (buttons, inputs), 14 (cards, popovers), 20 (paper page, sheets), pill (tags, coach button).
- **Elevation** (run 2 polish: clearer depth between ground, paper and cards):
  - `whisper` is used for the selected segment and a secondary button's hover.
  - `paper` is a 1 px ring plus a long soft drop, used for the paper page and surfaces: the paper sits above the ground.
  - `card` is a ring plus a short drop, for nested surfaces.
  - `raise` is a short drop under a card's own hairline (`--tp-line-card`), for cards on the paper (Tempo blocks, proposals, module and tier cards, kanban cards).
  - `lift` is the hover state of a card that is a link or a button (1 px up, 180 ms).
  - `float` is used for glass chrome.
  - `modal` is used for drawers.
  - Shadows stay warm-tinted and quiet.
- **Ground grain:** a faint grain (`--tp-grain`, about 0.6 levels of variation) on the page ground only, never on the paper, cards or text. Light mode adds light flecks and dark mode dark flecks, so the grain only moves the ground away from the text, and no pair in §6 drops below its number. It is off under `prefers-contrast: more` and forced colours.
- **Empty states:** one quiet illustration style. The state's line icon sits on a parchment disc (`--tp-sunken`, a hairline ring and a soft halo); a state with no icon gets the shared page drawing (`--tp-empty-art`) in the same 1.5 px stroke.

## 5. Liquid glass recipe (floating chrome only)

```
background: var(--tp-glass);                       /* 82% light / 86% dark */
backdrop-filter: blur(18px) saturate(150%);
border: 1px solid var(--tp-glass-line);            /* hairline */
box-shadow: inset 0 1px 0 var(--tp-glass-edge),    /* top highlight */
            var(--tp-shadow-float);
```

- **Where:** top bar, command palette, slash menu, coach button, coach panel, sheets, toasts, popovers and the mobile tab bar. Class `tp-glass`.
- **Never on:** the paper page, text, lists or Tempo blocks. Page content is always solid.
- **Fallbacks:** each of these switches glass to `--tp-glass-solid`, a fully opaque surface:
  - `prefers-reduced-transparency: reduce`;
  - no `backdrop-filter` support, via `@supports` and a JS check;
  - `?glass=off` / `data-glass="off"`.
- **Why the opacity is high:** the worst case under glass is body text or the primary button directly beneath, with no credit for the blur. At these opacities, muted text on glass still clears 4.5:1 (see §6).

## 6. Contrast (computed, WCAG 2.1)

Computed from the hex values above using WCAG relative luminance. Text needs 4.5:1. The focus ring and control outlines need 3:1.

| Pair | Min | Light | Dark |
|---|---|---|---|
| Body text (`ink` on `paper`) | 4.5:1 | 16.67 ✓ | 14.27 ✓ |
| Body text on page ground (`ink` on `ground`) | 4.5:1 | 15.17 ✓ | 15.64 ✓ |
| Secondary text (`muted` on `paper`) | 4.5:1 | 7.44 ✓ | 7.48 ✓ |
| Secondary text on rail (`muted` on `sunken`) | 4.5:1 | 6.14 ✓ | 8.53 ✓ |
| Tertiary text, ≥13 px (`subtle` on `paper`) | 4.5:1 | 5.54 ✓ | 5.68 ✓ |
| Tertiary text on rail (`subtle` on `sunken`) | 4.5:1 | 4.57 ✓ | 6.47 ✓ |
| Text on row hover (`ink` on `hover`) | 4.5:1 | 14.14 ✓ | 12.78 ✓ |
| Primary button label (`on-accent` on `accent`) | 4.5:1 | 6.08 ✓ | 7.58 ✓ |
| Focus ring vs page ground (`accent` on `ground`) | 3:1 | 5.26 ✓ | 7.94 ✓ |
| Focus ring vs paper (`accent` on `paper`) | 3:1 | 5.78 ✓ | 7.24 ✓ |
| Control outline vs paper (`line-control` on `paper`) | 3:1 | 3.89 ✓ | 3.75 ✓ |
| Control outline vs page ground (`line-control` on `ground`) | 3:1 | 3.54 ✓ | 4.11 ✓ |
| Done chip (`done` on `done-wash`) | 4.5:1 | 5.22 ✓ | 6.99 ✓ |
| Fixed chip (`info` on `info-wash`) | 4.5:1 | 5.13 ✓ | 7.38 ✓ |
| Flexible chip (`caution` on `caution-wash`) | 4.5:1 | 5.05 ✓ | 7.45 ✓ |
| Remove chip (`danger` on `danger-wash`) | 4.5:1 | 5.26 ✓ | 6.93 ✓ |
| Danger text on paper | 4.5:1 | 6.42 ✓ | 7.67 ✓ |

**Text on glass, worst case.** The glass colour is mixed with the busiest content that can sit under it, with no blur credit.

| Glass over… | Text | Light | Dark |
|---|---|---|---|
| body text (the darkest / lightest content) | `ink` | 11.49 ✓ | 9.16 ✓ |
| body text | `muted` | 5.13 ✓ | 4.80 ✓ |
| the primary button | `ink` | 12.82 ✓ | 10.59 ✓ |
| the primary button | `muted` | 5.72 ✓ | 5.55 ✓ |
| blank paper | `ink` | 16.67 ✓ | 13.79 ✓ |
| blank paper | `muted` | 7.44 ✓ | 7.23 ✓ |

`line` and `line-strong` are decorative dividers. They are deliberately below 3:1, and no meaning depends on them.

## 7. Motion

- Durations: 120 ms (press, hover), 180 ms (popover), 240 ms (panel, toast, new row). Nothing exceeds 250 ms. Exits run at 160 ms, about 65% of the entrance.
- Easing: ease-out (`0.2, 0.8, 0.2, 1`) on enter, ease-in on exit.
- **One animation per interaction:**
  - a new task row drops in;
  - the slash menu pops;
  - the coach panel slides from the trailing edge;
  - the toast rises.
- Run 2 polish adds: a press (1 px down, 98% scale, 120 ms) on every button; a 1 px lift on link and button cards (180 ms); content list rows drop in once when they arrive (240 ms); a check mark pops when ticked (180 ms).
- Only `transform` and `opacity` animate (hover colour changes fade at 120 ms).
- `prefers-reduced-motion` collapses all of it to instant. The text caret stops blinking, and skeletons stop shimmering.

## 8. Layout

- **1280 and up:** rail (264) + centred paper (max 760) + a docked coach panel (400) when it is open.
- **1024–1279:** the coach panel floats as a glass sheet over the page, with a scrim.
- **768–1023:** the rail becomes a drawer, opened from the top bar.
- **Under 768:**
  - the paper goes full-bleed;
  - a glass tab bar sits at the bottom;
  - the coach button sits above it;
  - the coach and slash menu open as bottom sheets;
  - block handles hide, and the block menu is reached by long-press later (Stage 2).
- **Fixed chrome:** content reserves room for it (`padding-bottom` = tab bar + 64). Nothing scrolls sideways at 390.
- **Breakpoints:** 375 / 768 / 1024 / 1280.

## 9. Components → shadcn on Tailwind v4

Tokens map to Tailwind v4 `@theme` one to one (`--tp-paper` → `--color-paper`, `--tp-space-4` → spacing `4`, and so on). Class `tp-x` with `data-component="X"` becomes the React component `X`.

| Component (`data-component`) | Class | shadcn primitive | Notes |
|---|---|---|---|
| TempoShell | `tp-app` | `sidebar` (SidebarProvider) | grid areas: rail, top, main, coach |
| Sidebar / PageTree | `tp-rail`, `tp-tree`, `tp-tree-item` | `sidebar` + `collapsible` | `aria-current="page"` |
| CommandTrigger | `tp-rail__search` | `command` in `dialog` | Ctrl K |
| Topbar | `tp-topbar tp-glass` | — (layout) + `breadcrumb` | glass |
| Avatar | `tp-avatar` | `avatar` | the person's initials, never "User" |
| TabBar | `tp-tabbar tp-glass`, `tp-tab` | `tabs` (nav variant) | under 768 only |
| Page / PageEditor | `tp-paper`, `tp-page__body` | — | the Markdown document |
| PageCover, PageIcon, PageMeta | `tp-page-cover`, `tp-page-icon`, `tp-page-meta` | — | |
| Tag | `tp-tag` | `badge` | inline `#tag` |
| Wikilink | `tp-wikilink` | `command` in `popover` (picker) | `[[page]]` |
| BlockHandle | `tp-block`, `tp-block__handle` | `dropdown-menu` | add below and block options; buttons, never drag-only |
| SlashMenu / SlashCommand | `tp-slash-menu tp-glass`, `tp-slash-item` | `command` in `popover` | listbox, arrow keys, Enter, Esc |
| NextUpCard | `tp-nextup` | `card` | the one primary action |
| TaskBlock / TaskRow | `tp-block-task`, `tp-task-row`, `tp-check` | `checkbox` + `collapsible` | optimistic tick |
| EnergyBlock / Dial | `tp-block-energy`, `tp-seg`, `tp-seg__opt` | `toggle-group` (single) | quiet / steady / push |
| TimeBlock / TimeBlockRow | `tp-block-time`, `tp-time-row` | custom | fixed = solid edge + "Fixed"; flexible = dashed + "Flexible" |
| Backlinks | `tp-backlinks`, `tp-backlink` | `card` list | "Linked here" |
| CoachButton | `tp-coach-fab tp-glass` | `button` + `sheet` trigger | Ctrl J |
| CoachPanel | `tp-coach-panel tp-glass` | `sheet` (side on desktop, bottom on phone) | |
| CoachMessage / UserMessage | `tp-msg`, `tp-msg--user` | `scroll-area` + custom | read-back per message (voice phase) |
| ProposalCard | `tp-proposal` | `card` + `button` ×3 | exact preview; Accept / Edit / Reject |
| ChangePreview | `tp-change[data-op]` | — | add / move / remove, with a word and an icon |
| Composer | `tp-composer` | `textarea` + `button` | voice button; send is ink, not accent |
| UndoToast | `tp-toast tp-glass` | `sonner` | 5:00 countdown, Undo button |
| Button | `tp-btn--primary/secondary/ghost/icon` | `button` | primary = accent, once per screen |
| Chip | `tp-chip` | `badge` | |
| Skeleton | `tp-skeleton` | `skeleton` | content areas > 100 ms |
| Empty | `tp-empty` | — | kind copy, a next step |

## 10. Right-to-left

- Direction comes from the language: `lang="he"` → `dir="rtl"`. It is built so Arabic and Persian need no redesign.
- Only logical properties are used: `inline-start/end`, `border-start-start-radius`, `inset-inline-*`. Nothing uses left/right for layout.
- What mirrors:
  - the rail moves to the right;
  - the coach panel slides in from the left;
  - chevrons and arrows flip (`tp-icon--flip`);
  - the paper's block handles sit on the right.
- **Numbers, times, dates as digits and code stay left-to-right**, via `tp-num` (`direction: ltr; unicode-bidi: isolate`) and IBM Plex Mono.
- User-written text uses `dir="auto"`, so each paragraph takes its own direction (F-72).
- Segmented controls swap arrow-key direction in RTL.
- Hebrew uses Frank Ruhl Libre and Assistant. Uppercase eyebrows turn off letter-spacing and case transforms for Hebrew.

## 11. Dyslexia mode

- `data-dyslexia="on"` (Settings → Accessibility; device-local key `tempo-dyslexia`):
  - body and UI switch to **OpenDyslexic**;
  - line height goes to 1.8, letter spacing +0.035em, word spacing +0.12em;
  - text width tightens to 60ch.
- If OpenDyslexic fails to load, `tempo.js` sets `data-dyslexia-font="fallback"` and **Atkinson Hyperlegible** takes over.
- Headings stay in Newsreader by default (HARD_RULES §7.2). `data-dyslexia-headings="on"` switches them too.
- OpenDyslexic has no Hebrew glyphs. In Hebrew, dyslexia mode keeps Assistant and applies the extra spacing.

## 12. Owner overrides

These are recorded on purpose: the owner's direction replaces a default.

1. **Liquid glass on all floating chrome.** Anti-slop caps glass at 1–2 elements, and the prototype profile bans glass without a business reason. The owner asked for glass on the top bar, command palette, slash menu, coach button and panel, sheets, toasts and popovers. Each has a solid fallback (§5).
2. **Warm beige / parchment grounds.** The anti-cliché default bans warm beige grounds. The owner chose them for calm (Anthropic-style warmth). Contrast is measured in §6.
3. **Body face is Source Sans 3, not Inter.** HARD_RULES §7.2 says Inter. The owner asked for a humanist sans, and the brief wins on look and feel. Inter stays allowed but is not used.
4. **Accent changed from `#D97757` to `#A3461F` / `#EE9468`.** R-30 says no exact colours copied, and the old value matched Claude.ai's accent.
5. **Patterns only.** Claude.ai and Craft supply layout patterns. No logos, wording or exact colours are copied (see `references/mobbin-refs.md`).

## 13. Copy rules carried from the docs

- Warm, direct, specific, never shaming. Never "failed", "overdue", "streak lost", "must".
- Empty states are kind and offer a next step. "Not now" is never failure.
- The coach proposes; the user accepts, edits or rejects. Every accepted change has a 5-minute Undo.
- No JSON, ids, developer words or "sample data" labels in the interface.
- All people and data are fictional ("Maya Ronen", "Dana", "Yoni").

## 14. Files

- `tokens.css`: values.
- `tempo.css`: components, beginning with the `OD-LAYOUT-PRIMITIVES v1` structure layer.
- `tempo.js`: preferences, i18n, icons, components.
- `fonts/`: OpenDyslexic with its licence.
- `screens/web/*.html`: layout plus content only.
- **Screen URL parameters:**
  - `theme=light|dark`
  - `lang=en|he` (sets direction)
  - `dyslexia=on`
  - `size=s|m|l`
  - `glass=off`
  - `state=undo` (coach: after Accept)
