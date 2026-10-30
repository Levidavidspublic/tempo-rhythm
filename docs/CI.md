# Continuous integration

GitHub Actions workflows live under `.github/workflows/`. All jobs use **Bun**
(`bun install --frozen-lockfile`, `bun run …`) per root `package.json`
(`packageManager: "bun@1.3.9"`). Workflow-level `BUN_VERSION` is `1.3.9`.

## Workflows

| Workflow | File | Triggers | Purpose |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | PR → `master` or `integration`, `workflow_dispatch` | Typecheck, lint, tests, policy scans, notices, Playwright e2e |
| **Security** | `.github/workflows/security.yml` | PR / push → `master` or `integration`, `workflow_dispatch` | Secret scanning (Gitleaks + TruffleHog) |

Agents open PRs against **`integration`**. Amit promotes `integration` → `master`.
See `docs/merge-runbook.md`.

## CI jobs (blocking)

These jobs **must pass** on every PR. None carry `continue-on-error`.

| Job | Command | Notes |
|---|---|---|
| **Typecheck** | `bun run typecheck` | Turborepo across `apps/*` and `packages/*` |
| **Lint** | `bun run lint` | Biome via Turborepo |
| **Test** | `bun run test:browser` then `bun run test:unit` | `scripts/test-suites.ts`: the ten browser suites (`tests/unit/kb-*.test.tsx`) one at a time in their own process, then `bun test` over the rest |
| **Scans** | `scan:forbidden-tech`, `scan:ram-only-audit`, `scan:design-tokens` | HARD_RULES §2 / §5 / §7 ratchets |
| **Third-party notices** | `bun run check:notices` | TF-OSS-00 — every runtime dep in `THIRD-PARTY-NOTICES.md` |
| **E2E** | `bunx playwright test` | Playwright Chromium |
| **Secret scan** | Gitleaks + TruffleHog | Security workflow; a finding fails the job |

## Local pre-PR checklist

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run scan:forbidden-tech
bun run scan:ram-only-audit
bun run scan:design-tokens
bun run check:notices
```

**Avoid** `bun run check` as a read-only verification step on mobile — some
workspaces run `biome check --write`, which mutates files.

## Convex in CI

Convex functions are typechecked as part of the monorepo `typecheck` task.
There is no `convex deploy` step in CI and no `convex:schema-guard` script in
root `package.json`. Preview/production deploys happen via Vercel + Convex
dashboard keys (see `docs/ENVIRONMENTS.md`). After merging a `convex/` change
into `integration`, deploy explicitly (`bun x convex deploy`) with the deploy
key — that is a `human-amit` action.

## Dependabot

Workspace version bumps use `package-ecosystem: bun` in
`.github/dependabot.yml` so `bun.lock` updates in the same PR. If a bump
arrives without a lockfile change, regenerate with bun@1.3.9 and do not merge
until `bun install --frozen-lockfile` succeeds. See `docs/merge-runbook.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Typecheck / lint fails only in CI | Lockfile drift | Run `bun install` locally, commit `bun.lock` |
| Lint fails on Tailwind class order | Biome does not sort Tailwind classes (intentional) | Fix real Biome errors; ignore cross-app sort conflicts |
| Notices job fails | New runtime dependency with no notices row | Add the package to `THIRD-PARTY-NOTICES.md` |
| Secret scan fails | Real or test credential in the diff | Remove it, rotate if it was ever real, use env vars |

## Related

- `docs/HARD_RULES.md` §11 (testing) and §12 (git + PR)
- `docs/merge-runbook.md` — three-gate integration flow
- `docs/AGENT_AUTOMATION_RUNBOOK.md` — pre-flight checks for long agent runs
