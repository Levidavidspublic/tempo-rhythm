# App flow

## Verdict

The routes below exist as files on `integration` at `5504fc40`. A file existing is not proof the screen works. Browser acceptance of the whole set is UNKNOWN.

Levels are Amit and Nir, 2026-11-05. They are newer than the morning ladder in this file. Alpha is web only. It replaces NotePlan, a chatbot, and Basic Memory-style memory. Executor is in the backend. The person never connects an MCP. Stock text models only. MVP is that alpha, plus the Expo screens under Mobile, plus voice-to-voice on a rented GPU.

## Alpha path

Web only. Recurring tasks, automatic email alerts, several email accounts, WhatsApp, Discord, and reminders are not on this path.

1. Marketing home: `apps/web/app/page.tsx`. About, contact, privacy, terms, changelog sit beside it.
2. Sign in: `apps/web/app/sign-in/page.tsx`. Magic link. No password on the product target.
3. Sign up: `apps/web/app/sign-up/page.tsx`. Paid sign-up enters at once. Beta testers wait for Amit's approval. Guest sign-in is preview only.
4. Onboarding: `apps/web/app/(bare)/onboarding/page.tsx`.
5. The day: `apps/web/app/(tempo)/today/page.tsx` and `apps/web/app/(tempo)/plan/page.tsx`. Also `apps/web/app/(bare)/daily-note/page.tsx`. Which one is the single front door is UNKNOWN. Do not invent a fourth.
6. Notes: `notes/page.tsx`, `notes/[id]/page.tsx`, and `p/[pageId]/page.tsx`. There is no separate "lecture" route. Adding one is EXTRAPOLATED and not required.
7. Chatbot: `coach/page.tsx`, `brain-dump/page.tsx`, `command/page.tsx`.
8. Memory: `settings/memory/page.tsx` and `settings/memory/import/page.tsx`.
9. `calendar`, `week`, `week/[week]`, `projects`, and `projects/[id]` are listed under Other routes. Whether the alpha NotePlan shape uses them is UNKNOWN. Do not add a new screen for that.
10. Template routes exist: `templates/page.tsx`, `templates/editor/[id]/page.tsx`, `templates/sketch/page.tsx`, plus `(bare)/templates/builder` and `(bare)/templates/run/[id]`. Whether the alpha opens them is UNKNOWN.
11. The person never connects an MCP. Executor is in the backend. `settings/integrations/page.tsx` exists, and its file comment names MCP tokens. It is not an alpha step. A separate screen for the Executor backend is UNKNOWN.

A break has no route named "break". Whether the web break is breathwork, a template, or a chat reply is UNKNOWN. `apps/mobile/app/(tempo)/breathwork.tsx` is mobile, so it is outside the alpha path.

## MVP path

The alpha path, plus Expo mobile, plus voice-to-voice on a rented GPU.

Mobile screens are the ones already listed under Mobile. Do not add one.

Voice on the phone: `apps/mobile/app/(tempo)/voice-call.tsx`. The web voice surface is UNKNOWN in the route list. Whether that same mobile screen is also a Gen 2 phone call is UNKNOWN.

## Gen 1 path

StudyFetch-like, Wispr Flow-like dictation, NotebookLM-like, a CLI, and advanced search.

- Study and lecture notes stay on the note pages in the alpha path. A separate StudyFetch-like screen is not in this list. UNKNOWN.
- Wispr Flow-like dictation: no route in this list. UNKNOWN.
- NotebookLM-like: no route in this list. UNKNOWN.
- CLI: no route in this list. A screen for it is UNKNOWN.
- `search` is listed under Other routes. Whether that route is the Gen 1 advanced search is UNKNOWN.

## Gen 1.1 and 1.5

Several email accounts, WhatsApp, Discord, and reminders. Recurring tasks and automatic email alerts sit here, not in the alpha.

- Email: `settings/integrations/page.tsx` exists. A screen that connects several accounts is UNKNOWN.
- WhatsApp: no route in this list. UNKNOWN.
- Discord: no route in this list. UNKNOWN.
- Reminders: `settings/nags/page.tsx` and `notifications/page.tsx` exist. Whether those two are the whole reminder surface is UNKNOWN.
- Recurring tasks: `tasks` is listed under Other routes. A route named for recurrence is not in this list. UNKNOWN.
- Automatic email alerts: no route in this list. UNKNOWN.

## Gen 2

Read-only assistant. Phone calls. The website as a read-only API. No route is named for those. Those screens are UNKNOWN. Do not add them inside an alpha or MVP ticket.

## Gen 3

Read-write. Compliance level UNKNOWN. No route is named. That screen is UNKNOWN.

## Other routes already in the web app

These files exist. Their generation is not re-decided here. Treat them as present, not as alpha or MVP promises.

`dashboard`, `activity`, `calendar`, `goals`, `goals/[id]`, `goals/progress`, `habits`, `habits/[id]`, `history`, `insights`, `journal`, `modules`, `modules/preview/[draftId]`, `projects`, `projects/[id]`, `projects/[id]/kanban`, `routines`, `routines/[id]`, `search`, `tasks`, `tasks/checklists`, `tasks/energy`, `tasks/priority`, `tracking`, `week`, `week/[week]`, `billing`, `billing/trial-end`, `admin/approvals`, `ask-founder`, `empty-states`, `settings`, `settings/preferences`, `settings/privacy`, `settings/profile`, `settings/passkeys`, `checkout`, `success`, `page1`, `page2`, `page3`.

`empty-states` is a gallery route, not a user destination.

## Mobile

Under `apps/mobile/app/(tempo)`:

Tabs: `today`, `tasks`, `notes`, `coach`.

Also: `calendar`, `capture`, `habits`, `journal`, `routines`, `templates`, `tracking`, `settings`, `accessibility`, `breathwork`, `movement`, `session-player`, `voice-call`, `page/[id]`.

Auth: `sign-in`, `sign-up`, `onboarding`, `paywall`.

The paywall must not offer Stripe. It must not be the live guest door.

## Movement rules

- A coach change shows Accept, Edit, and Reject before data changes, except where the open confidence clash in [SPEC.md](./SPEC.md) is later decided.
- Undo is available for at least 5 minutes after an AI change.
- Hebrew flips the layout. English does not flip inside a Hebrew page's numbers or code.
- Settings is the door for profile, privacy, memory, nags, and integrations. Billing is `(tempo)/billing` and the bare trial-end page. The live processor is Whop or Paddle, not the Polar route, once config catches up.

## Sources

Route list from `apps/web/app` and `apps/mobile/app` at `5504fc40`. [PRD.md](./PRD.md). Amit and Nir, 2026-11-05.
