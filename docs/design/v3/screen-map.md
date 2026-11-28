# Tempo v3 — Screen map

Every HTML screen → its target route → the shadcn primitives it is built on → the data it needs → its states.

Sources: each file's `@screen` header comment (the first block inside `<body>`), the `@component … | shadcn: …` comments, and `screen-inventory.md`. Convex function names are proposals (see README "Open notes").

**Common to every TempoShell screen** (not repeated per row): `sidebar` + `collapsible` (page tree), `breadcrumb` (top bar), `command` in dialog (Ctrl K), `tabs` nav variant (mobile tab bar), `avatar`. **Common to every screen**: `alert` (offline / error notice) and `skeleton` (loading). Every screen supports `?state=default|empty|loading|error|offline`; the States column lists only the extras.

**Flags**
- **[T]** — designed from the inventory title only. The inventory names the screen but no flow, data or feature in the PRD / APP-FLOW describes it: `template-editor`, `template-sketch`, `empty-states`.
- **[NEW]** — route added in Stage 2; not in `screen-inventory.md`.
- **[MOVED]** — screen in the inventory, but built at a different route or group.

## Web (58)

### Flow

| HTML file | Target route | shadcn (screen-specific) | Data | States (extras) |
|---|---|---|---|---|
| `web/today.html` | `apps/web/app/(tempo)/today/page.tsx` | card, checkbox, badge, button, dropdown-menu, command in popover (slash / wikilink), textarea, toggle-group, sheet, sonner, scroll-area | `pages.getDaily`, `tasks.nextUp`, `pages.backlinks` | — |
| `web/daily-note.html` | `apps/web/app/(bare)/daily-note/page.tsx` [MOVED: inventory says `(tempo)`] | card, checkbox, button, toggle-group, collapsible | `pages.getDaily`, `pages.backlinks` | — |
| `web/brain-dump.html` | `apps/web/app/(tempo)/brain-dump/page.tsx` | textarea, card, toggle-group per row, sheet, scroll-area, sonner, button | `brainDumps.getDraft` | `?view=review` (proposal open) |
| `web/plan.html` | `apps/web/app/(tempo)/plan/page.tsx` | tabs, calendar (base), toggle-group, drawer / sheet (bottom), textarea, scroll-area, sonner | `plan.getDay`, `plan.getWeek`, `plan.getMonth` | `?view=day|week|month` |

### Coach

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/coach.html` | `apps/web/components/coach/CoachPanel.tsx` (inside `/today`); inventory `(tempo)/coach/page.tsx` | sheet, card, checkbox, textarea, toggle, button, sonner, scroll-area | `coach.getThread`, `pages.getDaily` | `?state=undo` (5-minute Undo toast) |
| `web/coach-thread.html` | `apps/web/app/(tempo)/coach/[threadId]/page.tsx` [NEW] | card, textarea, slider (coach dial), toggle, drawer / sheet (bottom), sonner, scroll-area | `coach.getThread`, `profiles.getCoachDial`, `safety.resourcesFor` | `?view=crisis`, `?state=undo` |
| `web/coach-history.html` | `apps/web/app/(tempo)/history/page.tsx` [NEW] | input, command, toggle-group, sidebar menu, scroll-area | `coach.listThreads`, `coach.searchThreads` | no results |
| `web/voice-call.html` | `apps/web/components/voice/VoiceCall.tsx` (over `/today`) [NEW] | dialog (full screen), toggle, select, checkbox, badge, sonner (inline), scroll-area | `voice.startSession`, `voice.minutesLeft`, `voice.transcript` | loading = connecting, empty = no words yet, error = couldn't connect, ended |

### Pages & blocks

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/page-editor.html` | `apps/web/app/(tempo)/notes/[id]/page.tsx` (inventory `note-detail`) | card list, checkbox, badge, dropdown-menu, command in popover (slash menu) | `pages.get`, `pages.backlinks` | — |
| `web/page-blocks.html` | `apps/web/app/(tempo)/notes/[id]/page.tsx` (the one page route; `/p/[pageId]` only redirects there) | card list, checkbox, radio-group, dropdown-menu, toggle, toggle-group, sonner | `pages.get`, `pages.backlinks` | — |
| `web/weekly-page.html` | `apps/web/app/(tempo)/notes/[id]/page.tsx` (type weekly, from `/week/2026-W42`) [NEW] | card list, checkbox, badge, dropdown-menu, command in popover, toggle-group | `pages.getWeekly`, `tasks.listForWeek`, `pages.backlinks` | — |
| `web/new-page.html` | `apps/web/app/(tempo)/notes/new/page.tsx` [NEW] | radio-group (cards), card, button, sonner | `templates.suggest`, `templates.list` | — |
| `web/templates.html` | `apps/web/app/(tempo)/templates/page.tsx` | card, badge, input, dropdown-menu, toggle-group | `templates.listBuiltIn`, `templates.listMine` | empty = no own templates (built-ins still show) |
| `web/template-builder.html` | `apps/web/app/(bare)/templates/builder/page.tsx` [MOVED: inventory `(tempo)`] | card, badge, checkbox, command in popover (slash menu), dropdown-menu, form item, resizable, sonner | `templates.get`, `templates.listBlockTypes` | empty = brand-new template |
| `web/template-run.html` | `apps/web/app/(bare)/templates/run/[id]/page.tsx` [MOVED: inventory `(tempo)`] | form, card, checkbox, textarea, toggle-group, sonner | `templates.get`, `templates.getRunDraft`, `calendar.listFixed` | done |
| `web/template-editor.html` **[T]** | `apps/web/app/(tempo)/templates/editor/[id]/page.tsx` | form, input, select, switch, textarea, sonner | `templates.get` | invalid (Save with no name) |
| `web/template-sketch.html` **[T]** | `apps/web/app/(tempo)/templates/sketch/page.tsx` | form, textarea, card, resizable, sonner, scroll-area | `templates.getSketch` | thinking (coach is writing) |

