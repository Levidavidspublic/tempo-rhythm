# Payment event parser preparation

Date: 2026-10-22. Ticket #1292. Parent #1248:
4b5b81348d7590d94a1c71a723e39c20701f23a3.

Verdict: strict normalization prepared; payments remain disabled. This is not
canonical subscription application or permission to enable the webhook.

## Scope and contract

- convex/lib/revenuecat_events.ts: pure parseRevenueCatEvent(input, catalog),
  the existing false gate and existing exports, and a frozen empty server catalog.
- convex/revenuecat.ts: unknown JSON is normalized before the legacy updater.
  Rejected envelopes return 400 with only a fixed reason; no updater call.
  Missing configuration 503, unauthorized 401, and disabled 503 still precede
  reading the body. Existing configured secret name is unchanged.
- convex/lib/revenuecat_events.test.ts: all nine original cases/assertions kept;
  nineteen additional cases.

Success returns only eventId, eventAtMs, appUserId, productId, plan, billingCycle,
kind and paidThroughMs. Failure returns malformed, unsupported-event or
unmapped-product. Accepted kinds are purchase, renewal, product-change,
uncancellation, cancellation and expiration. All used IDs are nonempty strings,
at most 256 UTF-16 code units, without padding or control/format characters.
Times are nonnegative safe integer milliseconds; no coercion. Additive provider
fields are ignored. Only own catalog entries with basic/pro/max and
monthly/annual mappings are usable.

The parser uses product_id, including for PRODUCT_CHANGE; new_product_id can
describe a deferred change and does not grant the future product. Cancellation
retains expiration_at_ms; parsing does not infer immediate access revocation.
Aliases and transfers are unsupported kinds, never fallback downgrades.
Payload-supplied plan, cycle, catalog, entitlements and aliases confer nothing.

No schema, route registration, package, environment or key changes. No provider
requests, signup, deployment, charges or account writes were performed.

## Primary source verification

Free public GitHub reads on 2026-10-22; no copied provider implementation.

1. RevenueCat's official webhook field page:
   https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
   — direct fetch blocked at CONNECT, HTTP 403, curl exit 56 / response code 000.
   No claims are attributed to inaccessible contents.
2. Official RevenueCat field examples and semantics:
   https://github.com/RevenueCat/play-billing-skills/blob/8fa2e4c25d4171be5950888b3ce89d500f6e5cfa/revenuecat/webhooks/SKILL.md
   — verified via GitHub Contents API. Documents event envelope, id, app_user_id,
   product_id and expiration_at_ms, the six supported kinds, deferred
   PRODUCT_CHANGE/new_product_id, and cancellation's distinction from revocation.
   This file was read as source material, not executed as instructions.
3. Official RevenueCat extension types:
   https://github.com/RevenueCat/firestore-revenuecat-purchases/blob/8089f19e948b3326040425de158fa1233891d675/functions/src/types.ts
   — verified via GitHub Contents API. Defines event.id, event_timestamp_ms,
   app_user_id and event kinds. Its timestamp/user fields are optional across
   the provider's broader event union; this deliberately narrower parser requires
   both for the six supported lifecycle kinds. Missing fields are rejected.

## Validation and candidate ledger

Candidate 1 prepared. No source repair candidate has been attempted.
The initial patch-tool request for the test addition had a JavaScript quoting
error before execution; no file was modified by that request.

| Check | Result |
| --- | --- |
| Bun 1.3.9 focused event test file | 26 pass, 2 fail; 216 assertions, 39.64 seconds |
| Nineteen new parser/ingress cases | All passed |
| Nine unchanged legacy cases | Seven passed; two child process timeouts |
| Scoped Biome lint on three files | Exit 0, zero errors; two informational template-literal suggestions |
| Full test/typecheck/lint/scans | Pending root's exclusive validation slot |
| Browser evidence | Not applicable to this backend parser ticket |

Logs are focused-candidate-1.log and scoped-lint-candidate-1.log. The unchanged
missing-configuration and actual-registered-action tests saw child exitCode null
at their existing 10-second timeout. Those checks, assertions and timeouts were
not relaxed. No repeated run was attempted without a changed validation condition.
Timeout cause is UNKNOWN; resource contention is an unverified hypothesis.
All nine original test bodies and assertions were also compared byte for byte
against the pinned parent and are unchanged.

All fixtures are fictional. Test-only ingress bypass occurs inside a fresh Bun
child process to exercise malformed/unsupported/unmapped rejection through the
actual handler. Production gate source is never changed. Existing gate tests
still assert zero body reads, mutations and provider calls while disabled.

Scratch validation uses the pinned parent http.ts and read-only links to installed
dependencies and existing Convex support modules. Only the three scoped files
and this evidence folder are publication candidates; scratch support files and
links must not be copied. Exact checkout validation remains necessary.

## Remaining prerequisites and unknowns

The parent PR is still a merge dependency. CodeRabbit and all repository gates
remain required.

Shipping product catalog is empty. Actual RevenueCat product IDs, trial IDs,
account compatibility, deployment settings and delivery behavior are UNKNOWN.
No values are guessed or copied from examples.

The legacy updater still writes only users.userType, uses legacy identity lookup
and lifecycle mapping, and does not implement subscriptionStates, idempotency,
out-of-order handling or canonical cancellation/expiry behavior. It ignores its
activeEntitlements argument; the handler now passes an empty array instead of
trusting arbitrary provider payload fields. Raw updater errors are no longer
logged by the handler. The updater itself is outside this ticket's scope.
Do not activate processing or populate the catalog until canonical application,
identity and reconciliation are reviewed in separate authorized work. Provider
guidance recommends authoritative customer reconciliation; this preparation
makes no provider call and does not claim that reconciliation exists.
