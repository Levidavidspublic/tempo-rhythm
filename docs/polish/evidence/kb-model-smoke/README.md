# WALK — Model-smoke caller correction, 22 October 2026

status: blocked (publication/full checks and parent #1255 review gate remain)
ticket: #1286

The smoke action resolves the configured model inside its existing try block and retains that value for its failure result. If resolution fails, model is empty; the catch path does not invoke the failed resolver again. Success results and provider request parameters remain unchanged. No fallback model, router/error change, schema, environment, package or deployment change.

Code map: convex/ai_smoke.ts exposes only internalAction pingModel, with empty args. No repository callers were found outside its command comment. The parent router's resolveAiModel throws AiConfigurationError for missing/invalid settings, so the original catch repeated the same failure. The action now reports that typed error in its established object.

## Test results (cloud agent sandbox)

Bun 1.3.9. First actual source candidate, first focused run:

- bun test convex/ai_smoke.test.ts: 8 pass, 0 fail, 19 assertions, 241 ms.
- Missing model and three invalid configurations: ok false, empty model, zero fetch calls.
- Missing provider credential: resolved model, zero fetch calls.
- Provider rejection after settings disappear: retained model and one mocked fetch, proving the catch does not re-resolve.
- Success: same result shape, configured model and unchanged request parameters.
- Malformed provider output: established safe failure shape.

All provider calls are replaced by in-process fetch mocks; synthetic configuration is restored after every test. No live model call or spending. Parent router/errors are readonly test dependencies and MUST NOT be published with this ticket. Scratch prepare.ts/finish.ts, node_modules and generated-server links are harness material only.

UNKNOWN: bun install --frozen-lockfile; bun run lint; bun run typecheck; bun run test; all four scans; local Playwright; build; hosted CI; CodeRabbit and guards. Root owns the allocated checkout/full validation and publication. Browser behavior is unchanged; no screenshots needed for this internal action.

notes for ticket sync: parent #1255 review remains a merge gate. This caller ticket does not authorize a fourth router repair candidate.