### Library

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/tasks.html` | `apps/web/app/(tempo)/tasks/page.tsx` | checkbox, input, select, dropdown-menu (radio), toggle-group, form, textarea, sheet, sonner | `tasks.list`, `tasks.listChecklists` | filtered-to-nothing |
| `web/task-sheet.html` | `apps/web/components/tasks/TaskSheet.tsx` (`?task=<id>` on any (tempo) route) | sheet (bottom under 900 px) / dialog, form, input, textarea, radio-group, select, switch, checkbox, toggle-group | `tasks.get`, `nags.getForTarget` | empty = new task |
| `web/notes.html` | `apps/web/app/(tempo)/notes/page.tsx` | card, input, dropdown-menu (radio), resizable, sheet, scroll-area, sonner | `pages.tree`, `pages.list` | folder with no pages |
| `web/journal.html` | `apps/web/app/(tempo)/journal/page.tsx` | card, form, textarea, input, select, toggle, sheet, sonner | `journal.list`, `journal.promptForToday` | — |
| `web/calendar.html` | `apps/web/app/(tempo)/calendar/page.tsx` | calendar (base), card, form, radio-group, textarea, drawer / sheet (bottom), resizable, sonner | `events.listMonth`, `events.listDay` | empty day, form error (end before start) |
| `web/habits.html` | `apps/web/app/(tempo)/habits/page.tsx` | card, toggle, form, select, textarea, drawer / sheet (bottom), sonner | `habits.list` | welcome back (untouched 7+ days) |
| `web/habit-detail.html` | `apps/web/app/(tempo)/habits/[id]/page.tsx` | card, toggle, form, textarea, drawer / sheet (bottom), sonner | `habits.get`, `habits.listDays`, `habits.summary`, `nags.getForHabit` | paused |
| `web/routines.html` | `apps/web/app/(tempo)/routines/page.tsx` | card, badge, textarea, sheet, scroll-area | `routines.list`, `routines.suggestNow` | paused run |
| `web/routine-detail.html` | `apps/web/app/(tempo)/routines/[id]/page.tsx` | card, button, textarea, sheet, resizable | `routines.get`, `routines.getRun` | paused, finished |
| `web/goals.html` | `apps/web/app/(tempo)/goals/page.tsx` | card, badge, toggle-group, sonner | `goals.list`, `projects.listByGoals` | filtered-to-nothing |
| `web/goal-detail.html` | `apps/web/app/(tempo)/goals/[id]/page.tsx` | card, badge, checkbox, sonner | `goals.get`, `projects.listByGoal`, `tasks.listByGoal`, `goals.nextStep` | — |
| `web/goals-progress.html` | `apps/web/app/(tempo)/goals/progress/page.tsx` | chart, toggle-group | `goals.progressByGoal`, `goals.stepsByWeek` | — |
| `web/projects.html` | `apps/web/app/(tempo)/projects/page.tsx` | card, badge, toggle-group, sonner | `projects.list`, `goals.listNames` | filtered-to-nothing |
| `web/project-detail.html` | `apps/web/app/(tempo)/projects/[id]/page.tsx` | card list, badge, checkbox, dropdown-menu, sonner | `projects.get`, `pages.listByProject`, `tasks.listByProject`, `pages.backlinks` | — |
| `web/project-kanban.html` | `apps/web/app/(tempo)/projects/[id]/kanban/page.tsx` | card, badge, button, sonner | `projects.get`, `tasks.listByProjectColumns` | — |

### You

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/insights.html` | `apps/web/app/(tempo)/insights/page.tsx` (inventory slug `analytics`) | chart, card, toggle-group | `insights.getPatterns`, `insights.tasksByWeekday`, `insights.focusMinutesByWeek`, `reflect.listObservations` | — |
| `web/activity.html` | `apps/web/app/(tempo)/activity/page.tsx` | toggle-group, button | `activity.listRecent` | — |
| `web/search.html` | `apps/web/app/(tempo)/search/page.tsx` | input, command, select, toggle-group, sidebar menu, scroll-area | `search.query`, `search.recentQueries` | no results (`?results=none`) |
| `web/command.html` | `apps/web/app/(tempo)/command/page.tsx` (dialog over last page) | command in dialog, input | `pages.listRecent`, static jump targets, `search.quick` | empty = no recent pages |
| `web/notifications.html` | `apps/web/app/(tempo)/notifications/page.tsx` | (shell only) | `notifications.list` | — |
| `web/ask-founder.html` | `apps/web/app/(tempo)/ask-founder/page.tsx` | form, radio-group, textarea, card | `profiles.getMine` | field errors, sent |
| `web/empty-states.html` **[T]** | `apps/web/app/(tempo)/empty-states/page.tsx` (internal reference) | card | none (static gallery) | only default and offline apply |

