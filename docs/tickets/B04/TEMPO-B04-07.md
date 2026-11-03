---
ticket: TEMPO-B04-07
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/notifications-preferences/
depends_on: [TEMPO-B04-01]
contract:
  - "api.preferences.get(args: {}) -> Preferences"
  - "api.preferences.update(args: Partial<Preferences>) -> null"
  - "api.notifications.list(args: {unreadOnly?: boolean}) -> Notification[]"
  - 'api.notifications.markRead(args: {notificationId: Id<"notifications">}) -> null'
  - "api.notifications.markAllRead(args: {}) -> {updated: number}"
overlap_test: false
expected_merge: clean
hold: false
---

FOR: signed-in people on /settings/preferences and /notifications
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §4.1 A4: "Every control on every signed-in screen works" with "a reload check". §6: "Never shame" (notification copy stays neutral).
GOAL: /settings/preferences saves theme, language, week start, time zone and notification switches; /notifications lists notifications with mark read and mark all read.
SCOPE: apps/web/components/notifications-preferences/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/notifications-preferences/PreferencesForm.tsx (new), apps/web/components/notifications-preferences/NotificationsList.tsx (new), apps/web/components/notifications-preferences/PreferencesForm.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. `PreferencesForm`: controls for theme (system/light/dark), locale (en/he), weekStartsOn (Mon/Sun/Sat), timeZone (select from `Intl.supportedValuesOf("timeZone")`), emailReminders and inAppNotifications. Each change calls `preferences.update` with only the changed key; values come from `preferences.get` so a reload shows them.
3. A theme change also calls the existing `useTheme().setTheme` from `@/components/providers/ThemeProvider`.
4. `NotificationsList`: unread first, unread dot, per-item Mark read, a Mark all read button (disabled when nothing is unread), empty state "Nothing new".
5. Add or extend one test for the behaviour (apps/web/components/notifications-preferences/PreferencesForm.test.tsx, Vitest + Testing Library, mock `convex/react`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows each control calls `preferences.update` with its key, and Mark all read calls `notifications.markAllRead`; checks green.
EVIDENCE: test output; screenshots of both screens.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't add nag or coach settings (other batches own them)
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(tempo)/settings/preferences/page.tsx must import `PreferencesForm` and apps/web/app/(tempo)/notifications/page.tsx must import `NotificationsList` (hot files, merge agent wires them).
