# Factory slots — this repo's fill
<!-- Path: factory/SLOTS.md. The ONLY file that names tools. To swap a tool, edit one row.
     Everything else (AGENTS.md, CLAUDE.md, the skill) stays as it is. Review weekly. -->

Repo: `Levidavidspublic/tempo-rhythm`. Visibility: public (confirmed 2026-10-05). Default branch: `integration`. Live branch: `master`.

## Slots
| Slot | Role | Tool | Status |
|---|---|---|---|
| A-1 | Intake interviewer | UNKNOWN | pick one |
| A-2 | Doc writer | UNKNOWN | pick one |
| A-3 | Consistency check | UNKNOWN | pick one |
| A-4 | Doc store | UNKNOWN | In-repo files exist (`docs/PRD.md`, `docs/TRD.md`, `docs/contracts/`, `docs/tickets/`). Whether a wiki is canonical: UNKNOWN |
| A-5 | Ticket sync | UNKNOWN | not built |
| B-1 | Ticket queue | GitHub Issues, org Levidavidspublic | factory tickets are GitHub issues |
| B-2 | Dispatcher | Copilot (gh-aw), routing only | built: `.github/workflows/factory-dispatch.lock.yml` (`agent_id` copilot). Model comes from repo variable `FACTORY_MODEL_DISPATCH`. Value UNKNOWN (variables API returned 403). `claude-haiku-4.5` was not confirmed |
| B-3a | Agent lane A | Cursor cloud agent | workflow file `.github/workflows/factory-lane-cursor.yml` exists. Whether the hand-built automation is on: UNKNOWN |
| B-3b | Agent lane B | Claude Code in GitHub Actions (subscription token as org secret `CLAUDE_CODE_OAUTH_TOKEN`) | workflow file `.github/workflows/factory-lane-claude.yml` exists. Whether the secret is set: UNKNOWN |
| B-3c | Agent lane C | Codex cloud via @codex (subscription only, never an OpenAI API key) | workflow file `.github/workflows/factory-lane-codex.yml` exists. Whether a task actually starts: UNKNOWN |
| B-4 | Checks | GitHub Actions CI + Playwright | confirmed: `.github/workflows/ci.yml` and `.github/workflows/e2e-preview.yml` |
| B-5 | Review gate | Cursor Bugbot (interim, set 2026-10-05); CodeRabbit optional later | **Batch loop (2026-10-06, `factory/LOOP.md`): Bugbot reviews ONE PR per loop — the batch PR `batch/<loop-id>` → integration — never the component PRs (CI only, opened as draft).** Pre-queue only (not an MQ required check). Fix loop on the batch branch: `factory-review-fix.yml` → `factory-lane-claude` `target_branch`, max 3 (`review-fix:1..3`) then `blocked:amit`. Enqueue after Bugbot clean + 5 checks green (`factory-batch.yml` / `scripts/factory/batch-loop.mjs`). |
| B-6 | Auto-merge | GitHub merge queue (public repos) / GitHub auto-merge (private repos) | tempo-rhythm is public, so this slot is the GitHub merge queue on `integration`. The 5 required checks below have a `merge_group` trigger in this change. Bugbot is the review gate before a PR enters the queue when Bugbot is enabled. It is not a required queue check. The active ruleset has no merge-queue rule (checked 2026-10-05). The queue itself is not turned on in this change |
| B-7 | Preview host | Vercel preview | Preview environments exist (`Preview`, `Preview – tempo-web`). Whether `FACTORY_HAS_PREVIEW` is `true`: UNKNOWN (variables not readable) |
| — | Backend | Convex | folder `convex/` (not `packages/backend`) |
| C-1 | Secrets vault | UNKNOWN | 1Password was not confirmed in this repo |
| C-2 | Configurator | UNKNOWN | |
| C-3 | Code map | Graphify 0.9.74 + Archify (diagrams) | Graphify: `.github/workflows/graphify.yml` installs `graphifyy==0.9.74` and runs on push to `integration`. Archify: no workflow and no reference in this repo |
| C-4 | Memory log | UNKNOWN | Basic Memory was not confirmed from this repo |