### Memory & modules

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/memory.html` | `apps/web/app/(tempo)/memory/page.tsx` [NEW] | card, badge, toggle-group, alert-dialog (sheet on phone), sonner | `memory.list`, `lifeGraph.listGuesses` | undo |
| `web/memory-import.html` | `apps/web/app/(tempo)/memory/import/page.tsx` [NEW] | form, textarea, input, toggle-group per row, card, sonner | `memory.list` (duplicate check) | `?view=review`, saved |
| `web/modules.html` | `apps/web/app/(tempo)/modules/page.tsx` [NEW] | card, badge, switch, sonner | `modules.list`, `modules.getPlainMode`, `jobs.list` | `?plain=on` |
| `web/module-preview.html` | `apps/web/app/(tempo)/modules/preview/[draftId]/page.tsx` [NEW] | card, checkbox, alert-dialog, resizable, sonner | `modules.getDraft`, `pages.getDaily` | `?view=invalid`, approved |
| `web/nags.html` | `apps/web/app/(tempo)/nags/page.tsx` [NEW] | card, form, select, switch, textarea, sonner | `nags.list` | undo |

### Settings

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/settings-profile.html` | `apps/web/app/(tempo)/settings/profile/page.tsx` | form, input, radio-group, select, card, sonner | `profiles.getMine` | field errors |
| `web/settings-prefs.html` | `apps/web/app/(tempo)/settings/preferences/page.tsx` | select, slider, switch, toggle-group, card, badge | `profiles.getPrefs` | — |
| `web/settings-privacy.html` | `apps/web/app/(tempo)/settings/privacy/page.tsx` [NEW] | switch, checkbox, alert-dialog, card, sonner | `profiles.getPrivacy` | export requested, deletion pending |
| `web/settings-integrations.html` | `apps/web/app/(tempo)/settings/integrations/page.tsx` | card | `connectors.list` | — |
| `web/billing.html` | `apps/web/app/(tempo)/settings/billing/page.tsx` [MOVED: inventory `(tempo)/billing/page.tsx`] | card, badge, toggle-group | `billing.getMine`, `billing.listTiers` | — |
| `web/trial-end.html` | `apps/web/app/(tempo)/billing/trial-end/page.tsx` (layout Bare) | alert-dialog (inline), card, button | `billing.getMine` | continued, cancelled |

### Public

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `web/landing.html` | `apps/web/app/(marketing)/page.tsx` | navigation-menu, toggle-group, accordion, card, checkbox, button, sonner (inline) | none (prices from billing config) | — |
| `web/about.html` | `apps/web/app/(marketing)/about/page.tsx` | navigation-menu, toggle-group, card | none | — |
| `web/changelog.html` | `apps/web/app/(marketing)/changelog/page.tsx` | navigation-menu, toggle-group | `content/changelog/*.md` at build time | — |
| `web/sign-in.html` | `apps/web/app/(auth)/sign-in/page.tsx` | form, input, button, separator, card, toggle-group | `searchParams.next` | sending, invalid |
| `web/sign-up.html` | `apps/web/app/(auth)/sign-up/page.tsx` [NEW] | form, input, card, toggle-group | none | sending, invalid |
| `web/link-sent.html` | `apps/web/app/(auth)/sign-in/sent/page.tsx` [NEW] | card, toggle-group | `searchParams.email` | resending, resent |
| `web/approval-pending.html` | `apps/web/app/(auth)/sign-up/pending/page.tsx` [NEW] | card, toggle-group | `searchParams.email` | — |
| `web/onboarding.html` | `apps/web/app/(auth)/onboarding/page.tsx` | form, radio-group, slider, switch, textarea, card | `profiles.getMine` | saving, `?step=1..5` |

