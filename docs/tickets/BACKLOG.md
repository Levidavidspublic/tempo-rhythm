# Tempo Flow — Backlog (window 1)

<!-- Written 30 Oct 2026 with deepseek-v4-pro via Reason (rollover off). Window 1: TEMPO-BL-0001..0054 (10 pilot + 44). Billing tickets keep the PRD's Whop/PayPal wording and depend on #1335 (Paddle/Whop switch). Later windows append from TEMPO-BL-0055. -->

## How to read this file

- **IDs** run `TEMPO-BL-0001` … `TEMPO-BL-0010`, in **dependency order** (a ticket's `Depends:` always names an earlier ID).
- **Format** is the `docs/tickets` format (front matter + `FOR / WHEN / WHY / GOAL / SCOPE / MUTATES / STEPS / DONE / EVIDENCE / DO NOT / REPORT`), plus two calibration fields:
  - **`Pass:`** `1` = foundational / independent (no BL-internal dependency, can start now); `2` = depends on one or more earlier tickets (its `Depends:` names them).
  - **`Depends:`** the earlier `TEMPO-BL-####` IDs this ticket waits for, or `none`.
- **Front matter** keeps `depends_on` (machine-parsed by the factory) in sync with the `Depends:` line.
- **Lane** is `claude` (backend/data), `cursor` (front end), or `codex` (CI/ops/docs) per `factory/SLOTS.md`.
- Every ticket names **≥1 industry-standard number + source URL**, uses **no vague words** (fast / nice / clean / appropriate …), and gives every **visible string as `en` + `he` keys**.
- Tickets are sized for a **mid-tier model in 1–3 hours**, at most **3 files + 1 test** unless a ticket's `MUTATES` states otherwise.

## Areas covered (10 tickets)

| # | ID | Area | Type | Lane | Pass | Depends |
|---|---|---|---|---|---|---|
| 1 | TEMPO-BL-0001 | Paid tier / billing — entitlements table | data | claude | 1 | none |
| 2 | TEMPO-BL-0002 | Coach chat — coach artifacts | data | claude | 1 | none |
| 3 | TEMPO-BL-0003 | Today/tasks — calendar end time | data | claude | 1 | none |
| 4 | TEMPO-BL-0004 | CI/ops — Lighthouse perf budget | ops | codex | 1 | none |
| 5 | TEMPO-BL-0005 | Paid tier / billing — Whop + PayPal webhooks | data | claude | 2 | BL-0001 |
| 6 | TEMPO-BL-0006 | Voice — remaining-minutes surface | component | cursor | 2 | BL-0001 |
| 7 | TEMPO-BL-0007 | Notes/blocks — make page a template | component | cursor | 1 | none |
| 8 | TEMPO-BL-0008 | Notes/blocks — calendar tokens | component | cursor | 2 | BL-0007 |
| 9 | TEMPO-BL-0009 | Hebrew RTL — coach chat | component | cursor | 1 | none |
| 10 | TEMPO-BL-0010 | Mobile — magic-link sign-in | component | cursor | 1 | none |

---

## TEMPO-BL-0001 — Entitlements table (provider grants)

```yaml
---
ticket: TEMPO-BL-0001
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/schema.ts
  - convex/lib/entitlements.ts
  - convex/entitlements.ts
depends_on: []
contract:
  - "api.entitlements.getMyTier(args: {}) -> { tier: 'basic'|'pro'|'max', source: 'grant'|'entitlement', provider?: 'whop'|'paypal', expiresAtMs?: number }"
  - "api.entitlements.upsertGrant(args: { userId, provider: 'whop'|'paypal', externalId: string, tier: 'basic'|'pro'|'max', status: 'active'|'expired'|'revoked', expiresAtMs?: number }) -> Id<'entitlements'>  (internalMutation)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none
Billing note: keeps the PRD's Whop/PayPal wording. Depends: #1335 (Paddle/Whop switch); rewrite after it lands.

FOR: the billing lane and every entitlement gate (voice minutes, premium coach features) that must read a paid tier granted by a payment provider.

WHEN: first in the backlog; nothing depends on it, and the Whop/PayPal webhook (TEMPO-BL-0005) and the voice surface (TEMPO-BL-0006) wait for it.

WHY: docs/PRD.md §4.11 "Billing visible, never hidden … Trial $1 / 3 weeks → Basic $10 → Pro $20 → Max $40"; docs/HARD_RULES.md §6.3 "high-stakes categories (… payments) always require confirm"; docs/TRD.md §7 security RULES "server-side order before any model call: auth → entitlement → quota". Today `convex/lib/entitlements.ts` hard-codes the open-signup grant (`GRANTED_ENTITLEMENT_TIER = "max"`) and stores nothing per provider; there is no table that records a Whop or PayPal grant, its expiry, or its revocation.

GOAL: a new `entitlements` table is the single persisted source of paid-tier grants (provider, external id, tier, status, expiry, soft delete), and `api.entitlements.getMyTier` resolves the effective tier for the signed-in user (highest active grant wins; an expired grant counts as `none`).

SCOPE: `convex/schema.ts`, `convex/lib/entitlements.ts`, `convex/entitlements.ts` (new). Size: 2 files plus 1 test.

MUTATES: `convex/schema.ts` (new table `entitlements`), `convex/lib/entitlements.ts` (add a `resolveEntitlementTier` pure helper; do not change the sign-up grant defaults), `convex/entitlements.ts` (new: `getMyTier` query + `upsertGrant` internalMutation), `convex/entitlements.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/schema.ts`, `convex/lib/entitlements.ts` and their dependents; adjust the plan to the current code.
2. Add table `entitlements` to `convex/schema.ts`:
   `{ userId: v.id("users"), provider: v.union(v.literal("whop"), v.literal("paypal")), externalId: v.string(), tier: v.union(v.literal("basic"), v.literal("pro"), v.literal("max")), status: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")), expiresAtMs: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()) }` with indexes `by_userId`, `by_userId_status`, `by_userId_deletedAt`.
3. `convex/lib/entitlements.ts`: add a pure `resolveEntitlementTier(grants: {tier,status,expiresAtMs?}[]) -> "none"|"basic"|"pro"|"max"` that keeps the highest of `basic < pro < max` among `status === "active"` grants whose `expiresAtMs` is absent or `> now`; return `"none"` when there are none. Keep the existing open-signup grant helpers unchanged (no behaviour change to sign-up).
4. `convex/entitlements.ts`: `getMyTier` (query) requires auth, reads the user's non-deleted `entitlements` rows, and returns the resolved tier plus its source (`entitlement` when a provider grant produced it, else `grant` from the existing sign-up grant). `upsertGrant` (internalMutation) upserts by `provider + externalId`, sets `updatedAt`, and never hard-deletes.
5. Add `convex/entitlements.test.ts`: highest-active-wins, expired-grant-is-`none`, revoked-grant-is-`none`, missing-row-falls-back-to-signup-grant, and `upsertGrant` idempotency (same `provider + externalId` updates the row rather than inserting a second).
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/entitlements.test.ts` and `convex/lib/entitlements.test.ts`; `api.entitlements.getMyTier` exists in `convex/_generated/api.d.ts` with the shape above.

EVIDENCE: test output; `convex/_generated/api.d.ts` line for `getMyTier`.

DO NOT:
- don't change the sign-up grant defaults in `convex/lib/entitlements.ts` (every new account still starts on the existing grant; this ticket only ADDS a provider-grant path)
- don't add checkout, pricing, or any provider HTTP call (TEMPO-BL-0005 owns provider webhooks)
- don't touch `convex/revenuecat.ts` or `convex/lib/revenuecat_events.ts` (existing RevenueCat path stays out of scope)
- don't deploy; never touch the live Convex deployment
- don't hard-delete any entitlement row (soft delete via `deletedAt`)

REPORT: contract names created, the resolved-tier rule in one sentence, anything that couldn't match the contract and why.

Standard: **PCI DSS v4.0 SAQ-A** — no card data ever touches Tempo's servers; Whop/PayPal host the card fields. https://www.pcisecuritystandards.org/

No new visible strings (server-side only; the tier label shown to the user is produced by `api.users.getMyPlan`, which already exists).

---

## TEMPO-BL-0002 — Coach artifacts (flashcards / quiz / checklist / tracker)

```yaml
---
ticket: TEMPO-BL-0002
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/blocks.ts
  - convex/coach.ts
depends_on: []
contract:
  - "api.coach.makeArtifact(args: { spec: Record<string, unknown> }) -> { blockId: string, kind: 'flashcards'|'quiz'|'checklist'|'tracker', savedToNoteId?: Id<'notes'> }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the coach chat, so the coach can make an interactive piece (flashcards, a quiz, a checklist, or a small tracker) the user accepts, saved into a page as a block and drawn by json-render.

WHEN: first in the backlog; independent of the other tickets.

WHY: docs/PRD.md §4.2 F-28 "Coach artifacts: the coach can make interactive pieces … drawn by json-render from Tempo's catalog only. Each one is saved into a page as a block, and the user never sees JSON."; docs/TRD.md §4b "The spec must be a json-render spec using only Tempo's catalog components … validated with the catalog's Zod schemas before saving." The design tokens for `CoachArtifact` / `Flashcard` exist in `apps/web/app/tempo.css`, but there is no backend tool, no `artifact` block schema, and no validation path yet.

GOAL: the coach exposes one `makeArtifact` tool that validates a spec against the artifact block schema and the catalog's component names, then saves an `artifact` block into a page; an unknown component or any URL/script is rejected and the artifact is never saved.

SCOPE: `convex/lib/blocks.ts` (block schema + validation), `convex/coach.ts` (register the tool), `convex/coach.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/lib/blocks.ts` (add the `artifact` block type: `{ kind: 'flashcards'|'quiz'|'checklist'|'tracker', title: string, spec: Record<string, unknown> }`, validated so `spec` contains only the catalog component/action names for that kind), `convex/coach.ts` (register `makeArtifact` as a coach tool that validates then proposes the block through the existing accept/reject path), `convex/coach.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/lib/blocks.ts`, `convex/coach.ts` and their dependents; adjust the plan to the current code.
2. In `convex/lib/blocks.ts`, add the `artifact` block schema and a `validateArtifactSpec(kind, spec)` that returns `{ ok: true, spec } | { ok: false, reason }`; reject any spec with a URL field, a script field, or a component name not in the catalog.
3. In `convex/coach.ts`, register `makeArtifact` so it calls `validateArtifactSpec` first, then flows through the existing coach proposal / accept-reject path (the model never writes to the database directly; HARD_RULES §6.2).
4. Extend `convex/coach.test.ts`: a valid flashcards spec is accepted and becomes an `artifact` block; a spec with an unknown component is rejected with `reason`; a spec with a URL or script field is rejected; JSON is never returned to the client outside a validated block.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the new `convex/coach.test.ts` cases and `convex/lib/blocks.test.ts`; `api.coach.makeArtifact` exists in `convex/_generated/api.d.ts`.

EVIDENCE: test output; `convex/_generated/api.d.ts` line for `makeArtifact`.

DO NOT:
- don't render the artifact UI (a component ticket mounts the `CoachArtifact` / `Flashcard` components later)
- don't call a model to "fix" an invalid spec — reject it and ask the coach to retry
- don't persist raw model output outside a validated block (HARD_RULES §6.4 RAM-only is for third-party scans, but the same "code validates, code writes" rule applies here)
- don't deploy; never touch the live Convex deployment

REPORT: contract name created, the accepted catalog names for each of the four kinds, anything that couldn't match the catalog and why.

Standard: **WCAG 2.2 AA 4.5:1** contrast for every artifact's text (Flashcard faces, Quiz options, Checklist rows, Tracker values). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (the artifact renders later, but the block's fallback label is validated here): `artifact.broken` EN "This part has a problem. The rest of your page is safe." / HE "לחלק הזה יש בעיה. שאר הדף בטוח." (reuses the existing `editor.broken` key; no new string).

---

## TEMPO-BL-0003 — Calendar event end time (additive `endsAtMs`)

```yaml
---
ticket: TEMPO-BL-0003
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/schema.ts
  - convex/calendar_events.ts
depends_on: []
contract:
  - "api.calendar_events.create(args: { title: string, startsAtMs: number, endsAtMs?: number }) -> Id<'calendarEvents'>"
  - "api.calendar_events.update(args: { eventId: Id<'calendarEvents'>, title?, startsAtMs?, endsAtMs? }) -> Id<'calendarEvents'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people whose day has timed events; the Today and Calendar views show an event's duration instead of a single start instant.

WHEN: first in the backlog; independent.

WHY: docs/ROADMAP.md §3 step 8 (#533) "Calendar events: end time, edit, soft delete"; docs/APP-FLOW.md §5 item 7 "/calendar: events get a start and end time, edit and delete." The repo already has `update` / `remove` / `restore` on `convex/calendar_events.ts`, but `convex/schema.ts` has no `endsAtMs` field, so an event cannot show an end time.

GOAL: `calendarEvents` gains an optional `endsAtMs`; create and update accept it, `endsAtMs` must be `> startsAtMs` when present, and list returns it so the Today/Calendar views can draw duration.

SCOPE: `convex/schema.ts`, `convex/calendar_events.ts`, `convex/calendar_events.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/schema.ts` (additive field `endsAtMs: v.optional(v.number())`), `convex/calendar_events.ts` (accept + validate `endsAtMs` in `create` and `update`, return it in `listInRange`), `convex/calendar_events.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/schema.ts`, `convex/calendar_events.ts` and their dependents; adjust the plan to the current code.
2. Add `endsAtMs: v.optional(v.number())` to the `calendarEvents` table (additive; log it in `convex/MIGRATIONS.md`).
3. In `convex/calendar_events.ts`, accept `endsAtMs` in `create` and `update`; when both `startsAtMs` and `endsAtMs` are present, throw a clear `ConvexError` if `endsAtMs <= startsAtMs`; include `endsAtMs` in `listInRange`'s return.
4. Extend `convex/calendar_events.test.ts`: create with a valid `endsAtMs` persists it; `endsAtMs <= startsAtMs` throws; update changes `endsAtMs`; `listInRange` returns it; an event with no `endsAtMs` is unchanged in behaviour.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/calendar_events.test.ts`; `endsAtMs` appears in the `listInRange` return type in `convex/_generated/api.d.ts`.

EVIDENCE: test output; `convex/_generated/api.d.ts` return shape for `listInRange`.

DO NOT:
- don't change how an event is stored without `endsAtMs` (backward compatible)
- don't add all-day logic, time zones, or reminders (out of scope)
- don't deploy; never touch the live Convex deployment

REPORT: contract shape changed, the validation rule in one sentence, anything that couldn't match the contract and why.

Standard: **ISO 8601** timestamps — `startsAtMs` / `endsAtMs` are absolute instants (ms since epoch) so a duration renders in the user's local day. https://www.iso.org/iso-8601-date-and-time-format.html

No new visible strings (the duration label is rendered by an existing component).

---

## TEMPO-BL-0004 — Lighthouse performance budget in CI

```yaml
---
ticket: TEMPO-BL-0004
batch: BL
type: ops
lane: codex
browser_test: false
scope:
  - .github/workflows/ci.yml
  - lighthouserc.json
depends_on: []
contract: []
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: every PR, so a merge cannot regress the web app's interaction and visual-stability budgets without CI saying so.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §4.8 F-80 "Polished look"; docs/CI.md "CI jobs (blocking) … must pass on every PR"; web.dev Core Web Vitals define the budgets this ticket enforces.

GOAL: the CI workflow runs a Lighthouse CI audit against the built `apps/web` and fails the job when any Core Web Vital budget is exceeded.

SCOPE: `.github/workflows/ci.yml` (add one job), `lighthouserc.json` (new budget config). Size: 2 files, no product code.

MUTATES: `.github/workflows/ci.yml` (new `lighthouse` job), `lighthouserc.json` (new, budget assertions only).

STEPS:
1. Add `lighthouserc.json` at the repo root with `assert` budgets:
   - `largest-contentful-paint` ≤ **2 500 ms**
   - `cumulative-layout-shift` ≤ **0.1**
   and `preset: "desktop"`.
2. Add a `lighthouse` job to `.github/workflows/ci.yml` that runs `bun install --frozen-lockfile` (or reuses the existing install), builds `apps/web`, then runs `bunx lhci autorun --config=lighthouserc.json` against the built static export (or `collect` + `assert`).
3. Mark the job as blocking (no `continue-on-error`), matching the other jobs in `ci.yml`.
4. Run the job locally via `act` or push a draft branch and read the workflow run; record the pass/fail.
5. `bun run lint` (the repo's own lint must still pass; there is no product code change here).

DONE: `CI=1 bunx lhci autorun --config=lighthouserc.json` exits 0 on the current `apps/web` build, and the new CI job is green on a draft PR.

EVIDENCE: the workflow run log for the `lighthouse` job; the `lhci` assertion output.

DO NOT:
- don't add `lhci` as a runtime dependency of the app (it runs in CI only)
- don't lower a budget to make it pass (if the current build already exceeds a budget, report `UNKNOWN` with the measured value rather than relaxing the number)
- don't change other CI jobs, scan baselines, or test config
- don't deploy

REPORT: the exact budgets added, the measured current values, and any `UNKNOWN` (e.g. whether `lhci` can run in the sandbox).

Standard: **LCP ≤ 2.5 s** https://web.dev/articles/lcp · **CLS ≤ 0.1** https://web.dev/articles/cls · **INP ≤ 200 ms** https://web.dev/articles/inp (INP is asserted in the follow-up budget once `lhci`'s field-data source is wired; the layout budgets above are the blocking assertions in this ticket).

No visible strings (CI-only).

---

## TEMPO-BL-0005 — Whop webhook (primary) + PayPal fallback → entitlements

```yaml
---
ticket: TEMPO-BL-0005
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/whop.ts
  - convex/lib/paypal_events.ts
  - convex/http.ts
depends_on: [TEMPO-BL-0001]
contract:
  - "api.entitlements.upsertGrant(args: { userId, provider, externalId, tier, status, expiresAtMs? }) -> Id<'entitlements'>  (consumed, defined in TEMPO-BL-0001)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0001
Billing note: keeps the PRD's Whop/PayPal wording. Depends: #1335 (Paddle/Whop switch); rewrite after it lands.

FOR: the billing lane, so a purchase or revocation in Whop (primary) or PayPal (fallback) updates the `entitlements` table from TEMPO-BL-0001.

WHEN: after TEMPO-BL-0001 lands (its `upsertGrant` is the write target).

WHY: docs/PRD.md §4.11 "Billing visible, never hidden"; docs/HARD_RULES.md §6.3 "high-stakes categories (… payments) always require confirm"; docs/HARD_RULES.md §2 payments (provider checkout, never a direct card SDK). This is the new provider direction (Whop first, PayPal fallback); the existing RevenueCat path is untouched.

GOAL: a Whop webhook endpoint verifies the signature and upserts the membership's tier/status into `entitlements`, and a PayPal fallback path does the same for PayPal subscriptions; both are inert (return non-success) while a server-owned processing switch is off, and neither reads a body while off.

SCOPE: `convex/whop.ts` (new), `convex/lib/paypal_events.ts` (new), `convex/http.ts` (mount the route), `convex/whop.test.ts` (new). Size: 3 files plus 1 test.

MUTATES: `convex/whop.ts` (new: signature verify + event → grant mapping), `convex/lib/paypal_events.ts` (new: PayPal event → grant mapping, pure), `convex/http.ts` (register `POST /api/whop-webhook`), `convex/whop.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/http.ts`, `convex/lib/entitlements.ts` and their dependents; adjust the plan to the current code.
2. `convex/lib/paypal_events.ts`: pure `parsePayPalEvent(input: unknown) -> { ok: true, event: { userId, tier, status, expiresAtMs? } } | { ok: false, reason }`, normalizing only the event types needed for a grant (subscribe/activate/expire/cancel); reject unknown/oversized/malformed payloads.
3. `convex/whop.ts`: an `httpAction` that (a) returns early without reading the body while `WHOP_PROCESSING_ENABLED === false`, (b) verifies the request signature (HMAC over the raw body), and (c) maps a membership event (`purchased`, `revoked`, `expired`) to `api.entitlements.upsertGrant` using the stable `externalId` (membership id). PayPal events route through the same `upsertGrant` with `provider: "paypal"`.
4. `convex/http.ts`: register `POST /api/whop-webhook` (and the PayPal fallback under the same handler or a sibling route).
5. Add `convex/whop.test.ts`: while the switch is off the body is never parsed and no write happens; a bad signature is rejected; a `purchased` event upserts an active grant; a `revoked` event marks it revoked.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/whop.test.ts`; `POST /api/whop-webhook` exists in `convex/http.ts` and returns a non-success response while the switch is off.

EVIDENCE: test output; the `convex/http.ts` route registration line.

DO NOT:
- don't set the processing switch on, and don't call a live provider (no real Whop/PayPal event is sent)
- don't read the request body or write any row while the switch is off (HARD_RULES §6.3, and the OFF-gate pattern from the existing RevenueCat guard)
- don't touch `convex/revenuecat.ts`
- don't print or log a secret; `WHOP_WEBHOOK_SECRET` and `PAYPAL_WEBHOOK_ID` are referenced by name only
- don't deploy

REPORT: contract names created, the event→grant mapping table, and `UNKNOWN` items (the exact Whop signature header name and PayPal webhook event names — verify against the provider docs at implementation).

Standard: **HMAC-SHA256** request signature verification before any write. https://docs.whop.com/developer/guides/webhooks

No new visible strings (server-side only; the user's tier label comes from `api.users.getMyPlan`).

---

## TEMPO-BL-0006 — Voice: remaining-minutes surface + exhausted state

```yaml
---
ticket: TEMPO-BL-0006
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/coach/voice/
depends_on: [TEMPO-BL-0001]
contract:
  - "api.voice.availability(args: {}) -> { available: boolean, reason: null|'pending'|'off'|'language'|'budget'|'resting', minutesLeft: number }"
  - "api.entitlements.getMyTier(args: {}) -> { tier: 'basic'|'pro'|'max', source: 'grant'|'entitlement', provider?, expiresAtMs? }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0001

FOR: people who use voice, so they see how much live-voice time is left today and, when it runs out, a clear message instead of a bare failure.

WHEN: after TEMPO-BL-0001 (the tier now comes from the entitlements table).

WHY: docs/HARD_RULES.md §9 "Live (streaming) voice is minute-capped per tier … Basic 30, Pro 90, Max 180 … Session start checks available budget; if < 1 minute remains, walkie-talkie remains available, live voice is gated behind an upgrade prompt." `convex/voice.ts` already computes `minutesLeft` in `availability`; the UI does not surface it.

GOAL: the voice panel shows "N minutes left today" plus the tier, and when live voice is exhausted shows the friendly copy and keeps the walkie-talkie (push-to-talk) control available.

SCOPE: `apps/web/components/coach/voice/` (the existing `VoiceCall` / `useVoiceCall` files). Size: about 2 files plus 1 test.

MUTATES: `apps/web/components/coach/voice/VoiceCall.tsx` (surface minutesLeft + exhausted state), `apps/web/components/coach/voice/useVoiceCall.ts` (read `availability` + `getMyTier`), `apps/web/components/coach/voice/voice-budget.test.tsx` (new).

STEPS:
1. Query the Graphify graph for the MUTATES files and their dependents; adjust the plan to the current code.
2. In `useVoiceCall`, read `api.voice.availability` and `api.entitlements.getMyTier`; expose `minutesLeft`, `reason`, and `tier`.
3. In `VoiceCall`, render a one-line "Voice time left today: N min" (hidden while `reason === 'off'` or while loading); when `reason === 'budget'` show the exhausted copy and the upgrade link; the push-to-talk control stays enabled.
4. Add `voice-budget.test.tsx` (Vitest + Testing Library, mock `convex/react`): shows the remaining minutes; on `budget` shows the exhausted copy and keeps push-to-talk; does not show a number while loading.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `voice-budget.test.tsx`; a signed-in Playwright run on the cloud computer shows the remaining-minutes line and, after the budget is spent, the exhausted copy with push-to-talk still available.

EVIDENCE: test output; screenshot of the voice panel (remaining and exhausted states).

DO NOT:
- don't change `convex/voice.ts` or the tier-minute values (30/90/180 live in the backend; if a value looks wrong, report it)
- don't show a made-up number — the number comes only from `availability.minutesLeft`
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified (paste the test + Playwright output), anything missing from the contract.

Standard: **voice reply first audio ≤ 300 ms** — the budget line must not add perceptible latency to the call controls; keep the read on an existing reactive query. https://developers.deepgram.com/docs/measuring-streaming-latency

Visible strings (keys):
- `voice.left` EN "Voice time left today: {n} min" / HE "נותרו לך {n} דקות קול היום"
- `voice.exhausted` EN "That's today's voice time. Typing works as always." / HE "זה היה זמן הקול להיום. אפשר להמשיך להקליד."
- `voice.upgrade` EN "Upgrade for more voice time" / HE "שדרוג לעוד זמן קול"
- `voice.ptt` EN "Hold to talk" / HE "החזקה כדי לדבר" (reuses existing `vc.ptt`)

---

## TEMPO-BL-0007 — "Make this page a template"

```yaml
---
ticket: TEMPO-BL-0007
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/notes/
depends_on: []
contract:
  - "api.templates.create(args: { name: string, description?: string, periodType: 'daily'|'weekly'|'monthly'|'none', body: string }) -> Id<'templates'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who shaped a page that works for them and want to reuse that shape for new pages.

WHEN: first in the backlog; independent (uses the existing `api.templates.create`).

WHY: docs/APP-FLOW.md §6 "Template flow: … **Make this page a template** works on any page"; docs/PRD.md §5 "Template module: a page shape … stored as a page with a `template` block." `convex/templates.ts` has `create`, but no note-screen control turns the open page into a template.

GOAL: the note page shows a "Make this page a template" action that saves the current page's markdown body (with its JSON blocks) as a new template under the page's `periodType`, then links to the Templates screen.

SCOPE: `apps/web/components/notes/` (the note page's actions). Size: about 2 files plus 1 test.

MUTATES: `apps/web/components/notes/PageEditorView.tsx` (add the action + confirm), `apps/web/components/notes/make-template.ts` (new helper: `buildTemplateName` + call `api.templates.create`), `apps/web/components/notes/make-template.test.ts` (new).

STEPS:
1. Query the Graphify graph for the MUTATES files and their dependents; adjust the plan to the current code.
2. Add a helper `make-template.ts` that takes the current note's `title`, `periodType`, and `body` and calls `api.templates.create({ name: title, periodType, body })`; return the new template id.
3. In `PageEditorView.tsx`, add a "Make this page a template" action (with a one-tap confirm); on success, show an inline confirmation with a link to `/templates`; disable it while the page is unsaved.
4. Add `make-template.test.ts` (Vitest + Testing Library, mock `convex/react`): clicking the action calls `create` with the page's `periodType` and `body`; the link to `/templates` appears only after success.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `make-template.test.ts`; a signed-in Playwright run on the cloud computer turns an open page into a template visible in `/templates`.

EVIDENCE: test output; screenshot of the action and the confirmation link.

DO NOT:
- don't change `convex/templates.ts` or the templates table (if a field is missing, report `blocked: missing backend <function>`)
- don't copy any text from another product's templates — the body is the user's own page
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, anything missing from the contract.

Standard: **WCAG 2.2 target size ≥ 24×24 CSS px** for the new action button. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `note.makeTemplate` EN "Make this page a template" / HE "הפוך את הדף לתבנית"
- `note.makeTemplate.confirm` EN "Save this page as a template?" / HE "לשמור את הדף כתבנית?"
- `note.makeTemplate.done` EN "Saved as a template" / HE "נשמר כתבנית"
- `note.makeTemplate.view` EN "View templates" / HE "לתבניות"

---

## TEMPO-BL-0008 — Calendar tokens in pages and templates

```yaml
---
ticket: TEMPO-BL-0008
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/lib/template-pages.ts
depends_on: [TEMPO-BL-0007]
contract:
  - "api.templates.applyToNote(args: { templateId: string, title?: string }) -> Id<'notes'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0007

FOR: people who apply a template or make a page and want date words (`{{next_monday}}`, `{{today}}`) replaced with the real date.

WHEN: after TEMPO-BL-0007 (the template path is exercised by "make this page a template" and the template run).

WHY: docs/PRD.md §4.1 F-08 "calendar tokens (`{{next_monday}}`)"; docs/APP-FLOW.md §6 "code copies the body, resolves tokens like `{{next_monday}}`, gives every block a fresh id". Today the token resolution is incomplete (UNKNOWN exactly which tokens resolve).

GOAL: when a template is applied (or a page created from a template), every supported calendar token is replaced with a date computed in the user's local time zone; an unknown token is left as-is, never silently dropped.

SCOPE: `apps/web/lib/template-pages.ts` (and its existing test). Size: 1 file plus 1 test.

MUTATES: `apps/web/lib/template-pages.ts` (add token resolution to the draft builder), `apps/web/lib/template-pages.test.ts` (new or extended).

STEPS:
1. Query the Graphify graph for `apps/web/lib/template-pages.ts` and its callers; adjust the plan to the current code.
2. Define the supported token set: `{{today}}`, `{{tomorrow}}`, `{{yesterday}}`, `{{next_monday}}`, `{{next_sunday}}`, `{{next_month_first}}`; each resolves to `YYYY-MM-DD` in the user's local day (the same convention as `convex/lib/pageLedger.ts` `isValidLocalDate`).
3. In the draft builder, replace each token in the body before blocks are given fresh ids; leave any other `{{...}}` unchanged.
4. Add/extend `template-pages.test.ts`: `{{today}}` → today's local date; `{{next_monday}}` → the next Monday strictly after today; a literal `{{unknown_token}}` is preserved; the week-start rule (Sunday vs Monday) is UNKNOWN and must be pinned in the test to Monday only if the repo already defaults to Monday (report otherwise).
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `template-pages.test.ts` with each supported token resolving to its expected local date.

EVIDENCE: test output.

DO NOT:
- don't change `convex/` (resolution is client-side, same as the existing draft builder)
- don't change the user's time zone or week-start handling beyond reading the existing preference
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: the supported token list, the week-start rule used, and any `UNKNOWN` (which tokens the current builder already resolves).

Standard: **ISO 8601** local dates `YYYY-MM-DD` (matches `convex/lib/pageLedger.ts`). https://www.iso.org/iso-8601-date-and-time-format.html

No new visible strings (tokens are literal text the user writes; the resolved value is a date).

---

## TEMPO-BL-0009 — Hebrew coach chat: locale replies + RTL thread

```yaml
---
ticket: TEMPO-BL-0009
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/coach/
depends_on: []
contract:
  - "api.coach.sendMessage(args: { conversationId, text, locale?: 'en'|'he' }) -> …"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who use Tempo in Hebrew, so the coach replies in Hebrew and the chat thread lays out right-to-left with numbers, code and English runs staying left-to-right.

WHEN: first in the backlog; independent (the i18n layer and `dirFor` already exist in `apps/web/lib/i18n.ts`).

WHY: docs/PRD.md §4.7 F-73 "The coach and voice answer in the user's chosen language"; F-72 "Mixed Hebrew and English inside one note renders each paragraph in its own direction"; docs/TRD.md §5b "Copy lives in `apps/web/messages/en.json` and `he.json` … a locale in the RTL list gets `dir='rtl'`." The coach reply locale and the chat thread's RTL layout are not yet wired end to end.

GOAL: when the user's locale is `he`, the coach's reply is requested in Hebrew and the chat thread renders `dir="rtl"` with `.tp-num` / `.tp-mono` islands and `dir="auto"` on mixed lines.

SCOPE: `apps/web/components/coach/` (CoachChat and its message row). Size: about 2 files plus 1 test.

MUTATES: `apps/web/components/coach/CoachChat.tsx` (pass `locale` to the send call; set thread direction), `apps/web/components/coach/MessageRow.tsx` (new or existing message row: `dir="auto"` on the body, `.tp-num` on numbers), `apps/web/components/coach/coach-rtl.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/coach/CoachChat.tsx` and its dependents; adjust the plan to the current code.
2. In `CoachChat.tsx`, read the current locale (from the existing `LocaleProvider`) and pass `locale` to the send call; set the message list wrapper to `dir={dirFor(lang)}`.
3. In the message row, render the body with `dir="auto"`; wrap numerals and code spans in the existing `.tp-num` / `.tp-mono` classes so they stay LTR.
4. Add `coach-rtl.test.tsx` (Vitest + Testing Library): with `lang="he"` the list has `dir="rtl"`; a mixed "אנגלית English 123" line renders `dir="auto"` and the numeral uses `.tp-num`.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `coach-rtl.test.tsx`; a signed-in Playwright run on the cloud computer with `?lang=he` shows an RTL thread and an LTR numeral inside a Hebrew line.

EVIDENCE: test output; screenshot of the coach chat in Hebrew.

DO NOT:
- don't change `convex/coach.ts`'s reply logic — if the backend ignores `locale`, report `blocked: missing backend <locale>` and do not fake it on the client
- don't machine-invent new Hebrew copy beyond the existing `he` keys; use `translate(lang, key)`
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any `UNKNOWN` (whether `api.coach.sendMessage` already accepts `locale`; Hebrew reply quality needs a native review — see header).

Standard: **Unicode UAX #9** bidirectional algorithm for mixed-direction text (this is what `dir="auto"` and the bidi ordering rely on). https://www.unicode.org/reports/tr9/ · **WCAG 2.2 AA 4.5:1** for the chat text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys, reusing existing `he` copy):
- `nav.language` EN "עברית" is the switch label (already present); this ticket adds no new user-facing string beyond reusing `translate` for the thread's aria labels:
- `coachChat.threadLabel` EN "Coach conversation" / HE "שיחת מאמן"

---

## TEMPO-BL-0010 — Mobile magic-link sign-in

```yaml
---
ticket: TEMPO-BL-0010
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/mobile/app/(auth)/sign-in.tsx
depends_on: []
contract:
  - "signIn('resend', { email, flow: 'signIn' })"   # Convex Auth Resend provider, same as web
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people signing in on the phone app, so they use a magic link like the web instead of a password.

WHEN: first in the backlog; independent.

WHY: docs/APP-FLOW.md §2 "Phone app: sign-in method UNKNOWN (OTP or magic link) … Today `apps/mobile` still shows password sign-in."; docs/PRD.md §4.1 F-01 "Sign-in by magic link only (Resend), plus sign-out. No password, no passkeys." `apps/mobile/app/(auth)/sign-in.tsx` still calls `signIn('password', …)`.

GOAL: the mobile sign-in screen sends a Resend magic link by email (the same Convex Auth path as web) and removes the password field entirely.

SCOPE: `apps/mobile/app/(auth)/sign-in.tsx` and its copy. Size: 1 file plus 1 test.

MUTATES: `apps/mobile/app/(auth)/sign-in.tsx` (replace the password form with an email + "Send magic link" flow and a "check your inbox" state), `apps/mobile/app/(auth)/sign-in.test.tsx` (new or extended).

STEPS:
1. Query the Graphify graph for `apps/mobile/app/(auth)/sign-in.tsx` and its dependents; adjust the plan to the current code.
2. Replace the `password` state and the `signIn('password', …)` call with `signIn('resend', { email, flow: 'signIn' })`; keep the `email` validation.
3. Add the waiting state ("Check your inbox for the link") and an inline error on a bad or unapproved email (reuse the existing web copy keys).
4. Add/extend `sign-in.test.tsx` (React Native Testing Library): submits the email, shows the waiting state, and never renders a password input.
5. `bun run lint && bun run typecheck && bun run test` (Bun only; do not run `eas build`).

DONE: `bun run test` passes the mobile sign-in test; the screen no longer contains a `password` input.

EVIDENCE: test output.

DO NOT:
- don't run `eas build` or `eas login` (those are `human-amit` / `twin` actions; `docs/MOBILE_EAS.md`)
- don't add a password fallback, OTP, or a second auth method
- don't touch `apps/mobile/app/(auth)/sign-up.tsx` (out of scope)
- don't deploy

REPORT: what changed, what was verified, any `UNKNOWN` (whether the mobile Convex client is already wired to the Resend provider).

Standard: **WCAG 2.2 target size ≥ 24×24 CSS px** (web) / **44×44 dp touch target** (mobile) for the email field and the send button. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `auth.email` EN "Email" / HE "אימייל"
- `auth.sendLink` EN "Send magic link" / HE "שליחת קישור כניסה"
- `auth.checkEmail` EN "Check your inbox for the link." / HE "בדקו את תיבת הדואר — נשלח קישור."

---

## Self-check (detailed-enough) log

For each ticket, the questions a builder would ask, and where each is answered (fixed in the ticket) or left `UNKNOWN` (with who answers).

**TEMPO-BL-0001 (entitlements)**
- What is the tier precedence when several grants exist? → fixed (highest of basic < pro < max wins; `resolveEntitlementTier`).
- What happens when a grant expires? → fixed (expired counts as `none`).
- Does the open-signup "max" grant stay? → fixed (unchanged; the table only adds provider grants).
- Where do Whop vs PayPal grants differ? → fixed (same table, `provider` field).
- What tiers exist? → fixed (basic / pro / max, per PRD §4.11).
- Who maps the Whop "product" to a tier? → UNKNOWN — the product→tier mapping is decided by Amit and encoded in TEMPO-BL-0005.

**TEMPO-BL-0002 (coach artifacts)**
- Which catalog components are legal per kind? → UNKNOWN — the full catalog names are generated from json-render's catalog; the implementer reads `catalog.prompt()` (TRD §4b) and lists the four kinds in REPORT.
- Is a spec that fails validation retried or shown to the user? → fixed (rejected; coach retries; nothing is saved).
- Where is the artifact saved? → fixed (an `artifact` block in a page, via the accept/reject path).

**TEMPO-BL-0003 (calendar end time)**
- Is `endsAtMs` required or optional? → fixed (optional, backward compatible).
- What if `endsAtMs <= startsAtMs`? → fixed (throws).
- Does `listInRange` change shape? → fixed (adds `endsAtMs`).

**TEMPO-BL-0004 (Lighthouse CI)**
- Does the current build already pass? → UNKNOWN — measured on the first run; if it exceeds a budget, report the measured value, do not relax the number.
- Can `lhci` run in the sandbox? → UNKNOWN — reported in the run log if blocked.
- Why not assert INP directly? → fixed (INP needs field data; the layout budgets are the blocking assertions).

**TEMPO-BL-0005 (Whop/PayPal webhooks)**
- Exact Whop signature header name? → UNKNOWN — verify against docs.whop.com at implementation.
- Exact PayPal webhook event names? → UNKNOWN — verify against PayPal developer docs at implementation.
- Which events map to which status? → fixed (purchased/revoked/expired for Whop; subscribe/activate/expire/cancel for PayPal).
- How does the handler stay OFF? → fixed (server-owned switch; body never read while off).

**TEMPO-BL-0006 (voice surface)**
- Where does `minutesLeft` come from? → fixed (`api.voice.availability`).
- Does the tier come from the new table? → fixed (`api.entitlements.getMyTier`).
- Does walkie-talkie stay available when live is exhausted? → fixed (push-to-talk control stays enabled).

**TEMPO-BL-0007 (make page a template)**
- Does this need a new backend function? → fixed (uses existing `api.templates.create`).
- What name/periodType does the template get? → fixed (page title + page `periodType`).
- What about pages whose blocks are broken? → fixed (body saved as-is; broken blocks stay `broken`, per PRD §4.1 F-03).

**TEMPO-BL-0008 (calendar tokens)**
- Which tokens are supported? → fixed (six listed).
- Week starts Sunday or Monday? → UNKNOWN — the repo defaults to Monday (BACKEND-SCHEMA §7 question 3); the ticket pins to Monday only if the repo already does, else reports it.
- Unknown tokens? → fixed (left as-is, never dropped).

**TEMPO-BL-0009 (Hebrew coach RTL)**
- Does `api.coach.sendMessage` already accept `locale`? → UNKNOWN — if not, the component ticket reports `blocked: missing backend <locale>`.
- Is the Hebrew reply text native-quality? → UNKNOWN — native review by Amit / a Hebrew speaker (the repo already flags machine-drafted Hebrew).

**TEMPO-BL-0010 (mobile magic link)**
- Is the mobile Convex client wired to the Resend provider? → UNKNOWN — reported if the `signIn('resend', …)` call has no provider on mobile yet.
- Is the link valid on the phone's redirect? → UNKNOWN — depends on the EAS/Expo scheme; reported, not guessed.

---

## Inputs I could not find / reconcile

1. **Billing provider direction.** The docs still say "Polar on web, RevenueCat on mobile, no Stripe" (`docs/PRD.md` §4.11/§8, `docs/TRD.md`, `docs/REVENUECAT_SETUP.md`), while this pilot's instruction is "Whop first, PayPal fallback, entitlements table". The Whop/PayPal tickets (BL-0001, BL-0005) follow the instruction and are marked as the new direction; the existing RevenueCat files are left untouched. This is a doc-sync item for Amit (`notes for ticket sync`).
2. **`gh issue list` could not run** — `gh` has no auth on this machine and `GH_TOKEN`/`GITHUB_TOKEN` are unset. I read open issues with the Reason issues tool instead: 30 open issues (#1246–#1316), none of which these 10 tickets duplicate.
3. **"AGENTS.md §8.1 front matter"** was not found as a literal section — `AGENTS.md` is 133 lines with no `§8.1`. The front-matter fields used here come from `docs/tickets/_templates/*.md` and the current KB/FEATURE issue front matter.
4. **`include.md`** (the "detailed enough" self-check source) was not found in the repo; I applied the described method directly (list builder questions → fix or mark UNKNOWN).
5. **Exact provider API details** (Whop signature header, PayPal event names, Whop product→tier mapping) are UNKNOWN and flagged in the tickets to be verified against the vendor docs at implementation.
6. **Hebrew copy** is machine-drafted in the repo and needs native review (the repo itself notes this).

<!-- lane 0011-0021 -->
## TEMPO-BL-0011 — Memory recall: hybrid vector + keyword

```yaml
---
ticket: TEMPO-BL-0011
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/schema.ts
  - convex/memory.ts
  - convex/lib/ai_router.ts
depends_on: []
contract:
  - "api.memory.remember(args: { content: string, sector?: 'semantic'|'episodic'|'procedural'|'emotional'|'general' }) -> Id<'memories'>"
  - "api.memory.recallHybrid(args: { query: string, limit?: number }) -> Array<{ _id: Id<'memories'>, content: string, sector: string, salience: number }>  (action)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the coach chat and "What Tempo remembers", so recall finds a memory by meaning ("my gym schedule", "the thing about my brother") and not only by an exact word.

WHEN: first in the backlog; the coach memory loop (TEMPO-BL-0012) and the memory UI (TEMPO-BL-0013) wait for it.

WHY: docs/TRD.md §5 "recall = Convex vector search (meaning) + the existing search index (keyword), merged"; docs/PRD.md §4.5 F-50 "Recall searches by meaning and by keyword". Today `convex/memory.ts` `recall` collects every live memory (`.collect()`) and substring-matches the query in JavaScript; the `memories` table has no `embedding` field and no vector index, so "recall by meaning" is not possible.

GOAL: `memories` gains a 1,024-dimension `embedding` and a vector index; `remember` stores an embedding on insert, and a new `recallHybrid` action returns the union of semantic (vector) and keyword matches, de-duplicated and ordered by salience.

SCOPE: `convex/schema.ts`, `convex/memory.ts`, `convex/lib/ai_router.ts` (the DeepInfra seam), plus `convex/memory.test.ts`. Size: 3 files plus 1 test.

MUTATES: `convex/schema.ts` (additive `embedding: v.optional(v.array(v.number()))` + a vector index on `memories`), `convex/memory.ts` (`remember` stores an embedding via a new internal action; new `recallHybrid` action), `convex/lib/ai_router.ts` (add an `embedText` helper that calls DeepInfra's embeddings endpoint and returns the first 1,024 values re-normalised), `convex/memory.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/schema.ts`, `convex/memory.ts`, `convex/lib/ai_router.ts` and their dependents; adjust the plan to the current code.
2. In `convex/schema.ts`, add `embedding: v.optional(v.array(v.number()))` to `memories` and a `vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1024, filterFields: ["userId"] })`. Log the additive change in `convex/MIGRATIONS.md`.
3. In `convex/lib/ai_router.ts`, add `embedText(text: string): Promise<number[]>` using native `fetch` against DeepInfra's embeddings endpoint (`DEEPINFRA_API_KEY` by name only) with the model `Qwen/Qwen3-Embedding-8B`; keep the first 1,024 values and re-normalise to unit length.
4. In `convex/memory.ts`, make `remember` run an internal action that embeds the trimmed content and stores the vector in the same insert (the mutation stays the public entry point; an embedding failure falls back to storing `embedding: undefined` and logs nothing user-visible). Add `recallHybrid` (an `action`, because Convex vector search runs only in actions): `ctx.vectorSearch` over the user's live memories merged with the existing keyword substring match, de-duplicated by `_id`, ordered by salience then `updatedAt`, capped at `limit` (default 8).
5. Add `convex/memory.test.ts` cases: `recallHybrid` returns a semantic match that shares no word with the query; a keyword match still returns; results are de-duplicated when one row matches both ways; `remember` stores an embedding when `embedText` succeeds and stores `undefined` (and still succeeds) when the embed call errors.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/memory.test.ts` and `convex/lib/ai_router.test.ts`; `api.memory.recallHybrid` exists in `convex/_generated/api.d.ts` with the shape above.

