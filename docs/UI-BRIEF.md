# Tempo Flow: UI Brief

> **Last updated 2026-10-03** (IDT) · Written by Grok Bot from the sources below · Decisions are Amit's.
> **Sources:** factory-v2 product docs v2 (20 Sep 2026): `04-UI-BRIEF.md` · Basic Memory notes `Weekend factory plan 2026-10-02`, `Weekend goals 2026-10-02` (§4 next week: Taby, animations, avatar) · plan-v3 `WEEKEND-PLAN.md` (next-week UX tickets) · the repo on `integration` at `5b9675e`: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/components/providers/ThemeProvider.tsx`, [`docs/design/claude-export/design-system/`](https://github.com/Division6066/tempo-rhythm/tree/integration/docs/design/claude-export/design-system) (`tokens.css`, `brand-voice.md`, `assets/`) · the 3 Oct component map and live walk.
> **Markers:** UNKNOWN = not known or not decided. (EXTRAPOLATED) = Grok Bot's own fill, not a decision. Newer Amit decisions win over older sources; conflicts are listed in §9.
> **Companion docs:** [PRD](./PRD.md) · [TRD](./TRD.md) · [App flow](./APP-FLOW.md) · [Backend schema](./BACKEND-SCHEMA.md) · [Roadmap](./ROADMAP.md)

## 1. Where UI work stands

- **This weekend:** function first. "Works after sign-in" = every visible control on every signed-in screen does its job. **Looks and animations come next week** (Amit, 1–2 Oct).
- **Next week: Taby UX work starts.** Planned items (plan-v3, Weekend goals §4):
  - a chat button at the bottom right of every signed-in screen, inspired by Taby (Amit supplies the reference link);
  - an avatar in the top header of signed-in screens;
  - animations, one ticket per component family;
  - Turnstile on sign-up and the sign-up approval screens.
  - What exactly to take from Taby beyond the chat button: UNKNOWN until Amit shares the link.
- The 20 Sep layout, accessibility and tone rules below still stand.

## 2. References and what to take from each

| Reference | Take | Do not take |
|---|---|---|
| Taby (next week) | The chat-button pattern (bottom right, every signed-in screen). More: UNKNOWN. | UNKNOWN |
| today.ai (closest product) | Behaviour: memory of the user, acting before asked, to-dos and notes in one place. | Its assumption that the user follows a plan unprompted. Its look (EXTRAPOLATED). |
| NotePlan (UX bar) | Daily-note density; day / week / month over the same pages; time blocking. | Apple-only assumptions. |
| StudyFetch (UX bar) | Flow shape: record → notes → cards → test; confidence rating. | Arcade and gamification. |
| Memos (MIT, design only) | One capture box above a plain reverse-time feed; markdown as typed text; inline tags; little chrome (EXTRAPOLATED reading). | Any code. |
| Joplin (secondary) | UNKNOWN beyond its templates. | Any code. |
| Public Joplin, Notesnook, Notion, Obsidian templates | The structure of the most-used templates, adapted into Tempo's starting set (research not done). | Copied text or artwork. |
| Mobbin | As mapped per screen in the Bolt V0 spec. | Copying a screen. |

## 3. Layout

- Phone first: 390 px, sticky bottom bar. At 900 px: left rail, 640 px centre column, optional right column.
- Today's web shell (`TempoShell`): left sidebar grouped Flow / Library / You / Settings, top bar with screen title, ⌘K / Ctrl+K command palette, theme toggle. No account menu or user area in the top bar yet (the avatar is next week).
- One decision per screen. Today shows one large **Next up** card (target).
- Text width at most 68 characters; no hard-coded text widths; right-to-left must survive (Hebrew legal pages and voice).

## 4. Tokens: what the web app uses today

From `apps/web/app/globals.css` (Tailwind v4 theme), matching the repo's design export `tokens.css` ("Brand Identity & Style Guide v1.0"):

| Token | Light value | Use |
|---|---|---|
| ink | `#131312` | text, inverse surface |
| cream | `#f3ebe2` | page background |
| cream-raised | `#faf6f0` | cards, popovers |
| cream-deep | `#ebe0d2` | sunken surfaces, secondary |
| tempo-orange | `#d97757` | primary action, focus ring |
| soft-orange | `#e8a87c` | gradient end |
| dust-grey / dust-grey-soft | `#6b6864` / `#9a968f` | muted / subtle text |
| line / line-soft | `#d7cec2` / `#e6ddd1` | borders |
| moss | `#4a7c59` | semantic: success / done (EXTRAPOLATED mapping) |
| brick | `#c8553d` | semantic: destructive (EXTRAPOLATED mapping) |
| amber | `#d4a44c` | semantic: warning (EXTRAPOLATED mapping) |
| slate-blue | `#6e88a7` | semantic: info |

- **Fonts in code:** Newsreader (serif), Inter (sans), IBM Plex Mono, loaded with `next/font/google` in `apps/web/app/layout.tsx`.
- **Dyslexia mode:** a toggle sets `data-dyslexia="on"`, which switches to OpenDyslexic with looser leading. Theme (light / dark / system) and dyslexia are stored per device in localStorage (`tempo-theme`, `tempo-dyslexia`); moving them to the user profile is ticket #471.
- **Sizes (20 Sep):** base 17 px; text steps S 15 / M 17 / L 20 (unconfirmed); minimum 13 px; line height 1.6; 4 px spacing scale; cards 16 px padding; list rows 56 px on phone; motion 200 ms or less; reduced motion respected.
- **Contrast:** not measured against WCAG AA: UNKNOWN. `dust-grey-soft` on cream and white on `tempo-orange` look too light for small text (EXTRAPOLATED).
- The repo's `scan:design-tokens` CI scan exists (`scripts/scan-design-tokens.ts`); exactly what it enforces is UNKNOWN.

