---
ticket: TEMPO-B04-06
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/account/
depends_on: [TEMPO-B04-01]
contract:
  - "api.users.getProfile(args: {}) -> {fullName?, email, greetingName} | null"
  - 'api.users.updateMyProfile(args: {fullName}) -> Id<"users">'
  - "api.users.deleteMyAccount(args: {}) -> {success: boolean, deletedCount: number}"
overlap_test: false
expected_merge: clean
hold: false
---

FOR: signed-in people on /settings/profile and in the shell greeting
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §4.1 A5: "'Hi, User' shows the person's name: Profile name, or the start of the email address." §5 "Soft delete: 30-day grace. Undo for 5 minutes inside the app; confirm anything external." §4.1 A4.
GOAL: /settings/profile edits the display name (saved, visible after reload) and deletes the account behind a typed confirmation that explains the 30-day grace; a reusable `GreetingName` shows the real name.
SCOPE: apps/web/components/account/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/account/ProfileForm.tsx (new), apps/web/components/account/DeleteAccountCard.tsx (new), apps/web/components/account/GreetingName.tsx (new, exports `GreetingName`), apps/web/components/account/ProfileForm.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. `ProfileForm`: email shown read-only, name input prefilled from `fullName`, Save calls `users.updateMyProfile`, success text "Saved".
3. `DeleteAccountCard`: explains that the account can be restored by signing in again within 30 days; requires typing DELETE; calls `users.deleteMyAccount`, then `signOut()` from `useAuthActions` and `router.push("/sign-in")`. An in-app 5-minute undo is not possible after sign-out: record it as `UNKNOWN` in the PR.
4. `GreetingName`: renders `Hi, {greetingName}` from `api.users.getProfile`; never renders the literal "User" (falls back to the email prefix, then "there"). Wiring it into the shell is a hot-file job for the merge agent.
5. Add or extend one test for the behaviour (apps/web/components/account/ProfileForm.test.tsx, Vitest + Testing Library, mock `convex/react`, `@convex-dev/auth/react`, `next/navigation`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows Save calls `updateMyProfile` with the trimmed name, Delete stays disabled until DELETE is typed, and GreetingName never shows "User"; checks green.
EVIDENCE: test output; screenshot of /settings/profile.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/tempo/Topbar.tsx or apps/web/components/today/ (hot files / other batches)
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(tempo)/settings/profile/page.tsx must import `ProfileForm` and `DeleteAccountCard`; the shell greeting must use `GreetingName` (hot files, merge agent wires them).
