# Public pricing — local evidence

WALK — Ticket #1208 (`TEMPO-FEATURE-PRICING`), based on integration `39b564ec329705587df5262ed5a061bbec9a1e8f`. No account or payment provider is used by this page. This evidence does not establish operational paid admission or preview behavior.

The new public `/pricing` route composes the existing `PlanCard`, price catalog, billing interval control and locale switch. It displays the existing Trial/Basic/Pro/Max monthly and yearly amounts. Checkout is explicitly unavailable; the only account actions link to existing signup/signin routes. Current account approval is stated before the cards. No purchase handler, entitlement mutation, backend, payment flag, key or environment configuration changes.

Only exact `/pricing` is added to the public-route list. The existing unit tests retain the exact list assertion and every previous redirect assertion. The new route test uses the actual installed middleware matcher to prove that pricing is public while `/pricing/private`, `/pricing-extra`, `/settings` and `/today` remain private. A fresh Bun process renders the actual page composition without a signed-in context or process-global mocks; all four existing plan cards, both account links, the checkout notice and the absence of purchase controls are asserted.

## Test results (cloud agent sandbox)

| Command | Observed result |
|---|---|
| `bun --version` | 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: dependency resolution did not finish within the 120-second execution bound; exit 124. Lockfile unchanged. No network cause is inferred. |
| `bun test apps/web/lib/rootEntry.test.ts` | Final candidate: 10 pass / 0 fail, 51 assertions, authoritative exit 0 in 6.05 seconds. Eight existing cases and two new cases; no assertion or deadline changed. |
| `bun run lint` | Final frozen source: pass, 5/5 tasks, zero errors, nine existing web warnings plus one existing shared-UI warning. Initial run failed the new test's undeclared `Bun` global; explicitly importing the helper corrected it. No lint rule changed. |
| `bun run typecheck` | Final frozen source: pass, 5/5 tasks, authoritative exit 0 (27.18 seconds). |
| `bun run test` | Pending serialized lead gate. |
| Four scans/notices | Pending serialized lead gate. |
| Local real-route browser checks | Pending shared browser slot. |
| `CI=1 bunx playwright test --reporter=line` | Pending serialized lead gate. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Pending serialized lead gate. |

The first focused run failed at module import before any cases ran: the Convex Auth server barrel enforces a React Server Component boundary. The test now resolves that installed package's actual matcher leaf instead; the server-only guard is unchanged. That result was zero pass, one fail, one error. The corrected focused run passed all ten cases. Lint subsequently identified the explicit Bun helper import needed in the scoped test; the subsequent candidate explicitly imports `spawnSync` from Bun. Final lint/typecheck and all ten focused cases pass; both initial failures remain recorded.

## Browser evidence plan

Before captures use unchanged hero branch `6b2ca7c48a815530af8865b886b34fa59707da31`, whose pricing route is still absent. That source is integration plus the independent hero animation; no pricing source is edited to stage a screenshot. After captures use this ticket's real local Next route. Servers run one at a time under the lead's shared browser slot. No preview/live URL is used.

Required captures are 390/1280 widths, English/Hebrew, and both light/dark themes for the new page. Browser checks exercise monthly/yearly controls, unchanged trial duration, keyboard focus, RTL, phone targets, one main/h1, overflow, protected routes and the absence of payment or mutation requests. Only a successfully completed run may be reported as proof.

AT — New Hebrew text is machine-drafted in plural or impersonal forms and needs Amit's native read before production. No production release is authorized.

UNKNOWN — Operational paid access, provider configuration, authenticated account flows, current-head hosted CI/CodeRabbit/guards and deployed preview behavior. The pricing page does not resolve those separate backend tasks.