## 5. Components

Primitives: shadcn on Tailwind v4 (web), NativeWind on Expo (mobile). Locked.

| Tempo component | Primitive | Note |
|---|---|---|
| Card, Next up card, Tile, Tier card | `card` | Tier cards never hidden or collapsed. |
| TaskRow | `checkbox` + `collapsible` (the "why" caret) | Move up / down buttons on focus. |
| Dial 0–10 | `slider` | Labels: quiet, steady, push. |
| Segmented | `tabs` or `toggle-group` | |
| Button, Chip, TextArea, Loading, Undo notice | `button`, `badge`, `textarea`, `skeleton`, `sonner` | Primary button uses the accent. |
| Task sheet | `sheet` on phone, `dialog` at 900 px | |
| Day timeline | custom | Inelastic items: solid left edge; elastic: dashed; plus a text label. |
| Month grid | `calendar` as a base (EXTRAPOLATED) | Dots and count are custom. |
| Left rail · wikilink picker · coach thread | `sidebar` · `command` in `popover` · `scroll-area` + custom bubbles | |
| Proposal row | `card` + `switch` + inline `input` | |
| Nag | `sonner` in-app; `alert-dialog` when it needs an answer (EXTRAPOLATED) | User's words only. No icon, no emoji. |
| Template proposal | `card` with one primary action (EXTRAPOLATED) | |
| Chat button (next week) | floating button + `sheet` (EXTRAPOLATED) | Inspired by Taby. |
| Avatar (next week) | `avatar` (EXTRAPOLATED) | Top header. Shows the person's name or initials, not "User" (#479). |

**Block components (target, drawn by json-render):** `TaskBlock` (adjacent task blocks draw as one to-do list), `EventBlock`, `HabitBlock`, `NagBlock`, `TemplateBlock`, `PageMetaBlock` (draws nothing in the body), `BrokenBlock`. Tempo uses its own components, not `@json-render/shadcn`, so tokens stay in one place (EXTRAPOLATED). A block looks like a quiet card inside the text, never like code. There is no "show source" control; export gives the plain markdown.

Placeholder pages today use `ScaffoldScreen` with "Continue in beta" / "Review guidance" buttons that have no handler. Every screen ticket replaces them with real controls.

## 6. Accessibility (needs, not polish)

The first user is dyslexic and often listens.
- Short labels, plain words, one idea per row.
- Every control reachable by keyboard with a visible focus ring. Drag always has a button alternative (e.g. kanban move).
- Every icon has a text label. Colour is never the only signal.
- Read-back: any note or coach message can be read aloud. Control placement: UNKNOWN until the voice phase.
- Reduced motion respected (this applies to next week's animations). Text size S / M / L. Right-to-left safe.

## 7. Tone of copy

- Repo guide [`brand-voice.md`](https://github.com/Division6066/tempo-rhythm/blob/integration/docs/design/claude-export/design-system/brand-voice.md): "Warm, direct, specific, never shaming." Use: small, gentle, anchor, nudge, steady, offer. Avoid: crush, hustle, must, required, failed, grind, optimize.
- Never "you failed", "streak lost", "overdue!". The word "overdue" is in the coach's shame-word test list (`convex/coach.test.ts`).
- Nags: only the user's own words. The UI never supplies a default phrase.
- A coach, not a therapist.

## 8. Brand assets and placeholders

| Item | State |
|---|---|
| Logo | The design export has `assets/mark.svg`, `wordmark.svg`, `wordmark-dark.svg`. Whether these are final: UNKNOWN. Never Anthropic's marks. |
| App icon, illustration | UNKNOWN |
| Delete red, contrast-adjusted greys | Not measured. Code has `brick #c8553d`. |
| Paid design system · 21st.dev · uiverse · FlyonUI | Pending · licence UNKNOWN, don't pull yet · MIT, small elements only · not used (forbidden). |
| Crisis resources card | Fixed text, per country. Data source and how the country is known: UNKNOWN. |
| Starting templates | Research not done. |

## 9. Conflicts

| Source A | Source B | Status |
|---|---|---|
| 20 Sep UI brief: Anthropic palette (ground `#faf9f5`, ink `#141413`, accent `#d97757`, done `#788c5d`, info `#6a9bcc`) | Code and design export: cream `#f3ebe2`, ink `#131312`, tempo-orange `#d97757`, moss / brick / amber / slate-blue | **Code is what ships today.** The accent matches. No Amit ruling chose one over the other: UNKNOWN. |
| 20 Sep: Atkinson Hyperlegible for everything until Amit rules (vs Anthropic's Poppins + Lora) | Code: Newsreader + Inter + IBM Plex Mono; dyslexia mode uses OpenDyslexic | Open. Typeface: UNKNOWN. |
| 20 Sep: logo UNKNOWN | Repo design export contains a mark and wordmarks | Whether they're adopted: UNKNOWN. |
| 1–2 Oct: looks and animations next week | 20 Sep brief's polish items | Newer wins: no visual polish this weekend; function first. |

## 10. Open questions

1. Typeface and palette: keep the code's brand tokens, or move to the 20 Sep Anthropic palette with Atkinson Hyperlegible?
2. The Taby link, and what to take from it beyond the chat button.
3. Are the mark and wordmarks in the design export the real logo?
4. Crisis card: which source supplies per-country resources; does the country come from the profile?
5. Who runs the template research, and how many templates make the starting set?
