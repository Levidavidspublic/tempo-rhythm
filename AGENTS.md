# Software factory — agent instructions
<!-- owner: Amit · tool-agnostic and evergreen: tools are named only in factory/SLOTS.md · keep < 200 lines -->

## What this repo is
A product built by a ticket-driven software factory. Agents close one ticket at a time.
The owner keeps four things: decisions, secrets, spend, and deploys to live.
Every tool is a slot. `factory/SLOTS.md` says which tool fills each slot in this repo.

## Read first, every session
1. `factory/SLOTS.md`: tools per slot, commands, secret names, quiet days.
2. Your ticket, all 11 fields.
3. The doc sections your ticket's WHY points to. The six docs live in the doc store: PRD, TRD, App flow, UI brief, Backend schema, Roadmap.
4. Run the code-map steps in STEPS before editing. Other tickets may have changed the code today.
5. Take today's date from the system clock, never from the conversation or session start.

## Commands
Use the exact commands under **Commands** in `factory/SLOTS.md` (install, dev, test, lint, typecheck, build, e2e).
If a command you need is missing there, report `blocked: missing command <name>`. Don't invent one.

## Testing (cloud agents)
For cloud agent tasks (for example an agent mention on a PR). The commands match **Commands** in `factory/SLOTS.md` and the `ci` jobs in `.github/workflows/ci.yml`.
The environment setup script may already have run `bun install` and installed Chromium. The agent phase may have no internet.

Before you finish, run all of these from the repo root, in order. Run every step even if an earlier one fails:
0. Make sure Bun is 1.3.9 (older Bun has no `describe.serial` and misreads `bun.lock`, which gives mismatched `react`/`react-dom`). Run `bun --version`. If it does not print `1.3.9`, run `curl -fsSL https://bun.sh/install | bash -s bun-v1.3.9 && export PATH=$HOME/.bun/bin:$PATH`, then check `bun --version` again. Then run `bun install --frozen-lockfile` (again, if it already ran with another Bun). If Bun 1.3.9 can't be installed (no internet), report `UNKNOWN: bun 1.3.9 (install blocked)` and run the rest anyway.
1. `bun install --frozen-lockfile` (skip if step 0 just ran it)
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test`
5. `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices`
6. `CI=1 bunx playwright test --reporter=line`. `playwright.config.ts` starts the web dev server on `localhost:3000` with mock values (placeholder Convex URL, E2E auth bypass). Tests that need `TEMPO_E2E_STORAGE_STATE` or `PLAYWRIGHT_BASE_URL` skip; that is expected.
7. `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build`.

Sandbox network failures are `UNKNOWN`, not code failures:
- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) blocked or unreachable, in the build or the dev server: report `UNKNOWN: <command> (Google Fonts blocked)`.
- Playwright browser download from its CDN failing (for example 403), or the Playwright `webServer` timing out only because of a Google Fonts fetch: report `UNKNOWN: e2e (Playwright CDN / fonts blocked)`. You may use an already-installed Chromium instead.

Don't:
- set `PLAYWRIGHT_BASE_URL`, or run tests against a preview or live URL;
- use real keys, or run `convex dev`, `convex deploy` or any `convex:*` script;
- edit test config, CI files or scan baselines, or skip tests, to get green.

Report the results in the PR body (or your final message when you're not opening a PR) under `Test results (cloud agent sandbox)`: the Bun version used, then each command with pass, fail or skip counts, plus the last 20 lines of any failure. Anything you could not run goes in as `UNKNOWN: <command> (<reason>)`.

## Layout
- `packages/backend` — schema and backend functions. Only a batch's backend ticket edits this.
- In this repo the backend folder is the one named in SLOTS.md (tempo: convex/).
- `packages/core` — shared logic. No UI, no platform APIs.
- `packages/ui` — shared components, built on the design system named in SLOTS.md.
- `apps/<shell>` — thin shells (web, mobile, desktop, extension). Shells differ only in OS-access features.
- `factory/` — SLOTS.md, the ticket template, run logs.
- The six docs live in the doc store, not in this repo.

## The ticket (11 fields)
| Field | Meaning |
|---|---|
| FOR | product, repo, and which lane runs it |
| WHEN | order and dependencies (`after #n`) |
| WHY | links to the doc sections this serves |
| GOAL | one sentence: what exists after this ticket |
| SCOPE | the files you may touch: at most 3 files + 1 test |
| MUTATES | systems and data this changes (schema, env, routes) |
| STEPS | ordered steps, starting with code-map steps |
| DONE | a command and its expected output |
| EVIDENCE | what to paste into the PR to prove DONE |
| DO NOT | things that look helpful but are out of bounds |
| REPORT | where to post the result, in the format below |

A model named in a ticket is labelled either `code model` (the model that writes this code) or `runtime model` (the model the product calls). Never mix them up.

