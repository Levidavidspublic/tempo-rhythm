# Factory gates

Every per-PR gate for `tempo-rhythm`. Each row lists what the gate checks, its pass rule, and the
job that runs it. The five required checks are wired into the `factory-integration` ruleset on
`integration`; the three gates added by the 2026-11-01 config ticket run as advisory PR checks until
Amit adds them to the ruleset.

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
| `jev-judge` | TypeSafe Jev (`~typesafe/jev-latest`, OpenRouter System One) scores the PR on instruction-following (a), formatting (b), naming (c), clean code (d), and massive violation (e) | a–d each ≥ 0.85 and e < 0.5; scores posted as one PR comment | `.github/workflows/jev-judge.yml` → `jev-judge` |
| `process-check` | The agent's REPORT comment lists the ticket's DONE command and covers every STEP | the DONE command appears and every STEP's key words are covered | `.github/workflows/jev-judge.yml` → `process-check` |

## Jev judge details

- **Model**: `~typesafe/jev-latest` on OpenRouter. This is Amit's only OpenRouter exception.
- **Key**: repository secret `OPENROUTER_API_KEY`. Amit adds the value himself; the value is never
  written anywhere. If the secret is missing the job fails with
  `OPENROUTER_API_KEY not set: Amit adds it in repo Settings > Secrets > Actions`.
- **Input**: the ticket (issue) text, `AGENTS.md` and `include.md` (Amit's style rules), a link to
  and short summary of Google's TypeScript style guide, the PR diff, and the agent's REPORT comment.
- **Request format**: OpenRouter System One API (`POST https://openrouter.ai/api/v1/systemone`),
  five `noul` (probability) questions. See
  https://openrouter.ai/docs/guides/community/typesafe-sdk.md.
- The script is `.github/scripts/jev-judge.ts` with unit tests in
  `.github/scripts/jev-judge.test.ts`.

## How to test a gate locally

```bash
# format-naming (on changed files under apps/ and packages/)
bunx biome format --config-path=packages/config/biome.json <changed-ts-files>          # formatting (check mode)
bunx biome lint --config-path=.github/scripts/google-naming.json --only=useNamingConvention <changed-ts-files>

# jev-judge + process-check (unit tests; the live judge needs OPENROUTER_API_KEY)
bun test ./.github/scripts/jev-judge.test.ts
```

Note on formatting: this repo's formatter (Biome) uses double quotes, which is the repo's
convention. Google's TypeScript guide prefers single quotes; the formatting gate keeps the repo's
Biome configuration (the formatter the repo already has) and the naming gate enforces Google's
casing rules.

The live Jev call and the REPORT-comment matching run only in GitHub Actions against a real PR, and
only a PR that links a ticket (`Closes #N`). Config PRs link no ticket, so both gates skip.
