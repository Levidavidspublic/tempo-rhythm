# Factory quiet hours

Amit, 6 Oct 2026 13:21 IDT. Applies to tempo-rhythm (the only repo with factory dispatch workflows).

## Policy
- **22:00-09:00 Asia/Jerusalem: nothing NEW is issued or started.** No new tickets, no `status:ready` promotion, no lane
  dispatch (Claude, Cursor, Codex), no new batch loop, no scheduled builder, no new cloud agent.
- **Work already running may finish.** Lane fix runs for an in-flight PR (`fix_note`, incl. batch fixes with
  `target_branch`), the merge queue, factory-batch open/review/status/enqueue/finalize of an in-flight loop, factory-merge,
  factory-failures and factory-review-fix keep running, and their PRs may merge through the queue overnight.
- **Never gated:** the required PR checks (`ci`, `e2e-preview`, `secret-scan`, `config-guard`, `scope-guard`), the merge
  queue (`merge_group`), Security, Graphify (local AST index, starts no agent) and `convex-deploy-test` after a merge.
- **Monitoring is off 20:00-09:00.** factory-nightly (full E2E against the integration preview) runs at 16:30 UTC =
  19:30 IDT / 18:30 IST. factory-weekly-report runs Sunday 07:00 UTC = 10:00 IDT / 09:00 IST. The Grok-side monitoring
  routines are scheduled outside 20:00-09:00 (not in this repo).

## How it works
- `scripts/factory/quiet-hours.mjs`: hour computed in **Asia/Jerusalem** (DST-safe), window = `FACTORY_QUIET_START`
  (default 22, inclusive) to `FACTORY_QUIET_END` (default 9, exclusive). Invalid values fall back to the default with a
  warning. **Override: variable `FACTORY_QUIET_HOURS=off`** (repo or org). `force=true` does NOT bypass quiet hours.
- `.github/workflows/factory-quiet-hours.yml`: reusable job (`workflow_call`) that runs the script and outputs `quiet`.
  Gated workflows run it as job `quiet` and skip their work job when `quiet == 'true'`, so the run ends **green** with a
  "quiet hours, skipped" notice.
- Unit tests: `node scripts/factory/test-factory.mjs` (quiet-hours tests 31-35).

| Workflow | Trigger | Quiet-hours behaviour |
|---|---|---|
| factory-dispatch (gh-aw) | cron `7,37 6-19 * * *` (covers 09:07-21:37 in IDT and IST), `status:ready` label, manual | custom job `quiet` gates the generated `agent` job (`jobs.agent.needs/if`), so no Copilot agent starts at night for any trigger (incl. force=true); detection/safe_outputs/conclusion skip, run is green. `next-tickets.mjs` also returns `paused` (second layer) |
| factory-lane-claude / -codex / -cursor | dispatch, `run:cursor` label | fresh builds skipped; runs with `fix_note` exempt (in-flight) |
| factory-promote | push `docs/tickets/**` | nothing promoted (promote by hand after 09:00); `dry_run=true` exempt |
| factory-batch | dispatch | `build`/`run` never create a NEW `batch/<loop>` branch; in-flight loops and open/review/status/enqueue/finalize not gated (`batch-loop.mjs`, also from a person's shell) |
| factory-release-pr | after factory-nightly, manual | skipped |
| factory-write-tickets | manual | skipped |
| Archify | push to integration, dispatch | no refresh started; the next push after 09:00 catches up |
| dispatch-router (`ready` label), agent-router (`agent:*` label) | label, manual | skipped |
| factory-nightly | cron 16:30 UTC | moved (monitoring) |
| factory-weekly-report | cron Sun 07:00 UTC | moved (monitoring) |
| factory-merge | cron every 15 min | not gated: merges in-flight PRs (PARKED, no Factory App) |
| factory-refresh (gh-aw) | merged factory PR, PRD/TRD push | **not yet gated**: its files are in open config PR #676; add the same gate after #676 lands |
| claude.yml | `@claude` mention by a person | not gated (interactive, used on in-flight PRs) |

## Cursor automations (none scheduled, no change needed)
- **Bugbot**: Manual Only (runs on `@cursor review`); batch PRs get one review per loop (factory/LOOP.md).
- **Factory code review**: runs when its label or `/factory-review` is used on a PR; event-driven, not scheduled.
- **Factory ticket filer**: webhook-triggered; not scheduled. Tickets filed overnight still reach `status:ready` only via
  factory-promote / dispatch, which are gated.
- `Factory build` (issue label `run:cursor`): DISABLED; the API lane (factory-lane-cursor) is gated.

## Other repos
omniagent and agentwright are configure-only (FACTORY_PAUSED=true) and have no factory-dispatch / factory-lane workflows.
Each has a human-label `dispatch-router.yml` (`ready` label). When their factory is set up, copy `quiet-hours.mjs`,
`factory-quiet-hours.yml` and the same gates.
