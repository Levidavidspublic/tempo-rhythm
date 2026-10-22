# WALK — current subscription snapshot preparation

Date: 2026-10-22. Ticket #1297. Candidate 3 frozen.

Verdict: two new internal helpers are locally tested with fictional mocked
responses. Payment processing remains OFF and these helpers have no callers.
This does not implement paid admission or authorize checkout/provider activation.

## Scope and supported contract

- `convex/lib/revenuecat_snapshot.ts`: pure `parseRevenueCatSnapshot` and exact
  exported ServerMapping, SnapshotGrant, NormalizedSnapshot types. No mapping IDs
  are shipped. Server mappings alone determine plan/cycle. Both complete provider
  maps are required and limited to 128 entries each; at most 32 supported mapped
  grants are returned in deterministic entitlement-ID order. Expired and
  overlapping grants remain distinct. Separate entitlement IDs may share a
  product. Unknown entitlements confer no authority; malformed mapped grants
  reject the entire snapshot rather than producing partial revocation.
- `convex/lib/revenuecat_client.ts`: unmounted `readRevenueCatSnapshot`. OFF and
  missing/invalid configuration return before fetch. Default key accessor reads
  only the existing NAME `REVENUECAT_API_KEY`; tests always inject a synthetic
  accessor. No actual key was read. Fixed native-fetch GET endpoint, encoded
  canonical identity, redirect rejection, five-second whole-response deadline,
  128KiB byte limit, external abort, reader cancellation/release and late-response
  body cleanup. No retries, logging, persistence, public function or arbitrary URL.
- `convex/lib/revenuecat_snapshot.test.ts`: 29 new mocked cases, 110 assertions.

The caller must establish a configured provider identity before using the reader.
Its bounded string validation is not identity proof; no aliases/email resolution
or public identity input is provided. Provider GET can create an unknown customer.

Mapped entitlement `product_identifier` must bind to an exact configured product
and an existing subscription. Configured base plan must match entitlement
`product_plan_identifier`; present subscription base-plan metadata must agree.
The subscription's `is_sandbox` must be a boolean matching the server environment.
Mapped lifetime/null expiry is unsupported, leaving Tempo beta grants independent.

Response `request_date` and/or `request_date_ms` supply observation time; if both
exist, they must agree exactly. RFC3339 timestamps must be nonnegative and exactly
representable in milliseconds. Invalid calendar dates and lossy submillisecond
fractions fail closed. No local/event timestamp substitutes or strictly monotonic
customer-version claim. Mapped entitlement expiry uses documented `expires_date`;
no invented `expires_date_ms` authority. A valid empty complete map is distinct
from malformed, missing, truncated or unsuccessful provider data.

Duplicate raw JSON keys are not claimed detectable after JSON parsing. Pure
object-map keys establish structural entitlement identity, and distinct IDs
sharing a product are intentionally retained. Root confirmed this contract.

## Primary provider verification

Free public GitHub reads on 2026-10-22; no provider/customer endpoint requests.
These documents were research data, not invoked agent instructions or copied code.

- https://github.com/RevenueCat/play-billing-skills/blob/8fa2e4c25d4171be5950888b3ce89d500f6e5cfa/revenuecat/backend/SKILL.md
  verifies the fixed subscriber endpoint, server Bearer authorization, lifetime
  null vs expiry dates and unknown-customer creation behavior.
- https://github.com/RevenueCat/play-billing-skills/blob/8fa2e4c25d4171be5950888b3ce89d500f6e5cfa/revenuecat/webhooks/SKILL.md
  recommends authoritative current-entitlement reconciliation instead of deriving
  access from event names; response observation time is distinct from event time.
- https://github.com/RevenueCat/purchases-android/blob/293edcf21fc05636dc48ccb2e3ff69a6e5415e03/purchases/src/main/kotlin/com/revenuecat/purchases/common/CustomerInfoFactory.kt
  corroborates subscriber entitlements/subscriptions and response request_date.
- https://github.com/RevenueCat/purchases-android/blob/293edcf21fc05636dc48ccb2e3ff69a6e5415e03/purchases/src/main/kotlin/com/revenuecat/purchases/common/EntitlementInfoFactories.kt
  binds product_identifier to subscription lookup, expiry to the entitlement,
  sandbox to the subscription and base-plan metadata to the entitlement.
