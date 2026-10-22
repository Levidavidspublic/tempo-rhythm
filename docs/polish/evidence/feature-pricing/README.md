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
| `bun run test` | Subsequent merged-head result: 3,492 pass / 4 fail / 3 todo, exit 1. Details below. |
| Four scans/notices | Subsequent merged-head result: all four pass, exit 0. |
| Local real-route browser checks | Pass: before 4/4, after 8/8, authoritative exit 0 for both commands. Each after case checks both billing intervals. |
| `CI=1 bunx playwright test --reporter=line` | Subsequent merged-head result: 23 pass / 5 fail / 89 existing skips, exit 1. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Subsequent merged-head result: pass, 1/1 tasks, exit 0. |

The first focused run failed at module import before any cases ran: the Convex Auth server barrel enforces a React Server Component boundary. The test now resolves that installed package's actual matcher leaf instead; the server-only guard is unchanged. That result was zero pass, one fail, one error. The corrected focused run passed all ten cases. Lint subsequently identified the explicit Bun helper import needed in the scoped test; the subsequent candidate explicitly imports `spawnSync` from Bun. Final lint/typecheck and all ten focused cases pass; both initial failures remain recorded.

## Required checks after integration merge

All checks below ran on unchanged merge head `62390387a298d255a4af65a2a8b358902e70203a`, which normally merges integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac` into the pricing branch. This head is distinct from the screenshot source recorded below. The evidence-only commits do not change product or tests.

| Command | Actual result |
|---|---|
| `bun --version` | 1.3.9, exit 0 |
| `bun install --frozen-lockfile` | Exit 0 in 40.22 seconds; checked 1,033 installs across 1,079 packages, no changes. Earlier bounded timeout retained above. |
| `bun run lint` | Exit 0, 5/5 cached tasks; zero errors and existing warnings. |
| `bun run typecheck` | Exit 0, 5/5 cached tasks. |
| `bun run test` | Exit 1: 3,492 pass / 4 fail / 3 todo, 81,525 assertions, 3,499 tests across 211 files, 756.31 seconds. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | Exit 0; every scan and notices check prints OK. Baselines unchanged. |
| `CI=1 bunx playwright test --reporter=line` | Exit 1: 23 pass / 5 fail / 89 existing skips, 5.3 minutes. Local server only; no account state or preview URL. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Exit 0, 1/1 tasks, 2m32.512s; pricing included in route output. |

Full-test failures, with original limits unchanged:

- `gap-free hash-linked chain > the intervening bound is 256: 256 plan, 257 do not`: exceeded its 5,000 ms limit (observed 10,312.23 ms).
- `KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls`: `h1` wait timed out at 30,000 ms, in `tests/unit/kb-64.test.tsx:147` called from line 534.
- `KB64 Undo recovery > large text wraps and reduced motion has no toast animation`: 30,000 ms timeout.
- The following unnamed KB64 before/after hook: 5,000 ms timeout.

Playwright failures: calendar Day/Week/Month event visibility, sign-out button visibility, core task views, `/templates/editor/[id]` wiring and `/onboarding` wiring. These test files were unchanged by pricing; no cause or baseline attribution is inferred from that fact. They were not retried, skipped or repaired in this ticket. Their full local artifacts remain in `test-results/` and the execution logs in `/workspace/work/overnight/pricing-gates/6239038/`.

Every required step ran despite the failures. The `gates-6239038/` evidence subfolder records exact commands, source head, authoritative exits, and failure tails. After Playwright exited, no server listened on port 3000. Only verified ignored, untracked `apps/web/.next/dev` was removed to recover build space; failure screenshots and traces were preserved. Build then passed, and no owned browser, server or build process remained. These checks do not establish a green merge gate or deployed preview readiness.

## Browser evidence results

Before captures use unchanged hero branch `6b2ca7c48a815530af8865b886b34fa59707da31`, whose pricing route is still absent. That source is integration plus the independent hero animation; no pricing source was edited to stage a screenshot. After captures use this ticket's real local Next route at frozen source `e1cf9871113d3a0a8a80b55f75b4aa6614610077`. Servers ran one at a time under the lead's shared browser slot. No preview/live URL or auth bypass was used.

Twenty PNG captures are saved here: four light baseline redirects at 390/1280 widths and English/Hebrew locale selections, plus sixteen pricing captures covering both widths, languages, light/dark themes and monthly/yearly intervals. The baseline Hebrew locale still displays the existing English-only sign-in page; it is not represented as translated pricing. All data are public catalog values; no account was used.

All eight after cases pass exact prices, unchanged trial duration, one main/h1, RTL, no horizontal overflow, visible keyboard focus, correct direction-aware arrow selection and minimum 44-pixel control dimensions. The protected settings route still redirects to sign-in. All cases recorded zero page errors and no payment/provider, POST or Convex mutation/action traffic. EN phone light/monthly and HE desktop dark/yearly images were also visually inspected without clipping or overflow. Screenshots include the local Next development indicator.

Commands, both authoritative exit 0:

```sh
PATH=/workspace/work/kb/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/workspace/work/kb/browsers bun /workspace/work/overnight/pricing-browser-evidence.ts before
PATH=/workspace/work/kb/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/workspace/work/kb/browsers bun /workspace/work/overnight/pricing-browser-evidence.ts after
```

The bounded scratch script is retained as `browser-evidence-script.txt`, with pre-execution setup review and result logs. It uses installed Chromium and local Next port 3108 with a placeholder Convex URL. It preserves assertion and timeout bounds. The before command also verified the independent hero examples at EN/HE 1280 with reduced motion: visible, no animations, identity transform, full opacity, unchanged bounds across two animation frames and zero page errors (`hero-examples-reduced.json`).

Disk filled after the successful baseline. The after phase remained unstarted until the lead recovered capacity; it then passed on its first run. Both commands closed their browser and server, and the port had no listener afterward. This evidence does not establish hosted CI, full-suite success, authenticated flows or deployed preview behavior.

AT — New Hebrew text is machine-drafted in plural or impersonal forms and needs Amit's native read before production. No production release is authorized.

UNKNOWN — Operational paid access, provider configuration, authenticated account flows, current-head hosted CI/CodeRabbit/guards and deployed preview behavior. The pricing page does not resolve those separate backend tasks.
