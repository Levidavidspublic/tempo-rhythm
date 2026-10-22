# WALK — Search gateway evidence (#1259)

Recorded 2026-10-22 UTC. State: locally-tested module in an isolated scratch directory; not preview-tested or shipped. The route performs real bounded retrieval when configured. No upstream instance, deployment or caller wiring was created by this ticket.

## Implementation

POST `/api/search` is a server-to-server endpoint. A dedicated bearer credential is compared using fixed-length SHA-256 digests and `timingSafeEqual` before reading the JSON body or resolving the provider. Blank or invalid settings fail closed. The response never includes credentials, raw exceptions or provider diagnostics; responses use `Cache-Control: no-store`.

The request accepts the ticket's query/mode/source/domain/category contract. Initial support is `speed` or `balanced`, exactly `["web"]`, and category `web`. Valid unsupported capabilities return HTTP 422 with `status: "unsupported"` before DNS or retrieval. Speed returns at most three rows with an eight-second retrieval deadline; Balanced returns at most five with twelve seconds. Both share a twelve-second total request deadline, including request-body reads. No inference, page fetching, image proxy, retries or second provider is involved.

The configured URL must be HTTPS, have a public DNS hostname, no credentials/nondefault port/query/fragment, and end in `/search`. Every resolved address must pass the conservative public-unicast policy, including IPv6 checks. The HTTPS connection uses only the validated address through a pinned lookup; standard TLS verification and the original hostname remain enabled. Mixed private/public answers fail closed. No redirect is followed. DNS waiting, headers and response reading share cancellation; cancellation stops the HTTPS request. The operating-system DNS lookup itself is not cancellable, but a late DNS result cannot start an upstream request.

Request bodies are bounded to 8 KiB, upstream headers to 8 KiB, and upstream response bytes to 1 MiB. Compressed responses are refused. SearXNG receives form-encoded `q`, `format=json`, and `categories=general`. Domain restrictions are also enforced on returned hostname boundaries, independently of engine query syntax. Result titles/snippets are plain text, Unicode-bounded, deduplicated and transient. The consumer must render these strings as text and treat them as untrusted content, never instructions. Media fields remain null. This gateway never fetches result URLs; their DNS destinations are not independently resolved or certified by this ticket.

The native `node:https` transport is an explicit narrow correction to the initial fetch-only plan, recorded by the coordinator in #1259. It provides connection-level DNS pinning with standard TLS verification without adding a package. A preflight DNS check followed by a separately resolving native fetch would not prevent rebinding.

## Primary sources

Read through the public GitHub connector on 2026-10-22; no search query was sent to an engine. These are API facts, not copied implementation code.