## Rules
1. One ticket = one folder, one branch, one PR. Branch name: `t/<issue-number>-<short-slug>`.
2. Touch only files listed in SCOPE. If the work truly needs more, stop and report `blocked: scope overflow`. Don't split the ticket yourself.
3. Change only the systems named in MUTATES. A change outside MUTATES fails the checks.
4. Component tickets never edit the backend folder named in `factory/SLOTS.md` (tempo: `convex/`; scope-guard fails the PR unless the owner labels it `convex-arch`). Call the functions the loop's ticket 0 (backend architecture ticket) defines. If one is missing, report `blocked: missing backend <function>`.
5. You are done when the DONE command prints its expected output and all checks are green. Paste both into the PR as EVIDENCE.
6. A mock or demo key never proves DONE when DONE names a real check.
7. Anything you could not verify goes in the PR as `UNKNOWN: <what>`. Never fill a gap with a plausible guess.
8. Build tickets never edit the six docs. If a doc is wrong, say so under `notes for ticket sync` in your report. Doc changes go through the spec line.
9. Never edit, close or reassign another ticket.
10. Use the code model the dispatcher assigned. Code is written only with mid-tier (billing-tier) models.
11. Running headless (CI, cloud agent): don't ask questions. Report `blocked: question — <question>` and stop.
12. Open your PR as a draft and never ask for a review bot run (`@cursor review`, `bugbot run`). Bugbot reviews the whole loop once, on the batch PR (`factory/LOOP.md`).

## Never — and what enforces it
These are explained here and enforced elsewhere. Each item names its enforcement, which is listed in SLOTS.md → Enforcement.
- Deploy to live, or merge into the live branch. Enforced by: live-environment protection and branch protection.
- Push straight to the default branch. Enforced by: branch protection (PRs only).
- Read, print, log or commit a secret value. Enforced by: deny rules in each agent's settings, plus secret scanning.
- Spend money the ticket doesn't authorise (paid APIs, paid services). Enforced by: scoped keys and spend caps on each provider.

## Secrets
Use names only. The list is in SLOTS.md → Secrets. The configurator sets them from the vault.
If a secret is missing, report `blocked: missing secret <NAME>`. Never ask for a value, and never create a placeholder value.

## Failing and stuck
- When checks or review fail, fix it on the same branch. A ticket gets 3 attempts in total, including review-fix rounds.
- After the 3rd failure: stop and report `stuck` with the last error. Don't make a 4th attempt, and don't widen scope to get it to pass.
- Tickets whose WHEN depends on a stuck ticket wait. Everything else keeps running.
- If today is a quiet day (SLOTS.md → Schedule), stuck work waits for the next active day.

## Report format
Post this on the ticket when you finish or stop:
```
status: done | stuck | blocked
ticket: #<n>
evidence: <DONE command> -> <output>
changed: <files>
unknowns: <list or none>
notes for ticket sync: <follow-ups, doc errors, or none>
```

## Done means
- The DONE command prints its expected output.
- CI, browser test, speed limit and scope check are all green.
- For a component ticket: CI is green on your PR. The review gate runs once per loop on the batch PR (`factory/LOOP.md`), not on your PR. It is not a merge-queue check.
- The report is posted on the ticket.

What happens after that is automatic: the PR merges into the loop's batch branch, the batch PR gets one review and goes through the merge queue into integration, and integration deploys to preview. Deploying to live is the owner's job.

## Picking up a factory ticket (Freebuff / OpenCode)

For any agent a person runs by hand, such as Freebuff or OpenCode. The router sends a ticket here only when Claude, Codex and Cursor are all at their usage limits (`docs/factory/AGENT-LIMITS.md`).

1. **Quiet hours:** don't start anything new between 22:00 and 09:00 Asia/Jerusalem. Work already running may finish. No new branches, PRs or comments in those hours.
2. **Where tickets live:** GitHub issues in this repo labelled `status:ready` + `needs:manual-run` + an `agent:*` label. Only take an issue whose `agent:*` label matches you (`agent:freebuff`, `agent:opencode`).
3. **Read before you code:** the whole issue and its comments (FOR / GOAL / SCOPE / DONE), this AGENTS.md, `RULES.md`, and `.github/workflows/*`, so you know which checks must pass (ci, e2e-preview, secret-scan, config-guard, scope-guard).
4. **Branch:** `t/<issue>-<ticket-id-lowercase>` off `integration`, e.g. `t/712-b04-03`, the factory's name (`ticketBranch()` in `scripts/factory/factory-lib.mjs`). If the branch already exists, continue on it.
5. **PR:** a **draft** PR **into `integration`** (never `master` or `live`), opened as Division6066, with `Closes #<issue>` in the body. One ticket per PR. Then remove `needs:manual-run` and the `agent:*` label, and add `status:in-pr`.
6. **CI must pass:** run `bun run lint`, `bun run typecheck`, `bun run test` and the ticket's DONE commands locally first. A PR with red CI isn't done: fix it, or comment that you're blocked.
7. **Stay in scope:** only touch the ticket's SCOPE folders. **No Convex edits** (`convex/`, schema, functions, env, deployments) unless the issue is a **Ticket 0** (label `convex-arch`).
8. **When you're stuck:** comment on the issue with what you tried, then stop. Don't guess at scope.
9. **Never pay-per-use:** Freebuff on its free tier only; OpenCode on its free models or the Go plan only (Zen bills per request, so don't use it without Amit's OK). No metered API keys. Never print secrets.
