# Tempo v3 — HTML design

This folder is the Tempo Flow v3 design, written as plain HTML screens. Each screen is a spec for the Next.js (web) and Expo (mobile) build: real layout and copy, a header comment that names the target route, the data it needs and its states, and a comment before every component naming the shadcn primitive it becomes.

- 58 web screens in `screens/web/`, 13 mobile screens in `screens/mobile/`.
- One design system: `tokens.css` (values), `tempo.css` (components), `tempo.js` (behaviour, icons, i18n, state switch).
- Screens add layout only. Colour, type, spacing and radius come from tokens.

## How to open

- **`index.html`** in this folder is the screen board: every screen, grouped (Flow, Coach, Pages & blocks, Library, You, Memory & modules, Settings, Public, Mobile). Toggles switch width (390 / 1280), theme (light / dark) and direction (English LTR / Hebrew RTL). Each card has the screen name, its route, an **Open** link and a lazily loaded preview. Mobile screens preview at 390 only.
- In this repository the board lives at `docs/design/v3/index.html`. There is no separate launcher: open that file directly.
- **`hero-board.html`** is the Stage 1 hero board (Today, Page editor, Coach in every combination). It is linked from the screen board.
- Open any screen file directly in a browser. No build step and no server are needed.

## URL parameters

Every screen reads these (handled by `tempo.js`):

| Parameter | Values | Effect |
|---|---|---|
| `theme` | `light`, `dark` | Colour theme. Default follows the system. |
| `lang` | `en`, `he` | Language. `he` sets `dir="rtl"`. |
| `state` | `empty`, `loading`, `error`, `offline` | Shows that state. No parameter means `default`. Some screens add extras such as `undo`, `sending`, `invalid`, `resending`, `resent`, `saving`. |
| `view` | screen-specific | Opens a sub-view: `plan` → `day|week|month`; `coach-thread` → `crisis`; `brain-dump`, `memory-import` → `review`; `module-preview` → `invalid`; mobile `routines` → `guide`. |
| `step` | `1`–`5` | Onboarding step (web and mobile). |
| `plain` | `on` | Modules: Plain mode on. |
| `results` | `none` | Search: the no-results state. |
| `task` | task id | Opens the Task sheet over a screen. |
| `dyslexia` | `on` | Dyslexia reading font. |
| `size` | `s`, `m`, `l` | Text size. |
| `glass` | `off` | Solid fallback for glass chrome. |

Example: `screens/web/tasks.html?theme=dark&lang=he&state=empty`.

## Folder layout

```
docs/design/v3/
  index.html             screen board (every screen)
  hero-board.html        Stage 1 hero board
  README.md              this file
  screen-map.md          file → route → shadcn → data → states
  DESIGN.md              tokens, type, contrast, glass, RTL, owner overrides
  components.md          component catalogue + labelling convention
  tokens.css             design tokens
  tempo.css              every component
  tempo.js               behaviour (window.TP), icons, i18n, state switch
  fonts/                 OpenDyslexic + licence
  references/            pattern references (mobbin-refs.md)
  anti-slop/
    delivery-gate.md     anti-slop delivery report
  screens/
    web/*.html           58 web screens
    mobile/*.html        13 mobile screens (in a neutral handset frame)
```

## Labelling convention

_Copied from `components.md` §5._

Each screen is a spec for the Next.js / Expo build, so each one carries two kinds of comment.

### Screen header comment

This must be the **first thing inside `<body>`**. The fields always appear in this order:

```html
<!--
@screen   Today
@route    apps/web/app/(tempo)/today/page.tsx
@layout   TempoShell
@data     dailyPage = pages.getDaily({ date })      // Convex query
@actions  tick task -> tasks.complete({ id })        // optimistic, Undo 5 min
@states   default | empty | loading | error | offline  (?state=)
@flow     1. ... plain-language pseudocode steps
@i18n     en, he
-->
```

| Field | Rule |
|---|---|
| `@screen` | The human name, as in `screen-inventory.md`. |
| `@route` | The real target file (web `apps/web/app/...`, mobile `apps/mobile/app/...`). |
| `@layout` | `TempoShell`, `Bare`, `Auth`, `Marketing` or `MobileTabs`. |
| `@data` | One line per query: `name = module.function({ args })  // Convex query`. Repeat the tag for more than one. |
| `@actions` | One line per user action: `verb object -> module.mutation({ args })  // optimistic? Undo?`. Repeat the tag. |
| `@states` | Always list all five, then mark extras (e.g. `undo`). |
| `@flow` | Numbered, plain-language steps a developer can follow. No JSON. |
| `@i18n` | Languages the screen ships with (`en, he`). |

### Component comment

Put this **directly before each component instance**, on one line:

```html
<!-- @component TaskRow | shadcn: checkbox | props: { task: {id,title,minutes,done} } | events: onToggle -> tasks.complete -->
```

- `@component` takes the exact `data-component` name from `components.md`.
- `shadcn` takes the primitive from the tables in `components.md`.
- `props` uses TypeScript-ish object shapes and only fields the screen actually shows.
- `events` takes `onX -> module.function`, comma-separated for more than one. Use `events: —` when there are none.
- Repeated rows in a list need one comment on the list, not one per row: `<!-- @component TaskRow ×4 | ... -->`.

### Other markup rules

- Every component root keeps `class="tp-…"` **and** `data-component="Name"`.
- Visible strings get `data-i18n="key"`. Each screen defines `window.TP_STRINGS = { en, he }`.
- Screens contain no `<style>` beyond layout. They contain no colours, fonts or sizes.
- Each screen has one `.tp-btn--primary` at most.

## Sign-in note

The sign-in "Continue as guest" button appears on the preview site (preview.tempoflow.dev) only, never live.

