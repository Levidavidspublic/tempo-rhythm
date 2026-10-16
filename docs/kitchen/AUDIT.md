# Kitchen polish pass — audit (step 2)

Five read-only audits, one subagent per area. They ran on 2026-10-16 against `kitchen/polish-pass` after the six PRs were brought in.

- **How they checked.** Code reading, plus Playwright on the local dev server. That server uses a placeholder Convex URL and the dev-only E2E bypass, so signed-in states with data could not render. Some CSS checks injected a component's real markup into a live page.
- **Priority.** P1 is a visibly broken state or a bug a user would hit. P2 is a one-off style that an existing `tp-*` class or token replaces, or a missing state. P3 is a nit.
- **Status.** `fixed` (with the commit in `RUN-LOG.md`), `partial`, `open` (not done in this pass), or `blocked: <reason>`. Open items are proposals, not commitments.

## Today (`/today`, `/brain-dump`, `/plan`)

| # | P | Finding | Status |
|---|---|---|---|
| T1 | P1 | `TodayBrainDumpPanel` calls `brain_dump.prioritize` with no crisis check. `BrainDumpScreen` checks first, and the server action does not check. | fixed (carries open PR #1026's panel; redrawn on v3) |
| T2 | P1 | The old orange gradient (`#D97757→#E8A87C`, which DESIGN §12.4 forbids) appears on the greeting name, the brain-dump panel and the task list. Contrast is 1.76–3.12:1 in light mode. | fixed |
| T3 | P1 | No error boundary on `/today`, `/brain-dump` or `/plan`. Only `calendar/error.tsx` exists, so a throwing query takes the route down. | fixed (`app/(tempo)/error.tsx` covers every shell screen) |
| T4 | P1 | Failed writes say nothing: task toggle (`TodayTaskList`), energy pick, carry-over. | partial: task list and carry-over fixed; energy picks are left to open PR #1021 |
| T5 | P1 | Long unbroken titles scroll the page sideways at 390 px (habit strip, task list, day plan, agenda, energy list, brain-dump panel). | partial: task list, agenda, carry-over, habits and brain dump fixed; day plan is left to #1022 and energy to #1021 |
| T6 | P1 | Day timeline action buttons are 16–24 px tall with 12 px text. "Undo" is cut off when two blocks overlap at 390. | open: `DayTimeline` is in open PR #1038 |
| T7 | P1 | Raw `err.message` is shown in brain dump (Convex request ids reach the screen). | fixed |
| T8 | P2 | Hand-rolled cards, inputs and badges; shadcn accent `Button`s; text under 13 px; physical left/right in `DayTimeline`, `DayPlanSummary`, `TimeBlockDialog`. | partial: Today's sections fixed; `DayTimeline` (#1038), `DayPlan*` (#1022), energy (#1021) and `TimeBlockDialog` are open |
| T9 | P2 | Loading is bare pulse blocks with no text or timeout; no offline state; hard-coded English in most non-v3 sections. | partial: Today page and strip loading fixed; no offline notice on Today yet |
| T10 | P2 | Copy: "must" (`blockForm.ts`); developer words in `TodayBrainDumpPanel` ("server planner", "Raw dump", "Prioritized output"). | partial: brain dump copy fixed; "must" fixed |

## Chat / Coach (`/coach`, panel, `/history`)

| # | P | Finding | Status |
|---|---|---|---|
| C1 | P1 | Long messages overflow sideways (1935 px inside a 388 px thread), and line breaks collapse. | fixed |
| C2 | P1 | The thread snaps to the bottom on every render, even while you read further up. | fixed |
| C3 | P1 | If the first conversation can't be created, it loads forever with no retry. | fixed |
| C4 | P1 | Focus is lost after every send. | fixed |
| C5 | P1 | `/history`: every row says "No messages…" and "New Conversation"; there's no way to reopen an older thread; no error state. | partial: threads get titles, `/coach?c=<id>` reopens a thread, New conversation added; `HistoryScreen` itself is left to open PRs #1024 and #1036 |
| C6 | P1 | The side-column proposal card has no Edit and no Undo. | blocked: no backend undo for `coach.decideProposal` |
| C7 | P1 | OpenUI page/template cards show only the first line before Accept (the direct card has "Show all of it"). | fixed |
| C8 | P2 | Send is accent (DESIGN §9: ink); inline styles; double focus ring in the composer. | fixed |
| C9 | P2 | Composer doesn't grow; typing is a bare "…"; no offline notice; empty chat is one line. | fixed |
| C10 | P2 | `HistoryScreen` is entirely legacy (SoftCard, orange `Pill`, 12 px text, English only). | open: `HistoryScreen` is in open PRs #1024 and #1036 |
| C11 | P2 | `CoachControls`, `CoachProposalCard` and `CrisisResourcesCard` use shadcn/Tailwind instead of `tp-dial`, `tp-proposal` and `tp-crisis`. | partial: CrisisCard and the proposal card fixed; `CoachControls` is in open PR #1038 |
| C12 | P2 | Copy: "can't reach its model" (developer word). | fixed |

**Open WebUI patterns** (behaviour only, no code):

| Pattern | Status |
|---|---|
| Composer that grows | fixed |
| Enter / Shift+Enter | already present |
| Send disabled when empty | already present |
| Typing indicator | fixed |
| Follow the bottom, plus "Jump to the latest" | fixed |
| Copy a message | fixed |
| Markdown in replies | fixed |
| Starters on an empty chat | fixed |
| Stop button | not built: `coach.reply` can't be cancelled |
| Streaming | needs backend: the model seam doesn't stream |
| Regenerate | needs backend: `reply` is idle once the coach has answered |
| Thumbs up/down | not built: no backend |
| Edit and resend | not built |
| Model picker | not built: AI providers and models are out of scope |
| History grouped by date, rename, delete | partial: threads named from the first message, New conversation, reopen by link; grouping, rename and delete are open (see C10) |

## Notes / Pages (`/notes`, `/journal`, `/templates`, `/week`)

| # | P | Finding | Status |
|---|---|---|---|
| N1 | P1 | The read view has no prose styles: lists lose their bullets, tables their borders, and quotes their style. | fixed |
| N2 | P1 | Long unbroken strings scroll the page sideways (preview title, read view, "Linked here", list preview). | fixed |
| N3 | P1 | A failed note save shows "Saving…" forever, with no error, retry or offline notice. | fixed |
| N4 | P1 | Deleting from inside a page swaps in the legacy notes list. Its toast covers the tab bar at 390 px. | fixed |
| N5 | P1 | No error boundaries for notes, journal, templates or week. | fixed (shell-wide error.tsx) |
| N6 | P1 | False empty states while auth loads: "No notes yet", and an editable empty "Untitled" editor. | fixed |
| N7 | P1 | `/daily-note` shows a developer scaffold. | open, and already handled by the open PR https://github.com/Levidavidspublic/tempo-rhythm/pull/1023 |
| N8 | P2 | `NoteNotFound` and note loading are Tailwind with English-only text. The PanelUI week glance maps to legacy `moss`/`amber` and accent charts. `ProfileReady` is English only. | partial: not-found, loading and ProfileReady fixed; `WeekGlanceView` is in open PR #1042 |
| N9 | P2 | Builder paper width jumps while typing; the slash menu is positioned with physical `left`; the page menu has no Esc. | partial: builder paper and page menu keys fixed; slash menu RTL position open |

## Calendar / Tasks (`/calendar`, `/tasks*`, `/projects`, `/habits`, `/routines`)

| # | P | Finding | Status |
|---|---|---|---|
| K1 | P1 | Every Tasks view scrolls sideways at 390 px (447 px wide), because a long project chip is `nowrap`. | fixed (CSS) |
| K2 | P1 | The Tasks add form is 576 px tall at 390, so the first task is below the fold. It is not a `<form>`, so Enter does nothing. | partial: fields sit two to a row on phones (CSS); the form element / Enter fix is open because `TaskViewsScreen` is rewritten by open PRs #1020 and #1039 |
| K3 | P1 | Failed create, toggle, edit and delete on Tasks say nothing. A failed repeat setup leaves the draft, so a retry makes a duplicate. | open: same file (#1020, #1039) |
| K4 | P1 | Loading shows "This view is clear." next to the loading text. | open: same file |
| K5 | P1 | `/tasks` subscribes before the profile exists and has no error boundary (a crash during the sign-in race). | partial: a crash now lands on the shell error state; the subscription race is open |
| K6 | P1 | `/tasks/checklists` renders blank when signed out or with no profile. | fixed |
| K7 | P2 | Long event titles are clipped to one line with no way to read them. | fixed (CSS, every list row) |
| K8 | P2 | Week and Month are lists, not grids; `tp-week` and `tp-month` are unused. | open (feature-sized) |
| K9 | P2 | No Undo toast on Tasks. | open, and handled by the open PR https://github.com/Levidavidspublic/tempo-rhythm/pull/1039 |
| K10 | P2 | Touch targets of 36 px (`tp-btn--sm`, `tp-seg__opt`) on phones. | fixed (touch screens) |
| K11 | P2 | `PriorityBoard`, `ChecklistBoard` and `calendar/error.tsx` are pre-v3 Tailwind; five separate Undo toasts. | partial: Checklists, Priority and calendar/error fixed; EventRow's toast is in #1036 |
| K12 | P2 | Raw `err.message` in `EventRow` and `ChecklistBoard`; "Length must be…" in `blockForm.ts`. | partial: `blockForm` and `ChecklistBoard` fixed; `EventRow` is in #1036 |
| K13 | P2 | Every new task lands in "Home reset". | open, and handled by the open PR https://github.com/Levidavidspublic/tempo-rhythm/pull/1020 |

## Settings / Onboarding

| # | P | Finding | Status |
|---|---|---|---|
| S1 | P1 | The body is blank while loading on every settings page, onboarding, billing and memory: skeleton bars measure 0 px wide. | fixed |
| S2 | P1 | Sign-out on the approval screen has no error path. | fixed |
| S3 | P1 | A long email scrolls the "Check your email" card sideways at 390. | fixed |
| S4 | P2 | Approval screen, approval loading and sign-in/up spinners are Tailwind or shadcn rather than `tp-auth`. | fixed |
| S5 | P2 | Sign-in validation is the browser's own bubble, with no inline error or `aria-invalid`; no offline notice. | fixed |
| S6 | P2 | Settings cards run edge to edge at 390 px. | fixed |
| S7 | P2 | Preferences save error has no retry and sits far from the change; the MCP token name error isn't linked to its field. | fixed |
| S8 | P2 | The passkeys page is outside the shell and uses an emoji and `alert()`. | fixed |
| S9 | P2 | Copy: the sign-in error; "reply to your sign-in email"; contradictory analytics line; Hebrew mixes feminine and plural address. | fixed |
| S10 | P3 | Dead legacy files: `(auth)/layout.tsx`, the SignInForm modal branch, `settings-profile/*`, `NagPhraseEditor`, `NagList`, and others. | open (listed in the PR, not deleted) |

## Notes for ticket sync (doc errors found)

- `docs/design/v3/tempo.css` has the same zero-width skeleton (S1) and the same edge-to-edge settings cards at 390 (S6). The design source needs the same fix.
- `bun run test` does not include `apps/web/components/**/*.test.*`, so component tests there (`CoachChat.test.tsx`, `focusBlockStats.test.ts`) never run in CI.
