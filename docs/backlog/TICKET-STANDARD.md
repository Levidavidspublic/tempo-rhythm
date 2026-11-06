# Ticket standard v2 (1 Nov 2026)

Set by Amit on 1 Nov 2026. Every factory ticket in this repo follows it. A ticket that doesn't is not ready.

## Why this exists
If a ticket's PR passes every gate below, it is practically certain that the code works as intended. "Practically" means failure is possible in theory but statistically negligible at scale. Amit checks only what no machine can: whether it feels right (the uncanny valley) and user testing.

The bar for depth: Dave Plummer fed Claude Code a 107-page spec and got a working cross-platform Task Manager (TMOG) on the first run (Tom's Hardware, 25 Aug 2026). Task Manager is simpler than this product. So the MVP's docs and tickets together should run to hundreds of pages. Depth is the point.

## Sizing: practically one-shot by a small model
- One ticket = ONE screen, OR one component, OR one backend function/table/endpoint. Never more.
- Written so that a small workhorse, running for about 2 hours with compaction, would practically always get it right. Then a mid-tier model has no excuse.
- At most 3 files plus 1 test file, unless the ticket says why.
- Nothing is left to decide. Exact file paths, exported names, TypeScript signatures, props and their types, the data contract, every state, every string of copy in English AND Hebrew, the design tokens. If something is not decided yet, the ticket is marked OPEN, names the open question, and is not buildable.

## Fields (all required)
The 11 AGENTS.md fields: FOR, WHEN, WHY, GOAL, SCOPE, MUTATES, STEPS, DONE, EVIDENCE, DO NOT, REPORT.
Plus:
- SPEC
  - For a screen or component: layout and spacing using the tokens in DESIGN.md / UI-BRIEF (name the tokens); every state (default, loading, empty, error, offline, success, disabled, and any others it has) with what shows in each; exact copy for every visible string in EN and HE; RTL behaviour; keyboard and screen-reader behaviour; breakpoints (mobile and desktop); motion.
  - For backend: the exact function or table, arguments and return types, auth rule (who may call it), error cases, limits.
- TESTS: the exact test cases the agent must implement, written Given / When / Then. The agent does not invent the tests. UI tickets include a Playwright end-to-end test that clicks through the screen or component and asserts each state. Backend tickets include unit tests for every error case.
- NUMBERS: the industry-standard numbers it must hit, each with a pass range and a source, or UNKNOWN. Examples: WCAG 2.2 AA text contrast 4.5:1 and target size at least 24x24 CSS px (WCAG 2.5.8); Core Web Vitals INP 200 ms or less, LCP 2.5 s or less, CLS 0.1 or less (web.dev); scrolling at 60 fps; API p95 latency limit. Each number becomes a pass/fail check.
- GATES: the gate list below, copied in, plus any ticket-specific checks.

## Gates (every PR)
### Binary checks (CI): pass or fail
1. Build, typecheck, lint.
2. The ticket's own TESTS, unit and Playwright, all green.
3. Every NUMBER inside its pass range.
4. Formatting and naming per Google's official style guides (TypeScript: https://google.github.io/styleguide/tsguide.html), via the repo's configured formatter and linter.
5. Secret scan and forbidden-tech scan.
6. Scope guard: the changed files must be inside SCOPE and MUTATES. ANY other file touched = automatic reject, even if the code works. Amit prefers false rejects to letting bad code through.
7. Config guard: no config or secret changes outside a config ticket.
8. Never weaken, skip, lower or delete a check or test to make something pass. Doing so = automatic reject.

### Judgement checks: the Jev judge (~typesafe/jev-latest via OpenRouter, Amit's only OpenRouter exception)
Jev gets the ticket, Amit's style guide and Google's style guide, and the PR diff plus REPORT. It returns a probability for each:
- instruction-following: read all the instructions, did every STEP, skipped none, did nothing extra;
- formatting;
- naming conventions;
- clean code.
Each must be 0.85 or more. Any massive violation fails the PR.

### Process check
REPORT lists every STEP and every DONE item with its evidence. A missing item fails the PR.

## The loop (for context; tickets must make it possible)
The current process proposal is [FACTORY-LOOP.md](../factory/FACTORY-LOOP.md). Do not use this older context paragraph to activate a loop. The 6 Nov run requires one proven ticket through review, integration and preview, then automations paused; a release test is after about five loops, the repository security scan is weekly, and feature/UX checks are twice weekly. Exact branch/merge mechanics still need reconciliation with the owning AGENTS/HARD_RULES and current workflows before activation. Only Amit deploys live. All gates above remain unchanged.

## References to apply when writing tickets
- This repo's AGENTS.md, include.md ("detailed enough" test), DESIGN.md, UI-BRIEF, APP-FLOW, BACKEND-SCHEMA, PRD, TRD, ROADMAP, docs/graph/, docs/source/.
- Amit's skills in Reason: amit-core, working-habits, software-factory.
- Matt Pocock's skills, https://github.com/mattpocock/skills (to-prd, to-issues, tdd, grill-me): use their method for breaking work into issues and test-first acceptance.
- elayadesign/ai-design-skills, landing-page-design: for any marketing or landing page.
- Google style guides for formatting and naming.
