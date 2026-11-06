# Model router — preparation receipt

WALK — Candidate 3 adds documentation to the reviewed candidate 2 for issue #1255 / PR #1260. The original integration base is `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. This scratch preparation is not a deployed configuration or a passing repository validation claim. Candidate 1 passed all 38 runtime tests but the additional strict scoped TypeScript check found test mock typing errors (inherited fetch.preconnect omissions and new timer-hook parameter overloads). Candidate 2 corrected only test typing. Candidate 3 changes only JSDoc in ai_router.ts and ai_errors.ts; runtime code, tests and configuration are unchanged. All candidates' logs are preserved.

The router now requires configured model identifiers, uses medium reasoning by default (high for substantial newest user input or an explicit caller), and requires a distinct configured model for high-reasoning think-hard requests. One total abort budget covers request headers, response bodies and the one transient retry/backoff: thirty seconds normally, at most ten minutes for think-hard, shortened by an earlier caller deadline. Explicit cancellation has its own typed error and is never retried. Invalid provider responses fail with typed generic errors; provider bodies, transport details and abort reasons are not exposed.

`AiConfigurationError` extends `AiAuthError` to retain existing friendly configuration-error handling. Existing `AiTier`, `AiMessage`, `AiResult` and ordinary `callLLM` callers remain compatible. No runtime model identifier is hard-coded. The exact serving identifiers and actual GLM activation are UNKNOWN until deployment settings are provided and verified; no environment setting was changed.

## Checks

| Check | Result |
| --- | --- |
| Bun | 1.3.9 |
| `bun test convex/lib/ai_router.test.ts` in isolated scratch | PASS candidate 2: 38 tests, 0 failures, 116 assertions, 2.98s; all ten existing meaningful cases retained with explicit synthetic model settings, 28 added cases. Candidate 1 also passed 38/0, 116 assertions, 2.71s. |
| Whitespace check | Four `git diff --no-index --check` comparisons emitted no whitespace diagnostics; each exit 1 reports the expected changed files, not a normal repository `git diff --check` result. |
| Scoped TypeScript | PASS candidate 2, exit 0, no diagnostics. Candidate 1 failed, exit 2, only test mock typing errors; full log retained. This is not the repository's 5/5 command. |
| Mandatory install/lint/typecheck/full tests/four scans/Playwright/build | UNKNOWN: scratch preparation has no worktree or complete installed project. Assigned worktree must run every required gate in order before merge. |
| Hosted CI, CodeRabbit and guards | UNKNOWN: not run during scratch preparation. |

No live inference, network provider call, deployment, environment mutation, dependency addition or schema change. Synthetic fixture identifiers are not real model or account identifiers.

## Configuration decisions for the lead's DECISIONS register

- Schema: none; no new table, field or migration.
- Routes: none.
- Existing setting `DEEPINFRA_API_KEY` remains required, server-side.
- Existing model setting `TEMPO_AI_MODEL` becomes mandatory; missing/invalid settings fail closed instead of choosing a source-code fallback.
- New setting `TEMPO_AI_THINK_HARD_MODEL` is required only for think-hard and must differ from the normal model identifier.
- Both identifiers are deployment settings in Convex. `.env.example` documents names with blank values only for these additions. No values were supplied or read from a real environment file.
- Default medium; explicit high or newest-user content of at least 8,000 characters selects high without changing models. System/history length does not silently raise reasoning. Think-hard always requests high.
- Reasoning API evidence: https://github.com/deepinfra/docs/blob/dd5c6373aee2ec1743da7e1b698be5e80695beea/chat/reasoning.mdx . This verifies parameter shape, not current serving availability of the requested GLM models.
- `convex/ai_smoke.ts` uses `resolveAiModel()` in its failure return. With no configuration it now throws the typed configuration error rather than reporting a fallback model; this development-only caller is outside #1255 scope. No production caller imports the removed fallback constant.

New checks cover absent/invalid settings, medium/high/think-hard choice, stable settings during retry, explicit abort before fetch/during headers/during both body types/during backoff, earlier and maximum total deadlines, timer cleanup, malformed JSON/data, and error privacy. Existing 401, 429, 503, context-limit and output/usage checks remain.

The scoped TypeScript invocation used the repository-installed TypeScript through Bun, with `--noEmit --strict --target ESNext --module ESNext --moduleResolution Bundler --lib ES2021,DOM --skipLibCheck --types bun,node` and the existing repository type roots, against the three scoped TypeScript files only. No compiler configuration file was changed. A transient exec transport disconnect interrupted a diagnostic command launch; no tests were rerun because of that transport event.

## Candidate 2 source SHA256

| Path | SHA256 |
| --- | --- |
| `convex/lib/ai_router.ts` | `a31148fb7e6aa143d564b92ed63cfd5961e5447416ef802e698028b227ddb374` |
| `convex/lib/ai_errors.ts` | `003568955f95bef7af972c34c8ca7ecc0826ac312c010a41fbcc7aad3f64f322` |
| `convex/lib/ai_router.test.ts` | `82dd85cabc8e33efcf2d9f9487372a2c02fe244193ee6555ef72302e4fbef726` |
| `.env.example` | `ba46f1a95b7e138b97fe7d0182d4694fb8c2b8630fbef66ab74b30481340fa19` |

Machine-readable manifest: `source-hashes.json`. Mandatory repository commands and actual review remain required before merging.

## Candidate 3 — CodeRabbit documentation follow-up

CodeRabbit's review of `d4f0271ba745601853a5947fdfeb21b7fa04049f` reported no actionable merge-blocking issue, but warned that touched-function docstring coverage was 10% against an 80% threshold. This pass documents the scoped model resolution, reasoning selection, shared deadline, retry, response validation and error classification boundaries. It does not change the review configuration or claim a measured new CodeRabbit coverage percentage.

- Existing `bun test convex/lib/ai_router.test.ts`: **38 pass, 0 fail, 116 assertions, 3.09 s**, exit 0 (`focused-candidate-3.log`).
- TypeScript emits identical runtime JavaScript before and after for both source files with comments and empty lines removed (`comment-only-candidate-3.log`). Test and configuration hashes are unchanged.
- Auxiliary verification initially used a nonexistent root TypeScript symlink, then a raw lexer that cannot handle context-sensitive template tokens correctly. Neither attempt reached tests or prompted a source change; the final verification uses the installed TypeScript parser/emitter. These are verification-tool corrections, not additional source candidates.
- No new tests, runtime behavior, settings, provider call, schema or configuration change. Full mandatory repository checks and review of the final commit remain the coordinator's gates.

`source-hashes.json` now identifies candidate 3. Candidate 2 hashes above remain historical evidence. The two `*.candidate2.ts` backup files at the scratch root are local comparison artifacts and must not be published.
