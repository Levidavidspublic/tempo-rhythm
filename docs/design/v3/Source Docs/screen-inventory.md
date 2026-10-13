# Screen inventory — Claude design export → target routes

**Source:** `docs/design/claude-export/design-system/` (Tempo Flow Design System v1.0, April 2026).
**Router map source:** `design-system/app.html` lines 60–109 (`SCREENS` object).

## Web route groups

Next.js App Router groups under `apps/web/app/`:

| Group | Layout | Purpose |
|---|---|---|
| `(tempo)` | `TempoShell` — sidebar + coach dock | Primary product screens (42 screens below) |
| `(bare)` | Minimal chrome — focus / builder flows | Daily note, onboarding, template builder/run, trial-end |
| `(app)` | Grain background shell | Legacy/dashboard experiments (`dashboard`) |
| `(auth)` | Auth gate wrapper | Sign-in/up flows that share auth layout |

Marketing and legal pages (`/about`, `/privacy`, `/sign-in`, etc.) sit outside these groups at the app root.

## Web — 42 screens

Target base: `apps/web/app/(tempo)/`

### Flow (5)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `daily-note` | `(tempo)/daily-note/page.tsx` | screens-1.jsx | Daily Note (bare) |
| `today` | `(tempo)/today/page.tsx` | screens-1.jsx | Today |
| `brain-dump` | `(tempo)/brain-dump/page.tsx` | screens-1.jsx | Brain Dump |
| `coach` | `(tempo)/coach/page.tsx` | screens-1.jsx / coach-dock.jsx | Coach |
| `plan` | `(tempo)/plan/page.tsx` | screens-1.jsx | Planning |

### Library (15)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `tasks` | `(tempo)/tasks/page.tsx` | screens-2.jsx | Tasks |
| `notes` | `(tempo)/notes/page.tsx` | screens-2.jsx | Notes |
| `note-detail` | `(tempo)/notes/[id]/page.tsx` | screens-2.jsx | Note · editor |
| `journal` | `(tempo)/journal/page.tsx` | screens-2.jsx | Journal |
| `calendar` | `(tempo)/calendar/page.tsx` | screens-3.jsx | Calendar |
| `habits` | `(tempo)/habits/page.tsx` | screens-3.jsx | Habits |
| `habit-detail` | `(tempo)/habits/[id]/page.tsx` | screens-3.jsx | Habit detail |
| `routines` | `(tempo)/routines/page.tsx` | screens-3.jsx | Routines |
| `routine-detail` | `(tempo)/routines/[id]/page.tsx` | screens-3.jsx | Routine · guided |
| `goals` | `(tempo)/goals/page.tsx` | screens-4.jsx | Goals |
| `goal-detail` | `(tempo)/goals/[id]/page.tsx` | screens-4.jsx | Goal detail |
| `goals-progress` | `(tempo)/goals/progress/page.tsx` | screens-4.jsx | Goals · chart |
| `projects` | `(tempo)/projects/page.tsx` | screens-4.jsx | Projects |
| `project-detail` | `(tempo)/projects/[id]/page.tsx` | screens-4.jsx | Project detail |
| `project-kanban` | `(tempo)/projects/[id]/kanban/page.tsx` | screens-4.jsx | Project · kanban |

### You (9)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `analytics` | `(tempo)/insights/page.tsx` | screens-5.jsx | Insights |
| `activity` | `(tempo)/activity/page.tsx` | screens-5.jsx | Recent activity |
| `templates` | `(tempo)/templates/page.tsx` | screens-templates.jsx | Templates |
| `template-builder` | `(tempo)/templates/builder/page.tsx` | screens-template-builder.jsx + -ui.jsx + -slash.jsx | Template · builder (bare) |
| `template-run` | `(tempo)/templates/run/[id]/page.tsx` | screens-template-run.jsx | Template · run (bare) |
| `template-editor` | `(tempo)/templates/editor/[id]/page.tsx` | screens-5.jsx | Template · editor (legacy) |
| `template-sketch` | `(tempo)/templates/sketch/page.tsx` | screens-5.jsx | Template · sketch |
| `search` | `(tempo)/search/page.tsx` | screens-5.jsx | Search |
| `command` | `(tempo)/command/page.tsx` | screens-5.jsx | Command bar |
| `empty-states` | `(tempo)/empty-states/page.tsx` | screens-6.jsx | Empty states |

