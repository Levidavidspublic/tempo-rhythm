# App flow

## Verdict

The routes below exist as files on `integration` at `5504fc40`. A file existing is not proof the screen works. Browser acceptance of the whole set is UNKNOWN.

The MVP path is the day, notes, chat, templates, memory, and a Gmail connection. Other routes may stay in the repo. They are not MVP scope unless this file says so.

## MVP path

1. Marketing home: `apps/web/app/page.tsx`. About, contact, privacy, terms, changelog sit beside it.
2. Sign in: `apps/web/app/sign-in/page.tsx`. Magic link. No password on the product target.
3. Sign up: `apps/web/app/sign-up/page.tsx`. Paid sign-up enters at once. Beta testers wait for Amit's approval. Guest sign-in is preview only.
4. Onboarding: `apps/web/app/(bare)/onboarding/page.tsx`.
5. The day: `apps/web/app/(tempo)/today/page.tsx` and `apps/web/app/(tempo)/plan/page.tsx`. Also `apps/web/app/(bare)/daily-note/page.tsx`. Which one is the single front door is UNKNOWN. Do not invent a fourth.
6. Notes: `notes/page.tsx`, `notes/[id]/page.tsx`, and `p/[pageId]/page.tsx`.
7. Study and lecture notes use those note pages. There is no separate "lecture" route. Adding one is EXTRAPOLATED and not required.
8. Chat and brain dump: `coach/page.tsx`, `brain-dump/page.tsx`, `command/page.tsx`.
9. Templates: `templates/page.tsx`, `templates/editor/[id]/page.tsx`, `templates/sketch/page.tsx`, plus `(bare)/templates/builder` and `(bare)/templates/run/[id]`.
10. A break: no route is named "break". `apps/mobile/app/(tempo)/breathwork.tsx` exists on mobile. Whether the web break is breathwork, a template, or a chat reply is UNKNOWN.
11. Memory: `settings/memory/page.tsx` and `settings/memory/import/page.tsx`.
12. Gmail connection: `settings/integrations/page.tsx`. Proactive use of that connection is Gen 1.
13. Voice: `apps/mobile/app/(tempo)/voice-call.tsx` exists. The web voice surface is UNKNOWN in the route list. The product target is voice-to-voice on web and phone.

## Gen 1 path

From the day or the chat, Tempo may raise a nag or a notification.

- `settings/nags/page.tsx`
- `notifications/page.tsx`

Email and WhatsApp are sources, not extra planner screens, until a ticket adds one. WhatsApp has no route in this list.

## Gen 2 and Gen 3

No route is named for website-to-API or for "phone the bank". Those screens are UNKNOWN. Do not add them inside an MVP ticket.

## Other routes already in the web app

These files exist. Their generation is not re-decided here. Treat them as present, not as MVP promises.

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

Route list from `apps/web/app` and `apps/mobile/app` at `5504fc40`. [PRD.md](./PRD.md).
