---
ticket: TEMPO-B04-01
batch: B04
type: data
lane: claude
scope:
  - convex/
depends_on: []
contract:
  - 'api.templates.list(args: {scope?: "all"|"starter"|"mine"}) -> Template[]'
  - "api.templates.get(args: {templateId: string}) -> Template | null"
  - 'api.templates.proposeForPage(args: {periodType: "daily"|"weekly"|"monthly"|"none", title?: string}) -> {templateId: string, name: string, reason: string} | null'
  - 'api.templates.applyToNote(args: {templateId: string, title?: string}) -> Id<"notes">'
  - 'api.templates.create(args: {name: string, description?: string, periodType, body: string}) -> Id<"templates">'
  - 'api.templates.update(args: {templateId: Id<"templates">, name?, description?, periodType?, body?}) -> Id<"templates">'
  - 'api.templates.remove(args: {templateId: Id<"templates">}) -> null'
  - "api.preferences.get(args: {}) -> Preferences"
  - "api.preferences.update(args: Partial<Preferences>) -> null"
  - "api.notifications.list(args: {unreadOnly?: boolean}) -> Notification[]"
  - 'api.notifications.markRead(args: {notificationId: Id<"notifications">}) -> null'
  - "api.notifications.markAllRead(args: {}) -> {updated: number}"
  - 'api.users.updateMyProfile(args: {fullName: string}) -> Id<"users">'
  - "api.users.completeOnboarding(args: {fullName?: string}) -> {onboardedAt: number}"
  - "api.users.getMyPlan(args: {}) -> {plan, status, label, betaAccess, entitlementTier, userType, isBeta} | null"
  - "api.search.all(args: {query: string}) -> {notes, tasks, habits, goals}"
  - "api.users.getProfile(args: {}) -> user & {greetingName: string, onboardedAt?: number} | null  (EXISTING, behaviour fixed)"
overlap_test: false
expected_merge: clean
hold: false
---

FOR: the component tickets of batch B04
WHEN: first in the batch; components depend on it
WHY: docs/PRD.md §5 "Templates as architecture": "The app proposes the right template when a page is created; the user never hand-builds one. Starting set adapted from popular public Joplin, Notesnook, Notion and Obsidian templates (structure, not text)." §4.1 A5: "'Hi, User' shows the person's name: Profile name, or the start of the email address" (cause: convex/users.ts createOrUpdateUser writes the fallback fullName "User"). §5 "Billing visible" and "Soft delete: 30-day grace". §4.1 A4: every control on every signed-in screen works.
GOAL: provide every function in docs/contracts/B04.md so the templates, account, settings, notifications, billing and search screens have real data.
SCOPE: convex/ only (schema, functions, and the regenerated convex/_generated/)
MUTATES: convex/schema.ts (new tables `templates`, `userPreferences`, `notifications`; new optional field `users.onboardedAt`), convex/templates.ts (new), convex/lib/templateCatalog.ts (new, starter set as code constants), convex/preferences.ts (new), convex/notifications.ts (new), convex/search.ts (new), convex/users.ts (add updateMyProfile, completeOnboarding, getMyPlan; fix getProfile and the createOrUpdateUser name fallback), convex/lib/accountDeletion.ts (add `templates` to USER_OWNED_TABLES only if it has by_userId + deletedAt), tests: convex/templates.test.ts, convex/users.test.ts (new or extended)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for convex/ and the callers of the touched tables (users, notes, tasks, habits, goals).
2. Schema: `templates` {userId, name, description?, periodType, body, createdAt, updatedAt, deletedAt?} index by_userId; `userPreferences` {userId, theme, locale, weekStartsOn, timeZone, emailReminders, inAppNotifications, updatedAt} index by_userId; `notifications` {userId, title, body, kind, readAt?, createdAt, deletedAt?} index by_userId_createdAt; `users.onboardedAt` optional number. All additive (widen only; see convex/MIGRATIONS.md).
3. convex/lib/templateCatalog.ts: a starter set of 8 to 10 templates with ids `starter:<slug>` covering daily, weekly and monthly pages, meeting notes, project brief, reading notes, journal, and a task/project review. Structure (headings, checklists) adapted from public Joplin, Notesnook, Notion and Obsidian templates; write original text, copy none. No emoji, no shaming words. Body is markdown with no JSON.
4. convex/templates.ts: implement the 7 functions. `list` merges starter + the user's non-deleted templates. `proposeForPage` is a pure rule (periodType -> starter template, else null) returning a human `reason`; it never calls a model. `applyToNote` inserts a note (periodType from the template) and returns its id; `remove` is a soft delete (deletedAt). Starter templates cannot be updated or removed (throw a clear Error).
5. convex/preferences.ts: `get` returns defaults (theme "system", locale "en", weekStartsOn 1, timeZone "UTC", emailReminders true, inAppNotifications true) when no row exists; `update` upserts.
6. convex/notifications.ts: list (newest first, user-scoped, non-deleted), markRead, markAllRead (all owner-checked).
7. convex/search.ts `all`: trims the query, returns empty arrays for an empty query, otherwise a case-insensitive match over the user's non-deleted notes (title, body -> `snippet` of at most 120 chars), tasks (title), habits (name), goals (title); at most 8 per group.
8. convex/users.ts: `updateMyProfile` (current user only, trims, rejects empty); `completeOnboarding` (optional fullName, sets onboardedAt, idempotent); `getMyPlan` reads subscriptionStates + users.betaAccess/entitlementTier/userType and returns the REAL beta plan (label e.g. "Beta tester" / "Founder" / "Free"); never invent a price or checkout. Fix `createOrUpdateUser` so it no longer stores the literal "User" as fullName when the identity has no name (store undefined). Make `getProfile.greetingName` = fullName if non-empty and not the placeholder "User", else the part of the email before "@", else "there"; also return `onboardedAt`.
9. Regenerate and commit `convex/_generated/` (`bunx convex codegen`; needs Convex auth, see AGENTS.md §8.8).
10. Write tests for each function (auth required, owner scoping, starter immutability, greeting fallback to email prefix, soft delete); `bun run lint && bun run typecheck && bun run test`.
11. Note: it deploys to the TEST deployment (ceaseless-dog-617) only on merge, via convex-deploy-test. Never deploy yourself.
12. In REPORT list the hot files the merge agent must touch (docs/contracts/B04.md "Hot files for the merge agent"). Do not edit them.
DONE: every contract name exists in convex/_generated/api.d.ts with the listed shapes; the new tests pass; checks green.
EVIDENCE: test output; list of contract names -> file:line.
DO NOT:
- don't change files outside convex/
- don't deploy; never touch the live deployment
- don't rename or remove existing functions other tickets use (users.getProfile, users.deleteMyAccount, users.updateProfile stay)
- don't add model calls: template proposal is rule-based; the model never writes to the database (PRD §6)
- don't add tables or functions for /today, /plan, /habits, calendar, tasks, notes, tracking, insights, brain dump, coach, nags or memory (other batches)
REPORT: contract names created, anything that couldn't match the contract and why.