## Review gate loop (B-5) — how to invoke
0. Batch loop (`factory/LOOP.md`): component PRs get CI only (draft, no Bugbot). `batch-loop.mjs build/open` makes the batch PR; `review` posts ONE `@cursor review` on it. Steps 2-3 below apply to the batch PR.
1. (Before 2026-10-06) Lane opens a PR (`t/<issue>-…` or `factory/…`); Bugbot reviews (auto on push, or comment `bugbot run`).
2. `factory-review-fix` runs on Bugbot `pull_request_review` (batch/ heads only since 2026-10-06) **or** by hand:
   - Actions → `factory-review-fix` → Run workflow → `pr_number` (optional `dry_run`).
   - Findings → `workflow_dispatch` the PR's `factory-lane-<lane>` with `fix_note` = findings; same branch. Labels `review-fix:1..3`; after 3 → `blocked:amit`.
   - Bugbot "couldn't run" → `blocked:amit`.
3. When Bugbot is clean **and** the 5 required checks are green → enqueue via GraphQL `enqueuePullRequest` (squash). Do **not** add Bugbot as a merge-queue required check.

## Code model of the week
Mid-tier by BILLING only. Fill in this week's pick:
- code model: ______
- fallback: ______

## Code model suggestion (EXTRAPOLATED)
UNKNOWN. `FACTORY_MODEL_CLAUDE`, `FACTORY_MODEL_CURSOR`, `FACTORY_MODEL_CURSOR_PARAMS`, `FACTORY_MODEL_CODEX`, and `FACTORY_MODEL_DISPATCH` are named in workflows. Their values were not readable (GitHub variables API 403).

