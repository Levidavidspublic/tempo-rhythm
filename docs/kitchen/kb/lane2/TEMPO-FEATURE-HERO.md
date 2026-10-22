---
ticket: TEMPO-FEATURE-HERO
batch: FEATURE
type: component
lane: sol
wave: 1
browser_test: true
scope:
  - apps/web/components/marketing-pages/LandingPage.tsx
  - apps/web/app/v3/landing-motion.css
  - tests/e2e/landing-motion.spec.ts
  - docs/polish/evidence/feature-hero/
depends_on: []
overlap_test: false
expected_merge: clean
hold: false
---

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE.
WHEN: Amit's 21 October second-lane steer; independent worktree, shared register, four total worktrees across both lanes. LandingPage and the scoped new CSS/test do not overlap Lane 1, protected #1193/#1198 or inspected #1081/#1053. Serialize subsequent landing pricing/copy work after this ticket.
WHY: docs/HARD_RULES.md and docs/design/v3/DESIGN.md; Amit's explicit preview feature request.
GOAL: The existing public landing hero has a brief tasteful entrance, immediate stable rendering with reduced motion, and unchanged keyboard access and responsive layout.
SCOPE: Exactly the listed paths, at most three implementation files plus one test; evidence is metadata only.
MUTATES: UI and scoped tests only; no backend, schema, routes, dependencies, environment or deployment.
CONTRACT: Existing UI props only; no new backend calls or paid runtime behavior.
STEPS:
1. Code map: Read LandingPage.tsx, landing-copy.ts, existing design motion/spacing tokens and landing E2E patterns. Import the scoped CSS directly from LandingPage, not shared globals.
2. Implement the smallest fix using existing design tokens and mounted components. Preserve existing copy unless the scope explicitly includes translation. No orphan components.
3. Real / route Playwright coverage for default/reduced motion, final stable position, visible keyboard focus, EN/HE, 390 and1280 widths, and no horizontal overflow; actual before/after captures.
4. Run Bun1.3.9 and all AGENTS mandatory commands in order; preserve every existing check, assertion and timeout. Report exact failures and UNKNOWN.
DONE: Focused tests and current-head CI, CodeRabbit review and all guards pass before queueing into integration. bun run lint 0errors; bun run typecheck5/5; bun run test0fail; four scans/notices pass; local Playwright and build results reported exactly. A draft or local fixture is not proof of preview deployment.
EVIDENCE: Scoped evidence folder records source commit, focused test counts, command table/failure tails, before/after images at390/1280 in en/he, with fictional fixtures.
DO NOT: No forbidden technology, raw colors/pixel values outside tokens, test weakening/skips, new paid calls, keys/env access, deployment, production/default branch push, labels or bot commands. Do not change #1193/#1198 or any Lane 1 files. No live charges. Preserve reduced motion, keyboard access, visible focus,44px phone targets, one main/h1 and RTL. New Hebrew copy, if any, requires native read before production.
REPORT: Draft PR into integration with Closes issue reference and AGENTS status/ticket/evidence/changed/unknowns/notes format. Lead updates docs/kitchen/kb/OVERNIGHT-REPORT.md.
