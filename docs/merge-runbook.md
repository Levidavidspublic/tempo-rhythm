# Merge runbook

How changes land in `tempo-rhythm`. Source of truth for branch flow; if this
document and `AGENTS.md` disagree, `AGENTS.md` wins.

## Branch topology

```
ticket branches -> lane loop PR -> integration -> preview -> release PR -> master (Amit only)
```

- **`master`** is Amit's. Nothing merges into it except by Amit, roughly every
  2 days, by merging `integration`. `master` is protected by the
  `protect-master` ruleset. It must always be deployable.
- Ticket branches target their assigned `loop/claude-<date>` or `loop/codex-<date>` branch. The lead opens one completed loop PR into `integration`; guarded configuration PRs also target `integration`.
- Branch names: `feat/T-XXXX-<kebab>` · `fix/T-XXXX-<kebab>` ·
  `chore/<scope>-<kebab>` · `docs/<scope>-<kebab>` (Cursor cloud agents use
  their assigned `cursor/<slug>` prefix).

## The merge gates (rule 1.4, Amit, 2 Oct 2026)

Auto-merge is OFF until the merge-gate proof (D4) passes. Until then a PR
merges into `integration` only when **all** of these hold:

1. **All required checks are green** — and green means something: the `Test`,
   `Scans`, `Notices`, and `Security` jobs are enforcing (no
   `continue-on-error`, no no-op steps).
2. **The applicable CodeRabbit, Jev, security and unit-test gates pass** under `docs/HARD_RULES.md` REPO RULES 9. No council or vendored skill substitutes for PR review.
3. **No conflicts** with `integration` at merge time.
4. **Every changed file is inside the ticket's MUTATES list** (declared file
   scope).

The lead merges only after all applicable gates pass, then verifies the preview. Config PRs also require Amit's current-head approval label; agents never apply or restore it.
Max 3 agents per repo at once. Only Amit merges `integration` into `master`.

If any gate fails: stop, leave the PR open, report branch name + PR number +
which gate failed. Never force-push or rebase away someone else's work.

## Sequential-merge rule

Merges into `integration` happen **one at a time**. After each merge, the next
PR must be up to date with `integration` (re-run CI if it wasn't). When two
open PRs collide on the same file (`convex/schema.ts` is the usual suspect),
the PR that lands first wins the file; the second PR rebases and reconciles —
resolve from **commit-message intent**, not from whichever hunk is easier.

## Required checks

| Check | Job | What red means |
| --- | --- | --- |
| Typecheck | `ci.yml` | TS errors somewhere in the workspaces |
| Lint | `ci.yml` | Biome violations |
| Test | `ci.yml` | `bun run test` failed — a real regression |
| Scans | `ci.yml` | Forbidden tech, RAM-only/soft-delete, or design-token ratchet violation |
| Third-party notices | `ci.yml` | A runtime dependency has no `THIRD-PARTY-NOTICES.md` entry |
| Secret scan | `security.yml` | gitleaks or trufflehog found a credential — treat as an incident |

None of these jobs may carry `continue-on-error` or silently no-op when a
script is missing. Never weaken, skip, disable or delete a check to make a PR pass.

## Ratchet baselines

`scripts/scan-baselines.json` records pre-existing debt (hard-delete calls,
one-off hex values). Counts may only go **down**. Lower the baseline in the
same PR that removes a violation.

## When a secret leaks

1. Rotate the credential immediately — assume it is compromised.
2. Purge it from history only after rotation (history rewrite is Amit's call).
3. Add a gitleaks rule or fixture if the pattern was missed.

## Dependabot + `bun.lock`

Dependabot is configured with `package-ecosystem: bun` (not `npm`) in
`.github/dependabot.yml`. The npm updater used to bump workspace
`package.json` files and leave `bun.lock` unchanged, which made
`bun install --frozen-lockfile` fail before lint/typecheck/test ran.

If a Dependabot PR still arrives without a lockfile update, do not merge it.
Regenerate with bun@1.3.9 (`bun install`), commit `bun.lock`, and only then
re-run CI. Do not paste an older `bun.lock` from a stacked branch — that
desyncs the lockfile from the manifests on `integration`.

## Convex freeze

Convex code, schema, functions, environment and deployments are frozen. No ticket type, legacy automation or approval label authorizes a Convex change.