### Settings (7)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `settings` | `(tempo)/settings/profile/page.tsx` | screens-6.jsx | Settings · profile |
| `settings-prefs` | `(tempo)/settings/preferences/page.tsx` | screens-6.jsx | Settings · prefs |
| `settings-integrations` | `(tempo)/settings/integrations/page.tsx` | screens-6.jsx | Settings · sync |
| `billing` | `(tempo)/billing/page.tsx` | screens-6.jsx | Trial & billing |
| `trial-end` | `(tempo)/billing/trial-end/page.tsx` | screens-6.jsx | Trial ended |
| `ask-founder` | `(tempo)/ask-founder/page.tsx` | screens-6.jsx | Ask the founder |
| `notifications` | `(tempo)/notifications/page.tsx` | screens-6.jsx | Notifications |

### Marketing (3 + home)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `landing` | `/` (marketing home) | landing.html | Landing page |
| `about` | `/about` | about.html + screens-7.jsx | About |
| `changelog` | `/changelog` | changelog.html + screens-7.jsx | Changelog |

### Onboarding + Auth (2 bare)

| Slug | Route | Source file | Title |
|---|---|---|---|
| `sign-in` | `/sign-in` | screens-7.jsx | Sign in (bare, no shell) |
| `onboarding` | `/onboarding` | screens-7.jsx | Onboarding (bare, 5 steps) |

## Mobile — 12 screens

Target base: `apps/mobile/app/(tempo)/`

Source: `design-system/mobile/mobile-screens-a.jsx`, `mobile-screens-b.jsx`, `mobile-shell.jsx`.

| Slug | Route | Source | Title |
|---|---|---|---|
| `today` | `(tempo)/(tabs)/today.tsx` | mobile-screens-a.jsx | Today (tab home) |
| `capture` | `(tempo)/capture.tsx` | mobile-screens-a.jsx | Capture composer (modal) |
| `coach` | `(tempo)/(tabs)/coach.tsx` | mobile-screens-a.jsx | Coach |
| `tasks` | `(tempo)/(tabs)/tasks.tsx` | mobile-screens-a.jsx | Tasks |
| `notes` | `(tempo)/(tabs)/notes.tsx` | mobile-screens-a.jsx | Notes |
| `journal` | `(tempo)/journal.tsx` | mobile-screens-b.jsx | Journal |
| `habits` | `(tempo)/habits.tsx` | mobile-screens-b.jsx | Habits |
| `calendar` | `(tempo)/calendar.tsx` | mobile-screens-b.jsx | Calendar |
| `routines` | `(tempo)/routines.tsx` | mobile-screens-b.jsx | Routines |
| `templates` | `(tempo)/templates.tsx` | mobile-screens-b.jsx | Templates |
| `settings` | `(tempo)/settings.tsx` | mobile-screens-b.jsx | Settings |
| `onboarding` | `(auth)/onboarding.tsx` | mobile-screens-b.jsx | Onboarding |

## Shared primitives

Target: `packages/ui/src/`.

| Primitive | Source file | Notes |
|---|---|---|
| `Icon` set (lucide-ish) | components.jsx:L6–L91 | 70+ icons, 1.5px stroke |
| `BrandMark`, `Wordmark` | components.jsx:L93–L110 | Logo |
| `AppProvider` / `useApp` | components.jsx:L112–L160 | Replace with Next/Expo router + theme context |
| `SoftCard`, `Button`, `Field`, `Pill`, `Ring` | components.jsx | Shape primitives |
| `Sidebar`, `Topbar` | components.jsx | Web app shell |
| `TaskRow` | components.jsx | List-item with optimistic check |
| `HabitRing` | components.jsx | Streak ring |
| `CoachBubble` | components.jsx / coach-dock.jsx | Coach message bubble |
| `CoachDock` | coach-dock.jsx | Full coach panel |
| `VoiceChat` | voice-chat.jsx | Voice interaction |
| `iOSFrame` (preview-only) | ios-frame.jsx | Design canvas wrapper, keep in `packages/ui/preview/` |