EVIDENCE: test output; the `recallHybrid` line in `convex/_generated/api.d.ts`.

DO NOT:
- don't change the keyword-only `recall` query's return shape (existing callers keep working); `recallHybrid` is additive
- don't print or log `DEEPINFRA_API_KEY` or any embedding payload
- don't store the embedding of any other user's content (filter by `userId` before and after the search)
- don't deploy; never touch the live Convex deployment

REPORT: contract names created, the merge rule (semantic ∪ keyword, de-duplicated, salience order), and any `UNKNOWN` (whether DeepInfra accepts a `dimensions` parameter — the code truncates locally either way).

Standard: **Convex vector search — at most 2,048 dimensions, at most 256 results per query, runs only in actions.** https://docs.convex.dev/search/vector-search · Embedding model `Qwen/Qwen3-Embedding-8B`, keep the first **1,024** dimensions (docs/TRD.md §5).

No new visible strings (server-side only; the recall list is rendered by existing memory views).

---

## TEMPO-BL-0012 — Coach memory loop: recall + past chats into reply context; remember salient facts after a turn

```yaml
---
ticket: TEMPO-BL-0012
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/coach.ts
  - convex/lib/coachPrompt.ts
  - convex/lib/coachHistory.test.ts
depends_on: [TEMPO-BL-0011]
contract:
  - "api.memory.recallHybrid(args: { query: string, limit?: number }) -> Array<{ _id, content, sector, salience }>  (consumed by coach.reply, defined in TEMPO-BL-0011)"
  - "api.memory.remember(args: { content: string, sector? }) -> Id<'memories'>  (consumed after each coach turn)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0011

FOR: a chat-first coach that actually remembers — the reply is built from the person's relevant memories and earlier messages, and after the turn the coach keeps the salient facts it learned.

WHEN: after TEMPO-BL-0011 (recall by meaning exists). The memory UI (TEMPO-BL-0013) waits for it.

WHY: docs/APP-FLOW.md §6 "Memory flow: … The coach calls `context` before replying and `remember` after"; docs/PRD.md §4.5 F-50 "recall used by the coach … the coach can also search the user's past chats"; docs/PRD.md §3.1 target "a very strong chat window that remembers". Today `convex/lib/coachPrompt.ts` builds the prompt from history + page + tasks only; no memory is recalled and nothing is written back to `memories` after a turn.

GOAL: a coach reply includes a bounded `<memories>` section (recallHybrid on the user's last message) and a bounded `<past>` section (matching earlier messages), and after the reply the coach writes 1–3 salient facts into `memories` with the used-memory ids attached to the reply for the UI.

SCOPE: `convex/coach.ts`, `convex/lib/coachPrompt.ts`, and the existing `convex/lib/coachHistory.test.ts`. Size: 2 files plus 1 test.

MUTATES: `convex/coach.ts` (`reply` runs `recallHybrid` + past-chat search before `buildCoachMessages`, then calls `api.memory.remember` for the salient facts after `saveReply`, and attaches `toolCalls.coachMemory = { ids: Id<'memories'>[] }` to the reply), `convex/lib/coachPrompt.ts` (`COACH_LIMITS` gains `memoryItems` and `pastMessages`; `buildCoachMessages` renders the two sections and the prompt tells the model to cite which memories it used), `convex/lib/coachHistory.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/coach.ts`, `convex/lib/coachPrompt.ts` and their dependents; adjust the plan to the current code.
2. In `convex/lib/coachPrompt.ts`, add `COACH_LIMITS.memoryItems = 8` and `COACH_LIMITS.pastMessages = 5`; in `buildCoachMessages`, render a `<memories>` list (truncated to `COACH_LIMITS.titleChars` each) and a `<past>` list (latest matching messages first) after the existing page/tasks context.
3. In `convex/coach.ts`, inside `reply` (before the model call): derive a short recall query from the user's last message, call `api.memory.recallHybrid`, and gather past messages that share a word with the query (via the existing `messages` search, capped at `pastMessages`). Pass both into `buildCoachMessages`.
4. After `saveReply`, extract up to 3 salient facts (a single short model call with a strict "return only first-person facts" instruction) and write each with `api.memory.remember`; attach the used-memory ids to the reply's `toolCalls.coachMemory` so TEMPO-BL-0013 can show them. A fact that duplicates an existing memory (same trimmed content) is skipped.
5. Add/extend `convex/lib/coachHistory.test.ts`: a memory whose words do not appear in the query is still passed to the prompt; the `<memories>` section never exceeds `memoryItems`; the `<past>` section never exceeds `pastMessages`; the remembered-fact step skips an exact duplicate.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/coachHistory.test.ts` and `convex/coach.test.ts`; the `<memories>` and `<past>` sections are present in `buildCoachMessages` output for a non-empty recall.

EVIDENCE: test output; a transcript line showing a prompt with a `<memories>` section.

DO NOT:
- don't call `recallHybrid` or `remember` with another user's data (every memory call filters by `userId`)
- don't write a memory that is a rephrasing of an existing one (dedupe by trimmed content)
- don't exceed the new `memoryItems` / `pastMessages` caps, whatever the model returns
- don't store raw model output outside a validated `memories` row
- don't deploy; never touch the live Convex deployment

