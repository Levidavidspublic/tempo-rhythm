# Factory loop - lane loops and four release gates

The process is defined by `docs/HARD_RULES.md` REPO RULES 9. Existing checks and protections remain required. Legacy `batch/*` automation is not authority to use an older branch, reviewer or merge policy. Its compatibility with lane loops is UNKNOWN; do not dispatch it to bypass this process.

## Loop flow

1. Refresh Graphify at the start of each loop using the local-only command in `docs/factory/CODE-MAP-TOOLS.md`.
2. Cursor writes tickets from the PRD, TRD, docs and Graphify map. Jev scores each ticket; a fresh reviewer samples 20 per batch. Passed tickets enter Concord with their Claude or Codex lane.
3. Each ticket uses its own branch/worktree and PR into `loop/claude-<date>` or `loop/codex-<date>`. The lead merges only after all programmatic CI and Jev checks are green. Ticket workers never change Convex.
4. The lead opens one completed loop PR into integration. Gate 1 (Claude lane) or Gate 2 (Codex lane) requires CodeRabbit review, security checks and unit tests. Maximum three fix rounds; one push per fix, no manual CodeRabbit retriggers. All green: the lead merges into integration and verifies preview.
5. After both lanes merge, open or update one release PR integration to master. Gate 3 checks changes since the last preview with CodeRabbit, security checks and unit tests.
6. After several previews, Gate 4 performs the final full review, security checks and unit tests on that same release PR. Only Amit merges it into master and production. Failed production checks require rollback to the last good version; execution of a production action remains Amit's.

## Gates and authority

- CodeRabbit is the only PR reviewer. Council is architecture and tech stack only, never PR review or ticket assignment.
- Existing lint, typecheck, unit, build, production web-surface build, E2E, security, forbidden-tech/token, scope and Jev checks remain enforcing. Green aggregate status cannot replace a skipped underlying test.
- Config approval labels are applied only by Amit's account to the current head, following config-guard. Never apply, restore or work around them.
- Convex is frozen: no code, schema, functions, environment or deployment changes. Historical Ticket 0 and `convex-arch` exceptions do not authorize changes.
- Concord status moves claimed -> active -> review -> done. Watchdog timeout remains UNKNOWN until Amit sets it.
- Cursor audits run twice weekly per repo, read only and capped; findings become tickets. Starting this job's audits waits for all config PRs to merge, unless Amit says "start audits".

## Quiet hours

Existing quiet hours remain: 22:00-09:00 Asia/Jerusalem nothing new starts. Work already running may finish. Required checks and monitoring remain governed by existing repository policy; this rule update does not change a schedule or enable any paused factory automation.

## Execution status

The workflow base filters include `loop/**` so existing required checks can run on ticket PRs. A filter addition does not migrate or enable the legacy dispatcher, batch merger, review trigger or queue. Their reconciliation needs its own scoped work before automation is used. All existing factory pauses remain in force.