| Source | Verified facts | File blob SHA at read |
| --- | --- | --- |
| [Official Search API](https://github.com/searxng/searxng/blob/master/docs/dev/search_api.rst) | `/search` accepts form-encoded POST; `q` required; `format=json` must be enabled or returns 403; many public instances disable JSON; categories are deployment-configured; `site:` support depends on engine. | `f11a98e30308b74e6f0c552ad5486ddd46d85345` |
| [Official HTTP implementation](https://github.com/searxng/searxng/blob/master/searx/webapp.py) | JSON search calls `get_json_response` and returns `application/json`; result processing uses `url`, `title` and `content`. | `38c2564e783fd82d5752d54bfbcae313533a96fc` |
| [Official JSON response](https://github.com/searxng/searxng/blob/master/searx/webutils.py) | Top-level `results` is an ordered array of result dictionaries. Other fields are deliberately not exposed. | `43d42bf83cb27d1c3a7ce9af4b5da7407cc2637e` |

No third-party code or dependency was copied. Source URLs follow upstream master; the recorded blob hashes identify the reviewed file contents. The deployed upstream version is UNKNOWN.

## Test results (cloud agent sandbox)

Bun 1.3.9. All unit inputs, bearer values, DNS answers and transports are fictional local fixtures. No network calls are made by these tests. The following are focused scratch checks, not substitutes for the mandatory checkout-wide gates.

| Check | Candidate 3 result |
| --- | --- |
| `bun test apps/web/lib/server/search-service.test.ts` | exit 0; 133 pass, 0 fail; 223 assertions, 554 ms. See `focused-candidate-3.log`. |
| Strict isolated TypeScript for server module and test | exit 0, no diagnostics; see `scoped-types-candidate-3.log`. Uses the existing web TypeScript installation, ES2022, bundler resolution, strict mode, and existing Bun types. Route alias checking remains part of the actual checkout typecheck. |
| Scoped Biome lint on all three source/test files | exit 0, 0 errors; see `scoped-lint-candidate-3.log`. Uses the repository rules; only VCS ignore-file discovery is disabled because scratch has no Git checkout. No rule is disabled. |
| `bun install --frozen-lockfile` | UNKNOWN: deferred until coordinator supplies an actual worktree; no new dependency requested. |
| `bun run lint` | UNKNOWN: actual checkout-wide gate not run in scratch. |
| `bun run typecheck` | UNKNOWN: actual checkout-wide gate not run in scratch. |
| `bun run test` | UNKNOWN: full repository suite not run in scratch. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | UNKNOWN: actual checkout-wide scans not run in scratch. |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: no browser/heavy run authorized in this scratch lane. No UI changed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN: no build authorized in this scratch lane. |
| CI, CodeRabbit, guard status | UNKNOWN until a PR exists and checks run on its exact head. |

Focused coverage includes missing configuration/auth, bounded streaming input, invalid/malicious request fields, unsupported capabilities without provider calls, Unicode and IDNA, IPv4/IPv6 special ranges, mixed DNS answers, connection lookup binding and TLS options, fixed provider URL/form, result caps/domain spoofing/unsafe links/plain text, HTTP redirects/errors/429, response type/encoding/byte bounds, redaction, cancellation during DNS/headers/body, and both deadline policies.

The retry ledger is explicit. Candidate 1 had 132 passing and one failing test: the response-stream fixture started before transport, so cancellation happened during input parsing (400 rather than the expected 503). Its isolated typecheck also found a spread-argument fixture issue and incompatible Node/DOM stream declarations. Candidate 2 corrected the fixture timing and stream bridge and passed 133 tests, but TypeScript rejected readonly `test.each` array fixtures against a mutable resolver return contract; the exact diagnostic is preserved in `scoped-types-candidate-2.log`. Candidate 3 returns a new owned fixture array and passes the focused checks. No assertions or production checks were weakened. Two failed candidates have been used.

Candidate 1 failure excerpt from the tool output:

```text
Expected: 503
Received: 400
(fail) cancellation and request deadlines > abort while streaming cancels body and never returns a partial success
132 pass
1 fail
222 expect() calls
Ran 133 tests across 1 file.
```

## AWAY — Setup and limits

Schema: NONE. No Convex functions, settings, schema or deployment changed. Only these blank names were appended to the router #1255 final `.env.example`, after its writer finished:

- `TEMPO_SEARCH_SERVICE_TOKEN`: server-only credential shared by an approved server caller and the gateway; minimum 32 characters. Never expose it as a public/client variable.
- `TEMPO_SEARCH_UPSTREAM_URL`: exact public HTTPS SearXNG `/search` endpoint with JSON enabled and suitable configured general engines. The operator must control or explicitly trust that endpoint; this ticket does not pick or create a public instance.

The owner/configurator must establish the upstream and configure the server settings in the intended environment, after the usual review/deployment process. A dedicated Vercel service or existing preview deployment must run this route with the Node runtime and at least the declared 15-second function duration. No manual deploy or environment mutation was performed. The subsequent KB-16 adapter must use its existing approved-owner checks, crisis boundary, explicit search consent and per-person quota before calling this gateway; this ticket does not connect the browser or coach to it.

Amit approved at most $10/month hosting. A durable platform spending limit/hard stop must be configured and verified before enabling service traffic. This code does not create a financial cap, a process-local pretend cap, or a per-person quota. Vercel plan eligibility, configured budget controls, actual hosting/upstream cost, regional latency, TLS/DNS behavior on the eventual deployment, configured engine capabilities and preview retrieval remain UNKNOWN. Do not describe a gateway with unset configuration as working preview search. The route itself only changes to functioning retrieval after valid settings and a working upstream exist.

## Report

```text
status: blocked
ticket: #1259
evidence: focused Bun tests -> 133 pass / 0 fail; isolated strict types and scoped lint -> exit 0
changed: apps/web/app/api/search/route.ts; apps/web/lib/server/search-service.ts; apps/web/lib/server/search-service.test.ts; .env.example; docs/polish/evidence/kb-search-service/
unknowns: mandatory actual-checkout gates, CI/review/guards, configured upstream and preview, platform budget enforcement
notes for ticket sync: coordinator approved pinned native HTTPS correction; KB-16 remains responsible for authenticated/approved-user consent, crisis checks, quota and actual caller wiring; schema NONE
```