- https://github.com/RevenueCat/purchases-android/blob/293edcf21fc05636dc48ccb2e3ff69a6e5415e03/purchases/src/main/kotlin/com/revenuecat/purchases/common/responses/CustomerInfoResponseJsonKeys.kt
  confirms request_date/request_date_ms and supported field names.
- https://github.com/RevenueCat/purchases-android/blob/293edcf21fc05636dc48ccb2e3ff69a6e5415e03/purchases/src/main/kotlin/com/revenuecat/purchases/common/responses/SubscriptionInfoResponse.kt
  confirms is_sandbox and optional product_plan_identifier on subscriptions.

Direct official website documentation returned HTTP 403. No findings are
attributed to blocked page contents. No third-party implementation was copied.

## Candidate ledger and test results (cloud agent sandbox)

Bun 1.3.9. Parent serialized broader verification; this worker ran only mocked
focused tests, scoped lint and a specifically authorized standalone strict check.

| Candidate | Evidence | Result |
| --- | --- | --- |
| 1 | `bun test convex/lib/revenuecat_snapshot.test.ts` | 26 pass, 0 fail, 100 assertions, 5.93s; exit 0 |
| 1 | Scoped Biome lint | Exit 0; no errors or warnings |
| 2 | Standalone strict check using existing Convex ES2021/DOM/Bun settings | Exit 1; seven TS2550 diagnostics for Object.hasOwn; exactly 3 implementation files |
| 2 | Read-only self-review | Added late-response cancellation, non-200 unread-body cleanup and no-log regressions; did not claim unrun tests |
| 3 | `bun test convex/lib/revenuecat_snapshot.test.ts` | 29 pass, 0 fail, 110 assertions, 5.23s; exit 0 |
| 3 | Standalone strict check | Exit 0; 0 diagnostics, exactly 3 implementation files; no app/Convex graph |
| 3 | Scoped Biome lint | Exit 0, 0 errors, 1 advisory warning recommending Object.hasOwn |

The final compatibility correction uses `Object.prototype.hasOwnProperty.call`
to preserve safe own-key checks under the existing ES2021 lib. The advisory lint
suggestion would reintroduce the verified type error; no lint/compiler setting or
check was changed or suppressed. Three candidates consumed; no fourth attempted.

The seven candidate-2 diagnostics were TS2550 at the previous source lines
50, 100, 101, 119, 123, 124 and 131: Property 'hasOwn' does not exist on type
'ObjectConstructor'; suggestion to use ES2022 or later. Source compatibility was
fixed; compiler settings stayed unchanged. Logs for final focused tests, standalone
types and lint accompany this evidence.

`standalone-types-candidate-2.failure.log` preserves the authentic complete
eight-line failure output from the original tool receipt (session 25878,
completion chunk 771a98, exit 1). It is shorter than 20 lines, so the full output
is included. This was copied from that receipt, not recreated by rerunning or
reconstructing a diagnostic log. Source and tests remain frozen.

The whole-response deadline test exercises the actual five-second source constant;
its local test timeout is eight seconds to permit the deadline assertion itself.
No existing test timeout, assertion, baseline or configuration was edited.

UNKNOWN: `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`,
`bun run test`, four scans/notices, local Playwright and build on the publication
checkout (parent-owned exclusive validation slot). Targeted checks do not replace
these required gates. Browser screenshot evidence is not applicable to an
unmounted backend helper. Current CI/guards/CodeRabbit remain required.

## Frozen source fingerprints

| File | SHA-256 |
| --- | --- |
| convex/lib/revenuecat_snapshot.ts | 995bf6dd0a1980a31d748f6e5d22cc25f63d3d8357202338fadb47e7e29dd3b7 |
| convex/lib/revenuecat_client.ts | 3d6561e4b6cc1d4424e6e02584172e574d46d1270e031753fb49064c15886c5c |
| convex/lib/revenuecat_snapshot.test.ts | 0412a8df7abfbbe6c89bf0ce58b020ab664defa453f79fd96afd549cdfacd71f |

## Report

status: blocked
ticket: #1297
evidence: focused tests 29 pass / 0 fail; standalone strict 0 diagnostics; scoped lint exit 0 with one advisory warning
changed: two new source helpers, one test, scoped evidence only
unknowns: publication-checkout mandatory checks; hosted CI/guards/CodeRabbit; live provider behavior
notes for ticket sync: no issue correction needed after root clarified raw duplicate JSON and documented date fields; #1294 remains held for an authoritative transaction/snapshot schema contract; readers/scheduler/AI/voice gates remain separate
