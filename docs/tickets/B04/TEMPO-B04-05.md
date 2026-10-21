---
ticket: TEMPO-B04-05
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/onboarding/
depends_on: [TEMPO-B04-01]
contract:
  - "api.users.getProfile(args: {}) -> {fullName?, greetingName, onboardedAt?} | null"
  - "api.users.completeOnboarding(args: {fullName?}) -> {onboardedAt: number}"
  - 'api.templates.list(args: {scope?: "starter"}) -> Template[]'
overlap_test: false
expected_merge: clean
hold: false
---

FOR: new people right after first magic-link sign-in at /onboarding
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §4.1 A5: "'Hi, User' shows the person's name: Profile name, or the start of the email address." §5 "Templates as architecture" (the app proposes templates). The PRD defines no other onboarding step: UNKNOWN beyond name and a look at the starter templates.
GOAL: /onboarding asks "What should we call you?" (prefilled from the profile), lets the person finish, saves via completeOnboarding and sends them to /today.
SCOPE: apps/web/components/onboarding/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/onboarding/OnboardingFlow.tsx (new), apps/web/components/onboarding/NameStep.tsx (new), apps/web/components/onboarding/OnboardingFlow.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Build `OnboardingFlow` with 2 steps: `NameStep` (input prefilled from `greetingName` unless it is "there"), then a short read-only list of starter template names from `templates.list({scope: "starter"})` with a line that Tempo proposes one when a page is created.
3. Finish calls `users.completeOnboarding({fullName})` then `router.push("/today")`; a Skip link does the same without a name.
4. If `profile.onboardedAt` is already set, redirect to /today.
5. Add or extend one test for the behaviour (apps/web/components/onboarding/OnboardingFlow.test.tsx, Vitest + Testing Library, mock `convex/react` and `next/navigation`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows the name is prefilled, Finish calls `completeOnboarding` with the trimmed name and routes to /today, and an already-onboarded user is redirected; checks green.
EVIDENCE: test output; screenshot of /onboarding.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't invent extra onboarding steps (goals quiz, plan choice, coach setup): the PRD does not define them
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(bare)/onboarding/page.tsx must import `OnboardingFlow` (hot file, merge agent wires it); the PRD has no onboarding spec.
