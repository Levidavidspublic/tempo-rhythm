# [TEMPO-FEATURE-PAYMENT-GATE] Payment webhooks cannot change accounts while processing is off

---
ticket: TEMPO-FEATURE-PAYMENT-GATE
batch: FEATURE
type: data
lane: astra
wave: 3
browser_test: false
scope:
  - convex/revenuecat.ts
  - convex/lib/revenuecat_events.ts
  - convex/lib/revenuecat_events.test.ts
  - docs/polish/evidence/feature-payment-gate/
depends_on: []
overlap_test: false
expected_merge: clean
hold: false
---

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE; backend ticket. This is a scoped server-side off switch, not operational payment admission.
WHEN: A worktree becomes free within the four-worktree limit; no other worker owns these paths. Protected #1193/#1198 and held auth/persona/memory/council files remain untouched. File audit found older non-KB drafts #47, #55, #76, #103, #110, #115, #119, #123, #124, #126, #127 and #128 also touch revenuecat.ts. They are untouched and not assumed superseded; later merges require reconciliation. No active Lane 1 writer owns these paths. Preserve the run's owner architecture gate before merge; the worker adds no label.
WHY: Amit's 21 October steer explicitly requires payment-provider wiring behind a feature flag, keys later, no live charges. HARD_RULES sections 2, 5, 12 and 13; AGENTS scope, validation and retry rules. The current web flag is false but the existing server webhook can still mutate accounts independently.
GOAL:
- The registered RevenueCat webhook cannot read/process an event body, call a mutation or acknowledge success while the server processing flag is false.
- Existing missing/bad authorization responses remain intact; a configured authenticated disabled endpoint gives an explicit non-success disabled response.
- This ticket makes no subscription, paid-admission, pricing, beta-policy or safe-activation claim.
SCOPE: Exactly two existing implementation files, the existing test file, and evidence metadata. No new library, schema, route entry, env name, dependency or generated file.
MUTATES: HTTP behavior of the existing POST /api/revenuecat-webhook only. No database mutation is newly added. Environment unchanged. Frontend PAYMENT_SYSTEM_ENABLED=false and MOCK_PAYMENTS are untouched.
CONTRACT:
- Add server-owned exported constant REVENUECAT_PROCESSING_ENABLED: boolean = false in convex/lib/revenuecat_events.ts. It is not controlled by URL, body, cookies, client flag or request headers; no env value can turn it on in this ticket.
- Add pure helper revenueCatIngressDecision(input: { authorization: string | null; configuredSecret: string | undefined; processingEnabled: boolean }): 'not_configured' | 'unauthorized' | 'disabled' | 'continue'. Order: absent/empty configuredSecret -> not_configured; unequal authorization -> unauthorized; processingEnabled=false -> disabled; otherwise continue. The helper validates this ingress gate only, not a RevenueCat event.
- Existing exported revenueCatWebhook remains an httpAction under the same registered route. It calls the helper with the existing REVENUECAT_WEBHOOK_SECRET runtime value and the hardcoded server flag. not_configured keeps HTTP503 and existing response text; unauthorized keeps HTTP401 and existing text; disabled returns HTTP503 JSON {received:false,reason:'payments_disabled'}, Content-Type application/json, and does not call request.json, ctx.runMutation or fetch. Do not return received:true for an ignored event.
- Existing mapRevenueCatEventToUserType(eventType: string | undefined): 'free' | 'paid' and its three tests remain unchanged. Existing enabled-path behavior is not declared safe and must not be activated by this ticket.
STEPS:
1. Code map: read convex/revenuecat.ts revenueCatWebhook, convex/http.ts existing route registration, convex/lib/revenuecat_events.ts mapper and tests, apps/web/config/appConfig.ts payment flags, and internal.users.updateSubscriptionStatus without editing the latter files. Recheck protected/parallel ownership.
2. Insert the server gate before parsing an event. Keep authentication order and responses. Do not import frontend configuration into Convex, modify a setting, add a provider SDK, or flip either payment flag.
3. Keep the implementation small: one boolean and one pure ingress decision helper used by the actual HTTP action. Do not build an unconsumed product catalog, generic payment framework or new event-application endpoint.
4. Preserve the existing three mapper tests. Add six tests: absent/empty configuration; wrong authorization; authenticated disabled response; disabled malformed/throwing body is never read; client attempts to enable via query/body/header do not pass; actual registered action off state calls no mutation/provider and emits no fixture secret or payload in logs. Pure helper variants may be table-driven. Exercise the real exported action in a fresh Bun child with an explicitly synthetic process environment, never the host's secret value; do not mock the handler or globally mock Convex. Restore or close every owned test resource. Assert exact response status/body and zero invocation counters. Keep all existing deadlines/checks.
5. Run all mandatory AGENTS commands in order with Bun1.3.9; report exact authoritative results and failure tails even if unrelated baseline checks fail. No browser behavior changes; E2E still runs as required by AGENTS.
DONE: Existing3 plus6new tests pass (9 total); lint0errors, typecheck5/5, full test0fail, four scans/notices, local Playwright and build results recorded. Current CI, actual addressed CodeRabbit, scope/config/security guards and the run's owner architecture gate all pass before integration merge. Tests use fake values only and prove OFF behavior, not provider operation.
EVIDENCE: docs/polish/evidence/feature-payment-gate/README.md records source SHA, exact command/result table, failure tails, HTTP gate matrix and zero-write proof. Screenshot N/A: no UI change. Names only for configuration: existing REVENUECAT_WEBHOOK_SECRET; required on preview/prod only when a later approved activation occurs. Schema unchanged. No deployment performed or recommended as part of this run.
DO NOT:
- Never enable server/client payments, invoke a real provider, charge, inspect/set env values, deploy, run Convex scripts, push a default/live branch, add a label, or weaken checks.
- Do not touch auth.ts, users.ts, approval helpers, schema.ts, appConfig.ts, #1193/#1198, held scopes or another worker's files.
- Do not change event-to-entitlement semantics, cancellation/expiry behavior, account identity resolution, approval policy, historical tester grants or RevenueCat product mappings.
- Do not claim this closes paid access or validates activation. The existing updater ignores entitlement mapping, cancellation currently downgrades immediately, and mutation errors currently acknowledge success; all require the separate canonical event/application contract before activation.
REPORT: One draft PR into integration with Closes issue reference; AGENTS status/ticket/evidence/changed/unknowns/notes report. Lead updates OVERNIGHT-REPORT.md. CodeRabbit is the user's current review gate, superseding stale Bugbot prose.

Needs Amit before merge: retain the run's owner-only architecture gate; no new SKU, access policy, runtime spend or environment decision is required to implement the OFF guard. Enabling remains a separate owner action after canonical subscription semantics, identity mapping, idempotency/order, expiry and paid/beta coexistence are implemented and reviewed.
