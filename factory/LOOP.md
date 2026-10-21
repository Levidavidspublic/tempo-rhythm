# Factory loop — one Bugbot review per loop (batch loop)
<!-- Approved by Amit 2026-10-06 10:26 IDT. Goal: Cursor Bugbot (~$1.20/review) runs ONCE per loop, not once per PR. -->

## The loop
| Step | What | Who / tool | Review |
|---|---|---|---|
| 0 | **Ticket 0** (`type: data`, label `ticket:data`): the Convex architecture for EVERY component in the loop: schema tables, indexes, queries / mutations / actions, regenerated `convex/_generated/`. | Claude lane | CI only |
| 0b | Ticket 0 lands on `integration` through the merge queue (deploys to TEST `ceaseless-dog-617` via convex-deploy-test). Component tickets start only after this. | merge queue | — |
| 1 | **8–14 component tickets**, 3–5 per lane (each lane 2–5; 8 can't give every lane 3). Routing at dispatch: `scripts/factory/lane-limits.mjs` (usage limits `FACTORY_*_AT_LIMIT`, order `FACTORY_AGENT_PREFERENCE`, default claude,codex,cursor; `docs/factory/AGENT-LIMITS.md`): build tickets → **Claude/Codex**, browser tests → **Codex** (Playwright), Cursor last; all at limit → Freebuff, then OpenCode (manual, `needs:manual-run`). Components never touch `convex/`. | lanes | CI only (lint, typecheck, unit, Playwright). PRs open as **draft**. No `@cursor review`. |
| 2 | When the loop's component PRs are CI-green: `factory-batch` **build** creates `batch/<loop-id>` from `integration`, retargets each PR to it and merges its head (merges API). GitHub shows each component PR as **merged into `batch/<loop-id>`** (history kept; no "closed unmerged" noise). | `scripts/factory/batch-loop.mjs build` | — |
| 3 | **open**: ONE PR `batch/<loop-id>` → `integration`, labels `batch` + `factory`, body = `Closes #N` for every ticket (they close when the batch lands). | `… open` (user token) | — |
| 4 | **review**: ONE `@cursor review` on the batch PR (skipped if Bugbot already ran / runs on the head). | `… review` | **Bugbot, once** |
| 5 | Findings → fixed **on the batch branch** (`factory-review-fix` → `factory-lane-claude` `target_branch=batch/<loop-id>`, or a person). Each fix round = one more `review`. **Max 3 rounds** (`review-fix:1..3`), then `blocked:amit`. | review-fix / lane | Bugbot per round |
| 6 | Bugbot clean + the 5 required checks green → **enqueue** (GraphQL `enqueuePullRequest`, squash). | `… enqueue` | — |
| 7 | **finalize** (automatic when the batch PR merges): comment "landed via #B" + label `merged-via-batch` on each component PR; tickets → `status:done`. | factory-batch (`pull_request: closed`) | — |

Conflicts while building: the PR goes back to `integration`, label `batch:conflict`, and rolls to the next loop.

## Why component PRs are drafts
Bugbot reviews non-draft PRs automatically on every push while the dashboard auto-run is on. `.cursor/config/bugbot.yaml`
sets `drafts: false` + `frequency: oncePerPr`, but the YAML has **no manual-only switch**. Until Amit turns on
"Run only when mentioned" (below), draft is what keeps Bugbot off the component PRs. `build` merges drafts directly.

## Bugbot settings (docs: https://cursor.com/docs/bugbot)
- In repo: `.cursor/config/bugbot.yaml` (read from the PR's **base** branch): `drafts: false`, `oncePerPr`, autofix disabled.
  `.cursor/BUGBOT.md`: batch-PR review rules.
- Dashboard (Amit; not settable from the repo): **cursor.com/dashboard → Automations → Bugbot → Personal settings →
  "Run only when mentioned"** ON for the Cursor account linked to GitHub **Division6066** (it authors every factory PR).
  Team backstop: Bugbot → Repository settings → tempo-rhythm → **"Run only once per PR"** ON. Team-level manual-only exists
  only as the Admin API `POST /bugbot/repo/update {"manualTriggerOnly": true}` (needs a team Admin API key = Amit).

## Guards
- **scope-guard rule h**: a component PR that changes `convex/**` fails unless it has the `convex-arch` label added by
  Division6066. **Rule i**: a batch PR may link many tickets; files must sit inside the union of their scopes; no
  `convex/` (unless `convex-arch`), no shared hot files.
- config-guard unchanged. Branch protection unchanged: `integration` = PR + 5 required checks + merge queue (0 approvals);
  `batch/*` has no rules (merges into it need no review).

## Quiet hours (Amit 2026-10-06)
**22:00-09:00 Asia/Jerusalem nothing NEW starts**: no tickets, no `status:ready` promotion, no lane dispatch, no new
batch loop (`build`/`run` won't create a new `batch/<loop>`), no scheduled builder, no new cloud agent. Work in flight
finishes: lane fix runs (`fix_note`), batch open/review/status/enqueue/finalize, the merge queue. Required checks and
`convex-deploy-test` are never gated. Monitoring (nightly E2E, weekly report) runs outside 20:00-09:00.
Vars `FACTORY_QUIET_START`=22 / `FACTORY_QUIET_END`=9; override `FACTORY_QUIET_HOURS=off`. Details and the workflow
table: `docs/factory/QUIET-HOURS.md`. Script: `scripts/factory/quiet-hours.mjs`.

## Tokens (R15)
`build` / `open` / `review` / `enqueue` need a **user** token (Division6066): PRs opened with GITHUB_TOKEN start no CI, and
Bugbot needs a covered author. In Actions that is secret `FACTORY_BATCH_TOKEN` (not set → PARKED); otherwise run
`GH_TOKEN=… GITHUB_REPOSITORY=Levidavidspublic/tempo-rhythm node scripts/factory/batch-loop.mjs run --loop <id>`.

## Known limit — Codex can't push from a PR-comment task
Codex cloud tasks started by `@codex` on a PR run in a sandbox without GitHub write access: on #670 Codex fixed the findings
but could not push. Codex now has Playwright and gets `browser_test: true` tickets first (lane-limits.mjs); if a PR-comment
fix task still can't push, the fix needs its environment to allow it (Codex → Environments → tempo-rhythm: allow internet/GitHub access and "push to branch", or let
Codex open its own PR from the Codex web app). Fallback: a person/Claude applies Codex's diff on the branch.
