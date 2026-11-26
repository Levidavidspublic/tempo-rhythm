# Factory gates

Every per-PR gate for `tempo-rhythm`. Each row lists what the gate checks, its pass rule, and the
job that runs it. The five required checks are wired into the `factory-integration` ruleset on
`integration`; format-naming remains an advisory PR check. The Jev judge and process-check gates were removed on 2026-11-25 (Amit: "we're getting rid of the JEV checks in general. Was a mistake of mine."). Those files now live in `_to_delete/jev-judge/`.

## Required checks (ruleset `factory-integration`)

| Gate | Checks | Pass rule | Job |
| --- | --- | --- | --- |
| `ci` | Typecheck, lint (Biome), unit + browser tests, forbidden-tech / RAM-only / design-token scans, third-party notices, Playwright e2e, and build | every sub-job succeeds; the `ci` job fails if any need fails | `.github/workflows/ci.yml` → `ci` |
| `e2e-preview` | Playwright against the PR's Vercel preview | smoke spec passes (or passes with a note when no preview is configured) | `.github/workflows/e2e-preview.yml` → `e2e-preview` |
| `secret-scan` | Gitleaks + TruffleHog on the PR's commits, plus a canary self-test | no detected credential; the `secret-scan` job fails if any scanner fails | `.github/workflows/security.yml` → `secret-scan` |
| `config-guard` | Guarded files (`.github/**`, `scripts/factory/**`, `.cursor/**`, `AGENTS.md`, files that decide what a check checks) | only in a PR labelled `config`, opened by Division6066, that links no ticket | `.github/workflows/config-guard.yml` → `config-guard` |
| `scope-guard` | every changed file sits inside the ticket's `scope:` front-matter; component tickets never touch the data folders or shared hot files | no file outside the ticket's scope (batch/promotion PRs have their own rules) | `.github/workflows/scope-guard.yml` → `scope-guard` |

## Advisory gates (added 2026-11-01)

| Gate | Checks | Pass rule | Job |
| --- | --- | --- | --- |
| `format-naming` | Formatting via `biome format` and naming via Biome's `useNamingConvention` (Google casing) on the PR's changed TS/JS files under `apps/` and `packages/` | no file needs reformatting and no identifier breaks Google naming | `.github/workflows/format-naming.yml` → `format-naming` |

## Jev and process-check (removed 2026-11-25)

Removed by Amit: "we're getting rid of the JEV checks in general. Was a mistake of mine." The former workflow `.github/workflows/jev-judge.yml` (jobs `process-check` and `jev-judge`) and the already-disabled `4 jev judge` job in `merge-gate.yml` are gone. The workflow and scripts were moved to `_to_delete/jev-judge/` (never deleted). Do not restore them. Do not use OpenRouter for anything else.

## How to test a gate locally

```bash
# format-naming (on changed files under apps/ and packages/)
bunx biome format --config-path=packages/config/biome.json <changed-ts-files>          # formatting (check mode)
bunx biome lint --config-path=.github/scripts/google-naming.json --only=useNamingConvention <changed-ts-files>

```

Note on formatting: this repo's formatter (Biome) uses double quotes, which is the repo's
convention. Google's TypeScript guide prefers single quotes; the formatting gate keeps the repo's
Biome configuration (the formatter the repo already has) and the naming gate enforces Google's
casing rules.