## Stack (this repo)
- Package manager: `bun@1.3.9`, lockfile `bun.lock`. Workspaces: `apps/*`, `packages/*`.
- Backend folder: `convex/`.
- Shared packages that exist: `packages/ui`, `packages/types`, `packages/utils`, `packages/config`. No `packages/core` directory.
- Web shell: `apps/web` (Next.js, Tailwind v4).
- Mobile shell: `apps/mobile` (Expo, NativeWind, Tailwind v3 in that app's package.json).
- Desktop shell: UNKNOWN (no desktop app in the workspaces).

## Commands
| Purpose | Command |
|---|---|
| install | `bun install` |
| dev | `bun run dev` |
| test | `bun test convex apps/web/lib apps/web/components tests/unit packages` (= `bun run test`) |
| lint | `bun run lint` |
| typecheck | `bun run typecheck` |
| build | `bun run build` |
| e2e | `bunx playwright test` |

`e2e` is not a `package.json` script. Confirmed in `.github/workflows/ci.yml` (job `E2E (Playwright)`): `bunx playwright test`. `playwright.config.ts` sets `testDir` to `tests/e2e`. When a preview URL exists, `.github/workflows/e2e-preview.yml` runs `bunx playwright test tests/e2e/preview-smoke.spec.ts --reporter=list,html`.

Root scripts that exist and are not in the table: `bun run dev` is `turbo run dev`. Also present: `dev:web`, `dev:mobile`, `check`, `check:notices`, `scan:forbidden-tech`, `scan:ram-only-audit`, `scan:design-tokens`, `convex:dev`, `convex:codegen`. `convex:deploy` exists as a script. Do not use it against the live deployment.

## This repo's merge queue
Public repo. Auto-merge slot = GitHub merge queue on `integration`.

Active ruleset `factory-integration` (id 24427298, enforcement active, branch `integration`) requires these 5 checks:

1. `ci`
2. `e2e-preview`
3. `secret-scan`
4. `config-guard`
5. `scope-guard`

Bugbot is the review gate when Bugbot is enabled (review passed = no unresolved findings). It is not a required reviewer on this ruleset today, and it is not one of the merge-queue checks.

This change adds `merge_group` next to the existing pull-request trigger on these workflows, so the queue can run the same five check names:

1. `ci` — `.github/workflows/ci.yml`
2. `e2e-preview` — `.github/workflows/e2e-preview.yml`
3. `secret-scan` — job in `.github/workflows/security.yml`
4. `config-guard` — `.github/workflows/config-guard.yml` (same script, checkout stays the base SHA)
5. `scope-guard` — `.github/workflows/scope-guard.yml` (same script, checkout stays the base SHA)

The ruleset still has no merge-queue rule, so nothing enters a queue until that rule is turned on.

Follow-on workflows already use `on.push.branches: [integration]` (not an app token):

- Convex test deploy: `.github/workflows/convex-deploy-test.yml` (also limited to paths `convex/**`).
- Graphify: `.github/workflows/graphify.yml`.
- Archify: no workflow in this repo.

A merge-queue merge is a push to `integration`, so the two workflows that exist will run. No trigger edit was required.

## Secrets (names only, never values)
From `.env.example`, `apps/web/.env.example`, and `apps/mobile/.env.example`. Names only.

Required or used:
- `CONVEX_DEPLOYMENT`
- `CONVEX_SITE_URL`
- `CONVEX_DEPLOY_KEY`
- `MISTRAL_API_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `AUTH_RESEND_KEY`
- `RESEND_FROM_EMAIL`
- `BETA_FOUNDER_EMAIL`
- `BETA_ALLOWLIST_EMAILS`
- `BETA_MAX_TESTERS`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_ENABLE_PASSKEYS`
- `TEMPO_E2E_PUBLIC_CALENDAR`
- `TEMPO_E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS`
- `EXPO_PUBLIC_CONVEX_URL`

Commented in the examples (deferred, not confirmed as set):
- `REVENUECAT_API_KEY`
- `REVENUECAT_WEBHOOK_SECRET`
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `NEXT_PUBLIC_GETTERMS_PRIVACY_ID`
- `NEXT_PUBLIC_GETTERMS_TERMS_ID`
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`

CI secret names referenced by workflows (values not read):
- `CONVEX_DEPLOY_KEY_TEST`
- `VERCEL_AUTOMATION_BYPASS_SECRET`
- `CLAUDE_CODE_OAUTH_TOKEN`
- `CODEX_MENTION_PAT`
- `CURSOR_API_KEY`
- `DISPATCH_PAT`

Whether any of these are set: UNKNOWN.

## Schedule
- Build loop: runs every day.
- Quiet days (active work stops: configuration, patching, fixing stuck tickets): ______
- Agents take the date from the system clock.

## Enforcement checklist
Mark each one `configured`, then `tested` once a real run has shown it working. Checked 2026-10-05 against the rulesets API. Classic branch-protection API returned 403, so that view was not used.

- Branch protection on the default branch (`integration`): **configured, not yet tested.** Ruleset `factory-integration` is active: pull request required, the 5 checks above required, non-fast-forward. Review gate is **not yet** part of that ruleset (approving review count is 0; Bugbot is not listed).
- Live environment requires owner approval: **not yet.** Ruleset `factory-live` is active on `master` (pull request, the same 5 checks, update restriction, no deletion, no force-push). GitHub environments `Production`, `Production – tempo-web`, and `Production – tempo-marketing` have empty `protection_rules`. Owner approval on the environment was not found.
- Integration allows the merge queue only when checks and the review gate pass: **not yet.** The 5 checks are required, and their workflows now include `merge_group` (not yet tested on a real queue). There is no merge-queue rule. Bugbot is a pre-queue gate only, not a queue check.
- Claude `.claude/settings.json` denies reading `.env*` and pushing to `master`, `main`, and `integration`: **configured in this change, not yet tested.** No Claude session has been shown hitting the deny.
- The same denials for every other lane: **not yet.** Cursor hooks deny writing `.env` (except `.env.example`) and force-push to `main`/`master`. They do not deny reading `.env*` or a normal push to `integration`. Codex sandbox rules for the same denials: UNKNOWN.
- Secret scanning on: **configured, not yet tested** (this session did not watch a scan run). Workflow `.github/workflows/security.yml` exists, and `secret-scan` is a required check.
- Spend caps on every paid provider key: **UNKNOWN.**