REPORT: the exact recall-query derivation, the two new limits, and any `UNKNOWN` (whether the used-memory ids survive the reply round-trip; the extraction instruction's exact wording — a native review of Hebrew facts is out of scope and flagged for Amit).

Standard: **Convex vector search returns at most 256 results per query** — the semantic arm of recall is hard-capped well under this (top 8 kept). https://docs.convex.dev/search/vector-search

No new visible strings (server-side only; the used-memory chips are rendered by TEMPO-BL-0013).

---

## TEMPO-BL-0013 — Memory surfaced in chat: used-memory card with Forget/Undo

```yaml
---
ticket: TEMPO-BL-0013
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/components/coach/
  - apps/web/lib/coach-sources.ts
depends_on: [TEMPO-BL-0012]
contract:
  - "api.memory.forget(args: { memoryId: Id<'memories'> }) -> { success: true }"
  - "api.memory.restore(args: { memoryId: Id<'memories'> }) -> { success: boolean }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0012

FOR: people chatting with the coach, so they can see which memories the coach used in a reply and remove one with a one-tap Undo.

WHEN: after TEMPO-BL-0012 (the reply carries `toolCalls.coachMemory = { ids }`).

WHY: docs/PRD.md §4.5 F-52 "See and forget memories"; docs/PRD.md §2 "personalization … the AI never silently mutates user state"; docs/HARD_RULES.md §1 "Undo is a feature … at least 5 minutes". The coach now remembers and recalls, but the chat never shows which memories it used, and there is no forget/undo control in the chat.

GOAL: under a reply that used memories, the chat shows a "Tempo used these memories" card listing them; each row has Forget, and forgetting one shows an inline Undo for 5 minutes (the same `restore` path the memory screen uses).

SCOPE: `apps/web/components/coach/` (one new card), `apps/web/lib/coach-sources.ts` (a pure helper for reading `toolCalls.coachMemory`), plus one test. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/MemorySourcesCard.tsx` (new), `apps/web/lib/coach-sources.ts` (add `memoryIds(toolCalls)` + `readMemoryIds`), `apps/web/components/coach/MemorySourcesCard.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/coach/CoachChat.tsx` and `apps/web/lib/coach-sources.ts`; adjust the plan to the current code.
2. In `apps/web/lib/coach-sources.ts`, add a pure `memoryIds(toolCalls: unknown): Id<'memories'>[]` that reads `toolCalls.coachMemory.ids` and returns an empty array for anything else.
3. In `MemorySourcesCard.tsx`, render the ids (looked up through the existing memories query) with the card title, one row per memory, a Forget button per row, and a per-row 5-minute Undo via `api.memory.forget` / `api.memory.restore`; rows a user has forgotten disappear.
4. Mount `MemorySourcesCard` in `CoachChat.tsx` under each assistant message whose `memoryIds(...)` is non-empty (reuse the existing sources-card placement so it does not reflow the thread).
5. Add `MemorySourcesCard.test.tsx` (Vitest + Testing Library, mock `convex/react`): shows a row per id; Forget removes the row; Undo restores it within 5 minutes and hides Undo after.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `MemorySourcesCard.test.tsx`; `memoryIds` returns `[]` for a reply with no `coachMemory`, and the card renders only when the ids are non-empty.

EVIDENCE: test output; a screenshot of the card in a real conversation (if a signed-in browser is reachable; otherwise report the component as unit-tested only).

DO NOT:
- don't change `convex/` (the `forget` / `restore` calls already exist; if an id is missing from the query, report `blocked: missing backend <function>`)
- don't hard-delete anything on the client (only call `api.memory.forget`)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, and any `UNKNOWN` (whether the memories query exposes the ids the coach attached).

Standard: **WCAG 2.2 AA contrast 4.5:1** for the card's memory text and Forget/Undo labels. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys):
- `coachMem.used` EN "Tempo used these memories" / HE "טמפו השתמשה בזיכרונות האלה"
- `coachMem.forget` EN "Forget" / HE "שכח"
- `coachMem.forgot` EN "Forgotten. Undo" / HE "נשכח. בטל"
- `coachMem.undone` EN "Memory restored" / HE "הזיכרון שוחזר"
(Hebrew is machine-drafted; a native review is flagged for Amit, matching the repo's own note.)

---

## TEMPO-BL-0014 — Conversations: pin a thread (backend)

```yaml
---
ticket: TEMPO-BL-0014
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/schema.ts
  - convex/conversations.ts
depends_on: []
contract:
  - "api.conversations.setPinned(args: { conversationId: Id<'conversations'>, pinned: boolean }) -> Id<'conversations'>"
  - "api.conversations.list(args: {}) -> Array<{ _id, title, updatedAt, pinnedAt? }>  (pinned first, then updatedAt desc)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people with several coach threads, so the one they return to every day stays at the top of the list.

WHEN: first in the backlog; independent. The thread-list UI (TEMPO-BL-0015) waits for it.

WHY: docs/APP-FLOW.md §1 `/coach` "wired"; docs/HARD_RULES.md §5 "Every write sets `updatedAt`; soft delete only." `convex/conversations.ts` has `list` / `create` / `updateTitle` / `remove` but no pin, and `list` returns every conversation ordered by `updatedAt` with no pinned-first ordering.

GOAL: `conversations` gains an optional `pinnedAt`; a new `setPinned` mutation pins/unpins a thread, and `list` returns pinned threads first, then the rest by `updatedAt` descending.

SCOPE: `convex/schema.ts`, `convex/conversations.ts`, plus `convex/conversations.test.ts`. Size: 2 files plus 1 test.

MUTATES: `convex/schema.ts` (additive `pinnedAt: v.optional(v.number())` to `conversations`), `convex/conversations.ts` (`setPinned` mutation that sets or clears `pinnedAt`; `list` sorts pinned first), `convex/conversations.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/schema.ts`, `convex/conversations.ts` and their dependents; adjust the plan to the current code.
2. In `convex/schema.ts`, add `pinnedAt: v.optional(v.number())` to `conversations` (additive; log it in `convex/MIGRATIONS.md`). No new index is required — `list` reads the user's own rows and sorts in the handler.
3. In `convex/conversations.ts`, add `setPinned` (mutation): require auth, verify ownership, patch `pinnedAt: pinned ? Date.now() : undefined` and `updatedAt: Date.now()`. Change `list` to sort by `pinnedAt` present-first, then `updatedAt` descending.
4. Add `convex/conversations.test.ts` cases: pin moves a thread before an unpinned newer thread; unpin restores the updatedAt order; `setPinned` on another user's conversation throws; pinning does not hard-delete anything.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/conversations.test.ts`; `api.conversations.setPinned` exists in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `setPinned` line in `convex/_generated/api.d.ts`.

DO NOT:
- don't add a `pinned` boolean (a timestamp keeps ordering and unpin identical to never-pinned)
- don't change `updateTitle` or `remove` (rename and soft-delete already exist)
- don't deploy; never touch the live Convex deployment

REPORT: contract name created, the ordering rule in one sentence, anything that couldn't match the contract and why.

Standard: **UNKNOWN** — no industry-standard number applies to a pin toggle; the human-interface metric this backs (WCAG 2.2 target size ≥ 24×24 CSS px for the pin button) is asserted in TEMPO-BL-0015.

No new visible strings (server-side only).

---

## TEMPO-BL-0015 — Thread list: pin + rename UI

```yaml
---
ticket: TEMPO-BL-0015
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/components/coach/CoachThreads.tsx
  - apps/web/lib/coach-threads.ts
depends_on: [TEMPO-BL-0014]
contract:
  - "api.conversations.setPinned(args: { conversationId, pinned: boolean }) -> Id<'conversations'>"
  - "api.conversations.updateTitle(args: { conversationId, title }) -> Id<'conversations'>"
  - "api.conversations.list(args: {}) -> Array<{ _id, title, updatedAt, pinnedAt? }>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0014

FOR: people using the coach thread list, so they can pin the chat they return to and rename a chat from the list instead of living with "New Conversation".

WHEN: after TEMPO-BL-0014 (`setPinned` and pinned-first ordering exist).

WHY: docs/APP-FLOW.md §1 `/coach` "wired"; `convex/conversations.ts` already exposes `updateTitle`, but `apps/web/components/coach/CoachThreads.tsx` only offers delete (no rename, no pin). The title stored is still the server default for new chats.

GOAL: each thread row shows a pin toggle (pinned rows first) and an inline rename; renaming updates the title, and pinned threads stay above unpinned ones.

SCOPE: `apps/web/components/coach/CoachThreads.tsx`, `apps/web/lib/coach-threads.ts`, plus one test. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/CoachThreads.tsx` (pin toggle + rename affordance), `apps/web/lib/coach-threads.ts` (pure sort/selection helpers for pinned-first ordering), `apps/web/lib/coach-threads.test.ts` (new).

STEPS:
1. Query the Graphify graph for `CoachThreads.tsx` and `apps/web/lib/coach-threads.ts`; adjust the plan to the current code.
2. In `coach-threads.ts`, add pure helpers: `pinFirst<T extends { pinnedAt?: number; updatedAt: number }>(threads)` (pinned first, then `updatedAt` desc) and `renameDraftOf(thread)`; keep the existing search grouping intact.
3. In `CoachThreads.tsx`, add a pin toggle per row (calls `api.conversations.setPinned`) and an inline rename (a text input, `Enter` commits `api.conversations.updateTitle`, `Escape` cancels). Keep the existing delete-with-confirm and keyboard/escape handling.
4. Add `apps/web/lib/coach-threads.test.ts`: pinned rows sort first; unpin returns to updatedAt order; `renameDraftOf` returns the stored title or the empty-string fallback.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `apps/web/lib/coach-threads.test.ts`; the thread list renders pinned threads first and offers pin + rename.

EVIDENCE: test output; a screenshot of the thread list with a pinned row (if a signed-in browser is reachable; otherwise report unit-tested only).

DO NOT:
- don't change `convex/` (both mutations exist; if `updateTitle` rejects an empty title, show the server error, don't guess)
- don't change the delete flow or the search grouping (out of scope)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any `UNKNOWN` (whether `conversations.list` already returns `pinnedAt`).

Standard: **WCAG 2.2 target size ≥ 24×24 CSS px** for the pin button and the rename input. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `cc.pin` EN "Pin" / HE "הצמד"
- `cc.unpin` EN "Unpin" / HE "בטל הצמדה"
- `cc.rename` EN "Rename" / HE "שנה שם"
- `cc.rename.placeholder` EN "Chat name" / HE "שם השיחה"

---

## TEMPO-BL-0016 — Calendar event proposal from chat (backend)

```yaml
---
ticket: TEMPO-BL-0016
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/coach.ts
  - convex/lib/coachPrompt.ts
  - convex/lib/coachProposalGuard.ts
depends_on: []
contract:
  - "api.coach.acceptProposal(args: { messageId: Id<'messages'>, edit?: { title?, startsAtMs?, endsAtMs? } }) -> { kind: 'event', createdId: string, undoUntilMs: number }"
  - "api.calendar_events.create(args: { title: string, startsAtMs: number, endsAtMs?: number }) -> Id<'calendarEvents'>  (consumed on accept)"
  - "api.calendar_events.remove(args: { eventId: Id<'calendarEvents'> }) -> Id<'calendarEvents'>  (consumed on undo)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who ask the coach "remind me to call the clinic tomorrow at 9" and want that as a calendar event, not only as a task.

WHEN: first in the backlog; independent (the task/note/template/decision kinds already exist; this adds `event`).

WHY: docs/PRD.md §4.2 F-22 "Coach actions: create a note, add a task to Today, fill a template"; docs/APP-FLOW.md §5 item 7 "/calendar: events get a start and end time"; docs/HARD_RULES.md §6.3 "high-stakes categories (calendar events with real-world consequences …) always require confirm regardless of confidence." The coach proposal kinds today are `task | note | template | decision` — there is no way to create an event from chat.

GOAL: the coach can propose an `event` (title, `startsAtMs`, optional `endsAtMs`); accepting it creates a calendar event, and the event is undoable for 5 minutes — always through the accept card, never written by the model directly.

SCOPE: `convex/coach.ts`, `convex/lib/coachPrompt.ts`, `convex/lib/coachProposalGuard.ts`, plus `convex/coach.test.ts`. Size: 3 files plus 1 test.

MUTATES: `convex/coach.ts` (add `event` to `chatProposalValidator` and the `acceptProposal`/`undoProposal` branches so accept calls `calendar_events.create` and undo calls `calendar_events.remove`), `convex/lib/coachPrompt.ts` (add `event` to the `CoachProposal` union, its editor validator, and the prompt's proposal rules), `convex/lib/coachProposalGuard.ts` (let `event` cards pass, like `decision`), `convex/coach.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/coach.ts`, `convex/lib/coachPrompt.ts`, `convex/lib/coachProposalGuard.ts` and `convex/calendar_events.ts`; adjust the plan to the current code.
2. In `coachPrompt.ts`, add `event` to `CoachProposal`: `{ kind: 'event', title: string, startsAtMs: number, endsAtMs?: number }`; update the prompt so an event requires `startsAtMs` (a real instant) and `endsAtMs > startsAtMs` when present.
3. In `coach.ts`, extend `chatProposalValidator` with the `event` shape; in `acceptProposal` add the `event` branch (call `api.calendar_events.create` with the person's edited fields, return `createdId` and `undoUntilMs`); in `undoProposal` add the `event` branch (call `api.calendar_events.remove`).
4. In `coachProposalGuard.ts`, treat `event` like `decision` (always passes the task-duplicate check).
5. Add `convex/coach.test.ts` cases: an `event` proposal with `endsAtMs <= startsAtMs` is rejected; accepting creates a calendar event; undoing it removes it within 5 minutes; a proposal without `startsAtMs` never parses.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the new `convex/coach.test.ts` cases; `acceptProposal` returns `kind: 'event'` and creates a `calendarEvents` row.

EVIDENCE: test output; the `event` branch in `convex/coach.ts`.

DO NOT:
- don't add all-day logic, time zones, or reminders (a later ticket owns those)
- don't let the model write the event directly — only `acceptProposal` writes (HARD_RULES §6.2)
- don't auto-accept an event, whatever the confidence (HARD_RULES §6.3: calendar events always require confirm)
- don't change `convex/calendar_events.ts` (its `create`/`remove` already exist; if a field is missing, report `blocked: missing backend <function>`)
- don't deploy; never touch the live Convex deployment

REPORT: contract shape changed, the accept/undo branch in one sentence, and any `UNKNOWN` (whether `calendar_events.remove` soft-deletes — it must, per HARD_RULES §5).

Standard: **ISO 8601** — `startsAtMs` / `endsAtMs` are absolute instants (ms since epoch) so the event lands on the right local day. https://www.iso.org/iso-8601-date-and-time-format.html

No new visible strings (server-side only; the event card is rendered by TEMPO-BL-0017).

---

## TEMPO-BL-0017 — Calendar event accept card (edit before accept, Undo)

```yaml
---
ticket: TEMPO-BL-0017
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/components/coach/
  - apps/web/lib/coach-conversation.ts
depends_on: [TEMPO-BL-0016]
contract:
  - "api.coach.acceptProposal(args: { messageId, edit?: { title?, startsAtMs?, endsAtMs? } }) -> { kind, createdId, undoUntilMs }"
  - "api.coach.undoProposal(args: { messageId }) -> { kind, createdId }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0016

FOR: people approving a calendar event the coach proposed, so they can fix the time before it is added and undo it from the chat if it was wrong.

WHEN: after TEMPO-BL-0016 (the `event` proposal kind exists).

WHY: docs/HARD_RULES.md §1 "accept-reject flow is law … confirm / edit / reject"; docs/HARD_RULES.md §1 "Undo … at least 5 minutes"; docs/PRD.md §6 "The JSON is never shown on any screen." The per-message proposal card (`ChatProposal`) renders task/note/template/decision but has no event variant.

GOAL: an `event` proposal renders as an editable card (title, start time, end time); Accept adds the event, and the reply shows Undo for 5 minutes.

SCOPE: `apps/web/components/coach/` (the event card), `apps/web/lib/coach-conversation.ts` (a pure helper for the event fields), plus one test. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/CoachEventProposal.tsx` (new), `apps/web/components/coach/ChatProposal.tsx` (branch to render the event card when `proposal.kind === 'event'`), `apps/web/lib/coach-conversation.ts` (add `eventFields(proposal)`), `apps/web/components/coach/CoachEventProposal.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/coach/ChatProposal.tsx` and `apps/web/lib/coach-conversation.ts`; adjust the plan to the current code.
2. In `coach-conversation.ts`, add a pure `eventFields(proposal)` that reads `title`, `startsAtMs`, `endsAtMs` and returns a normalized `{ title, startsAtMs, endsAtMs? }`.
3. Add `CoachEventProposal.tsx`: editable title, start and optional end time; Accept calls `api.coach.acceptProposal` with the edited fields; on success show the Undo button for 5 minutes calling `api.coach.undoProposal`.
4. In `ChatProposal.tsx`, render `CoachEventProposal` when the proposal kind is `event` (keep the other kinds unchanged).
5. Add `CoachEventProposal.test.tsx` (Vitest + Testing Library, mock `convex/react`): renders the three fields; an end time before the start time disables Accept; Accept calls `acceptProposal` with the edited values; Undo calls `undoProposal`.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `CoachEventProposal.test.tsx`; an `event` proposal renders the editable card and never shows raw JSON.

EVIDENCE: test output; a screenshot of the event card (if a signed-in browser is reachable; otherwise report unit-tested only).

DO NOT:
- don't change `convex/` (accept/undo exist; if `undoProposal` rejects after 5 minutes, show the server message, don't fake an undo)
- don't invent a timezone — read the user's locale and render local wall-clock time, but send absolute `startsAtMs`/`endsAtMs`
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any `UNKNOWN` (the exact date/time input the design system uses).

Standard: **WCAG 2.2 AA contrast 4.5:1** for the card's labels and the Accept/Undo buttons. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys):
- `coachEvent.title` EN "Add to calendar" / HE "הוסף ליומן"
- `coachEvent.when` EN "When" / HE "מתי"
- `coachEvent.duration` EN "Duration" / HE "משך"
- `coachEvent.accept` EN "Add event" / HE "הוסף אירוע"
- `coachEvent.undone` EN "Event removed" / HE "האירוע הוסר"

---

## TEMPO-BL-0018 — Recent coach changes strip with per-action Undo

```yaml
---
ticket: TEMPO-BL-0018
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/components/coach/
  - apps/web/lib/coach-conversation.ts
depends_on: []
contract:
  - "api.coach.undoProposal(args: { messageId: Id<'messages'> }) -> { kind: string, createdId: string }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who accepted a coach action and want one place to undo the last few changes, instead of scrolling back to the original message.

WHEN: first in the backlog; independent (reads existing accepted-proposal data). It renders `event` changes automatically once TEMPO-BL-0016 lands.

WHY: docs/HARD_RULES.md §1 "Undo is a feature. Every mutation that the AI performs is reversible with a one-click undo for at least 5 minutes"; docs/PRD.md §4.2 F-22 "Each action shows in the chat with a 5-minute Undo." Today Undo lives only on the original assistant message's proposal card; there is no session-wide list of recent coach changes.

GOAL: a "Recent changes" strip lists every coach action accepted in the last 5 minutes (task, note, template, decision, event) with a one-tap Undo per action; it empties as each action's 5-minute window expires.

SCOPE: `apps/web/components/coach/` (one new strip), `apps/web/lib/coach-conversation.ts` (a pure helper that scans the thread for accepted, still-undoable proposals), plus one test. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/RecentChangesStrip.tsx` (new), `apps/web/components/coach/CoachChat.tsx` (mount the strip above the thread), `apps/web/lib/coach-conversation.ts` (add `recentUndoableProposals(messages, now)`), `apps/web/components/coach/RecentChangesStrip.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/coach/CoachChat.tsx`, `apps/web/lib/coach-conversation.ts` and `apps/web/components/coach/ChatProposal.tsx`; adjust the plan to the current code.
2. In `coach-conversation.ts`, add a pure `recentUndoableProposals(messages, now)` that returns accepted proposals with `undoUntilMs > now`, newest first, each with its `messageId` and a short label.
3. Add `RecentChangesStrip.tsx`: renders the returned proposals with their kind label and an Undo button that calls `api.coach.undoProposal(messageId)`; a proposal disappears from the strip once undone or past `undoUntilMs`.
4. Mount the strip in `CoachChat.tsx`; it renders nothing when there are no undoable actions.
5. Add `RecentChangesStrip.test.tsx` (Vitest + Testing Library): lists only proposals whose `undoUntilMs > now`; Undo calls `undoProposal`; expired proposals are omitted.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `RecentChangesStrip.test.tsx`; the strip shows accepted-but-unexpired coach actions and hides expired ones.

EVIDENCE: test output; a screenshot of the strip with two actions (if a signed-in browser is reachable; otherwise report unit-tested only).

DO NOT:
- don't change `convex/` (`undoProposal` already exists; if an action was already undone, show the server error, don't guess)
- don't re-implement the 5-minute window in a second place — read `undoUntilMs` from the existing proposal data
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, and any `UNKNOWN` (the exact kind labels to show for `decision` vs `template`).

Standard: **WCAG 2.2 AA contrast 4.5:1** for the strip text and Undo labels. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys):
- `coachRecent.title` EN "Recent changes" / HE "שינויים אחרונים"
- `coachRecent.undo` EN "Undo" / HE "בטל"
- `coachRecent.none` EN "No recent coach changes" / HE "אין שינויים אחרונים של המאמן"

---

## TEMPO-BL-0019 — Crisis safeguard: escalation + country-specific resources

```yaml
---
ticket: TEMPO-BL-0019
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/crisis.ts
  - convex/lib/crisisWords.ts
  - convex/schema.ts
depends_on: []
contract:
  - "api.crisis.resourcesCard(args: { locale: 'en'|'he' }) -> { title: string, body: string, resources: Array<{ label: string, detail: string }> }"
  - "api.crisis.check(args: { text: string }) -> { isCrisis: boolean, escalate: boolean }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people in an escalating crisis, so after repeated crisis signals the coach stops coaching and shows resources for their country instead of the generic card.

WHEN: first in the backlog; independent. The crisis UI (TEMPO-BL-0020) waits for it.

WHY: docs/PRD.md §2 "Escalation: three nights without sleep, severe distress or an escalating crisis → show real resources for the user's country, stop coaching"; docs/PRD.md §4.2 F-24 "Fixed crisis card … per-country data MVP"; docs/HARD_RULES.md §7 "Crisis card text is fixed content, never written by a model." Today `convex/lib/crisisWords.ts` returns one generic `CRISIS_CARD`, and `convex/crisis.ts` `resourcesCard` ignores the user's locale and has no escalation state.

GOAL: `resourcesCard` returns a country-specific card from the user's locale (fixed content, no model call), and `check` also returns `escalate: true` when the user has sent crisis text in at least two of the last three coach messages — the signal that coaching must stop.

SCOPE: `convex/crisis.ts`, `convex/lib/crisisWords.ts`, `convex/schema.ts` (a per-user escalation field), plus `convex/crisisWords.test.ts`. Size: 3 files plus 1 test.

MUTATES: `convex/crisis.ts` (`resourcesCard` takes `locale` and returns a locale-mapped card; `check` returns `escalate`), `convex/lib/crisisWords.ts` (add a country-resource map keyed by locale and an `isEscalating(history)` pure helper), `convex/schema.ts` (additive `crisisEscalatedAt: v.optional(v.number())` on `users` so the escalate state persists), `convex/crisisWords.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/crisis.ts`, `convex/lib/crisisWords.ts`, `convex/coach.ts` (its crisis branch) and `convex/schema.ts`; adjust the plan to the current code.
2. In `convex/lib/crisisWords.ts`, add a fixed `CRISIS_RESOURCES_BY_LOCALE` map (en → US **988** Suicide & Crisis Lifeline; he → ער"ן 1201 and the Israeli hotline, with labels) and a pure `isEscalating(history: Array<{ role, content }>): boolean` that returns true when at least two of the last three user messages contain crisis text.
3. In `convex/schema.ts`, add an additive `crisisEscalatedAt: v.optional(v.number())` field on `users`; log it in `convex/MIGRATIONS.md`.
4. In `convex/crisis.ts`, make `resourcesCard({ locale })` return the mapped card (fallback to the generic card for an unmapped locale) and `check({ text })` return `{ isCrisis, escalate }` by reading the user's recent messages; when `escalate` is true, patch `crisisEscalatedAt`.
5. Add `convex/crisisWords.test.ts`: `isEscalating` is false for one crisis message, true for two of three; an unmapped locale returns the generic card; the en card carries 988; the he card carries ער"ן.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/crisisWords.test.ts`; `resourcesCard` returns a country-specific card for `en` and `he` and `check` returns `escalate: true` after two of three crisis messages.

EVIDENCE: test output; the `escalate` field in `convex/_generated/api.d.ts`.

DO NOT:
- don't let a model write any crisis-card text — every string is fixed content (HARD_RULES §7)
- don't add Hebrew crisis keywords here (that is tracked in issue #1252)
- don't return resources for a country you cannot source — fall back to the generic card and report `UNKNOWN`
- don't deploy; never touch the live Convex deployment

REPORT: the locale→country map added, the escalation threshold in one sentence, and any `UNKNOWN` (the exact Israeli hotline number and its label — verify against the official source, don't invent one).

Standard: **988 Suicide & Crisis Lifeline (US)** — the fixed en resource number. https://988lifeline.org/ · the he resource (ער"ן) is verified against its official source at implementation; the escalation threshold "two of the last three messages" is a product constant from PRD §2, not an industry number.

No new visible strings (server-side only; the card text is fixed and rendered by TEMPO-BL-0020).

---

## TEMPO-BL-0020 — Crisis card UI: country resources + stop-coaching state

```yaml
---
ticket: TEMPO-BL-0020
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/web/components/coach-crisis/
depends_on: [TEMPO-BL-0019]
contract:
  - "api.crisis.resourcesCard(args: { locale: 'en'|'he' }) -> { title, body, resources: Array<{ label, detail }> }"
  - "api.crisis.check(args: { text }) -> { isCrisis: boolean, escalate: boolean }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0019

FOR: people in crisis, so the card shows their country's resources and, once the coach has escalated, the chat clearly stops coaching.

WHEN: after TEMPO-BL-0019 (`resourcesCard({ locale })` and `check` return `escalate`).

WHY: docs/PRD.md §2 "Escalation … stop coaching"; docs/PRD.md §4.2 F-24 "Fixed crisis card"; docs/HARD_RULES.md §1 "Never shame the user." Today `apps/web/components/coach-crisis/CrisisResourcesCard.tsx` and `useCrisisGuard.ts` show the generic card and do not reflect escalation or locale.

GOAL: the crisis card reads `resourcesCard` for the user's locale, and when `check` reports `escalate`, the chat shows the resources card and a fixed "this needs a person now" state and does not send further coaching messages.

SCOPE: `apps/web/components/coach-crisis/` (the existing card + guard), plus one test. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach-crisis/CrisisResourcesCard.tsx` (read `resourcesCard` with the locale), `apps/web/components/coach-crisis/useCrisisGuard.ts` (return `escalate` and block sends while it is true), `apps/web/components/coach-crisis/crisisCopy.test.ts` (extend).

STEPS:
1. Query the Graphify graph for `apps/web/components/coach-crisis/` and its callers (`CoachChat.tsx`); adjust the plan to the current code.
2. In `CrisisResourcesCard.tsx`, call `api.crisis.resourcesCard({ locale })` (locale from the existing `LocaleProvider`) and render the returned title, body and resources; keep the card fixed-content (no model text).
3. In `useCrisisGuard.ts`, read `api.crisis.check` and expose `escalate`; when `escalate` is true, the chat shows the card and disables the send path (reuse the existing `crisisHold` state in `CoachChat.tsx`).
4. Extend `crisisCopy.test.ts`: the card renders the locale's resources; `escalate: true` disables the composer; the card never renders model text.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `crisisCopy.test.ts`; with `locale = 'he'` the card shows the Hebrew resources, and `escalate: true` stops the send.

EVIDENCE: test output; a screenshot of the crisis card in Hebrew (if a signed-in browser is reachable; otherwise report unit-tested only).

DO NOT:
- don't change `convex/` (both calls exist; if `resourcesCard` returns the generic card for an unmapped locale, show it, don't fabricate a number)
- don't write any crisis copy in the component — every string comes from the fixed card or `crisisCopy.ts`
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, and any `UNKNOWN` (whether `LocaleProvider` is available inside the crisis card's tree).

Standard: **WCAG 2.2 AA contrast 4.5:1** for the card text and the phone-number links. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys):
- `cr.escalated` EN "I'm glad you told me. This needs a person now — the numbers above are for right now." / HE "טוב שסיפרת לי. זה צריך אדם עכשיו — המספרים למעלה מיועדים לרגע זה."
(reuses the existing `crisisCopy.ts` keys for the rest; the escalation line is fixed content, never model-written.)

---

## TEMPO-BL-0021 — Chat performance: reply context token budget + trimming

```yaml
---
ticket: TEMPO-BL-0021
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/coachPrompt.ts
  - convex/lib/coachLoad.ts
depends_on: []
contract:
  - "internal: buildCoachMessages(...) keeps the assembled prompt under COACH_LIMITS.contextTokens; no public API change"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: every coach reply, so a long page or many memories cannot push the prompt past the model's budget and make the reply slow or fail.

WHEN: first in the backlog; independent.

WHY: docs/TRD.md §5 "recall, then trim to a token cap"; docs/PRD.md §3.1 "a very strong chat window that remembers"; `convex/lib/coachPrompt.ts` caps each item in characters (`historyChars`, `pageChars`, `titleChars`) but has no total budget, so many items can still overflow the model context.

GOAL: `buildCoachMessages` enforces a total token budget and trims the lowest-priority context (oldest history first, then lowest-salience memories) until the prompt fits, without ever dropping the user's current message.

SCOPE: `convex/lib/coachPrompt.ts`, `convex/lib/coachLoad.ts`, plus `convex/lib/coachPrompt.test.ts`. Size: 2 files plus 1 test.

MUTATES: `convex/lib/coachPrompt.ts` (`COACH_LIMITS.contextTokens`, a `trimToBudget` pure helper, and the budget applied in `buildCoachMessages`), `convex/lib/coachLoad.ts` (pass the salience/recency ordering the trimmer needs), `convex/lib/coachPrompt.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/lib/coachPrompt.ts`, `convex/lib/coachLoad.ts` and their callers (`convex/coach.ts`); adjust the plan to the current code.
2. In `coachPrompt.ts`, add `COACH_LIMITS.contextTokens = 8000` and a pure `trimToBudget(parts, budgetTokens)` that drops the oldest history messages first, then the lowest-salience memory lines, and always keeps the system prompt and the user's newest message. Use a character-to-token estimate (≈4 chars/token) and document it in the code comment.
3. Apply the trimmer at the end of `buildCoachMessages` so the returned messages sum to at most the budget; keep the existing per-item char caps.
4. In `coachLoad.ts`, expose the salience/recency ordering the trimmer needs (memories already arrive salience-ordered from `recallHybrid`; history is newest-last).
5. Add `convex/lib/coachPrompt.test.ts`: an oversized page + memory set trims to the budget; the newest user message is never dropped; a small prompt is unchanged; the estimate comment matches the constant.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/coachPrompt.test.ts`; `buildCoachMessages` output stays at or under `COACH_LIMITS.contextTokens` for an oversized input.

EVIDENCE: test output; the token estimate for a representative prompt (logged, not printed in production).

DO NOT:
- don't change the per-item char caps (they still apply first)
- don't add a tokenizer dependency (a documented char estimate is enough; report `UNKNOWN` if the model's real tokenizer differs)
- don't drop the user's newest message or the crisis-card path (crisis replies never reach the model)
- don't deploy; never touch the live Convex deployment

REPORT: the budget chosen, the trimming priority order in one sentence, and any `UNKNOWN` (the exact tokenizer for the runtime text model — a char estimate is used until it is measured).

Standard: **Nielsen Norman Group response-time limits — a reply within about 1 second keeps the user's flow of thought.** https://www.nngroup.com/articles/response-times-3-important-limits/ (the budget keeps the prompt small enough that the runtime model answers fast; the measured reply latency is reported in EVIDENCE).

No new visible strings (server-side only).

---

## Self-check (detailed-enough) log

For each ticket, the questions a builder would ask, and where each is answered (fixed in the ticket) or left `UNKNOWN` (with who answers).

**TEMPO-BL-0011 (hybrid recall)**
- Which embedding model and dimensions? → fixed (Qwen3-Embedding-8B, first 1,024 dims, re-normalised).
- Why an action, not a query? → fixed (Convex vector search runs only in actions).
- What if the embed call fails? → fixed (remember still inserts, `embedding: undefined`, no user-visible error).
- Does the existing `recall` query change? → fixed (no; `recallHybrid` is additive).

**TEMPO-BL-0012 (coach memory loop)**
- How is the recall query derived? → fixed (short query from the user's last message).
- How many memories / past messages? → fixed (8 memories, 5 past messages).
- Does the coach write memories without approval? → fixed (only `memory.remember`; low-stakes, surfaced + undoable via TEMPO-BL-0013). Whether every remembered fact must also pass a confirm/edit/reject card: UNKNOWN — Amit decides (HARD_RULES §1 vs APP-FLOW §6 "remember after"); the ticket keeps writes visible and undoable.

**TEMPO-BL-0013 (memory card)**
- Where do the used-memory ids come from? → fixed (`toolCalls.coachMemory.ids`, attached in TEMPO-BL-0012).
- Is forgetting reversible? → fixed (5-minute `restore`).
- Does the memories query expose those ids? → UNKNOWN — the implementer confirms; if not, `blocked: missing backend <function>`.

**TEMPO-BL-0014 (pin backend)**
- Why a timestamp, not a boolean? → fixed (unpin = never-pinned; ordering needs no sentinel).
- Is a new index needed? → fixed (no; `list` sorts in the handler).
- Standard number? → UNKNOWN (none applies; the UI metric is asserted in TEMPO-BL-0015).

**TEMPO-BL-0015 (pin/rename UI)**
- Does `updateTitle` accept an empty title? → UNKNOWN — show the server error rather than guessing.

**TEMPO-BL-0016 (event proposal)**
- Is the event ever auto-accepted? → fixed (never; HARD_RULES §6.3 always-confirm for calendar).
- Undo path? → fixed (`calendar_events.remove`).
- Does `calendar_events.remove` soft-delete? → UNKNOWN — must be true (HARD_RULES §5); report if not.

**TEMPO-BL-0017 (event card)**
- Which date/time input? → UNKNOWN — the design-system component; absolute ms are always sent.
- Invalid end-before-start? → fixed (Accept disabled).

**TEMPO-BL-0018 (recent changes strip)**
- Where does the 5-minute window come from? → fixed (`undoUntilMs` on the existing proposal).
- Kind labels for decision/template? → UNKNOWN — resolved from the existing i18n groups.

**TEMPO-BL-0019 (crisis backend)**
- Exact Israeli hotline label/number? → UNKNOWN — verified against the official source at implementation; never invented.
- Escalation threshold? → fixed (two of the last three messages, from PRD §2 "three nights / escalating").
- Hebrew keywords? → fixed out of scope (issue #1252 owns them).

**TEMPO-BL-0020 (crisis UI)**
- Is `LocaleProvider` in the card's tree? → UNKNOWN — confirmed at implementation.
- Any model-written copy? → fixed (none; fixed content only).

**TEMPO-BL-0021 (token budget)**
- Exact tokenizer? → UNKNOWN — a documented char estimate (≈4 chars/token) until measured.
- Is the user's newest message ever dropped? → fixed (never).
- Budget value? → fixed (`contextTokens = 8000`), reported if the measured model window differs.

---

## Inputs I could not find / reconcile

1. **`gh issue list` could not run** — `gh` has no auth on this machine and `GH_TOKEN`/`GITHUB_TOKEN` are unset. I read open issues with the Reason `issues_search` tool instead: **30 open issues** (#1252–#1336), and none of these 11 tickets duplicates one. In particular `#1252` (Hebrew crisis keywords) and `#1253` (live voice) are deliberately left to those issues.
2. **Text-model name drift.** `convex/lib/ai_router.ts` still defaults to `deepseek-ai/DeepSeek-V4.1-Flash` (6 Oct), while the 29 Oct decision names **GLM 5.3 Flash on DeepInfra**. These tickets avoid naming the text model and refer to "the runtime text model via the DeepInfra seam"; this is a doc/code sync item for Amit (`notes for ticket sync`). The embedding model (`Qwen/Qwen3-Embedding-8B`) is unchanged and is the only model these tickets pin.
3. **"AGENTS.md §8.1 front matter"** was not found as a literal section — `AGENTS.md` is 133 lines with "## The ticket (11 fields)", and the actual front-matter fields come from `docs/tickets/_templates/*.md` and the B05 examples. The front matter here matches those.
4. **`include.md`** was not found in the repo; I applied the described "detailed enough" method directly (list builder questions → fix or mark UNKNOWN, above).
5. **Hebrew copy** is machine-drafted and needs native review (the repo itself flags this); every Hebrew key above is marked accordingly.

<!-- lane 0022-0032 -->
## TEMPO-BL-0022 — Two paid tiers: $20 / $50 price catalog

```yaml
---
ticket: TEMPO-BL-0022
batch: BL
type: component
lane: claude
browser_test: false
scope:
  - apps/web/lib/settings/billing.ts
  - apps/web/config/planDisplay.ts
  - apps/web/lib/settings/settings.test.ts
depends_on: []
contract:
  - "No backend functions. Reads the existing api.users.getMyPlan(args: {}) -> { plan: 'none'|'trial'|'basic'|'pro'|'max', status, entitlementTier, userType, isBeta }."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: #1335 (Paddle/Whop switch); rewrite after it lands.

FOR: the billing screen and every price the product shows, so the two paid plans read **Pro $20** and **Max $50** a month (the 29 Oct pricing), not the old three-tier $10/$20/$40.

WHEN: first in this worker's billing lane; the price table is the source the limits ticket (TEMPO-BL-0023), the upgrade/downgrade UI (TEMPO-BL-0024) and the trial screen (TEMPO-BL-0025) all read.

WHY: the 29 Oct decision "Plans: $20 and $50 tiers" supersedes `apps/web/lib/settings/billing.ts` (which today lists Trial $1, Basic $10, Pro $20, Max $40) and `apps/web/config/planDisplay.ts` (a stale Hebrew paywall at ₪29/₪290). The repo PRD §4.11 wording for providers (Whop first, PayPal fallback) is unchanged by this ticket; this ticket only changes the price points.

GOAL: `apps/web/lib/settings/billing.ts` exposes exactly two paid tiers — Pro $20/mo ($200/yr) and Max $50/mo ($500/yr) — plus the $1/3-week trial; `planDisplay.ts` no longer shows ₪29/₪290; and `settings.test.ts` asserts the new amounts.

SCOPE: `apps/web/lib/settings/billing.ts`, `apps/web/config/planDisplay.ts`, `apps/web/lib/settings/settings.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `apps/web/lib/settings/billing.ts` (change `TIERS`: remove the `basic` entry; set `pro.monthly = 20`, `max.monthly = 50`; keep `trial.monthly = 1` and `MONTHS_PER_PAID_YEAR = 10`), `apps/web/config/planDisplay.ts` (remove the ₪29/₪290 literals or mark them UNKNOWN), `apps/web/lib/settings/settings.test.ts` (new cases).

STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, `graphify-out/graph.json`) for the MUTATES files and their dependents; adjust the plan to the current code.
2. In `apps/web/lib/settings/billing.ts`, set `TIERS` to `trial` ($1), `pro` ($20, liveVoiceMinutes 90), `max` ($50, liveVoiceMinutes 180); delete the `basic` entry and its `TierId` union member only if no other module reads `"basic"` (grep first; if `PlanCard.tsx` or i18n keys reference `basic`, keep the union member but remove it from `TIERS` and report the leftover).
3. Update `apps/web/config/planDisplay.ts`: remove the stale ₪29/₪290 lines. The exact Hebrew (ILS) prices are UNKNOWN (Amit decides the ILS conversion); do not invent a rate.
4. Extend `apps/web/lib/settings/settings.test.ts`: `TIERS` has exactly `trial/pro/max`; `tierPrice(pro, "month")` → `{ amount: 20, per: "month" }`; `tierPrice(max, "year")` → `{ amount: 500, per: "year" }`; `formatUsd(50)` → `"$50"`.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the new `settings.test.ts` cases; `TIERS` in `apps/web/lib/settings/billing.ts` contains exactly the two paid tiers at $20 and $50.

EVIDENCE: test output; the `TIERS` array as it appears in `apps/web/lib/settings/billing.ts`.

DO NOT:
- don't change `convex/`, the schema, `users.getMyPlan`, or any backend tier union (retiring `basic` from `entitlementTier`/`subscriptionStates.plan` is a separate schema ticket; report it as a follow-up)
- don't add a checkout call or touch a payment provider (TEMPO-BL-0024 and #1336 own the action)
- don't invent an ILS/USD rate for `planDisplay.ts` (report UNKNOWN)
- don't touch `.github/`, `scripts/factory/`, `.cursor/`, `AGENTS.md`, `docs/tickets/`, `docs/contracts/`
- don't deploy

REPORT: the final `TIERS` array, the `basic` references still left (if any), and the UNKNOWN ILS price decision (who answers: Amit).

Standard: **Baymard Institute** — the average documented online shopping-cart abandonment rate is **70.19%**; unclear or surprising pricing is a primary cause, so the price table must read the two tiers exactly as charged. https://baymard.com/lists/cart-abandonment-rate

No new visible strings (prices are numbers). `planDisplay.ts` ILS amounts are UNKNOWN (Amit).

---

## TEMPO-BL-0023 — Per-tier limits single source (voice minutes and tier limits)

```yaml
---
ticket: TEMPO-BL-0023
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/tierLimits.ts
  - convex/lib/voicePolicy.ts
  - convex/lib/tierLimits.test.ts
depends_on: [TEMPO-BL-0022]
contract:
  - "convex/lib/tierLimits.ts exports tierLiveMinutes(tier: 'none'|'pro'|'max'|'god') -> number and TIER_LIVE_MINUTES (no api.* function)"
  - "convex/lib/voicePolicy.ts dailyMinutesFor(tier: string|undefined) -> number (signature unchanged)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0022

FOR: every place that limits a paid feature, so the per-tier limits (live-voice minutes today, and later scheduled-job or connector counts) come from one module instead of two files that can drift apart.

WHEN: after TEMPO-BL-0022 lands (the tier set is $20/$50, Pro/Max), and before the voice-cap ticket (TEMPO-BL-0030) and the premium gate (TEMPO-BL-0026).

WHY: HARD_RULES §9 "Live (streaming) voice is minute-capped per tier … Basic 30, Pro 90, Max 180"; the same numbers are duplicated in `convex/lib/voicePolicy.ts` (`TIER_LIVE_MINUTES`) and `apps/web/lib/settings/billing.ts` (`liveVoiceMinutes`), and they already disagree (billing shows `trial`/`basic` with no live minutes while `voicePolicy` grants `basic` 30). With Basic retired by TEMPO-BL-0022, there must be one server-side source of truth.

GOAL: a new `convex/lib/tierLimits.ts` is the single source for per-tier limits (`pro` 90 live minutes, `max` 180, `none` 0), and `convex/lib/voicePolicy.ts` reads it instead of its own copy.

SCOPE: `convex/lib/tierLimits.ts` (new), `convex/lib/voicePolicy.ts`, `convex/lib/tierLimits.test.ts` (new). Size: 2 files plus 1 test.

MUTATES: `convex/lib/tierLimits.ts` (new: `TIER_LIVE_MINUTES = { none: 0, pro: 90, max: 180, god: 180 }` and `tierLiveMinutes(tier)`), `convex/lib/voicePolicy.ts` (import `TIER_LIVE_MINUTES`/`tierLiveMinutes` from `tierLimits.ts`; delete the local copy), `convex/lib/tierLimits.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/lib/voicePolicy.ts`, `convex/lib/tierLimits.ts` (after creating it) and their dependents; adjust the plan to the current code.
2. Add `convex/lib/tierLimits.ts` with `TIER_LIVE_MINUTES` and a pure `tierLiveMinutes(tier)` that returns 0 for an unknown or missing tier (fail closed).
3. In `convex/lib/voicePolicy.ts`, import the values from `tierLimits.ts`, remove the local `TIER_LIVE_MINUTES`, and keep `dailyMinutesFor`'s existing "no higher than the preview cap" behaviour unchanged.
4. Add `convex/lib/tierLimits.test.ts`: `tierLiveMinutes("pro") === 90`, `tierLiveMinutes("max") === 180`, `tierLiveMinutes("none") === 0`, `tierLiveMinutes("basic") === 0` (retired tier fails closed), and `dailyMinutesFor` still returns the same number `voicePolicy.test.ts` already asserts.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/tierLimits.test.ts` and `convex/lib/voicePolicy.test.ts`; `convex/lib/voicePolicy.ts` no longer contains a local `TIER_LIVE_MINUTES`.

EVIDENCE: test output; the import line in `convex/lib/voicePolicy.ts`.

DO NOT:
- don't change the minute numbers (90/180 stay HARD_RULES §9 until Amit changes them; TEMPO-BL-0030 lifts the preview cap)
- don't add limits for features that don't exist yet (keep this to live-voice minutes; a later ticket adds other limits)
- don't touch `apps/web/lib/settings/billing.ts` (TEMPO-BL-0022 owns it; this ticket only removes the duplicate server-side)
- don't deploy; never touch the live Convex deployment

REPORT: the module created, the single line that now owns the numbers, and any caller that still had a hard-coded copy.

Standard: **UNKNOWN** — no industry standard sets per-tier voice-minute caps; the 90/180 values are HARD_RULES §9 owner decisions (Amit). The fail-closed rule (unknown tier gets 0) is the enforcement posture, not a measured number.

No new visible strings (server-side only).

---

## TEMPO-BL-0024 — Upgrade / downgrade UI (change plan with confirm)

```yaml
---
ticket: TEMPO-BL-0024
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/billing-plan/
depends_on: [TEMPO-BL-0022]
contract:
  - "No new backend functions. Components read api.users.getMyPlan and call the checkout entry the tier ids point at (checkout itself is #1336)."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0022, #1335 (Paddle/Whop switch); rewrite after it lands.

FOR: a signed-in person who wants to move between the $20 Pro and $50 Max plans (or cancel to trial/none), so the change happens through one confirmed action instead of a provider dashboard.

WHEN: after TEMPO-BL-0022 (the two tiers exist in the catalog).

WHY: HARD_RULES §6.3 "high-stakes categories (… payments) always require confirm"; docs/APP-FLOW.md §7 "Billing is never hidden". Today `apps/web/components/billing-plan/BillingPlan.tsx` and `PlanCard.tsx` are read-only: the cards show prices but have no change-plan control (`set.billing.chooseLater` is a text hint only).

GOAL: the billing screen shows a "Change plan" action on each non-current tier card, opens a confirm step, and — for a downgrade — states the person keeps the current plan until the end of the billing period.

SCOPE: `apps/web/components/billing-plan/BillingPlan.tsx`, `apps/web/components/billing-plan/PlanCard.tsx`, `apps/web/components/billing-plan/ChangePlanConfirm.tsx` (new), `apps/web/components/billing-plan/BillingPlan.test.tsx` (extend). Size: 3 files plus 1 test.

MUTATES: `BillingPlan.tsx` (pass a change handler), `PlanCard.tsx` (render the action and call it), `ChangePlanConfirm.tsx` (new confirm dialog), `BillingPlan.test.tsx` (new cases).

STEPS:
1. Query the Graphify graph for the MUTATES files and their dependents; adjust the plan to the current code.
2. Add a `ChangePlanConfirm` dialog that shows the target tier's name, a one-line "You'll be charged at the end of this billing period" note, and a Confirm button; nothing fires on the confirm until the checkout entry exists (call the named entry, or render a `blocked: checkout not wired` state when it is absent).
3. In `PlanCard`, render a `Change plan` action on a non-current tier (not on `trial` when already on `trial`); a downgrade from a higher to a lower tier appends the "you keep {tier} until the end of this period" line.
4. Extend `BillingPlan.test.tsx` (Vitest + Testing Library, mock `convex/react`): tapping "Change plan" opens the confirm; the downgrade copy appears only for a lower tier; the action does not appear on the current tier.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `BillingPlan.test.tsx`; a signed-in Playwright run on the cloud computer shows the "Change plan" action and the confirm dialog on `/billing`.

EVIDENCE: test output; screenshot of `/billing` with the confirm dialog open.

DO NOT:
- don't call a live payment provider or charge anything (the checkout entry is #1336; when it is absent, report `blocked: checkout not wired`)
- don't change `convex/` (scope-guard fails a component PR that touches `convex/**`)
- don't change plan prices or the trial (TEMPO-BL-0022 owns prices; TEMPO-BL-0025 owns the trial screen)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, the test output, and whether the checkout entry existed (`blocked: checkout not wired` otherwise).

Standard: **WCAG 2.2 SC 2.5.8** — the change-plan action and confirm button meet a target size of at least **24 × 24 CSS px**. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `set.billing.change` EN "Change plan" / HE "החלפת תוכנית"
- `set.billing.changeConfirm` EN "Switch to {tier}? You'll be charged at the end of this billing period." / HE "לעבור ל-{tier}? החיוב יתבצע בתום תקופת החיוב הנוכחית."
- `set.billing.downgrade` EN "You'll keep {tier} until the end of this period." / HE "תשמרו על {tier} עד תום התקופה הנוכחית."

---

## TEMPO-BL-0025 — Trial countdown + conversion notices + trial-end action

```yaml
---
ticket: TEMPO-BL-0025
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/billing-plan/
depends_on: [TEMPO-BL-0022]
contract:
  - "No new backend functions. Reads api.users.getMyPlan; the trial end time field is UNKNOWN (see STEPS) and reported if absent."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0022, #1335 (Paddle/Whop switch); rewrite after it lands.

FOR: a person on the $1/3-week trial, so they see how much trial time is left, get the pre-conversion notices (3 days, 1 day, 1 hour), and can pick a plan from the trial-end screen.

WHEN: after TEMPO-BL-0022 (the $20/$50 tiers exist to point at).

WHY: PRD §4.11 "notices at 3 days, 1 day and 1 hour before conversion"; docs/APP-FLOW.md §1 lists `/billing/trial-end` as a placeholder. `apps/web/components/billing-plan/TrialEnd.tsx` and the `BillingPlan` "Before any charge" section exist, but the countdown is static copy, and the trial-end screen has no working plan selection.

GOAL: the billing screen shows a live "trial ends in N days/hours" line, and the trial-end screen offers a working "choose a plan" action that reuses TEMPO-BL-0024's change-plan confirm.

SCOPE: `apps/web/components/billing-plan/BillingPlan.tsx`, `apps/web/components/billing-plan/TrialEnd.tsx`, `apps/web/components/billing-plan/TrialEnd.test.tsx` (new). Size: 2 files plus 1 test.

MUTATES: `BillingPlan.tsx` (live countdown from the trial end time), `TrialEnd.tsx` (wire "choose a plan" to the change-plan confirm), `TrialEnd.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `BillingPlan.tsx`, `TrialEnd.tsx` and their dependents; adjust the plan to the current code.
2. Read whether `api.users.getMyPlan` (or the subscription row) exposes a trial start/end time. If none exists, render the countdown from the static "3 / 1 / 1" notice copy and report `blocked: missing backend <trialEndsAtMs>` — do not invent a time.
3. In `BillingPlan`, when `isOnTrial(plan)` is true, show "Trial ends in {n} days" (or "{n} hours" under 24 h) computed from the end time, or the static notice when the field is absent.
4. In `TrialEnd`, replace the dead CTA with a "Choose a plan" action that opens TEMPO-BL-0024's confirm for the selected tier.
5. Add `TrialEnd.test.tsx` (Vitest + Testing Library, mock `convex/react`): the countdown renders for a trial plan; the "Choose a plan" action opens the confirm; the screen never shows a hard-coded price.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `TrialEnd.test.tsx`; a signed-in Playwright run on the cloud computer shows the countdown and the working plan-selection on `/billing/trial-end`.

EVIDENCE: test output; screenshot of the trial-end screen.

DO NOT:
- don't add a trial-end cron or email (the 3/1/1 notices are in-app here; a scheduled email notice is a separate ticket)
- don't change plan prices (TEMPO-BL-0022) or the change-plan confirm internals (TEMPO-BL-0024)
- don't change `convex/` (report `blocked: missing backend <trialEndsAtMs>` instead)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, whether the trial end time field existed, and the test output.

Standard: **WCAG 2.2 SC 1.4.3** — the countdown and notice text meet a contrast ratio of at least **4.5:1**. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (the 3-day/1-day/1-hour cadence itself is PRD §4.11 product policy, not an industry number).

Visible strings (keys):
- `set.trial.daysLeft` EN "Trial ends in {n} days" / HE "הניסיון מסתיים בעוד {n} ימים"
- `set.trial.hoursLeft` EN "Trial ends in {n} hours" / HE "הניסיון מסתיים בעוד {n} שעות"
- `set.trial.choose` EN "Choose a plan to keep using Tempo" / HE "בחרו תוכנית כדי להמשיך להשתמש ב-Tempo"

---

## TEMPO-BL-0026 — Premium feature gate (auth → entitlement → quota)

```yaml
---
ticket: TEMPO-BL-0026
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/premiumGate.ts
  - convex/voice.ts
  - convex/lib/premiumGate.test.ts
depends_on: [TEMPO-BL-0001, TEMPO-BL-0023]
contract:
  - "convex/lib/premiumGate.ts exports requirePaidTier(user: Doc<'users'>, tier: 'pro'|'max') -> void (throws ConvexError) and hasPaidTier(user, tier) -> boolean (internal helper, no api.* function)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0001, TEMPO-BL-0023

FOR: every premium feature (live voice today), so the server enforces the entitlement before any model or provider call, in the fixed order auth → entitlement → quota.

WHEN: after TEMPO-BL-0001 (the entitlements table exists) and TEMPO-BL-0023 (the tier limits are a single source).

WHY: TRD §7 rule 3 "Server-side order before any model call: auth → entitlement → quota"; HARD_RULES §9 (live voice is minute-capped per tier). Today the live-voice gate is spread across `convex/lib/aiGate.ts` (`requireApprovedForAi`), `convex/voice.ts` (`dailyCapMs` reading `userType`/`entitlementTier`), and `convex/lib/subscriptionGuards.ts`; there is no one function a feature calls to say "this tier unlocks this feature".

GOAL: a single `requirePaidTier(user, tier)` helper resolves the effective tier from the entitlements table (TEMPO-BL-0001) and throws a calm `ConvexError` when the account is below the required tier; `convex/voice.ts` calls it before minting a grant or a TTS sentence.

SCOPE: `convex/lib/premiumGate.ts` (new), `convex/voice.ts` (wire the gate), `convex/lib/premiumGate.test.ts` (new). Size: 2 files plus 1 test.

MUTATES: `convex/lib/premiumGate.ts` (new: `hasPaidTier` / `requirePaidTier` reading the entitlements table), `convex/voice.ts` (call `requirePaidTier(user, "pro")` in `grant` and `speak` before the provider call, after `requireApprovedForAi`), `convex/lib/premiumGate.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/lib/entitlements.ts`, `convex/voice.ts`, `convex/lib/aiGate.ts` and their dependents; adjust the plan to the current code.
2. Add `convex/lib/premiumGate.ts`: `hasPaidTier(user, tier)` resolves the effective tier via the TEMPO-BL-0001 resolver (highest active grant; expired counts as none) and returns true only when the resolved tier is ≥ the required tier (`pro` < `max`); `requirePaidTier(user, tier)` throws a `ConvexError` with the existing `voice_daily_limit` code otherwise. Do not read `userType` directly (the entitlements table is the source).
3. In `convex/voice.ts`, call `requirePaidTier(user, "pro")` at the top of `grant` and `speak` (after `requireApprovedForAi`, before `mintDeepgramToken`/`synthesize`); keep `dailyCapMs`'s minute counting unchanged.
4. Add `convex/lib/premiumGate.test.ts`: `max` passes for `pro`; `pro` passes for `pro`; `none`/expired fails; `basic` (retired) fails closed; the thrown error carries the calm code.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/premiumGate.test.ts` and `convex/voice.test.ts`; `requirePaidTier` is called in `convex/voice.ts` before both provider calls.

EVIDENCE: test output; the two call sites in `convex/voice.ts`.

DO NOT:
- don't re-implement the entitlements table or the resolver (TEMPO-BL-0001 owns them; call its API)
- don't change `convex/lib/entitlements.ts`, `convex/auth.ts`, or `convex/users.ts` (issue #1263 owns the grant defaults)
- don't change the tier-minute numbers (TEMPO-BL-0023/0030)
- don't deploy; never touch the live Convex deployment

REPORT: the helper created, the two call sites wired, and any feature that should gate but couldn't be wired in scope.

Standard: **OWASP ASVS 4.0 V4.1** — access-control checks must run on a trusted service layer and be enforced server-side, not on the client. https://owasp.org/www-project-application-security-verification-standard/

No new visible strings (the calm `voice_daily_limit` copy already exists).

---

## TEMPO-BL-0027 — Magic-link send rate limit and cooldown

```yaml
---
ticket: TEMPO-BL-0027
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/signInRateLimit.ts
  - convex/auth.ts
  - convex/lib/signInEmail.test.ts
depends_on: []
contract:
  - "convex/lib/signInRateLimit.ts exports checkSendAllowed(lastSentAtMs: number|undefined, now: number) -> { allowed: boolean, retryAfterMs: number } (pure, no api.* function)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the magic-link sign-in, so a person (or a bot) cannot flood the email address by requesting a link repeatedly, and a real person gets a clear wait time instead of a bare provider error.

WHEN: first in the sign-in lane; independent. TEMPO-BL-0028 (the client states) depends on it.

WHY: the magic-link email is the only sign-in (PRD §4.1 F-01), so its send path is the authentication entry point and must be throttled (OWASP ASVS V2.2.1). Today `convex/lib/signInEmail.ts` sends on every request, and the client only guesses at rate limiting by matching the string "TooManyRequests" in `apps/web/components/auth/SignInForm.tsx`.

GOAL: a pure `checkSendAllowed` helper enforces a per-email cooldown (≥ 60 s between sends, at most 5 per hour), `convex/auth.ts` refuses a second send inside the window with a typed error, and the window never blocks the first send.

SCOPE: `convex/lib/signInRateLimit.ts` (new), `convex/auth.ts`, `convex/lib/signInEmail.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/lib/signInRateLimit.ts` (new: `checkSendAllowed`), `convex/auth.ts` (in `sendVerificationRequest`, track `lastSentAtMs`/`sendCount` per email — a bounded in-memory or table-backed window is acceptable; refuse with a typed error inside the window), `convex/lib/signInEmail.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/auth.ts`, `convex/lib/signInEmail.ts` and their dependents; adjust the plan to the current code.
2. Add `convex/lib/signInRateLimit.ts`: `checkSendAllowed(lastSentAtMs, now)` returns `{ allowed: false, retryAfterMs }` when `now - lastSentAtMs < 60_000`, else `{ allowed: true, retryAfterMs: 0 }`; a second pure `hourlyCount`-based limit (5 per rolling hour) returns `retryAfterMs` to the next slot.
3. In `convex/auth.ts`'s `sendVerificationRequest` (or the Resend `sendVerificationRequest` wrapper), record the send and call `checkSendAllowed` before `sendSignInEmail`; when not allowed, throw an `Error` whose `name` or message carries a stable `SIGN_IN_COOLDOWN` marker the client can branch on (do not echo the address or the window internals to the client).
4. Extend `convex/lib/signInEmail.test.ts`: first send allowed; a send 30 s later is refused with `retryAfterMs ≥ 30_000`; a send after 61 s is allowed; the 5-per-hour ceiling refuses the 6th.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/signInEmail.test.ts`; `convex/auth.ts` refuses a second magic-link send inside 60 s.

EVIDENCE: test output; the `checkSendAllowed` call site in `convex/auth.ts`.

DO NOT:
- don't rate-limit by IP alone (per-email is the requirement; IP is not the identity)
- don't store the email address or link in a log or error message (errors name the status only)
- don't change the Resend provider, `maxAge` (30 min), or the 30-day session (out of scope)
- don't deploy; never touch the live Convex deployment

REPORT: the cooldown numbers chosen (60 s, 5/hour), where the send is recorded, and any `UNKNOWN` (whether Convex Auth's `sendVerificationRequest` can carry the typed error cleanly to the client).

Standard: **OWASP ASVS 4.0 V2.2.1** — "Verify that anti-automation controls are effective at mitigating … credential testing, brute force, and account lockout attacks"; a **60-second** cooldown and a **5-per-hour** ceiling are the concrete thresholds this ticket enforces. https://owasp.org/www-project-application-security-verification-standard/

No new visible strings (the client copy for the cooldown is TEMPO-BL-0028).

---

## TEMPO-BL-0028 — Sign-in reliability states (cooldown, expired, used, resend)

```yaml
---
ticket: TEMPO-BL-0028
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/auth/
depends_on: [TEMPO-BL-0027]
contract:
  - "No new backend functions. The client branches on the typed SIGN_IN_COOLDOWN marker from TEMPO-BL-0027 and on Convex Auth's signIn('resend', { email, redirectTo }) rejection."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0027

FOR: a person signing in with a magic link, so every failure state (a second link too soon, an expired link, an already-used link, a send that failed) shows a specific, calm message with a resend path instead of a generic error or a string match.

WHEN: after TEMPO-BL-0027 (the server emits a typed cooldown marker).

WHY: the sign-in is magic-link only (PRD §4.1 F-01); reliability means a person always knows what to do next. `apps/web/components/auth/SignInForm.tsx` today hard-codes English strings and matches the literal `"TooManyRequests"` to guess a rate limit.

GOAL: the sign-in form shows a live cooldown countdown, distinct copy for an expired or used link, and a "resend" path, with every visible string in `en` + `he`.

SCOPE: `apps/web/components/auth/SignInForm.tsx`, `apps/web/lib/i18n.ts` (or a new `apps/web/lib/i18n-groups/auth.ts`), `apps/web/components/auth/SignInForm.test.tsx` (new). Size: 2 files plus 1 test.

MUTATES: `SignInForm.tsx` (branch on the typed cooldown marker and on expired/used link rejections; render a countdown; move the hard-coded strings to keys), `apps/web/lib/i18n-groups/auth.ts` (new group) or `apps/web/lib/i18n.ts`, `SignInForm.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/auth/SignInForm.tsx`, `apps/web/lib/i18n.ts` and their dependents; adjust the plan to the current code.
2. In `SignInForm`, replace the `message.includes("TooManyRequests")` match with a branch on the typed `SIGN_IN_COOLDOWN` marker; show "Link sent. Wait {n}s before asking again." with a live countdown computed from `retryAfterMs`.
3. Add distinct states for an expired link and an already-used link (from the Convex Auth rejection shape), each with a "Send a new link" resend that reuses the submit handler; keep `nextPath` (`redirectTo`) preserved across the resend.
4. Move every new visible string into `en`/`he` keys (a new `apps/web/lib/i18n-groups/auth.ts`); reuse `t()` for the new copy.
5. Add `SignInForm.test.tsx` (Vitest + Testing Library): a cooldown rejection renders the countdown and disables resend until it ends; an expired-link rejection renders the expired copy; a used-link rejection renders the used copy; `nextPath` is still passed on resend.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `SignInForm.test.tsx`; a signed-in Playwright run on the cloud computer shows the cooldown countdown after a second magic-link request.

EVIDENCE: test output; screenshot of the cooldown state.

DO NOT:
- don't change `convex/` (the typed marker and rate limit are TEMPO-BL-0027)
- don't change the sign-up approval flow or `WaitingForApproval` (issue #1272 owns the beta-request UI)
- don't change the auth provider, `redirectTo` mechanics, or `apps/web/proxy.ts`
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: the states added, the typed marker consumed, and any `UNKNOWN` (the exact Convex Auth rejection shape for an expired vs used link — read the provider's error at implementation).

Standard: **WCAG 2.2 SC 3.3.1** — error text is programmatically associated with its field (`role="alert"`, `aria-describedby`), so a screen reader announces each state. https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html

Visible strings (keys):
- `auth.cooldown` EN "Link sent. Wait {n}s before asking again." / HE "הקישור נשלח. המתינו {n} שניות לפני בקשה נוספת."
- `auth.linkExpired` EN "That link expired. Send a new one." / HE "הקישור פג. שלחו קישור חדש."
- `auth.linkUsed` EN "That link was already used. Send a new one." / HE "הקישור כבר שימש. שלחו קישור חדש."
- `auth.sendFailed` EN "We couldn't send the link. Try again." / HE "לא הצלחנו לשלוח את הקישור. נסו שוב."

---

## TEMPO-BL-0029 — Session expiry re-auth (friendly redirect, `next` preserved)

```yaml
---
ticket: TEMPO-BL-0029
batch: BL
type: component
lane: claude
browser_test: false
scope:
  - apps/web/components/providers/providers.tsx
  - apps/web/lib/session-expiry.ts
  - apps/web/lib/session-expiry.test.ts
depends_on: []
contract:
  - "No backend functions. Reads the Convex Auth session expiry and the current route; no api.* function."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: a signed-in person whose 30-day session lapses mid-use, so they get a clear "your session ended" and land back at `/sign-in` with the route they were on preserved, instead of a stuck loading state or a raw auth error.

WHEN: first in the sign-in lane; independent of TEMPO-BL-0027/0028.

WHY: APP-FLOW.md §2 "…30-day session"; the 30-day session (`convex/auth.ts` `totalDurationMs`) lapses while a page is open, and the middleware redirect only covers navigation, not a lapse mid-page. The person should never see an unhandled Convex auth error.

GOAL: when a Convex query returns an auth-expiry/unauthorized error mid-session, the client provider redirects to `/sign-in?next=<current route>` with a friendly notice; the same helper also clears in-memory voice/session state on sign-out.

SCOPE: `apps/web/components/providers/providers.tsx`, `apps/web/lib/session-expiry.ts` (new), `apps/web/lib/session-expiry.test.ts` (new). Size: 2 files plus 1 test.

MUTATES: `providers.tsx` (subscribe to the auth expiry and route the redirect), `session-expiry.ts` (new pure helper: `sessionEndedTarget(pathname: string) -> string` returning `/sign-in?next=…`), `session-expiry.test.ts` (new).

STEPS:
1. Query the Graphify graph for `apps/web/components/providers/providers.tsx`, `apps/web/proxy.ts` and their dependents; adjust the plan to the current code.
2. Add `apps/web/lib/session-expiry.ts`: `sessionEndedTarget(pathname)` returns `/sign-in?next=` + the encoded pathname (empty `next` for `/`), and never redirects a public route.
3. In `providers.tsx`, detect the Convex Auth session-expiry/unauthorized signal and route to `sessionEndedTarget(currentPathname)`; show the `auth.sessionEnded` notice on the sign-in screen (via `next` handling) without a hard reload loop.
4. Add `session-expiry.test.ts`: `/today` → `/sign-in?next=%2Ftoday`; `/` → `/sign-in`; a public route is left alone; the redirect target encodes the path exactly once.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `session-expiry.test.ts`; a signed-in Playwright run that drops the session lands on `/sign-in` with the `next` query intact.

EVIDENCE: test output; the redirect handler in `providers.tsx`.

DO NOT:
- don't shorten or extend the 30-day session (it is `convex/auth.ts` `totalDurationMs`, out of scope)
- don't touch `apps/web/proxy.ts` route protection (the middleware stays as-is)
- don't sign anyone out of other devices (a global sign-out is a separate, higher-risk ticket)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: the expiry signal consumed, the redirect helper, and any `UNKNOWN` (the exact Convex Auth expiry signal exposed to the client).

Standard: **OWASP ASVS 4.0 V3.3** — session termination must invalidate the client-side session and the server must not leave a stale authenticated state; the redirect preserves the intended route so the person resumes where they were. https://owasp.org/www-project-application-security-verification-standard/

Visible strings (keys):
- `auth.sessionEnded` EN "Your session ended. Sign in again." / HE "ההתחברות הסתיימה. היכנסו שוב."

---

## TEMPO-BL-0030 — Voice minute caps for $20/$50 + lift the preview cap

```yaml
---
ticket: TEMPO-BL-0030
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/lib/voicePolicy.ts
  - convex/lib/voicePolicy.test.ts
depends_on: [TEMPO-BL-0023]
contract:
  - "convex/lib/voicePolicy.ts dailyMinutesFor(tier: string|undefined) -> number (signature unchanged)"
  - "convex/lib/voicePolicy.ts VOICE_LIMITS.dailyMinutesPerUser -> number (value changed)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0023

FOR: a paid user on the $20 Pro or $50 Max plan, so they get their tier's full live-voice minutes (90 / 180) instead of a flat 15-minute preview cap that applies to everyone.

WHEN: after TEMPO-BL-0023 (the tier limits are one source, `tierLimits.ts`).

WHY: HARD_RULES §9 "Live (streaming) voice is minute-capped per tier … Pro 90, Max 180"; the voice policy comment itself says the 15-minute `dailyMinutesPerUser` "only ever lowers the tier's HARD_RULES §9 number" and is a preview decision (Amit) to lift before paid launch. Today `dailyMinutesFor` caps every tier at `min(byTier, 15)`.

GOAL: `dailyMinutesFor` returns the tier's real minutes for paid tiers (`pro` 90, `max` 180) and 0 for none, so the $20/$50 voice-minute entitlements match HARD_RULES §9.

SCOPE: `convex/lib/voicePolicy.ts`, `convex/lib/voicePolicy.test.ts` (extend). Size: 1 file plus 1 test.

MUTATES: `convex/lib/voicePolicy.ts` (raise/remove `VOICE_LIMITS.dailyMinutesPerUser` so paid tiers are no longer capped at 15; keep the `min(byTier, …)` guard pattern or delete it and keep the unknown-tier → 0 rule), `convex/lib/voicePolicy.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/lib/voicePolicy.ts`, `convex/voice.ts` and their dependents; adjust the plan to the current code.
2. In `voicePolicy.ts`, change `dailyMinutesFor` so `pro` returns 90 and `max` returns 180 (delete the `dailyMinutesPerUser: 15` clamp or set it high enough to be inert for paid tiers); keep `none`/unknown/`basic` returning 0.
3. Extend `convex/lib/voicePolicy.test.ts`: `dailyMinutesFor("pro") === 90`, `dailyMinutesFor("max") === 180`, `dailyMinutesFor("none") === 0`, `dailyMinutesFor("basic") === 0`, `dailyMinutesFor(undefined) === 0`, and confirm the 1-minute `minStartMs` floor and the global `dailyMinutesGlobal` ceiling are unchanged.
4. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/voicePolicy.test.ts` and `convex/voice.test.ts`; `dailyMinutesFor("pro")` returns 90 and `dailyMinutesFor("max")` returns 180.

EVIDENCE: test output; the `dailyMinutesFor` return values.

DO NOT:
- don't change the 90/180 minute numbers (Amit's call; they come from HARD_RULES §9 via TEMPO-BL-0023)
- don't change the lease/`renew`/`start` accounting in `convex/voice.ts` (only the cap value moves)
- don't change the per-user session cap (`sessionsPerUserPerDay: 40`) or the global ceiling
- don't deploy; never touch the live Convex deployment

REPORT: the cap values before/after, and any `UNKNOWN` (whether the 15-minute preview cap should stay for non-paid/`basic` accounts — Amit confirms).

Standard: **UNKNOWN** — no industry standard sets per-tier voice-minute caps; 90/180 are HARD_RULES §9 owner decisions. The 1-minute floor (`minStartMs: 60_000`) is HARD_RULES §9 product policy, not a measured standard.

No new visible strings (server-side only; the surface is TEMPO-BL-0006).

---

## TEMPO-BL-0031 — Live English voice: first-audio ≤ 300 ms latency budget

```yaml
---
ticket: TEMPO-BL-0031
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/voice.ts
  - convex/lib/voiceLatency.ts
  - convex/lib/voiceLatency.test.ts
depends_on: []
contract:
  - "convex/lib/voiceLatency.ts exports firstAudioMs(startedAtMs: number, audioReadyAtMs: number) -> number and a FIRST_AUDIO_BUDGET_MS constant (no api.* function)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the English live-voice call, so the pipeline measures and enforces the 29 Oct target of **voice-to-voice first audio ≤ 300 ms**, and a regression is visible instead of silently slow.

WHEN: first in the voice lane; independent. TEMPO-BL-0032 (streaming the first sentence) builds on this measurement.

WHY: the 29 Oct decision "live English voice Deepgram Flux (target: voice-to-voice first audio ≤ 300 ms)"; TRD §5a says "first-audio latency is UNKNOWN until measured" because the reply is read aloud one sentence at a time. Today `convex/voice.ts` mints the Deepgram token (`grant`) and synthesizes a sentence (`speak`) with no latency measurement, so the target cannot be checked.

GOAL: a pure `firstAudioMs` helper and a `FIRST_AUDIO_BUDGET_MS = 300` constant exist, and `convex/voice.ts` records (in a bounded, content-free way) the time from the end of the user's turn to the first TTS audio byte, failing a test when it exceeds the budget.

SCOPE: `convex/voice.ts`, `convex/lib/voiceLatency.ts` (new), `convex/lib/voiceLatency.test.ts` (new). Size: 2 files plus 1 test.

MUTATES: `convex/voice.ts` (measure and store the first-audio delta on the `voiceSessions` row — a content-free `firstAudioMs` number field — without logging audio or text), `convex/lib/voiceLatency.ts` (new: `firstAudioMs` + `FIRST_AUDIO_BUDGET_MS = 300`), `convex/lib/voiceLatency.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/voice.ts`, `convex/lib/voicePolicy.ts` and their dependents; adjust the plan to the current code.
2. Add `convex/lib/voiceLatency.ts`: `firstAudioMs(startedAtMs, audioReadyAtMs)` returns `Math.max(0, audioReadyAtMs - startedAtMs)`; export `FIRST_AUDIO_BUDGET_MS = 300`.
3. In `convex/voice.ts`, record the turn-end time at the last accepted transcript and the audio-ready time when `speak` returns the first sentence's audio for that turn; patch the `voiceSessions` row with a `firstAudioMs` number (additive, optional field). Never store the audio or the transcript.
4. Add `convex/lib/voiceLatency.test.ts`: `firstAudioMs` returns the positive delta; a zero/negative delta clamps to 0; `FIRST_AUDIO_BUDGET_MS === 300`.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/lib/voiceLatency.test.ts` and `convex/voice.test.ts`; `convex/voice.ts` records `firstAudioMs` on the session row.

EVIDENCE: test output; the `firstAudioMs` patch site in `convex/voice.ts`.

DO NOT:
- don't assert the 300 ms budget in CI on live audio (only the helper and the constant are unit-tested; a live latency run needs the provider and is reported, not gated)
- don't store or log audio, transcripts, or the provider body (content-free measurement only)
- don't change the sentence-at-a-time pipeline itself (TEMPO-BL-0032 streams the first sentence)
- don't deploy; never touch the live Convex deployment

REPORT: the field added, the measurement points, and the `UNKNOWN` live first-audio value measured on the first provider run.

Standard: **ITU-T G.114** — one-way mouth-to-ear delay should stay at or below **150 ms** and below **400 ms** to be acceptable for interactive voice; the product's **300 ms** first-audio target sits inside that window. https://www.itu.int/rec/T-REC-G.114

No new visible strings (server-side only).

---

## TEMPO-BL-0032 — Live English voice: stream the first sentence's TTS

```yaml
---
ticket: TEMPO-BL-0032
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/voice.ts
  - convex/coach.ts
  - convex/voice.test.ts
depends_on: [TEMPO-BL-0030, TEMPO-BL-0031]
contract:
  - "convex/voice.ts speak(args: { sessionId, messageId, index }) -> { status: 'audio', audio, mime, count } | { status: 'done' } | { status: 'exhausted' } (signature unchanged)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0030, TEMPO-BL-0031

FOR: the English live-voice call, so the coach's first spoken sentence is synthesized as soon as that sentence finishes streaming, rather than after the whole reply completes — cutting the time to first audio toward the 300 ms target.

WHEN: after TEMPO-BL-0031 (the first-audio budget is measurable) and TEMPO-BL-0030 (the caps are per-tier).

WHY: the 29 Oct target "voice-to-voice first audio ≤ 300 ms"; TRD §5a step 4 says "As each sentence of the reply completes, a Convex action sends it to Chatterbox … so speech starts before the whole reply is written". Today the client calls `speak` on the newest complete reply (`useVoiceCall` reads `latestReply`), so the first sentence is not synthesized until the whole reply exists.

GOAL: the reply is split into sentences as the model streams, and the first sentence is admitted to TTS (via the existing `admitSentence`/`speak` path) before the full reply is committed, without changing the `speak` contract.

SCOPE: `convex/voice.ts`, `convex/coach.ts`, `convex/voice.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/voice.ts` (admit the first streamed sentence early, reusing `speechSentences` on the streaming partial), `convex/coach.ts` (on the first streamed sentence boundary, admit it to TTS via the existing internal mutation), `convex/voice.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/voice.ts`, `convex/coach.ts`, `convex/lib/voicePolicy.ts` and their dependents; adjust the plan to the current code.
2. Reuse `speechSentences` (convex/lib/voicePolicy.ts) to split the streaming reply; when the first sentence boundary is reached while the coach streams, admit that sentence through the existing `admitSentence`/`speak` path, so its audio starts before the full reply is committed.
3. Keep the `speak(args)` contract unchanged (the client still resolves a reply by `messageId` + `index`); the early admission only changes when the first sentence becomes available.
4. Extend `convex/voice.test.ts`: a streamed reply's first sentence is admitted before the full reply; a crisis card is still never read aloud; the sentence is counted once (no double-count when the client later re-reads the same `index`).
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/voice.test.ts`; the first sentence is admitted to TTS before the full reply commits, with the `speak` contract unchanged.

EVIDENCE: test output; the early-admission call site in `convex/coach.ts` or `convex/voice.ts`.

DO NOT:
- don't change the `speak`/`admitSentence`/`grant` signatures (the client depends on them)
- don't stream or store audio/transcripts (content-free, same as today)
- don't change the model or the Deepgram lane (the GLM router is issue #1255; the Voice Agent transport is issue #1253)
- don't change the crisis guard (the crisis card is never read aloud)
- don't deploy; never touch the live Convex deployment

REPORT: the early-admission path, the contract names preserved, and any `UNKNOWN` (whether the coach's streaming deltas expose a reliable sentence boundary — read `@convex-dev/agent` streaming deltas at implementation).

Standard: **Deepgram** streaming latency — first-token/first-audio latency is the time from end-of-speech to the first returned audio; the product target is **≤ 300 ms** (TEMPO-BL-0031's budget). https://developers.deepgram.com/docs/measuring-streaming-latency

No new visible strings (server-side only).

---

## Self-check (detailed-enough) log

For each ticket, the questions a builder would ask, and where each is answered (fixed in the ticket) or left `UNKNOWN` (with who answers).

**TEMPO-BL-0022 (pricing $20/$50)**
- Which tiers remain? → fixed (trial $1, Pro $20, Max $50; Basic retired from the display).
- Does retiring Basic touch the schema unions? → fixed (no — schema is out of scope; reported as a follow-up).
- What is the Hebrew (ILS) price? → UNKNOWN — Amit (ILS conversion rate); never invent it.
- Are the exact $20/$50 numbers a standard? → fixed (no — they are the 29 Oct decision; Baymard 70.19% is the cited checkout-clarity number).

**TEMPO-BL-0023 (limits source)**
- Where do the 90/180 minute numbers live now? → fixed (one place: `convex/lib/tierLimits.ts`).
- What happens to a retired `basic` tier? → fixed (fails closed to 0).
- Does `dailyMinutesFor`'s preview-clamp behaviour change? → fixed (unchanged in this ticket; TEMPO-BL-0030 lifts it).

**TEMPO-BL-0024 (upgrade/downgrade)**
- Does a confirm fire a charge? → fixed (no — it calls the checkout entry; `blocked` when absent).
- What does a downgrade tell the person? → fixed ("keep {tier} until end of period").
- Where does the actual purchase happen? → fixed (out of scope — #1336).

**TEMPO-BL-0025 (trial)**
- Does the trial end time exist in the backend? → UNKNOWN — reported `blocked: missing backend <trialEndsAtMs>` if absent.
- Are the 3/1/1 notices in-app or email? → fixed (in-app here; email notice is a separate ticket).
- What is the trial price? → fixed (unchanged, TEMPO-BL-0022).

**TEMPO-BL-0026 (premium gate)**
- Which feature gates first? → fixed (live voice: `grant` and `speak`).
- Where does the tier come from? → fixed (the entitlements table via TEMPO-BL-0001, not `userType`).
- Does this change grant defaults? → fixed (no — #1263 owns grants; out of scope).

**TEMPO-BL-0027 (rate limit)**
- What are the exact thresholds? → fixed (60 s cooldown, 5 per rolling hour).
- Is it per-email or per-IP? → fixed (per-email; IP is not the identity).
- Does the typed marker reach the client cleanly? → UNKNOWN — read Convex Auth's `sendVerificationRequest` error path at implementation.

**TEMPO-BL-0028 (sign-in states)**
- What is the exact rejection shape for expired vs used links? → UNKNOWN — read the Convex Auth provider error at implementation.
- Is `next` preserved on resend? → fixed (yes, `redirectTo`).
- Does this touch the beta-request flow? → fixed (no — #1272 owns it).

**TEMPO-BL-0029 (session expiry)**
- Which expiry signal does the client consume? → UNKNOWN — read Convex Auth's client auth-error surface at implementation.
- Does it sign out other devices? → fixed (no — out of scope).

**TEMPO-BL-0030 (voice caps)**
- What do `pro`/`max` return after the change? → fixed (90 / 180).
- Does the 15-minute preview cap stay for non-paid? → UNKNOWN — Amit (whether `basic`/non-paid keeps a preview cap).

**TEMPO-BL-0031 (latency budget)**
- Is the 300 ms budget gated in CI on live audio? → fixed (no — helper and constant only; live value reported).
- Is the measurement content-free? → fixed (a single `firstAudioMs` number, no audio/text).

**TEMPO-BL-0032 (streaming TTS)**
- Is there a reliable sentence boundary in the streaming deltas? → UNKNOWN — read `@convex-dev/agent` streaming deltas at implementation.
- Is the `speak` contract changed? → fixed (no).
- Is the crisis guard preserved? → fixed (crisis card never read aloud).

---

## Inputs I could not find / reconcile

1. **`include.md`** (the "detailed enough" self-check source) is not at the repo root in this checkout; I applied the described method directly (list builder questions → fix or mark UNKNOWN with who answers), as the pilot did.
2. **`AGENTS.md` §8.1 front matter** is not a literal section (AGENTS.md is 133 lines). The front-matter fields here come from `docs/tickets/_templates/*.md` and the B05 examples.
3. **Billing provider wording.** The repo PRD §4.11 still says "Polar on web, RevenueCat on mobile", while issue #1335 switches to "Paddle (main) / Whop (alt) (+crypto)" and the pilot's billing tickets use "Whop first, PayPal fallback". Per the 29 Oct instruction I kept the pilot's "Whop first, PayPal fallback" wording and marked every billing ticket `Depends: #1335 (Paddle/Whop switch); rewrite after it lands.` The three-way provider question (Paddle vs Whop vs PayPal fallback) resolves when #1335 lands — Amit.
4. **`gh issue list` could not run** — `gh` has no auth on this machine and `GH_TOKEN`/`GITHUB_TOKEN` are unset. I read open issues with the Reason issues tool: ~30 open issues (#1252–#1336) including the TEMPO-KB billing/sign-in/voice batch and #1335/#1336, none of which these 11 tickets duplicate by title or scope.
5. **$20/$50 exact tier set.** Whether Basic $10 is retired outright (vs kept for the schema union) is UNKNOWN beyond the 29 Oct "two tiers" wording; TEMPO-BL-0022 retires Basic from the display only and reports the schema-union retirement as a follow-up for Amit.
6. **Hebrew copy** is machine-drafted in the repo (the repo itself flags this) and needs native review by Amit or a Hebrew speaker.

<!-- lane 0033-0043 -->
## TEMPO-BL-0033 — Search matches task descriptions, checklists, and project names

```yaml
---
ticket: TEMPO-BL-0033
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/search.ts
depends_on: []
contract:
  - "api.search.all(args: { query: string }) -> { notes, tasks, habits, goals }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people searching the Library, so a task is found by its checklist step, its description, or its project name — not only by its title.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §4.1 F-08 "Project/folder tree, structured tags"; docs/APP-FLOW.md §1 `/search`. The Library search should find what the person actually wrote. Today `convex/search.ts` `all` matches a task only on `row.title` (`includesQuery(row.title, queryText)`); a task whose project name or checklist step holds the word is missed.

GOAL: `api.search.all` matches tasks on title, description, project name, and checklist step text, so a query that matches any of those fields returns the task.

SCOPE: `convex/search.ts`, `convex/search.test.ts` (new). Size: 1 file plus 1 test.

MUTATES: `convex/search.ts` (extend the tasks filter to match `description`, `projectName`, and checklist item text), `convex/search.test.ts` (new).

STEPS:
1. Query the Graphify graph for `convex/search.ts` and its caller `apps/web/components/global-search/SearchScreen.tsx`; adjust the plan to the current code.
2. In the `tasks` branch of `search.all`, replace the title-only predicate with one that matches the query against `title`, `description`, `projectName`, and every checklist item's `text` (case-insensitive, same `includesQuery` helper).
3. Keep the result shape unchanged (`{_id, title, status}` per task) and the `GROUP_LIMIT` of 8 and `SNIPPET_MAX` bounds.
4. Add `convex/search.test.ts`: a task found by a checklist step word; a task found by `description`; a task found by `projectName`; a task whose title is the only match still works; a task with no match is still excluded; deleted tasks are still excluded.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/search.test.ts`; `api.search.all` still returns the existing `{notes, tasks, habits, goals}` shape in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `search.all` tasks-filter diff.

DO NOT:
- don't change the result validator shape (TEMPO-BL-0034 adds the new groups; this ticket only widens the tasks match)
- don't add fuzzy/typo tolerance or a search index (out of scope)
- don't touch `apps/web` (the SearchScreen consumes the unchanged shape)
- don't deploy; never touch the live Convex deployment

REPORT: the fields a task now matches, the new test cases, anything that couldn't match the contract and why.

Standard: **INP ≤ 200 ms** — search recomputes after a 250 ms debounce as the person types, so the widened match must stay inside the interaction latency budget. https://web.dev/articles/inp

No new visible strings (server-side only; the SearchScreen already renders the task title and status).

---

## TEMPO-BL-0034 — Search adds memories and calendar events groups

```yaml
---
ticket: TEMPO-BL-0034
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/search.ts
depends_on: [TEMPO-BL-0033]
contract:
  - "api.search.all(args: { query: string }) -> { notes, tasks, habits, goals, memories, calendarEvents }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0033

FOR: people searching the Library, so one search also finds what Tempo remembers and their calendar events.

WHEN: after TEMPO-BL-0033 (both edit `convex/search.ts`; this one lands second).

WHY: docs/PRD.md §4.5 F-50 "recall searches by meaning and by keyword" and §4.1 F-08 "structured tags"; docs/APP-FLOW.md §1 "Library … search". Today `api.search.all` covers notes, tasks, habits and goals but never the `memories` or `calendarEvents` tables, so those are invisible to the one Library search box.

GOAL: `api.search.all` returns two more groups — `memories` (matched on `content`, with a snippet) and `calendarEvents` (matched on `title`, with its local start date) — with the same 8-item `GROUP_LIMIT` per group.

SCOPE: `convex/search.ts`, `convex/search.test.ts` (extend). Size: 1 file plus 1 test.

MUTATES: `convex/search.ts` (add `memories` and `calendarEvents` to the result validator and the handler), `convex/search.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/search.ts`, the `memories` and `calendarEvents` schemas, and their callers; adjust the plan to the current code.
2. Add `memories` to the result validator: `v.array(v.object({ _id: v.id("memories"), content: v.string(), snippet: v.string() }))`. Match on `content` (case-insensitive `includesQuery`), filter `deletedAt === undefined`, sort by `updatedAt` desc, slice to `GROUP_LIMIT`, and reuse `snippetFromBody` for the snippet.
3. Add `calendarEvents` to the result validator: `v.array(v.object({ _id: v.id("calendarEvents"), title: v.string(), startsAtMs: v.number() }))`. Match on `title`, filter `deletedAt === undefined`, sort by `startsAtMs` asc, slice to `GROUP_LIMIT`.
4. Extend `convex/search.test.ts`: a memory found by a word in its `content`; a calendar event found by its `title`; both groups stay empty when nothing matches; deleted memories/events are excluded; the pre-existing notes/tasks/habits/goals groups still work.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/search.test.ts`; `api.search.all` returns `{notes, tasks, habits, goals, memories, calendarEvents}` in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `search.all` return type in `convex/_generated/api.d.ts`.

DO NOT:
- don't add semantic/vector search for memories (that is the memory port's `recall`, a different ticket)
- don't search calendar events by anything but title (no time-range filter here)
- don't touch `apps/web` (TEMPO-BL-0035 renders these groups)
- don't deploy; never touch the live Convex deployment

REPORT: the two new groups and their sort order, the snippet rule, anything that couldn't match the contract and why.

Standard: **ISO 8601** — the calendar event's `startsAtMs` is an absolute instant the UI renders as a local date. https://www.iso.org/iso-8601-date-and-time-format.html

No new visible strings (server-side only; TEMPO-BL-0035 adds the result labels).

---

## TEMPO-BL-0035 — Search screen renders memories and calendar groups

```yaml
---
ticket: TEMPO-BL-0035
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/global-search/
depends_on: [TEMPO-BL-0034]
contract:
  - "api.search.all(args: { query: string }) -> { notes, tasks, habits, goals, memories, calendarEvents }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0034

FOR: people searching the Library, so the results also show matching memories and calendar events, each with a link.

WHEN: after TEMPO-BL-0034 (the two new groups exist in `api.search.all`).

WHY: docs/PRD.md §4.5 F-50 and §4.1 F-08; docs/APP-FLOW.md §1 `/search`. Today `SearchScreen` renders only `notes`, `tasks`, `habits` and `goals` (KINDS = all/notes/tasks/habits/goals); the new `memories` and `calendarEvents` groups from TEMPO-BL-0034 are ignored.

GOAL: the Search screen shows two more result groups — "Memories" and "Calendar" — with the "Show" filter extended to both, and a click opens the right destination (the memory screen for a memory, `/calendar` for an event).

SCOPE: `apps/web/components/global-search/SearchScreen.tsx`, `apps/web/components/global-search/ResultGroup.tsx`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/global-search/SearchScreen.tsx` (extend KINDS, counts, and the two new ResultGroups), `apps/web/components/global-search/ResultGroup.tsx` (render the event's local date in its `detail` line), `apps/web/components/global-search/SearchScreen.test.tsx` (extend), `apps/web/lib/i18n.ts` (new keys).

STEPS:
1. Query the Graphify graph for `SearchScreen.tsx` and its dependents; adjust the plan to the current code.
2. In `SearchScreen.tsx`, extend `KINDS` to include `"memories"` and `"calendar"`, extend `counts` and `total`, and render a `ResultGroup` for each: memories → the memory screen (verify the real route; likely `/settings/memory`), calendar events → `/calendar`, with the event's `startsAtMs` rendered as a local date in the `detail` line.
3. Add the i18n keys (en + he): `search.memories` "Memories" / "זיכרונות"; `search.calendar` "Calendar" / "לוח שנה". Keep the existing `dir="auto"` and `bdi` behaviour already used for the query.
4. Extend `SearchScreen.test.tsx`: with mocked `convex/react`, results containing a memory and a calendar event render both groups and the "Show" filter lists all six kinds; empty groups still show the existing empty state.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `SearchScreen.test.tsx`; a signed-in Playwright run on the cloud computer searches a word that matches a saved memory and a calendar event and shows both groups.

EVIDENCE: test output; screenshot of the search results showing the two new groups.

DO NOT:
- don't change `convex/` (TEMPO-BL-0034 owns the query; if a group is missing, report `blocked: missing backend <search.memories|search.calendarEvents>`)
- don't render raw JSON anywhere (PRD §6)
- don't change other screens' search (the command palette and the notes filter stay as they are)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified (paste the test + Playwright output), any `UNKNOWN` (the exact memory-screen route — verify it exists and name the real one).

Standard: **WCAG 2.2 target size ≥ 24×24 CSS px** for the two new "Show" filter options. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `search.memories` EN "Memories" / HE "זיכרונות"
- `search.calendar` EN "Calendar" / HE "לוח שנה"

---

## TEMPO-BL-0036 — Calendar day view shows the day's planned time blocks

```yaml
---
ticket: TEMPO-BL-0036
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/calendar/
depends_on: []
contract:
  - "api.timeBlocks.listForDate(args: { localDate: string }) -> TimeBlock[]"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people planning their day, so the calendar's Day view also shows the time blocks they placed on the planner timeline, in one place.

WHEN: first in the backlog; independent (uses the existing `api.timeBlocks.listForDate`).

WHY: docs/PRD.md §4.1 F-07 "Daily, weekly and monthly views from the same markdown; elastic vs inelastic events"; docs/APP-FLOW.md §5 "Time blocks on a timeline for the local day (`/plan` Day view)". Today the planner timeline (`/plan`) and the calendar (`/calendar`) are separate; the calendar Day view lists `calendarEvents` and due tasks but never the day's `timeBlocks`.

GOAL: the calendar Day view shows a "Planned" section listing the day's time blocks (title plus start–end clock time), below the events, with the same signed-out/loading discipline the screen already uses.

SCOPE: `apps/web/components/calendar/CalendarViews.tsx`, `apps/web/components/calendar/CalendarViews.test.ts` (extend). Size: 1 file plus 1 test.

MUTATES: `apps/web/components/calendar/CalendarViews.tsx` (read `api.timeBlocks.listForDate` for the day view and render a planned-blocks list), `apps/web/components/calendar/CalendarViews.test.ts` (extend), `apps/web/lib/i18n.ts` (new keys).

STEPS:
1. Query the Graphify graph for `CalendarViews.tsx`, `apps/web/components/time-block-dialog/TimeBlockDialog.tsx` and their dependents; adjust the plan to the current code.
2. In `CalendarViews.tsx`, subscribe to `api.timeBlocks.listForDate({ localDate: toDateInputValue(selectedDate) })` only when `view === "day"` and `hasConvexUser`; render the blocks (title plus `startMinute`/`durationMinutes` as a clock range) in a new `section` with `data-testid="calendar-time-blocks"`.
3. Show the section only in day view; in week/month view nothing changes. Keep the existing `isLoading` gate and signed-out path unchanged.
4. Add the i18n keys (en + he): `cal.planned` "Planned" / "מתוכנן"; `cal.planned.empty` "No blocks planned yet." / "עוד לא תוכננו בלוקים.".
5. Extend `CalendarViews.test.tsx`: a day with time blocks renders the "Planned" section with the block title; week/month view does not render it; an empty day shows the empty copy; the section is skipped while loading.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `CalendarViews.test.tsx`; a signed-in Playwright run on the cloud computer shows the planned blocks on `/calendar` day view.

EVIDENCE: test output; screenshot of the calendar Day view with the "Planned" section.

DO NOT:
- don't change `convex/` (if `api.timeBlocks.listForDate` is missing or returns the wrong shape, report `blocked: missing backend <timeBlocks.listForDate>`)
- don't make the time blocks editable here (TimeBlockDialog and /plan own edit)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, anything the planned-blocks list could not show.

Standard: **ISO 8601** — `startMinute` is minutes since local midnight (0–1439), rendered as a 24-hour clock time `HH:MM`. https://www.iso.org/iso-8601-date-and-time-format.html

Visible strings (keys):
- `cal.planned` EN "Planned" / HE "מתוכנן"
- `cal.planned.empty` EN "No blocks planned yet." / HE "עוד לא תוכננו בלוקים."

---

## TEMPO-BL-0037 — Calendar event start time (time-of-day input)

```yaml
---
ticket: TEMPO-BL-0037
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/calendar/
  - apps/web/lib/calendar/
depends_on: []
contract:
  - "api.calendar_events.create(args: { title: string, startsAtMs: number }) -> Id<'calendarEvents'>"
  - "api.calendar_events.update(args: { eventId: Id<'calendarEvents'>, title?, startsAtMs? }) -> Id<'calendarEvents'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people with timed events, so a calendar event can be at 2pm, not only on a whole day.

WHEN: first in the backlog; independent (the backend already stores `startsAtMs`; this only lets the UI set a time component).

WHY: docs/APP-FLOW.md §5 item 7 "/calendar: events get a start and end time"; docs/ROADMAP.md §3 step 8 (#533). Today `CalendarViews.tsx` reads a `<input type="date">` and calls `selectedDate.getTime()` (local midnight), and `EventRow.tsx` edits the date only — an event can never have a time of day. (`endsAtMs` duration is TEMPO-BL-0003; this ticket adds the start time only.)

GOAL: the calendar's add and edit forms take an optional time of day, stored in `startsAtMs` at that clock time, and the row shows the time when it is set.

SCOPE: `apps/web/components/calendar/CalendarViews.tsx`, `apps/web/components/calendar/EventRow.tsx`, `apps/web/lib/calendar/date-math.ts`. Size: 3 files plus 1 test.

MUTATES: `apps/web/lib/calendar/date-math.ts` (new `dateAndTimeToMs(dateValue, timeValue)` helper and a `timeValueFromMs(ms)` inverse), `apps/web/components/calendar/CalendarViews.tsx` (add a `time` input to the add form), `apps/web/components/calendar/EventRow.tsx` (edit the start time), `apps/web/components/calendar/EventRow.test.tsx` (extend), `apps/web/lib/i18n.ts` (new keys).

STEPS:
1. Query the Graphify graph for the three MUTATES files and their dependents; adjust the plan to the current code.
2. In `date-math.ts`, add `dateAndTimeToMs(dateValue: string, timeValue: string): number` that parses the date and the `HH:MM` time in the browser's local zone and returns an instant; add `timeValueFromMs(ms): string` for the edit form's initial value. An empty time means midnight (the current behaviour).
3. In `CalendarViews.tsx`, add an optional `time` input beside the date input; submit `dateAndTimeToMs(selectedDateValue, timeValue)`.
4. In `EventRow.tsx`, add a `time` input to the edit form and show the clock time in the row's meta line when `startsAtMs` is not at local midnight.
5. Add the i18n keys (en + he): `cal.eventTime` "Time" / "שעה"; `cal.eventTimeAny` "All day" / "כל היום". Extend `EventRow.test.tsx`: saving a time stores that instant; an empty time stores midnight; the row meta shows the time when set.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `EventRow.test.tsx`; a signed-in Playwright run on the cloud computer creates an event at 14:00 and the row shows 14:00.

EVIDENCE: test output; screenshot of the add form with the time input and a row showing a clock time.

DO NOT:
- don't add an end time or duration (TEMPO-BL-0003 owns `endsAtMs`)
- don't change `convex/` (the backend already accepts any `startsAtMs`)
- don't change time zones or add a time zone picker (the value is the user's local clock time)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any `UNKNOWN` (whether the row's date-only display should change for other views).

Standard: **iCalendar RFC 5545 `DTSTART`** — a timed event's start is a date-time with the local time zone, which this maps to an absolute `startsAtMs`. https://www.rfc-editor.org/rfc/rfc5545

Visible strings (keys):
- `cal.eventTime` EN "Time" / HE "שעה"
- `cal.eventTimeAny` EN "All day" / HE "כל היום"

---

## TEMPO-BL-0038 — Monthly period pages (backend)

```yaml
---
ticket: TEMPO-BL-0038
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/notes.ts
  - convex/schema.ts
  - packages/utils/src/blocks.ts
depends_on: []
contract:
  - "api.notes.ensurePeriodPage(args: { pageType: 'daily'|'weekly'|'monthly', date: string, title: string, body: string }) -> Id<'notes'>"
  - "api.notes.getPeriodPage(args: { pageType: 'daily'|'weekly'|'monthly', date: string }) -> { _id, title } | null"
  - "api.notes.listPeriodPages(args: { pageType: 'daily'|'weekly'|'monthly', before?, limit? }) -> PeriodPageRow[]"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who plan a month, so a monthly page can be opened and keyed like the daily and weekly pages.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §4.1 F-07 "Daily, weekly and monthly views from the same markdown"; docs/PRD.md §4.1 F-04 (Daily, Weekly, Monthly, Plain starter templates). Today `convex/notes.ts` `periodPageType` is `"daily" | "weekly"` only, `isPeriodDate` keys weekly pages to an ISO Monday, and the page-meta `pageType` enum (`packages/utils/src/blocks.ts` and the `notes`/`noteBlocks` schema) has no `"monthly"`, so a monthly page cannot be made end to end even though a `starter:monthly-page` template and a `periodType: "monthly"` column already exist.

GOAL: `monthly` becomes a first-class period page type — keyed by the month's first day (`YYYY-MM-01`) — accepted by `isPeriodDate`, `ensurePeriodPage`, `getPeriodPage`, `listPeriodPages` and `restore`, with `"monthly"` added to the mirrored `pageType` enum in the codec and both schema tables.

SCOPE: `convex/notes.ts`, `convex/schema.ts`, `packages/utils/src/blocks.ts`, `convex/notes_period.test.ts` (extend). Size: 3 files plus 1 test (the enum is mirrored in three places, so all three must change together).

MUTATES: `packages/utils/src/blocks.ts` (add `"monthly"` to the `pageType` enum), `convex/schema.ts` (add `"monthly"` to `notes.pageType` and `noteBlocks` page-meta `data.pageType`; additive, log in `convex/MIGRATIONS.md`), `convex/notes.ts` (extend `periodPageType` to include `"monthly"`; `isPeriodDate` accepts `YYYY-MM-01`; `restore` clash handling covers monthly), `convex/notes_period.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/notes.ts`, `convex/schema.ts`, `packages/utils/src/blocks.ts` and their dependents; adjust the plan to the current code.
2. Add `"monthly"` to the `pageType` enum in `packages/utils/src/blocks.ts`; run the blocks test to confirm the codec still parses a monthly `page-meta` block.
3. Add `"monthly"` to the two `pageType` unions in `convex/schema.ts`; log the additive change in `convex/MIGRATIONS.md`.
4. In `convex/notes.ts`, extend `periodPageType` to `"daily" | "weekly" | "monthly"`; make `isPeriodDate("monthly", date)` true only when `date` is `YYYY-MM-01`; the weekly rule (ISO Monday) stays unchanged.
5. Extend `convex/notes_period.test.ts`: `ensurePeriodPage` makes one monthly page for `2026-10-01` and returns the same id on a second call; `getPeriodPage` returns it; a non-first-of-month date is rejected; restoring a deleted monthly page behaves like the daily/weekly path.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `convex/notes_period.test.ts` and `packages/utils/src/blocks.test.ts`; `api.notes.ensurePeriodPage` accepts `pageType: "monthly"` in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `periodPageType` and `pageType` unions in the diffs.

DO NOT:
- don't change the daily or weekly keying rules (ISO Monday for weekly stays)
- don't add a monthly UI or route (TEMPO-BL-0039 owns `/month` and the opener)
- don't deploy; never touch the live Convex deployment
- don't edit `convex/schema.ts` in parallel with another open PR (AGENTS.md: one schema PR at a time)

REPORT: the monthly date rule in one sentence, the three enum sites changed, anything that couldn't match the contract and why.

Standard: **ISO 8601** calendar dates — the month key is `YYYY-MM-01` (the month's first day), the same date convention the daily/weekly pages already use. https://www.iso.org/iso-8601-date-and-time-format.html

No new visible strings (server-side only; TEMPO-BL-0039 adds the opener copy).

---

## TEMPO-BL-0039 — Monthly page opener and /month route

```yaml
---
ticket: TEMPO-BL-0039
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/today/
  - apps/web/app/(tempo)/month/
  - apps/web/lib/period-pages.ts
depends_on: [TEMPO-BL-0038]
contract:
  - "api.notes.ensurePeriodPage(args: { pageType: 'daily'|'weekly'|'monthly', date: string, title: string, body: string }) -> Id<'notes'>"
  - "api.notes.getPeriodPage(args: { pageType: 'daily'|'weekly'|'monthly', date: string }) -> { _id, title } | null"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0038

FOR: people who plan a month, so `/month` opens this month's page and makes it from the monthly starter template on first open — the way `/week` opens the weekly page.

WHEN: after TEMPO-BL-0038 (the backend accepts `pageType: "monthly"`).

WHY: docs/PRD.md §4.1 F-07; docs/APP-FLOW.md §5. Today `WeekOpener` (`apps/web/components/today/WeekOpener.tsx`) opens the weekly page, but there is no monthly equivalent and no `/month` route; `apps/web/lib/period-pages.ts` `PeriodKind` is `"daily" | "weekly"` only.

GOAL: `/month` renders a `MonthOpener` that resolves the current month's key (`YYYY-MM-01`), makes the monthly page from the `starter:monthly-page` body with `{{tokens}}` resolved, and opens it, mirroring `WeekOpener`'s loading/error/gone states.

SCOPE: `apps/web/components/today/MonthOpener.tsx` (new), `apps/web/app/(tempo)/month/page.tsx` (new), `apps/web/lib/period-pages.ts`. Size: 3 files plus 1 test.

MUTATES: `apps/web/lib/period-pages.ts` (add `"monthly"` to `PeriodKind`, a `monthTokens` helper and monthly handling in `periodPageDraft`), `apps/web/components/today/MonthOpener.tsx` (new; modeled on `WeekOpener`), `apps/web/app/(tempo)/month/page.tsx` (new route), `apps/web/lib/period-pages.test.ts` (extend), `apps/web/lib/i18n.ts` (new keys).

STEPS:
1. Query the Graphify graph for `apps/web/components/today/WeekOpener.tsx`, `apps/web/lib/period-pages.ts`, `apps/web/lib/period-page-bodies.ts` and their dependents; adjust the plan to the current code.
2. In `period-pages.ts`, add `"monthly"` to `PeriodKind`, a `monthTokens(monthFirst, lang)` helper (month name via `Intl.DateTimeFormat` `month: "long"`, year, and a `title`), and monthly handling in `periodPageDraft` so the page-meta block says `pageType: "monthly"` with `date: YYYY-MM-01`.
3. In `period-page-bodies.ts`, if the monthly starter needs a localized Hebrew outline, add it the way the daily/weekly Hebrew outlines are added (reuse the English `starter:monthly-page` body otherwise).
4. Add `MonthOpener.tsx` (modeled on `WeekOpener`): resolve the current month key, call `api.notes.getPeriodPage` then `api.notes.ensurePeriodPage`, and open the page with the same loading/error/gone/retry states.
5. Add `apps/web/app/(tempo)/month/page.tsx` that renders `MonthOpener`. Add i18n keys (en + he): `month.title` "Month" / "חודש"; and `month.gone` / `month.error` as needed (below).
6. Extend `period-pages.test.ts`: `periodPageDraft("monthly", "2026-10-01", body)` emits a `page-meta` block with `pageType: "monthly"` and `date: "2026-10-01"` and resolves the month/year tokens; an unknown token stays.
7. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `period-pages.test.ts`; a signed-in Playwright run on the cloud computer opens `/month` and shows the monthly page (or its loading→open path).

EVIDENCE: test output; screenshot of `/month`.

DO NOT:
- don't change `convex/` (TEMPO-BL-0038 owns the monthly backend; if `pageType: "monthly"` is missing, report `blocked: missing backend <monthly>`)
- don't add a month-grid UI (that is a calendar view change, a different ticket)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any `UNKNOWN` (whether the sidebar should gain a `/month` nav entry — leave it out unless the design says so).

Standard: **Unicode CLDR** — the month name and localized date formatting come from `Intl.DateTimeFormat`, which follows CLDR locale data. https://cldr.unicode.org/

Visible strings (keys):
- `month.title` EN "Month" / HE "חודש"
- `month.gone` EN "This month's page was removed. You can restore it from Notes for a while." / HE "הדף של החודש נמחק. אפשר לשחזר אותו מהפתקים עוד זמן מה."
- `month.error` EN "Could not open this month's page. Your notes are safe." / HE "לא הצלחנו לפתוח את הדף של החודש. ההערות שלך בטוחות."

---

## TEMPO-BL-0040 — Duplicate a user template

```yaml
---
ticket: TEMPO-BL-0040
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/templates.ts
depends_on: []
contract:
  - "api.templates.duplicate(args: { templateId: Id<'templates'> }) -> Id<'templates'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who shaped a template and want a copy to edit into a variant without rebuilding it.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §5 "Modules — how Tempo changes itself" (a template is a user-made module) and §4.1 F-04. Today `convex/templates.ts` has `create`/`update`/`remove`/`list`/`get`/`applyToNote` but no `duplicate`; the only way to start a new template from an existing one is to copy its body by hand.

GOAL: `api.templates.duplicate` copies a user template (name, description, periodType, body) into a new row with the name suffixed `(copy)` and a fresh id, and rejects starter ids.

SCOPE: `convex/templates.ts`, `convex/templates.test.ts` (extend). Size: 1 file plus 1 test.

MUTATES: `convex/templates.ts` (new `duplicate` mutation), `convex/templates.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/templates.ts` and its callers; adjust the plan to the current code.
2. Add `duplicate` as a `mutation` with `args: { templateId: v.id("templates") }`, `returns: v.id("templates")`. Reject `isStarterTemplateId(templateId)` with the same error text `update`/`remove` use ("Starter templates cannot be changed").
3. Read the owned template (reuse `ownedTemplate`); insert a new row with `name: \`${name} (copy)\``, the same `description`, `periodType` and `body`, fresh `createdAt`/`updatedAt`, and no `deletedAt`.
4. Extend `convex/templates.test.ts`: duplicating a user template returns a new id and keeps `periodType`/`body`; the copy's name ends in `(copy)`; duplicating a starter id throws; the copy is independent (editing the copy does not change the original).
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/templates.test.ts`; `api.templates.duplicate` exists in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `duplicate` line in `convex/_generated/api.d.ts`.

DO NOT:
- don't duplicate a starter template (starters live in code and cannot be copied into the user's rows)
- don't change the `templates` table or `create`/`update` behaviour
- don't deploy; never touch the live Convex deployment

REPORT: the duplicate rule (name suffix, what is copied), the test cases, anything that couldn't match the contract and why.

Standard: UNKNOWN — no industry-standard number governs copying a user template row; the name suffix `(copy)` and the `periodType` enum (`daily|weekly|monthly|none`) follow the existing repo conventions (docs/PRD.md §4.1 F-04). (who answers: Amit, only if a different duplicate-naming rule is wanted.)

No new visible strings (server-side only; TEMPO-BL-0041 adds the action label).

---

## TEMPO-BL-0041 — Templates library: duplicate action

```yaml
---
ticket: TEMPO-BL-0041
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/templates-library/
depends_on: [TEMPO-BL-0040]
contract:
  - "api.templates.duplicate(args: { templateId: Id<'templates'> }) -> Id<'templates'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0040

FOR: people browsing their templates, so a user template can be copied from the library with one action.

WHEN: after TEMPO-BL-0040 (the `duplicate` mutation exists).

WHY: docs/PRD.md §5 (user-made templates as modules) and §4.1 F-04. Today `TemplatesLibrary`/`TemplateCard` show Use/Edit/Delete for user templates but no Duplicate; a variant requires recreating the template by hand.

GOAL: each user template card gains a "Duplicate" action that copies the template and opens the new copy in the editor, with a one-line confirmation; starter templates show no Duplicate.

SCOPE: `apps/web/components/templates-library/TemplateCard.tsx`, `apps/web/components/templates-library/TemplatesLibrary.tsx`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/templates-library/TemplateCard.tsx` (add the Duplicate button, only for `source: "user"`), `apps/web/components/templates-library/TemplatesLibrary.tsx` (wire `api.templates.duplicate` and open the copy), `apps/web/components/templates-library/TemplateCard.test.tsx` (extend), `apps/web/lib/i18n.ts` (new keys).

STEPS:
1. Query the Graphify graph for `TemplateCard.tsx` and `TemplatesLibrary.tsx` and their dependents; adjust the plan to the current code.
2. Add a `duplicate` callback prop to `TemplateCard` and render a "Duplicate" button (with the existing icon set) only when the card is a user template (`source === "user"`), beside Edit.
3. In `TemplatesLibrary`, call `api.templates.duplicate({ templateId })`, then navigate to the template editor for the new id (route `apps/web/app/(tempo)/templates/editor/[id]/page.tsx`).
4. Add the i18n keys (en + he): `tpl.duplicate` "Duplicate" / "שכפול"; `tpl.duplicateName` "Duplicate {name}" / "שכפול של {name}"; `tpl.duplicated` "Duplicated" / "שוכפל". Reuse the existing `tpl.deleteError` error style for a failed duplicate.
5. Extend `TemplateCard.test.tsx`: a user template shows Duplicate; a starter template does not; clicking Duplicate calls the mutation and the confirmation shows.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `TemplateCard.test.tsx`; a signed-in Playwright run on the cloud computer duplicates a user template and lands in its editor.

EVIDENCE: test output; screenshot of the card with the Duplicate action and the new copy in the editor.

DO NOT:
- don't change `convex/` (if `api.templates.duplicate` is missing, report `blocked: missing backend <templates.duplicate>`)
- don't show Duplicate on a starter template (starters cannot be copied into user rows)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, anything missing from the contract.

Standard: **WCAG 2.2 target size ≥ 24×24 CSS px** for the Duplicate button. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `tpl.duplicate` EN "Duplicate" / HE "שכפול"
- `tpl.duplicateName` EN "Duplicate {name}" / HE "שכפול של {name}"
- `tpl.duplicated` EN "Duplicated" / HE "שוכפל"

---

## TEMPO-BL-0042 — Localize the Today screen's remaining hard-coded strings

```yaml
---
ticket: TEMPO-BL-0042
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/today/
depends_on: []
contract:
  - "No new backend functions. Reuses the existing `translate(lang, key)` from apps/web/lib/i18n.ts."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who use Tempo in Hebrew, so the Today task list, quick-add and sign-in fallback switch to Hebrew with the rest of the app.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §4.7 F-70 "Website copy and app copy in English and Hebrew", F-71 RTL; docs/TRD.md §5b "Copy lives in apps/web/messages/en.json and he.json" (now `apps/web/lib/i18n.ts`). Today `apps/web/components/today/TodayTaskList.tsx`, `TodayQuickAdd.tsx` and the sign-in fallback in `TodayScreen.tsx` hold hard-coded English ("Today", "Nothing on the plan yet.", "Mark … complete", "Add something small for today", "Sign in required", …) and never call `useLocale()`, so those parts stay English in Hebrew.

GOAL: every visible string in the three files is a `t(...)` key with an `en` and `he` value, reusing existing keys where they exist and adding the missing ones; no behaviour changes.

SCOPE: `apps/web/components/today/TodayTaskList.tsx`, `apps/web/components/today/TodayQuickAdd.tsx`, `apps/web/components/today/TodayScreen.tsx` (sign-in fallback). Size: 3 files plus 1 test.

MUTATES: the three files (replace hard-coded strings with `useLocale()`/`t()`), `apps/web/lib/i18n.ts` (new keys), `apps/web/components/today/TodayTaskList.test.tsx` (new or extended).

STEPS:
1. Query the Graphify graph for the three MUTATES files and `apps/web/lib/i18n.ts`; adjust the plan to the current code.
2. In `TodayTaskList.tsx`, replace the hard-coded heading/count/empty/all-done/aria strings with `t(...)`; reuse `nav.today`, `tasks.markDone`, `tasks.markOpen`, `tasks.level.high|medium|low` where they already exist, and add `today.list.*` keys for the rest.
3. In `TodayQuickAdd.tsx`, replace the label and hint strings with `t(...)`; add `today.quickAdd.label`, `today.quickAdd.hint`, `today.quickAdd.error`.
4. In `TodayScreen.tsx`, replace the signed-in fallback's "Sign in required" / "We could not load your session…" / "Sign in" with `t(...)`; add `today.signInRequired`, `today.sessionError`, `today.signIn`.
5. Add every new key to both `en` and `he` in `apps/web/lib/i18n.ts` (machine-drafted Hebrew is acceptable, marked with a `// Machine-drafted Hebrew: needs native review.` comment, matching the repo's convention). Add/extend a render test that asserts the Today list renders the translated heading in Hebrew (`lang="he"`) and English.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the Today task-list render test in both languages; a signed-in Playwright run on the cloud computer with `?lang=he` shows the Today task list and quick-add in Hebrew with `dir="rtl"`.

EVIDENCE: test output; screenshot of Today in Hebrew.

DO NOT:
- don't change the logic, selectors or `data-testid`s of the three components (copy only)
- don't change `convex/`
- don't invent Hebrew beyond the existing `he` keys plus the new machine-drafted keys (flag them for native review)
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, the keys reused vs added, and the Hebrew keys flagged for native review.

Standard: **Unicode UAX #9** — mixed Hebrew/English lines in the list use `dir="auto"` (already present on the title) so each line reads correctly. https://www.unicode.org/reports/tr9/ · **WCAG 2.2 AA 4.5:1** for the task text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Visible strings (keys, reused where present): `nav.today`, `tasks.markDone`, `tasks.markOpen`, `tasks.level.high|medium|low`; new: `today.list.title`, `today.list.empty`, `today.list.emptyHint`, `today.list.allDone`, `today.list.showing`, `today.list.open`, `today.list.more`, `today.quickAdd.label`, `today.quickAdd.hint`, `today.quickAdd.error`, `today.signInRequired`, `today.sessionError`, `today.signIn`.

---

## TEMPO-BL-0043 — Duplicate a note

```yaml
---
ticket: TEMPO-BL-0043
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/notes.ts
depends_on: []
contract:
  - "api.notes.duplicate(args: { noteId: Id<'notes'> }) -> Id<'notes'>"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who want a second copy of a page to try changes without losing the original.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §1 "Every page is markdown with JSON blocks"; §6 "soft delete … Undo". Today `convex/notes.ts` has `create`/`update`/`remove`/`restore`/`togglePin` but no `duplicate`; the only way to copy a page is to select and paste its markdown by hand, which does not refresh block ids.

GOAL: `api.notes.duplicate` copies a page into a new plain page (title suffixed `(copy)`, body with fresh block ids, `pageType: "plain"`, no date, not pinned), leaving the original untouched.

SCOPE: `convex/notes.ts`, `convex/notes.test.ts` (extend). Size: 1 file plus 1 test.

MUTATES: `convex/notes.ts` (new `duplicate` mutation; reuse `asPlainPageBody` and add a block-id refresh using `parseTempoBlocks`/`serializeTempoBlocks` from `@tempo/utils`), `convex/notes.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/notes.ts`, `packages/utils/src/blocks.ts` and their dependents; adjust the plan to the current code.
2. Add `duplicate` as a `mutation` with `args: { noteId: v.id("notes") }`, `returns: v.id("notes")`. Read the owned live note (`requireUser`, reject when missing/deleted, as `update` does).
3. Build the copy: title `${title} (copy)`, body from `asPlainPageBody(note.body)` (so the page-meta block becomes `plain` and the page no longer claims a date), then rewrite every block's `id` to a fresh `blk_`+ULID via `parseTempoBlocks`/`serializeTempoBlocks`.
4. Insert the copy with `pinned: false`, `periodType: "none"`, `pageType: "plain"`, no `date`, fresh timestamps.
5. Extend `convex/notes.test.ts`: duplicating a page returns a new id; the copy's title ends in `(copy)`; its body's page-meta block is `plain` and block ids differ from the source; the original is unchanged; duplicating a deleted or missing note throws.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/notes.test.ts`; `api.notes.duplicate` exists in `convex/_generated/api.d.ts`.

EVIDENCE: test output; the `duplicate` line in `convex/_generated/api.d.ts`.

DO NOT:
- don't duplicate a dated page into the same date (the copy is always `plain` with no `date`, so one date never gets two live pages)
- don't change `create`/`update`/`remove` behaviour
- don't add a UI action (a later component ticket wires the page menu)
- don't deploy; never touch the live Convex deployment

REPORT: the duplicate rule (title suffix, plain page, fresh block ids), the test cases, anything that couldn't match the contract and why.

Standard: **ULID** — fresh block ids keep the repo's `blk_`+ULID convention (128-bit, 80 bits of randomness), so a copy's blocks never collide with the source's within their own page. https://github.com/ulid/spec

No new visible strings (server-side only; the title suffix `(copy)` is a value, and a later UI ticket adds its label).

---

## Self-check (detailed-enough) log

For each ticket, the questions a builder would ask, and where each is answered (fixed in the ticket) or left `UNKNOWN` (with who answers).

**TEMPO-BL-0033 (search task fields)**
- Which fields now match? → fixed (title, description, projectName, checklist item text).
- Does the result shape change? → fixed (unchanged; BL-0034 changes it).
- Is there a search index? → fixed (no; stays a bounded in-memory filter under the existing limits).

**TEMPO-BL-0034 (search memories + calendar)**
- What does each new group return? → fixed (memories: content + snippet; calendarEvents: title + startsAtMs).
- Sort order? → fixed (memories updatedAt desc; events startsAtMs asc).
- Is semantic memory search included? → fixed (no; that is the memory port's `recall`).

**TEMPO-BL-0035 (search UI)**
- Where does a memory result link? → UNKNOWN — the exact memory-screen route; the implementer verifies it and reports the real one.
- Which filter kinds? → fixed (six: all/notes/tasks/habits/goals/memories/calendar).

**TEMPO-BL-0036 (calendar time blocks)**
- Where do blocks come from? → fixed (`api.timeBlocks.listForDate`).
- Are they editable here? → fixed (no; /plan and TimeBlockDialog own edit).
- Clock format? → fixed (24-hour `HH:MM` from `startMinute`/`durationMinutes`).

**TEMPO-BL-0037 (event start time)**
- How is the time stored? → fixed (`startsAtMs` at local clock time; empty time = midnight).
- Does this add an end time? → fixed (no; TEMPO-BL-0003 owns `endsAtMs`).
- Time zone picker? → fixed (none; the value is the user's local clock time).

**TEMPO-BL-0038 (monthly backend)**
- How is a month keyed? → fixed (`YYYY-MM-01`).
- Why does it touch three enum sites? → fixed (the `pageType` enum is mirrored in `@tempo/utils`, `notes`, and `noteBlocks`).
- Does weekly keying change? → fixed (no; ISO Monday stays).

**TEMPO-BL-0039 (month opener)**
- Which starter? → fixed (`starter:monthly-page`).
- Sidebar nav entry? → UNKNOWN — leave out unless the design says so; the implementer reports.
- Which tokens resolve? → fixed (month name, year, title; unknown tokens stay).

**TEMPO-BL-0040 (duplicate template)**
- Can a starter be duplicated? → fixed (no; rejected with the existing error).
- What is copied? → fixed (name `(copy)`, description, periodType, body).
- Industry-standard number? → UNKNOWN — none governs copying a template row (who answers: Amit, only for a different naming rule).

**TEMPO-BL-0041 (duplicate template UI)**
- Starter cards? → fixed (no Duplicate button).
- Where does the copy open? → fixed (template editor route).

**TEMPO-BL-0042 (Today localization)**
- Which keys are reused vs new? → fixed (reused: nav.today, tasks.markDone/Open, tasks.level.*; new: today.list.*, today.quickAdd.*, today.signIn*).
- Hebrew quality? → UNKNOWN — machine-drafted, flagged for native review by Amit / a Hebrew speaker.
- Behaviour changes? → fixed (none; copy only).

**TEMPO-BL-0043 (duplicate note)**
- What page type is the copy? → fixed (`plain`, no date).
- Are block ids refreshed? → fixed (yes, `blk_`+ULID).
- Does a UI action ship here? → fixed (no; a later component ticket wires it).

---

## Inputs I could not find / reconcile

1. **`gh issue list` could not run** — `gh` has no auth on this machine and `GH_TOKEN`/`GITHUB_TOKEN` are unset. I read open issues read-only with the Reason issues tool instead: 30 open issues (#1252–#1336), none of which these 11 tickets duplicate.
2. **`include.md`** was not found in the repo; I applied the described "detailed enough" self-check directly (list builder questions → fix or mark UNKNOWN with who answers), as the pilot did.
3. **`AGENTS.md §8.1 front matter`** was not found as a literal section; the front-matter fields here follow `docs/tickets/_templates/*.md` and the pilot's `BACKLOG-PILOT.md`.
4. **The memory-screen route** for TEMPO-BL-0035's memory result link is UNKNOWN (no top-level `/memory` route exists in `apps/web/app/(tempo)/`); the ticket flags it and names `/settings/memory` as the likely destination to verify.
5. **Billing instruction** ("Whop first, PayPal fallback … Depends: #1335 … rewrite after it lands") applies to billing tickets, which are outside this Session's area (Notes/Today/planner/calendar/templates/search); no ticket here is a billing ticket, so none carries that line.

<!-- lane 0044-0054 -->
## TEMPO-BL-0044 — Hebrew RTL: notes and editor pages (mixed-direction paragraphs)

```yaml
---
ticket: TEMPO-BL-0044
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/editor/
  - apps/web/components/notes/
depends_on: []
contract:
  - "No new backend functions. Reuses apps/web/lib/i18n.ts dirFor(lang) and apps/web/lib/i18n-groups/*."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who write and read notes in Hebrew, so a page with mixed Hebrew and English lays out right-to-left and each paragraph reads in its own direction.

WHEN: first in the backlog; independent (the i18n layer, `dirFor`, and `LocaleProvider` already exist in `apps/web/lib/i18n.ts`).

WHY: docs/PRD.md §4.7 F-72 "Mixed Hebrew and English inside one note renders each paragraph in its own direction"; docs/TRD.md §5b "Note paragraphs render with `dir='auto'`, so mixed Hebrew and English lines each read correctly" and "Layout uses logical CSS only". Today `apps/web/components/editor/ReadView.tsx` sets `dir="auto"` once on the whole content wrapper, so a mixed page does not give each paragraph its own direction, and the editing surface `apps/web/components/editor/LivePreviewEditor.tsx` is not verified RTL-safe.

GOAL: when `lang="he"`, every rendered paragraph in a note uses `dir="auto"`, numerals and code spans stay LTR via `.tp-num` / `.tp-mono`, and the live editor's text area and slash menu lay out right-to-left with logical CSS.

SCOPE: `apps/web/components/editor/` and `apps/web/components/notes/`. Size: 3 files plus 1 test.

MUTATES: `apps/web/components/editor/ReadView.tsx` (render each markdown paragraph and each block card with `dir="auto"` instead of one wrapper-only `dir`), `apps/web/components/editor/LivePreviewEditor.tsx` (set `dir={dirFor(lang)}` and logical spacing on the editing surface and SlashMenu), `apps/web/components/notes/PageEditorView.tsx` (pass the active `lang` to the editor), `apps/web/components/editor/readview-rtl.test.tsx` (new).

STEPS:
1. Query the Graphify graph (`docs/graphs/tempo-rhythm.json`, `graphify query`) for `ReadView.tsx`, `LivePreviewEditor.tsx`, `PageEditorView.tsx` and their dependents; adjust the plan to the current code.
2. In `ReadView.tsx`, replace the single wrapper `dir="auto"` with per-paragraph/per-block `dir="auto"`: for `segment.kind === "markdown"`, wrap each paragraph in an element with `dir="auto"` and add `.tp-num` to numeral runs and `.tp-mono` to inline code (the classes already exist in `apps/web/app/globals.css` / design tokens). Block cards keep `dir="auto"`.
3. In `LivePreviewEditor.tsx`, read `lang` from `useLocale()` and set `dir={dirFor(lang)}` on the editor root and the SlashMenu; use logical utilities (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`) for the toolbar and caret chrome; mirror the direction-sensitive icons.
4. In `PageEditorView.tsx`, pass the resolved `lang` into the editor (or read it there) without changing the save path.
5. Add `readview-rtl.test.tsx` (Vitest + Testing Library): with `lang="he"` a body `"שלום English 123"` renders a paragraph with `dir="auto"`; the numeral `123` carries `.tp-num`; a second English-only paragraph keeps LTR ordering; a code span carries `.tp-mono`.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `readview-rtl.test.tsx`; a signed-in Playwright run on the cloud computer with `?lang=he` shows a note whose Hebrew line is RTL, its embedded `123` LTR, and the editor's caret/text starting from the right.

EVIDENCE: test output; screenshot of a mixed Hebrew/English note in the editor (RTL thread, LTR numeral).

DO NOT:
- don't change `convex/` (no backend change is needed)
- don't machine-invent new Hebrew copy — reuse the existing `he` keys via `translate(lang, key)`
- don't render raw JSON anywhere (PRD §6)
- don't hard-code `right`/`left` (TRD §5b logical CSS only)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified, any block/paragraph type whose direction could not be made `auto` and why.

Standard: **Unicode UAX #9** bidirectional algorithm (the basis for `dir="auto"` ordering). https://www.unicode.org/reports/tr9/ · **WCAG 2.2 AA 4.5:1** contrast for the note text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

No new visible strings (direction attributes and existing editor copy only; `dirFor` already exists).

---

## TEMPO-BL-0045 — Hebrew RTL: calendar and Today views with Hebrew dates

```yaml
---
ticket: TEMPO-BL-0045
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/calendar/
  - apps/web/components/today/
depends_on: []
contract:
  - "No new backend functions. Reuses apps/web/lib/i18n.ts dirFor(lang) and existing cal.* / today.* keys."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who use the calendar and Today in Hebrew, so dates, day names and the day grid read right-to-left and Hebrew-formatted.

WHEN: first in the backlog; independent.

WHY: docs/PRD.md §4.7 F-71 "The layout switches left-to-right / right-to-left with the language"; docs/TRD.md §5b "`<html lang dir>` is set from the locale … Layout uses logical CSS only"; docs/TRD.md §1 calendar building block "`direction: 'rtl'` documented for Hebrew". Today `apps/web/components/calendar/CalendarViews.tsx` renders day/week/month views and `EventRow.tsx` renders event rows, but neither is verified to lay out RTL or to format dates with the Hebrew locale.

GOAL: when `lang="he"`, the calendar's day/week/month grid and Today's agenda lay out right-to-left, day names and dates render with `Intl.DateTimeFormat("he", …)` (Hebrew weekday/month names, western-Arabic numerals), and every direction-sensitive icon mirrors.

SCOPE: `apps/web/components/calendar/` and `apps/web/components/today/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/calendar/CalendarViews.tsx` (wrap the grid with `dir={dirFor(lang)}`, format headings and day names with an `Intl.DateTimeFormat` built from the active locale), `apps/web/components/today/TodayAgenda.tsx` (set `dir` and Hebrew date formatting on the agenda list), `apps/web/components/calendar/calendar-rtl.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `CalendarViews.tsx`, `EventRow.tsx`, `TodayAgenda.tsx` and their dependents; adjust the plan to the current code.
2. Add a small locale helper (inline in `CalendarViews.tsx`, not a new file) that returns `Intl.DateTimeFormat(lang === "he" ? "he" : "en", { weekday, month, day, year })` and `Intl.DateTimeFormat(…, { month: "long" })` for month headers; use it for every date heading, day-name header and event date.
3. Set `dir={dirFor(lang)}` on the grid container and `EventRow` rows; use logical utilities for the prev/next arrows and mirror the arrow icons for RTL.
4. In `TodayAgenda.tsx`, set `dir={dirFor(lang)}` and format the agenda's date line with the same helper.
5. Add `calendar-rtl.test.tsx` (Vitest + Testing Library): with `lang="he"` the grid root has `dir="rtl"`; a date renders Hebrew month/day names (assert the formatted string contains a Hebrew weekday, e.g. "ראשון"); with `lang="en"` it stays LTR.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `calendar-rtl.test.tsx`; a signed-in Playwright run with `?lang=he` shows the calendar grid laid out right-to-left with Hebrew day/month names.

EVIDENCE: test output; screenshot of `/calendar` and Today's agenda in Hebrew.

DO NOT:
- don't change `convex/` or the calendar event data model (rendering-only)
- don't change the Hebrew digits to `ar`/Hindi numerals (keep western-Arabic, matching `.tp-num`)
- don't hard-code `right`/`left` (logical CSS only, TRD §5b)
- don't machine-invent new Hebrew copy beyond `Intl` output
- don't render raw JSON anywhere (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, the exact `Intl` options used, any view whose RTL could not be verified and why.

Standard: **ISO 8601** local dates, rendered with `Intl.DateTimeFormat` so the Hebrew locale is correct without hard-coding month names. https://www.iso.org/iso-8601-date-and-time-format.html · **WCAG 2.2 AA 4.5:1** contrast for the calendar text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

No new visible strings (dates come from `Intl`; `cal.*` / `today.*` keys already exist).

---

## TEMPO-BL-0046 — Note read-aloud backend (Chatterbox TTS for a note block)

```yaml
---
ticket: TEMPO-BL-0046
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/voice.ts
  - convex/lib/voicePolicy.ts
depends_on: []
contract:
  - "api.voice.readAloud(args: { noteId: Id<'notes'>, index: number }) -> { status: 'audio', audio: ArrayBuffer, mime: string, count: number } | { status: 'done' } | { status: 'exhausted' } | { status: 'off' }"
  - "api.voice.admitReadAloud(args: { noteId: Id<'notes'>, index: number }) -> { status: 'sentence', text: string, language: string, count: number } | { status: 'done' } | { status: 'exhausted' }  (internalMutation)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the note page, so any note's text can be read aloud — not only a coach reply (the existing `speak` action reads coach replies only).

WHEN: first in the backlog; independent. The note read-aloud control (TEMPO-BL-0047) waits for it.

WHY: docs/UI-BRIEF.md §6 "Read-back: any note or coach message can be read aloud"; docs/HARD_RULES.md §9 voice minute-caps and the read-aloud character cap. Today `convex/voice.ts` `speak` resolves a coach reply's sentence by `messageId` inside a live voice lease; there is no path that reads a note's text aloud, and no TTS char accounting for a note.

GOAL: `api.voice.readAloud` resolves sentence `index` of a note's plain-text body server-side, counts its characters against the existing daily read-aloud cap, and returns Chatterbox audio; a crisis note line is never spoken, and the crisis card is never read aloud.

SCOPE: `convex/voice.ts`, `convex/lib/voicePolicy.ts`, `convex/voice.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/voice.ts` (add `admitReadAloud` internalMutation + `readAloud` action; reuse the existing `speechSentences`, `audioFrom` and the Chatterbox `speak` HTTP path), `convex/lib/voicePolicy.ts` (no new limits unless a note-read-aloud cap differs — reuse `dailyTtsCharsPerUser`), `convex/voice.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/voice.ts`, `convex/lib/voicePolicy.ts`, `convex/notes.ts` and their dependents; adjust the plan to the current code.
2. Add `api.voice.admitReadAloud(noteId, index)`: require an approved user; read the note (deleted notes are refused); reject reading when `isCrisisText` matches any sentence (reuse `convex/lib/crisisWords.ts`, never the crisis card); split the note body with the existing `speechSentences`; return sentence `index` plus `language` (from the user's locale, `en`/`he`) and `count`; count its characters against `dailyTtsCharsPerUser` the same way `admitSentence` does.
3. Add `api.voice.readAloud(noteId, index)` as an `action` that reserves via `admitReadAloud`, then calls the same Chatterbox endpoint (`CHATTERBOX_URL`, `DEEPINFRA_API_KEY` by name only) and returns `{ status: 'audio', audio, mime, count }`; on a used-up cap return `{ status: 'exhausted' }`, on `index >= count` return `{ status: 'done' }`. Fail closed when `DEEPINFRA_API_KEY` is unset (`{ status: 'off' }`).
4. Extend `convex/voice.test.ts`: a note body is split into sentences; `readAloud` returns audio bytes for index 0 and `done` past the end; a crisis-phrase note returns `done` without a provider call; the char cap is shared with coach `speak`.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/voice.test.ts`; `api.voice.readAloud` exists in `convex/_generated/api.d.ts` with the shape above.

EVIDENCE: test output; the `convex/_generated/api.d.ts` line for `readAloud`.

DO NOT:
- don't change the coach `speak`/`admitSentence` behaviour (the note path is additive)
- don't store or log any audio, transcript, token or provider body (TRD §7 rule 2)
- don't read the crisis card aloud, and don't send a crisis note to TTS (L-12)
- don't print a secret; reference `DEEPINFRA_API_KEY` by name only
- don't deploy; never touch the live Convex deployment

REPORT: contract names created, the shared char-cap rule in one sentence, anything that couldn't match the contract and why.

Standard: **voice reply first audio ≤ 300 ms** — the note read-aloud reuses the same sentence-at-a-time TTS, whose actual first-audio latency is UNKNOWN until measured (TRD §5a); the target is the product's ≤300 ms budget. https://developers.deepgram.com/docs/measuring-streaming-latency

No new visible strings (server-side only; the note control's copy is owned by TEMPO-BL-0047).

---

## TEMPO-BL-0047 — Note read-aloud control ("Listen" on a note)

```yaml
---
ticket: TEMPO-BL-0047
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/notes/
depends_on: [TEMPO-BL-0046]
contract:
  - "api.voice.readAloud(args: { noteId: Id<'notes'>, index: number }) -> { status: 'audio'|'done'|'exhausted'|'off', audio?, mime?, count? }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0046

FOR: people who read or listen to their notes, so one button reads the open page aloud and can be stopped.

WHEN: after TEMPO-BL-0046 lands (its `readAloud` action is the audio source).

WHY: docs/UI-BRIEF.md §6 "Read-back: any note or coach message can be read aloud. Control placement: UNKNOWN until the voice phase" and "The first user is dyslexic and often listens." The coach reply path already reads aloud; the note page has no listen control.

GOAL: the open note page shows a "Listen" control that reads each sentence aloud in order (from `readAloud`), toggles to "Stop", and on an unavailable/off response shows a one-line calm message without breaking the page.

SCOPE: `apps/web/components/notes/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/notes/PageEditorView.tsx` (mount the control in the page header), `apps/web/components/notes/read-aloud.ts` (new hook: sequence `readAloud` indices, play via `Audio`, stop on unmount), `apps/web/components/notes/read-aloud.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `PageEditorView.tsx` and its dependents; adjust the plan to the current code.
2. Add `read-aloud.ts` that takes `noteId`, calls `api.voice.readAloud` for index 0, 1, …, plays each `audio` blob in order, and exposes `{ state: 'idle'|'playing'|'off'|'exhausted', start, stop }`; `stop` aborts playback and cancels the next fetch.
3. In `PageEditorView.tsx`, add a "Listen" button (toggle to "Stop" while playing) in the header; when `status === 'off'` or `'exhausted'` show the calm one-line copy and disable nothing else.
4. Add `read-aloud.test.tsx` (Vitest + Testing Library, mock `convex/react` and `Audio`): pressing "Listen" calls `readAloud` with index 0 then advances; "Stop" aborts; an `'off'` first response shows the unavailable copy.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `read-aloud.test.tsx`; a signed-in Playwright run on the cloud computer shows the Listen control on an open note and toggles it to Stop.

EVIDENCE: test output; screenshot of the Listen control (idle and playing states).

DO NOT:
- don't change `convex/` (TEMPO-BL-0046 owns the backend; if `readAloud` is missing, report `blocked: missing backend <readAloud>`)
- don't auto-play on page open (a user action starts it)
- don't read aloud a block's raw JSON — the sentence text comes from `readAloud` (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified (paste the test + Playwright output), anything missing from the contract.

Standard: **WCAG 2.2 AA target size ≥ 24×24 CSS px** for the Listen/Stop control. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `note.listen` EN "Listen" / HE "האזנה"
- `note.listen.stop` EN "Stop reading" / HE "הפסקת הקראה"
- `note.listen.off` EN "This page can't be read aloud yet." / HE "עדיין אי אפשר להקריא את הדף הזה."

---

## TEMPO-BL-0048 — Dictation backend: standalone speech-to-text grant for the note editor

```yaml
---
ticket: TEMPO-BL-0048
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/voice.ts
  - convex/lib/voicePolicy.ts
depends_on: []
contract:
  - "api.voice.dictationGrant(args: {}) -> { token: string, url: string, language: 'en'|'he' }"
  - "api.voice.admitDictation(args: {}) -> { url: string }  (internalMutation)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the note editor, so a person can dictate (speech-to-text) straight into a page with a 30-second Deepgram token that is not tied to a live coach voice session.

WHEN: first in the backlog; independent. The dictation mic control (TEMPO-BL-0049) waits for it.

WHY: docs/PRD.md §4.3 F-33 "Hebrew: Deepgram Nova-3 `he` → runtime model"; docs/TRD.md §5a step 1 "The browser asks a Convex action for a speech-to-text token … plus the model to use (`flux-general-en`, or Nova-3 with `he`, from the user's locale)"; docs/TRD.md §7 rule 2 "the browser streams microphone audio directly to Deepgram using a 30-second token minted by a Convex action". Today `convex/voice.ts` `grant` requires a live `voiceSessions` lease (a coach conversation); there is no standalone grant for dictating into a note.

GOAL: `api.voice.dictationGrant` mints a 30-second Deepgram token for the caller's locale lane (Nova-3 `he`, Flux `en`) with no voice session, counts a small per-day dictation grant budget, and returns the socket URL chosen server-side; the key never leaves the server.

SCOPE: `convex/voice.ts`, `convex/lib/voicePolicy.ts`, `convex/voice.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/voice.ts` (add `admitDictation` internalMutation + `dictationGrant` action; reuse `mintDeepgramToken` and `laneFor`), `convex/lib/voicePolicy.ts` (add a `dictationGrantsPerDay` cap constant beside the existing limits), `convex/voice.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/voice.ts`, `convex/lib/voicePolicy.ts` and their dependents; adjust the plan to the current code.
2. Add `DICTATION_GRANTS_PER_DAY = 40` (one `voiceSessions`-style counter per local day, no audio stored) to `convex/lib/voicePolicy.ts`; note the exact value is a recommended default and report it.
3. `admitDictation` (internalMutation): require an approved user, resolve the lane via `laneFor(prefs.locale)`, fail closed when `laneFor` is null (Hebrew stays off until the Hebrew crisis list lands — issue #1252) or `DEEPGRAM_API_KEY` is unset; count the grant against the daily cap and return `{ url }`.
4. `dictationGrant` (action): reserve via `admitDictation`, mint a 30-second token via `mintDeepgramToken`, return `{ token, url, language }`; give back the reservation if minting fails.
5. Extend `convex/voice.test.ts`: an `en` locale returns the Flux URL; a `he` locale with the lane off returns the calm `voice_language` error; over the daily cap it fails closed; a minted token is never stored.
6. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/voice.test.ts`; `api.voice.dictationGrant` exists in `convex/_generated/api.d.ts` with the shape above.

EVIDENCE: test output; the `convex/_generated/api.d.ts` line for `dictationGrant`.

DO NOT:
- don't change the coach `grant`/`admitGrant` lease path (additive)
- don't store or log any audio, transcript, token or provider body
- don't enable the Hebrew lane here — that is issue #1252 (Hebrew crisis keywords); this ticket fails closed for `he` until it lands
- don't print a secret; reference `DEEPGRAM_API_KEY` by name only
- don't deploy; never touch the live Convex deployment

REPORT: contract names created, the daily grant cap used, and `UNKNOWN` (whether Nova-3 `he` returns interim results in the sandbox — verify at implementation).

Standard: **Deepgram token TTL 30 s** (the browser only needs the token valid when the WebSocket opens; TRD §5a step 1). https://developers.deepgram.com/docs/authenticating

No new visible strings (server-side only; the mic control's copy is owned by TEMPO-BL-0049).

---

## TEMPO-BL-0049 — Dictation mic input in the note editor

```yaml
---
ticket: TEMPO-BL-0049
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/editor/
depends_on: [TEMPO-BL-0048]
contract:
  - "api.voice.dictationGrant(args: {}) -> { token: string, url: string, language: 'en'|'he' }"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 2
Depends: TEMPO-BL-0048

FOR: people writing a note, so they can dictate (type by voice) into the editor in English or Hebrew.

WHEN: after TEMPO-BL-0048 lands (its `dictationGrant` supplies the token and socket URL).

WHY: docs/PRD.md §4.3 F-33 "Hebrew: Deepgram Nova-3 `he` → runtime model → Chatterbox multilingual"; docs/TRD.md §5a step 2 "The browser streams microphone audio to Deepgram `/listen` over a WebSocket and shows the live transcript." Today the mic input exists only inside the coach voice call; the note editor has no dictate control.

GOAL: the note editor shows a "Dictate" control that opens a Deepgram `/listen` WebSocket (with the grant token), inserts the final transcript at the caret, and shows a calm error on a refused or unsupported microphone.

SCOPE: `apps/web/components/editor/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/editor/LivePreviewEditor.tsx` (mount the Dictate control), `apps/web/components/editor/dictation.ts` (new hook: grant → WebSocket → final transcript → insert at caret), `apps/web/components/editor/dictation.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `LivePreviewEditor.tsx` and its dependents; adjust the plan to the current code.
2. Add `dictation.ts` that calls `api.voice.dictationGrant`, opens the returned `url` as a WebSocket with the token as the `bearer` subprotocol, accumulates the transcript from `final` (and shows `interim_results` where present), and returns the final text; `stop` closes the socket and flushes the transcript.
3. In `LivePreviewEditor.tsx`, add a "Dictate" button beside the toolbar that toggles to "Stop"; on stop, insert the final transcript at the caret through the existing editor insert path.
4. Add `dictation.test.tsx` (Vitest + Testing Library, mock `convex/react` and `WebSocket`): pressing "Dictate" requests a grant and opens the socket; a `final` transcript is inserted on stop; a refused `grant` (Hebrew lane off) shows the calm error and no socket opens.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `dictation.test.tsx`; a signed-in Playwright run on the cloud computer shows the Dictate control in the editor and inserts dictated text on stop (English lane; Hebrew depends on #1252).

EVIDENCE: test output; screenshot of the Dictate control.

DO NOT:
- don't change `convex/` (TEMPO-BL-0048 owns the backend; if `dictationGrant` is missing, report `blocked: missing backend <dictationGrant>`)
- don't send audio anywhere but the returned Deepgram socket
- don't store or log the token or transcript client-side beyond the in-memory transcript
- don't insert raw JSON into the editor (PRD §6)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, what was verified (paste the test + Playwright output), anything missing from the contract.

Standard: **WCAG 2.2 AA target size ≥ 24×24 CSS px** for the Dictate/Stop control. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Visible strings (keys):
- `editor.dictate` EN "Dictate" / HE "הכתבה"
- `editor.dictate.stop` EN "Stop dictation" / HE "הפסקת הכתבה"
- `editor.dictate.permission` EN "Allow the microphone to dictate." / HE "אפשרו את המיקרופון כדי להכתיב."
- `editor.dictate.off` EN "Dictation in this language isn't ready yet." / HE "הכתבה בשפה הזו עוד לא מוכנה."

---

## TEMPO-BL-0050 — Accessibility: keyboard navigation and visible focus order

```yaml
---
ticket: TEMPO-BL-0050
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/coach/
  - apps/web/components/notes/
depends_on: []
contract:
  - "No new backend functions."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who use Tempo without a mouse, so the coach chat and the note page are fully reachable and operable by keyboard with a visible focus ring.

WHEN: first in the backlog; independent.

WHY: docs/HARD_RULES.md §8 "Keyboard navigation on web: every feature reachable without a mouse. Focus states visible. Never `outline: none` without a visible replacement."; docs/UI-BRIEF.md §6 "Every control reachable by keyboard with a visible focus ring. Drag always has a button alternative." Today the coach and notes controls have no verified focus order, and some interactive elements may hide the focus ring.

GOAL: every interactive control in the coach chat and note page is keyboard-reachable in a sensible order, shows a visible focus indicator, and a skip link jumps past repeated chrome to the main content.

SCOPE: `apps/web/components/coach/` and `apps/web/components/notes/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/CoachChat.tsx` (audit and fix the composer and message actions' `tabIndex`/focus order; ensure focus returns after an action), `apps/web/components/notes/PageEditorView.tsx` (add a skip link and ensure the page actions are keyboard-operable), `apps/web/components/coach/keyboard-nav.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `CoachChat.tsx`, `PageEditorView.tsx` and their dependents; adjust the plan to the current code.
2. Walk the coach chat with Tab alone: composer, send, message actions, web-search toggle, and voice controls must all be reachable in DOM order; remove any `tabIndex={-1}` that hides a real control and any `outline: none` without a replacement.
3. Add a skip link ("Skip to main content") as the first focusable element on the note page and coach page, targeting the main landmark; ensure the focus ring uses the design token (never a bare `outline: none`).
4. Add `keyboard-nav.test.tsx` (Vitest + Testing Library): Tab order on the composer reaches send; the skip link is first and moves focus to `<main>`; no interactive element has an `outline: none` without a visible replacement class.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `keyboard-nav.test.tsx`; a Playwright run tabs through the coach and note page and asserts each control is focusable with a visible ring.

EVIDENCE: test output; screenshot of the visible focus ring on the composer and note page.

DO NOT:
- don't change `convex/` (no backend change is needed)
- don't change drag behaviour itself — a button alternative is only required where a drag already has one pending (report otherwise)
- don't add a third-party focus library
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, the focus order you verified, anything not reachable by keyboard and why.

Standard: **WCAG 2.2 AA 2.4.7 Focus Visible** (every keyboard-operable control shows a visible focus indicator). https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html · **WCAG 2.2 AA 2.1.1 Keyboard**. https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html

Visible strings (keys):
- `a11y.skipLink` EN "Skip to main content" / HE "דלג לתוכן הראשי"

---

## TEMPO-BL-0051 — Accessibility: screen-reader labels and live region for the coach

```yaml
---
ticket: TEMPO-BL-0051
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/components/coach/
depends_on: []
contract:
  - "No new backend functions."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people who use a screen reader, so the coach chat announces its controls, streamed replies and errors correctly.

WHEN: first in the backlog; independent.

WHY: docs/HARD_RULES.md §8 "Screen-reader labels on every interactive element" and "Error text is programmatically associated with its field (`aria-describedby`)"; docs/TRD.md §5a step 3 "The reply streams back as text deltas". Today the coach's streaming reply and icon-only controls are not announced through a live region, and icon buttons may lack accessible names.

GOAL: every coach control has an accessible name, streaming reply text is announced through a polite `aria-live` region, and errors are associated with the control that raised them via `aria-describedby`.

SCOPE: `apps/web/components/coach/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/components/coach/CoachChat.tsx` (add `aria-label`/`aria-labelledby` to icon-only buttons, wrap the streaming reply in a polite `aria-live` region, associate inline errors with `aria-describedby`), `apps/web/components/coach/CoachPanel.tsx` (accessible name for the panel and its toggles), `apps/web/components/coach/screen-reader.test.tsx` (new).

STEPS:
1. Query the Graphify graph for `CoachChat.tsx`, `CoachPanel.tsx` and their dependents; adjust the plan to the current code.
2. In `CoachChat.tsx`, give every icon-only button an `aria-label` (or `aria-labelledby` to an existing key), mark the streaming reply container `aria-live="polite"` and `aria-atomic="false"`, and point each inline error's `aria-describedby` at its field.
3. In `CoachPanel.tsx`, add an accessible name to the panel region and its toggle controls.
4. Add `screen-reader.test.tsx` (Vitest + Testing Library): the send button has an accessible name; the reply container has `aria-live="polite"`; an error on the composer is associated by `aria-describedby`.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `screen-reader.test.tsx`; a Playwright run with `axe` (or the repo's existing a11y check, if any) reports no unlabeled coach controls.

EVIDENCE: test output; screenshot/axe output of the coach controls.

DO NOT:
- don't change `convex/` (no backend change is needed)
- don't make the live region `aria-live="assertive"` for normal replies (polite only; errors may be assertive)
- don't change copy tone (warm, direct, never shaming — HARD_RULES tone)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: what changed, the accessible names added, anything without a programmatic label and why.

Standard: **WAI-ARIA 1.2** `aria-live` / `aria-describedby` for live and error announcements. https://www.w3.org/TR/wai-aria-1.2/ · **WCAG 2.2 AA 4.1.2 Name, Role, Value**. https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html

Visible strings (keys; labels only, reusing the existing copy):
- `coach.liveRegion` EN "Coach is replying" / HE "המאמן עונה"
- `coach.sendLabel` EN "Send message" / HE "שליחת הודעה"

---

## TEMPO-BL-0052 — Accessibility: text contrast (4.5:1) and reduced-motion sweep

```yaml
---
ticket: TEMPO-BL-0052
batch: BL
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/app/globals.css
  - packages/ui/
depends_on: []
contract:
  - "No new backend functions."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: everyone who reads Tempo, so small text meets WCAG AA contrast and motion respects `prefers-reduced-motion`.

WHEN: first in the backlog; independent.

WHY: docs/HARD_RULES.md §7.1 "WCAG AA contrast minimum. AAA where reasonably achievable" and §7.4 "Default to `prefers-reduced-motion` respected"; docs/UI-BRIEF.md §6 "Reduced motion respected … Colour is never the only signal" and §6 "Contrast: not measured against WCAG AA: UNKNOWN. `dust-grey-soft` on cream and white on `tempo-orange` look too light for small text". Today the tokens are not measured and several interactions animate without a reduced-motion gate.

GOAL: the "Soft Editorial" tokens that fail 4.5:1 for small text are adjusted to AA in `globals.css`/`packages/ui`, and the animated interactions are wrapped in a `prefers-reduced-motion: reduce` gate that disables non-essential motion.

SCOPE: `apps/web/app/globals.css` and `packages/ui/`. Size: 2 files plus 1 test.

MUTATES: `apps/web/app/globals.css` (adjust the failing token values to AA; add the `@media (prefers-reduced-motion: reduce)` gate for the existing transitions/animations), `packages/ui/` token source (mirror the adjusted tokens and the reduced-motion rule), `apps/web/app/globals.test.ts` (new, token contrast assertion).

STEPS:
1. Query the Graphify graph for `globals.css`, the `packages/ui` token source, and their dependents; adjust the plan to the current code.
2. Measure each foreground/background pair (small text vs large text) with a contrast script; list the pairs below 4.5:1 (report the measured ratios). Adjust only the failing pairs in `globals.css` and the `packages/ui` token source; never change a value that already meets AA.
3. Add a `@media (prefers-reduced-motion: reduce)` rule that sets `animation-duration`/`transition-duration` to near-zero for the non-essential motion and disables auto-playing animations; keep state changes (a loading state, a tick) functional.
4. Add `globals.test.ts`: parse the token CSS variables and assert the adjusted small-text pairs compute ≥ 4.5:1 (recompute with a small contrast function, not by eye).
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes `globals.test.ts` with the adjusted pairs ≥ 4.5:1; a Playwright run with `emulate: { reducedMotion: 'reduce' }` shows the animated controls without motion.

EVIDENCE: test output; the measured before/after ratios for each adjusted pair.

DO NOT:
- don't change colour in a way that loses brand meaning — pair any colour change with an icon or label (HARD_RULES §7.1 "never encode meaning in color alone")
- don't change `convex/`, components, or route files (tokens only)
- don't introduce arbitrary hex — add a token in the shared source first (HARD_RULES §7.3)
- don't disable motion that conveys state (a spinner may stay; a fly-in animation is gated)
- don't request a Bugbot review; open the PR as a DRAFT

REPORT: the measured failing pairs and their new ratios, the reduced-motion rule added, any pair you could not measure and why.

Standard: **WCAG 2.2 AA 1.4.3 contrast 4.5:1** for normal text (3:1 for large text). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · **WCAG 2.2 AA 2.3.3 Animation from Interactions** (motion can be disabled). https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

No new visible strings (token and motion rules only).

---

## TEMPO-BL-0053 — Mobile: Hebrew RTL note page with mixed-direction markdown

```yaml
---
ticket: TEMPO-BL-0053
batch: BL
type: component
lane: cursor
browser_test: false
scope:
  - apps/mobile/app/(tempo)/page/
  - apps/mobile/lib/v3/
depends_on: []
contract:
  - "No new backend functions. Reuses @/components/v3/prefs usePrefs (lang, rtl, row) and @/lib/rtl."
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: people reading a note in the phone app in Hebrew, so the page lays out right-to-left and mixed Hebrew/English lines each read in their own direction.

WHEN: first in the backlog; independent (the mobile RTL primitives already exist: `apps/mobile/lib/rtl.ts`, `apps/mobile/lib/rtlBootstrap.ts`, `prefs.tsx` exposes `lang`, `rtl`, `row`).

WHY: docs/PRD.md §4.7 F-72 "Mixed Hebrew and English inside one note renders each paragraph in its own direction"; docs/PRD.md §4.11 F-121 "One-to-one Expo native shell"; docs/HARD_RULES.md §8 accessibility (mobile included). Today the mobile note page `apps/mobile/app/(tempo)/page/[id].tsx` renders markdown via `apps/mobile/lib/v3/markdown.ts` but does not apply per-paragraph direction for mixed text.

GOAL: the mobile note page applies `dir`/`textAlign` from `prefs.rtl` and renders each markdown paragraph with its own direction so a mixed "שלום English 123" line keeps Hebrew RTL and the number/English LTR.

SCOPE: `apps/mobile/app/(tempo)/page/` and `apps/mobile/lib/v3/`. Size: 2 files plus 1 test.

MUTATES: `apps/mobile/app/(tempo)/page/[id].tsx` (apply `rtl`/`row` from `usePrefs` to the page container and paragraph wrapper), `apps/mobile/lib/v3/markdown.ts` (wrap each paragraph in a component with its own `writingDirection` and keep numbers/code LTR via the existing `.tp-num`/`.tp-mono` classes or a native equivalent), `apps/mobile/lib/v3/markdown.test.ts` (new or extended).

STEPS:
1. Query the Graphify graph for `apps/mobile/app/(tempo)/page/[id].tsx`, `apps/mobile/lib/v3/markdown.ts`, `apps/mobile/lib/rtl.ts` and their dependents; adjust the plan to the current code.
2. In `markdown.ts`, render each paragraph with a per-paragraph `writingDirection: "auto"` and wrap numeral/code runs in the existing token classes (or `style` with the LTR text direction) so they stay left-to-right inside Hebrew.
3. In `page/[id].tsx`, read `usePrefs()` and set the page container's `writingDirection`/`flexDirection` from `p.rtl`/`p.row`.
4. Add/extend `markdown.test.ts` (React Native Testing Library): a mixed `"שלום English 123"` paragraph gets `writingDirection: "auto"`; the numeral run stays LTR; a pure-English paragraph keeps LTR ordering.
5. `bun run lint && bun run typecheck && bun run test` (Bun only; do not run `eas build`).

DONE: `bun run test` passes the mobile markdown test; the page container reads `rtl` from `usePrefs` and the mixed paragraph renders `writingDirection: "auto"`.

EVIDENCE: test output.

DO NOT:
- don't change `convex/` (no backend change is needed)
- don't run `eas build` or `eas login` (those are `human-amit` / `twin` actions; docs/MOBILE_EAS.md)
- don't change the mobile auth or tab layout (out of scope)
- don't machine-invent new Hebrew copy — reuse `@/components/v3` strings via `useT`
- don't render raw JSON anywhere (PRD §6)

REPORT: what changed, the paragraph direction rule used, any native markdown node that could not take `writingDirection` and why.

Standard: **Unicode UAX #9** bidirectional algorithm (basis of `writingDirection: "auto"`). https://www.unicode.org/reports/tr9/ · **WCAG 2.2 AA 1.4.3 4.5:1** contrast for the note text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

No new visible strings (direction and existing copy via `useT`).

---

## TEMPO-BL-0054 — Voice first-audio latency: record and budget (≤ 300 ms)

```yaml
---
ticket: TEMPO-BL-0054
batch: BL
type: data
lane: claude
browser_test: false
scope:
  - convex/voice.ts
  - convex/lib/voicePolicy.ts
depends_on: []
contract:
  - "api.voice.recordFirstAudio(args: { sessionId: Id<'voiceSessions'>, ms: number }) -> null  (internalMutation)"
overlap_test: false
expected_merge: clean
hold: false
---
```

Pass: 1
Depends: none

FOR: the voice pipeline, so every live-voice turn records its time-to-first-audio against the ≤ 300 ms target instead of leaving latency UNKNOWN.

WHEN: first in the backlog; independent.

WHY: the product target is voice-to-voice first audio ≤ 300 ms (29 Oct decision); docs/TRD.md §5a "first-audio latency is UNKNOWN until measured". Today `convex/voice.ts` counts sentences and characters but records no latency, so the budget cannot be checked.

GOAL: `api.voice.recordFirstAudio` records the client-measured first-audio milliseconds on the active lease (a number, capped, no audio content), and `voicePolicy.ts` carries the `FIRST_AUDIO_BUDGET_MS = 300` constant plus a helper that flags a turn above budget, so CI can assert the budget value and the metric is available for a dashboard.

SCOPE: `convex/voice.ts`, `convex/lib/voicePolicy.ts`, `convex/voice.test.ts` (extend). Size: 2 files plus 1 test.

MUTATES: `convex/voice.ts` (add `recordFirstAudio` internalMutation; store `firstAudioMs` on the lease), `convex/lib/voicePolicy.ts` (add `FIRST_AUDIO_BUDGET_MS = 300` and a pure `firstAudioWithinBudget(ms)`), `convex/voice.test.ts` (new cases).

STEPS:
1. Query the Graphify graph for `convex/voice.ts`, `convex/lib/voicePolicy.ts` and their dependents; adjust the plan to the current code.
2. In `convex/lib/voicePolicy.ts`, add `FIRST_AUDIO_BUDGET_MS = 300` and `firstAudioWithinBudget(ms: number): boolean` (`ms <= FIRST_AUDIO_BUDGET_MS`); document that the value is the 29 Oct product target, not an industry standard.
3. In `convex/voice.ts`, add `recordFirstAudio(sessionId, ms)`: require the caller, find their active lease, reject `ms` outside `[0, 60_000]`, and `patch` the lease with `firstAudioMs = ms`; never store audio, transcript or provider body.
4. Extend `convex/voice.test.ts`: `firstAudioWithinBudget(299)` is true and `(301)` is false; `recordFirstAudio` stores a value on the caller's active lease; an out-of-range `ms` is rejected; a foreign session is rejected.
5. `bun run lint && bun run typecheck && bun run test`.

DONE: `bun run test` passes the extended `convex/voice.test.ts`; `api.voice.recordFirstAudio` exists in `convex/_generated/api.d.ts` with the shape above.

EVIDENCE: test output; the `convex/_generated/api.d.ts` line for `recordFirstAudio`.

DO NOT:
- don't change the coach `speak`/`grant` behaviour or the minute caps
- don't store or log any audio, transcript, token or provider body (TRD §7 rule 2)
- don't assert the budget on a timer that blocks speech — recording is observational
- don't print a secret
- don't deploy; never touch the live Convex deployment

REPORT: contract name created, the budget value and its source, anything that couldn't match the contract and why.

Standard: **voice-to-voice first audio ≤ 300 ms** is the 29 Oct product target (not an industry standard; the measured p95 is UNKNOWN until data arrives). https://developers.deepgram.com/docs/measuring-streaming-latency

No new visible strings (server-side only).

---

## Self-check (detailed-enough) log

For each ticket, the questions a builder would ask, and where each is answered (fixed) or left `UNKNOWN` (with who answers).

**TEMPO-BL-0044 (notes RTL)**
- Per-paragraph or whole-page direction? → fixed (per-paragraph `dir="auto"`, per TRD §5b).
- What keeps numbers/code LTR? → fixed (`.tp-num` / `.tp-mono`, already defined).
- Does the editor surface flip? → fixed (`dir={dirFor(lang)}` on the editor and SlashMenu).
- Which block types can't take `dir="auto"`? → UNKNOWN — the implementer reports any that can't.

**TEMPO-BL-0045 (calendar RTL)**
- Hebrew month/weekday names from where? → fixed (`Intl.DateTimeFormat("he", …)`).
- Which numerals? → fixed (western-Arabic, matching `.tp-num`).
- Does the day grid reorder? → fixed (grid container `dir="rtl"`).

**TEMPO-BL-0046 (note TTS backend)**
- Crisis notes? → fixed (never sent to TTS; `isCrisisText` guard).
- Shared char cap? → fixed (reuses `dailyTtsCharsPerUser`).
- Actual first-audio latency? → UNKNOWN — measured at implementation; sentence-at-a-time TTS.

**TEMPO-BL-0047 (note read-aloud UI)**
- Auto-play? → fixed (never; user action starts it).
- What if backend missing? → fixed (`blocked: missing backend <readAloud>`).

**TEMPO-BL-0048 (dictation backend)**
- Hebrew lane on? → fixed (fails closed until issue #1252 lands).
- Token lifetime? → fixed (30 s, TRD §5a).
- Does Nova-3 `he` return interim results in the sandbox? → UNKNOWN — verify at implementation.

**TEMPO-BL-0049 (dictation UI)**
- Where does the transcript go? → fixed (insert at caret, existing editor insert path).
- Token/transcript persistence? → fixed (in-memory only).

**TEMPO-BL-0050 (keyboard/focus)**
- Skip link target? → fixed (first focusable, targets `<main>`).
- Drag alternative needed? → UNKNOWN — report if a drag exists without a button alternative.

**TEMPO-BL-0051 (screen-reader)**
- Live region politeness? → fixed (`aria-live="polite"` for replies).
- Any unlabeled icon? → UNKNOWN — reported if one can't be labeled.

**TEMPO-BL-0052 (contrast/reduced motion)**
- Which pairs fail? → UNKNOWN — measured first, reported before/after.
- Motion that conveys state? → fixed (state changes stay functional; fly-ins gated).

**TEMPO-BL-0053 (mobile RTL)**
- Native node that can't take `writingDirection`? → UNKNOWN — reported.
- Build verification? → fixed (Bun only; `eas build` is out of scope).

**TEMPO-BL-0054 (first-audio latency)**
- Budget source? → fixed (29 Oct product target, not a standard).
- Where is `ms` measured? → UNKNOWN — client-side in `useVoiceCall.ts` (a follow-up for cursor); this ticket stores and budgets it.

---

## Inputs I could not find / reconcile

1. **`gh issue list` could not run** — `gh` has no auth and `GH_TOKEN`/`GITHUB_TOKEN` are unset. I read open issues with the Reason `issues_search` tool instead: 30 open issues (#1252–#1336). None of these 11 tickets duplicates them. In particular #1252 ("Add sourced Hebrew crisis keywords behind a disabled flag") owns the Hebrew-lane unblock, so TEMPO-BL-0048 and TEMPO-BL-0049 fail closed for `he` and name #1252 rather than duplicating it; #1253 and #1278 own the live-voice bridge, so TEMPO-BL-0054 only records latency and does not rewire the bridge.
2. **`AGENTS.md §8.1`** is not a literal section (AGENTS.md is 133 lines). The front-matter fields used here come from `docs/tickets/_templates/*.md` and `BACKLOG-PILOT.md`.
3. **`include.md`** was not found in the repo; I applied the described "detailed enough" method directly (list builder questions → fix or mark UNKNOWN), as the pilot did.
4. **Tier names.** The 29 Oct decisions name `$20` / `$50` plans; the code and HARD_RULES §9 still use `basic`/`pro`/`max`. These tickets reference the code's tier names (`basic`/`pro`/`max`) and leave the plan-name mapping to the billing tickets (whose wording is governed by the `Depends: #1335` rule), so no ticket here asserts a price.
5. **Hebrew copy** is machine-drafted in the repo and needs native review (the repo itself notes this).
