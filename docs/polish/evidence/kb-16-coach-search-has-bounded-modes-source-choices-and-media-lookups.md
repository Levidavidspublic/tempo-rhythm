# WALK — KB-16 preparation, 22 October 2026

Prepared source and focused tests; no deployment or completed full-validation claim.

Parent stack: frozen owned-research/cancel PR #1264, model-router PR #1260, gateway PR #1267, and canonical blank gateway URL declaration #1271. Original KB-01 and KA dependencies, Amit's convex-arch label, all guards, CI and CodeRabbit remain merge gates. The gateway's outstanding guard failure remains a real dependency blocker; this ticket does not bypass it.

## Deliverables

- `convex/lib/webSearch.ts`: replacement retaining the existing legacy provider and adding a separate capability-gated gateway adapter.
- `convex/search.ts`: replacement retaining `all`, adding `capabilities`, `lookup`, and internal `reserveLookup`.
- `convex/coach.ts`: replacement on frozen #1264, adding optional searchOptions and strict outcome mapping while preserving owned research cancellation and existing legacy calls.
- `convex/kb_16.test.ts`: new, 21 tests.

**Schema changes: NONE.** No table, field, index, package, route or actual environment setting changes. The dependency symlinks and `convex/kb16_baseline.test.ts` are scratch-only: the latter is an unchanged copy of the frozen parent's 86-test suite so its relative imports exercise these candidate files. Do not publish it as another test file.

## Decisions for the shared register

| Date | Decision | Effect |
| --- | --- | --- |
| 2026-10-22 | Amit authorized KB-16 architecture preparation. | Dependencies and owner convex-arch remain merge gates; no deployment. |
| 2026-10-22 | Use authenticated Vercel search gateway #1267 instead of inventing a missing KA adapter. | Supports web Speed/Balanced only when configured; no new paid provider or model fallback in the new endpoints. |
| 2026-10-22 | Declare TEMPO_SEARCH_SERVICE_URL separately in #1271. | Exact HTTPS `*.vercel.app/api/search` URL, no credentials/query/hash/nondefault port. Existing TEMPO_SEARCH_SERVICE_TOKEN supplies server-to-server authentication. No hidden environment name or setting mutation. |
| 2026-10-22 | Do not enable missing Quality/page-fetch/media/source engines. | Quality, images, videos, Discover, discussions and academic return unsupported when the adapter is configured; absent configuration returns off. Capabilities advertise only Speed/Balanced + web. |
| 2026-10-22 | Preserve explicit owned research controls and legacy reply behavior. | Legacy calls with no searchOptions retain the previous provider path. Explicit owned web research selects the gateway defaults when configured and retains cancellation/watch/save fences. Optional reply.searchOptions enables strict gateway status handling. |

## Behavior and safety boundary

Speed sends one request, returns at most three sources, and aborts retrieval after eight seconds. Balanced defaults to one request, at most five sources, and twelve seconds. The timer aborts the actual fetch and cancels its response-body reader; body size is capped at 64 KiB. The adapter never requests pages or images and never follows redirects. It contacts only an operator-configured Vercel deployment; it does not implement arbitrary-host DNS pinning inside Convex. Gateway #1267 performs the upstream address validation and pinned connection. Missing KA-24 safe page fetching is why Quality and media remain unavailable.

Input validates Unicode query length (1–200 code points), NFC, source-family uniqueness and up to five normalized IDNA hostnames. It rejects credentials, paths, ports, IP literals, local names and control characters. Returned source links are parsed and checked again; domain matching requires equality or a dot-separated subdomain, never a suffix spoof. HTML becomes plain text. Media metadata is always null for the supported web-only result type. Result links are never fetched here; hostname syntax checks are not represented as DNS verification of arbitrary content pages.

`search.lookup` checks approval and crisis text before any provider call. It makes no model call, reserves one content-free row in the existing coachWebSearches budget, respects the same preference, and shares the ten-per-UTC-day limit. No polling or automatic Discover endpoint exists. Capabilities require authentication and reveal no credentials or endpoint URLs.

Strict coach options preserve idle/busy/superseded precedence. Unsupported options and an exhausted budget fail before a model call. Retrieval off follows the existing non-search reply path; limit/unsupported/unavailable do not silently broaden retrieval or add a model call. Crisis history commits the existing safe response under the current turn claim with zero model/provider calls. Successful searched turns keep the existing tier, 900-token ceiling and two-model-call maximum, use existing untrusted-context rendering, and persist only title/site/URL citations. Raw snippets stay in RAM. Existing configured model selection and think-hard settings are unchanged.

## Validation ledger

Bun 1.3.9; root authorized lightweight backend tests while another worktree held the full-check slot.

| Check | Result |
| --- | --- |
| First focused new + parent suite run | 101 pass, 5 fail. All five failures were in the new fixture: it seeded `preferences` instead of the actual `userPreferences` table, leaving search disabled. Parent's 86 regressions passed. `focused-1.log`. |
| Second focused run | 107 pass, 0 fail, 583 assertions, 1.65 s, exit 0. Corrected fixture and added an owned gateway cancellation regression. `focused-2.log`. |
| Final parent annotation / credential-fixture verification | 107 pass, 0 fail, 583 assertions, 5.61 s, exit 0. Inherited the frozen parent #1264 explicit research-state union annotation and constructed the credential rejection fixture using URL setters. No assertion or guard was weakened. `focused-3.log`. |
| Frozen install, full lint/typecheck/test, four scans, browser/build | UNKNOWN: coordinator must run the mandatory checks against the actual stack. |
| Hosted CI / CodeRabbit / owner guards | UNKNOWN for KB-16; parent gateway has an unresolved guard failure. |

New tests cover supported capability honesty, IDNA and unsafe host inputs, Unicode/Hebrew queries, mode result caps and exact request options, domain spoof rejection, HTML cleanup, off without fallback, disabled Quality/media/Discover/source families, private/arbitrary-host gateway refusal, unchecked redirect refusal, unsafe URL/media payload rejection, actual abort/body cancellation deadlines, excessive body, approval, crisis no external work, shared daily budget, strict coach status mappings, same model tier/budget, snippets not persisted, ownership outcomes and cancelled owned gateway research unable to save or start its second model call.

One failed candidate was used (the initial fixture-table error); both later focused candidates pass. No source changes were made after the final run. Exact replacement hashes are in `manifest.json`.

No key was read from a file, configured, printed or used against a real provider. All request fixtures are fictional; all transports in focused tests are injected or mocked. Root owns publication, evidence placement and full review gates.