## PRD feature coverage

Feature IDs from `PRD.md`. The screen column names where the feature is designed. "No screen" means the feature is backend-only, later horizon (END), or unknown in the PRD. Coverage is by design intent; it has not been checked in a browser.

| Feature | Screen file(s) |
|---|---|
| F-01 magic-link sign-in, sign-out | `web/sign-in.html`, `web/link-sent.html`, `web/settings-profile.html` |
| F-01a approval-gated sign-up | `web/sign-up.html`, `web/approval-pending.html` |
| F-02 page = Markdown + blocks (JSON never shown) | `web/page-editor.html`, `web/page-blocks.html`, `web/today.html` |
| F-03 note editor, broken block card with Undo | `web/page-editor.html`, `web/page-blocks.html` |
| F-04 built-in templates | `web/templates.html`, `web/new-page.html`, `mobile/templates.html` |
| F-05 Today is the daily page | `web/today.html`, `web/daily-note.html`, `mobile/today.html` |
| F-06 template proposed on new page | `web/new-page.html` |
| F-07 day / week / month, fixed vs flexible events | `web/plan.html`, `web/calendar.html`, `web/weekly-page.html`, `mobile/calendar.html` |
| F-08 folder tree, tags, calendar tokens | `web/notes.html`, `web/page-editor.html`, `mobile/notes.html` |
| F-09 brain dump → plan → Today | `web/brain-dump.html`, `mobile/capture.html` |
| F-10 events and habits as blocks, no streak pressure | `web/habits.html`, `web/habit-detail.html`, `web/page-blocks.html`, `mobile/habits.html` |
| F-20 coach chat beside the editor | `web/coach.html`, `web/coach-thread.html`, `web/coach-history.html`, `mobile/coach.html` |
| F-21 coach reads pages and memory | `web/coach.html`, `web/memory.html` |
| F-22 coach actions with 5-minute Undo | `web/coach.html` (`?state=undo`), `web/coach-thread.html`, `mobile/coach.html` |
| F-23 coach builds templates and modules | `web/template-sketch.html`, `web/module-preview.html` |
| F-24 fixed crisis card | `web/coach-thread.html` (`?view=crisis`) |
| F-25 adaptive coach dial | `web/coach-thread.html`, `web/settings-prefs.html`, `web/onboarding.html`, `mobile/settings.html` |
| F-26, F-27 | No screen (END) |
| F-28 coach artifacts | No dedicated screen (MVP) |
| F-30 live voice mode | `web/voice-call.html`, `mobile/voice-call.html` |
| F-31 voice does everything text does | `web/voice-call.html`, `mobile/voice-call.html` |
| F-32, F-33, F-34 speech pipelines | No screen (backend) |
| F-35 push-to-talk all tiers; live minutes on Pro/Max | `web/voice-call.html`, `web/billing.html` |
| F-36 | No screen (END) |
| F-40 ask the coach for a template or module | `web/template-sketch.html`, `web/coach-thread.html` |
| F-41 module preview with Approve / Discard | `web/module-preview.html` |
| F-42 approved module live at once | `web/module-preview.html` |
| F-43 modules list, Plain mode, built-ins | `web/modules.html` |
| F-44 view modules | `web/modules.html` (listed only) |
| F-45 | No screen (END) |
| F-46 code in pages, sandboxed | No dedicated screen |
| F-47 scheduled jobs | `web/modules.html` |
| F-48 | No screen (backend) |
| F-50 memory adapter | `web/memory.html` |
| F-51 memory import | `web/memory-import.html` |
| F-52 see / forget / export memories | `web/memory.html`, `web/settings-privacy.html` |
| F-53 | No screen (END) |
| F-54 life graph, guessed links kept apart | `web/memory.html` |
| F-55 Reflect observations | `web/insights.html` |
| F-60 nags in the user's own words | `web/nags.html`, `web/task-sheet.html`, `web/habit-detail.html` |
| F-61 nag delivery channel | No screen (UNKNOWN) |
| F-70 English and Hebrew copy | Every screen (`?lang=he`) |
| F-71 LTR / RTL layout | Every screen (`?lang=he`) |
| F-72 mixed-direction paragraphs | `web/page-editor.html`, `web/page-blocks.html` (`dir="auto"`) |
| F-73 coach and voice answer in the chosen language | `web/coach.html`, `web/voice-call.html` |
| F-80 polished look | Every screen |
| F-81 chat button bottom right, avatar in header | Every TempoShell screen (coach button, top bar) |
| F-82 typeface | `web/settings-prefs.html` (dyslexia font), DESIGN.md §3 |
| F-90 | No screen (END) |
| F-100 connectors | `web/settings-integrations.html` |
| F-101, F-102, F-103 | No screen (END) |
| F-110 billing visible | `web/billing.html`, `web/trial-end.html`, `web/landing.html` |
| F-120 web PWA | No screen (platform) |
| F-121 Expo native shell | `mobile/*.html` |
| F-122, F-123 | No screen (END) |
| F-130 | No screen (backend) |
| F-131 soft delete, 5-minute Undo | `web/coach.html`, `web/memory.html`, `web/nags.html`, `web/settings-privacy.html` |

## Open notes

- Hebrew copy needs native review.
- The crisis card lists real Israeli services (ERAN 1201, SAHAR, MDA 101). They must be verified before release.
- Convex function names in `// REAL:` comments are proposals.
- Tier differences beyond voice minutes are unconfirmed.
- Footer legal links point to `#`.
- Kanban moves have no Undo toast.
- Month / week arrows on calendars are display-only.
- Some mobile note rows have no target screen.
- No screen has been rendered or clicked through after export. See `anti-slop/delivery-gate.md`.