## Mobile (13)

Common: `tabs` nav variant (tab bar), `sheet` (side, the "more" menu), `avatar`.

| HTML file | Target route | shadcn | Data | States (extras) |
|---|---|---|---|---|
| `mobile/today.html` | `apps/mobile/app/(tempo)/(tabs)/today.tsx` | card, checkbox, toggle, toggle-group, button (floating) | `pages.getDaily`, `tasks.nextUp`, `profiles.getEnergy` | — |
| `mobile/capture.html` | `apps/mobile/app/(tempo)/capture.tsx` | textarea, checkbox, toggle-group, button | `capture.inboxCount` | — |
| `mobile/coach.html` | `apps/mobile/app/(tempo)/(tabs)/coach.tsx` | card, textarea, toggle, button, sonner, scroll-area | `coach.getThread`, `pages.getDaily` | undo |
| `mobile/voice-call.html` | `apps/mobile/app/(tempo)/voice-call.tsx` [NEW] | dialog (full screen), toggle, select, badge, button, sonner (inline), scroll-area | `voice.startSession`, `voice.minutesLeft`, `voice.transcript` | — |
| `mobile/tasks.html` | `apps/mobile/app/(tempo)/(tabs)/tasks.tsx` | tabs, input, checkbox, toggle-group, button (floating), sonner | `tasks.list`, `tasks.counts` | — |
| `mobile/notes.html` | `apps/mobile/app/(tempo)/(tabs)/notes.tsx` | input, toggle (pressed), button (floating) | `pages.listPinned`, `pages.listRecent`, `tags.listUsed` | — |
| `mobile/journal.html` | `apps/mobile/app/(tempo)/journal.tsx` | form, textarea, toggle-group, button | `journal.getEntry`, `journal.listEntries` | — |
| `mobile/habits.html` | `apps/mobile/app/(tempo)/habits.tsx` | card, toggle, select, form item, sonner | `habits.list` | — |
| `mobile/calendar.html` | `apps/mobile/app/(tempo)/calendar.tsx` | card, toggle-group | `calendar.week`, `calendar.day` | — |
| `mobile/routines.html` | `apps/mobile/app/(tempo)/routines.tsx` | card, button | `routines.list`, `routines.getRun` | `?view=guide` |
| `mobile/templates.html` | `apps/mobile/app/(tempo)/templates.tsx` | tabs, input, card, badge, toggle-group, sonner | `templates.list` | — |
| `mobile/settings.html` | `apps/mobile/app/(tempo)/settings.tsx` | card, slider, switch, toggle-group, alert-dialog, form item | `profiles.getMine` | — |
| `mobile/onboarding.html` | `apps/mobile/app/(auth)/onboarding.tsx` | form, radio-group, slider, switch, textarea | `profiles.getMine` | `?step=1..5` |

## Added routes not in `screen-inventory.md`

| Screen | File | Route |
|---|---|---|
| history | `web/coach-history.html` | `(tempo)/history` |
| voice-call (web) | `web/voice-call.html` | `components/voice/VoiceCall.tsx` over `/today` |
| page-blocks | `web/page-blocks.html` | `(tempo)/notes/[id]` (alias `/p/[pageId]` redirects) |
| weekly-page | `web/weekly-page.html` | `(tempo)/notes/[id]` (weekly type), entry `/week/[isoWeek]` |
| new-page | `web/new-page.html` | `(tempo)/notes/new` |
| modules | `web/modules.html` | `(tempo)/modules` |
| module-preview | `web/module-preview.html` | `(tempo)/modules/preview/[draftId]` |
| memory | `web/memory.html` | `(tempo)/memory` |
| memory-import | `web/memory-import.html` | `(tempo)/memory/import` |
| nags | `web/nags.html` | `(tempo)/nags` |
| settings-privacy | `web/settings-privacy.html` | `(tempo)/settings/privacy` |
| sign-up | `web/sign-up.html` | `(auth)/sign-up` |
| link-sent | `web/link-sent.html` | `(auth)/sign-in/sent` |
| approval-pending | `web/approval-pending.html` | `(auth)/sign-up/pending` |
| voice-call (mobile) | `mobile/voice-call.html` | `apps/mobile/app/(tempo)/voice-call.tsx` |

Also new but not on the requested list: `web/coach-thread.html` → `(tempo)/coach/[threadId]` (the inventory has one `coach` route, which the panel over Today now covers).

## Inventory entries with no separate file

- `coach` (`(tempo)/coach/page.tsx`) — built as the Coach panel over Today (`web/coach.html`) plus `web/coach-thread.html`.
- `(app)` group `dashboard` — legacy; not designed.
