# Tempo Flow: Convex to InsForge migration plan

Dated 2026-11-25. Written by the Opus orchestrator (SwarmPane InsForge lane). Read-only study of `Levidavidspublic/tempo-rhythm`, branch `integration` (default branch; there is no `main`).

## Verdict

Doable, and most of the hard thinking is already done. The repo has a full Convex-to-Firebase plan (`docs/backlog/FIREBASE-MIGRATION-PLAN.md`, 20 Nov) with a switch, a hook seam, and an owner/private data split. InsForge slots into the same pattern: swap "Firestore" for "InsForge Postgres + RLS". About 17 step-A hooks already exist under `apps/web/lib/data/` and are reused as they are.

Status of the three blockers found on 25 Nov:
1. **Amit's decision: made.** Amit, 2026-11-25 13:56, answering "Should Tempo's backend move to InsForge, with the Firebase move stopped?": "Yes, and InsForge also once it's merged should replace Vercel because it's one subscription to rule them all." So: backend = InsForge, the Firebase move stops, and hosting moves from Vercel to InsForge deployments after the migration merges (Stage 7).
2. **Repo rules still say Firebase.** `AGENTS.md` (Layout, rule 4), `factory/SLOTS.md` (Backend row) and `docs/HARD_RULES.md` §2 change in one `config` PR (IF-001). Amit applies the approval label.
3. **Code model.** Repo `AGENTS.md` rule 10 (Amit, 2026-11-24): Opus, Soul, Sol, Grok or Gemini Neon. Amit, 2026-11-25: workhorse models are Opus, Sol, Grok 4.7. Code workers use Sol (Codex subscription) or Grok 4.7. Sonnet is not used for code in this repo.

## What exists today (measured 25 Nov, integration HEAD)

| Thing | Number / state |
|---|---|
| Convex tables | 36 + Convex Auth tables |
| Convex functions | 62 queries, 90 mutations, 11 actions, 5 HTTP actions, 49 internal (from the Firebase plan, 20 Nov) |
| Files outside `convex/` calling Convex | 119 (97 web, 22 mobile). List: `docs/backlog/CONVEX-CALL-SITES.md` |
| Convex extras | Convex Auth (Resend magic link), 1 cron (page payload cleanup every 5 min), HTTP routes (RevenueCat webhook, `/mcp`, Executor callback), `@convex-dev/agent`, scheduler in 2 files (`pageCleanup.ts`, `connections.ts`), 1 vector index on `memories`. No file storage. |
| Switch | `apps/web/lib/backend-flag.ts`: `convex` (default) or `firebase`. Only used by `app/layout.tsx` (`data-backend` attribute). |
| Step-A hooks (seam) | `apps/web/lib/data/tasks/*` (9 hooks) and `apps/web/lib/data/notes/*` (3 hooks), each `makeUseX(useQueryImpl)` + test. Reusable for InsForge as is. |
| Firebase helpers | 117 modules under `apps/web/lib/firestore*`, `lib/server/`. Used only by `/api/waitlist` and `/api/whop/webhook`. `firebase` is in `apps/web/package.json`. |
| Payments | Whop webhook at `apps/web/app/api/whop/webhook/route.ts` (writes Firestore today). RevenueCat webhook in `convex/http.ts`. |
| AI | Mistral via native `fetch` (`convex/lib/ai_router.ts`). HARD_RULES §2 forbids vendor AI SDKs. |

## InsForge side (checked 25 Nov from the CLI and the official skills)

| | Value |
|---|---|
| Project | `insforge-app`, eu-central, free plan, active. CLI signed in as Division6066 inside the `swarmpane` container only. |
| Free plan | Projects pause after 1 week with no activity (24 Nov note). Restore: `insforge projects restore`. |
| Database | Postgres via PostgREST. Schema changes only through `db migrations new/up` files in `migrations/` (`<version>_<lowercase-hyphen-name>.sql`, no BEGIN/COMMIT). App objects in `public` only; may reference `auth.users(id)` and `auth.uid()`. |
| Auth | Email + password, email OTP (6-digit code, 5 min), OAuth (PKCE). Auth emails built in on every plan. A magic-LINK passwordless sign-in method in the SDK: UNKNOWN (docs show OTP). Profile/gate rows via a trigger on `auth.users`. |
| Realtime | Pub/sub channels. Rows are published from Postgres triggers with `realtime.publish(channel, event, payload)`. Channel access via RLS on `realtime.channels`. Not live queries like Convex. |
| Edge functions | `functions deploy <slug>` (Deno). |
| Schedules | `schedules create --cron ... --url ... --method ...` calls a URL (5-field cron or `30 seconds`). |
| Vector | `vector` extension, HNSW/IVFFlat, RPC similarity search. |
| Storage | Buckets + RLS. Tempo stores no files today. |
| AI gateway | OpenRouter only. Amit's rule: no OpenRouter (Jev is the only exception). So Tempo does NOT use InsForge AI. Mistral stays on native fetch. |
| Payments | Stripe and Razorpay only. Whop is not supported. Whop stays a webhook we own. |
| Branches | Exist, but each branch is a paid compute instance ("not free"). Not used. The free `insforge-app` project is the dev/preview database. |
| Keys | API key (server admin): 1Password dev vault item `ansforge.dev api`, field `credential` (added by Amit 25 Nov; name kept exactly as stored). Anon key (client, public by design): no vault item yet, UNKNOWN; read it only through the vault, never with a command that prints it. |

## Convex to InsForge mapping

| Convex | InsForge |
|---|---|
| table with `userId` (owner data) | `public.<snake_case>` table, `user_id uuid references auth.users(id)`, RLS: `user_id = auth.uid() and public.account_is_active()` |
| private tables (secrets, billing, leases, audit) | `public.<table>` with RLS ON and NO policy for `authenticated` = clients can't touch it. Server code uses the admin API key. Same split as `FIREBASE-DATA-MODEL.md` "Private collections". |
| `users` authorization fields | `public.account_gate` (one row per user, created by a trigger on `auth.users`, defaults copied from `convex/auth.ts`: `approval_status = 'pending'`). Client can't write it. |
| `users` editable fields (`name`, `fullName`, `onboardedAt`) | `public.profiles` (owner-editable) |
| `v.id("x")` | `uuid primary key default gen_random_uuid()`, plus `legacy_convex_id text unique` for the one-time import (safe to re-run) |
| `v.number()` epoch ms (`createdAt`, `dueAt`, `deletedAt`...) | `bigint` epoch ms. EXTRAPOLATED: keeps the hooks' return shape identical to Convex, so screens don't change. Open question 3. |
| `v.optional(v.any())`, small arrays of objects (`timeSpentOnDay`, `checklist`) | `jsonb` (small, read whole). Big repeated objects become child tables (InsForge docs warn on large JSONB). |
| `v.union(v.literal(...))` | `text` + `check (col in (...))` |
| Convex index `by_userId_deletedAt...` | Postgres index on `(user_id, deleted_at, ...)` |
| soft delete `deletedAt` | `deleted_at bigint null` (HARD_RULES §9 unchanged) |
| query (owner data, live) | hook: SDK `select` + subscribe to channel `tasks:<uid>`; refetch on event. One shared `useLiveRows` hook. |
| mutation (owner data) | SDK `insert/update` under RLS, in the hook's InsForge half |
| action / internal / anything touching private tables | Vercel route `POST /api/op/<name>` (same as the Firebase plan) using the InsForge admin client server-side. EXTRAPOLATED: Vercel routes, not InsForge edge functions, so existing route tests and the keyless pattern stay. |
| multi-row atomic writes (page ledger) | Postgres function (`security definer`, checks `auth.uid()`), called with `db rpc` / SDK `rpc` |
| Convex Auth (Resend magic link) + approval gate | InsForge email OTP sign-in + `account_gate` trigger. Approval check in `account_is_active()` (deleted/inactive) and in ops that spend money (`approval_status = 'approved'`). |
| cron (`pageCleanup.runBatch` every 5 min) | InsForge schedule `*/5 * * * *` calling `POST /api/op/page-cleanup` with a secret header. GAP: the schedule's auth header needs a secret stored in InsForge secrets (Amit adds it, AT). |
| `ctx.scheduler.runAfter` (2 files) | Same op called by a schedule, or a `pending_jobs` table drained by the cron op. Per-case decision in Stage 4. |
| `@convex-dev/agent` (coach threads) | Own `conversations` / `messages` tables (already in schema) + coach ops. Component dropped. |
| vector index on `memories` | `vector` column + HNSW index + `match_memories` RPC. Embeddings from Mistral via native fetch (not InsForge AI = OpenRouter). |
| HTTP routes `/mcp`, Executor callback | Already partly in `apps/web/app/api/mcp`. Move fully to Vercel route handlers (rails). |
| RevenueCat webhook (Convex HTTP) | Vercel route writing `account_gate.user_type` via admin client |
| Whop webhook (Vercel route, writes Firestore) | Same route, writes `public.whop_membership_events` (private table) via admin client. InsForge payments are not used. |
| Mobile (Expo, 22 files) | `@insforge/sdk` in React Native: UNKNOWN. Check before Stage 6. |

## Risks

1. **Realtime is not reactive queries.** Convex pushes fresh query results; InsForge pushes events you publish from triggers. Every live screen needs a trigger + channel + refetch. Mitigation: one `useLiveRows` hook and one trigger function reused by every owner table.
2. **RLS bugs are silent.** A wrong policy leaks or locks data. Mitigation: every migration ships SQL policy tests run against the dev project with two test users; private tables have no client policy at all.
3. **Free plan pauses after 1 week idle.** Preview breaks silently. Mitigation: a weekly health ping (schedule or GitHub Action hitting `/api/health`), or Pro when there are real users (AT, spend).
4. **HARD_RULES conflict.** Postgres stack resembles the forbidden Supabase row; `pg` client is forbidden. Mitigation: use `@insforge/sdk` (PostgREST over fetch), never `pg`; record the decision in HARD_RULES §2.
5. **Two half-done migrations.** Firebase helpers (117 modules) become orphans. Mitigation: freeze Firebase work now; archive (never delete) in the final stage.
6. **Auth change logs people out.** Convex Auth sessions don't carry over. Accounts matched by email at import; people sign in once with an OTP code.
7. **Whop and RevenueCat** stay outside InsForge payments. Webhook signature checks stay in our code.
8. **Vendor lock and pricing.** InsForge is Apache-2.0 and can self-host (MCP works self-hosted; CLI + Skills are cloud-only).
9. **Adult-content terms** do not affect Tempo (that question is for OmniAgent).
10. **Keys.** Anon key is public by design but still goes in through Vercel env; API key is server-only, AWAY class, never in files or command lines.

## Phased tickets

Lanes as in the repo: **K** = kitchen (component, max 3 files + 1 test, no hot files). **R** = rail (hot/guarded files; one `config` PR). **AT** = Amit.
Code model: the week's workhorse pick (Grok, Soul, Sol or Gemini Neon). Never Fable. Opus only as orchestrator.

### Stage 0: decisions and rails
| ID | Lane | What exists after it | Needs |
|---|---|---|---|
| IF-000 | AT | DONE 2026-11-25: Amit said yes (backend = InsForge, Firebase move stopped, Vercel replaced by InsForge after the merge). Still open: whether Tempo is paused meanwhile. | none |
| IF-001 | R | `docs/backlog/INSFORGE-MIGRATION-PLAN.md` (this plan) on integration. `AGENTS.md` Layout + rule 4, `factory/SLOTS.md` Backend row, `docs/HARD_RULES.md` §2 name InsForge. `FIREBASE-MIGRATION-PLAN.md` gets a "superseded 2026-11-25" header (file kept). | IF-000 |
| IF-002 | R | `@insforge/sdk` in `apps/web/package.json` + `bun.lock`. `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY` in `apps/web/.env.example` (names only). | IF-001 |
| IF-003 | K | `backend-flag.ts` accepts `insforge` (exact, trimmed). Test updated. | none (done in Phase 2 PR if merged) |
| IF-004 | K | `insforge/migrations/<v>_tempo-identity-and-tasks.sql`: `account_gate`, `profiles`, `subscription_states` (private), trigger on `auth.users`, `account_is_active()`, `tasks`, `task_repeat_cfgs`, RLS, indexes. Applied to `insforge-app`. | IF-000 for the repo copy; applying to the free dev project is WALK |
| IF-005 | K | `apps/web/lib/insforge/client.ts`: one lazy client from the two public env names; `null` when missing. | IF-002 |
| IF-006 | K | `lib/session/use-session.ts` supports `insforge` (loading / signedOut / signedIn + uid + email). | IF-005 |
| IF-007 | K | Providers mount the InsForge session provider when the switch is `insforge`. | IF-006 |
| IF-008 | K | `SignInForm` sends an email OTP when the switch is `insforge`; `/sign-in/verify` checks the code. | IF-005 |
| IF-009 | K | Realtime migration: `public.publish_owner_change()` trigger function + channel pattern `<table>:%` + RLS on `realtime.channels` (own uid only); attached to `tasks`. | IF-004 |
| IF-010 | K | `lib/insforge/use-live-rows.ts`: select + subscribe + refetch; returns `undefined` while loading (same as Convex `useQuery`). | IF-005, IF-009 |
| IF-011 | K | E2E mode (`NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS=1`): in-browser store with the same contract, so Playwright needs no real project. | IF-010 |
| IF-012 | R | CI runs Playwright with switch `convex` and switch `insforge`. | IF-011 + one ported screen |

### Stage 1: Tasks (web)
Step A hooks already exist (`apps/web/lib/data/tasks/`). Each ticket adds the InsForge half to ONE hook file and picks at module level: `export const useX = DATA_BACKEND === "insforge" ? useXInsforge : useXConvex;`. Same return shape. Test against the IF-011 store.
IF-101 `use-task-list` (step A missing: create it first, like FB-101a), IF-102 `use-create-quick-task`, IF-103 `use-toggle-task`, IF-104 `use-done-tasks-in-range`, IF-105 `use-create-task`, IF-106 `use-update-task`, IF-107 `use-remove-task`, IF-108 `use-restore-task`, IF-109 `use-rename-project`, IF-110 repeat configs (`createRepeatCfg`, `setTaskRepeatCfg`).

### Stage 2: Notes and pages
Migration for `notes`, `note_blocks`, `page_operations`, `page_operation_payloads` (private), `page_proposals`, `templates`. Page-ledger writes that must be atomic become Postgres functions. Then step A / InsForge half per hook (the 3 notes hooks exist).

### Stage 3: Day
Migration for `habits`, `habit_check_ins`, `goals`, `day_plans`, `time_blocks`, `focus_blocks`, `calendar_events`; then hooks.

### Stage 4: Coach, profile, voice, connections, server
- Coach tables + ops (reply, web search, memory import, crisis check, AI router). `memories` gets `vector` + HNSW + `match_memories` RPC. Embedding model + dimension: open question.
- Profile/preferences/notifications client-side; approval, admin approvals, deletion/restore, entitlements as ops.
- Voice leases (private table) as ops.
- Connections + MCP + Executor callback as route handlers (rails).
- R: `POST /api/op/[name]` route + registry (same contract as FB-010, but verifies the InsForge access token).
- R: Whop webhook writes `whop_membership_events` via admin client. RevenueCat webhook route.
- R: page cleanup op + InsForge schedule every 5 min (AT: schedule secret).

### Stage 5: data, flip, archive
| ID | Lane | What |
|---|---|---|
| IF-501 | AWAY/R | `npx convex export` of preview and production (deploy keys from the dev vault, never printed). Row counts written down. Nothing changed on Convex. |
| IF-502 | K | Transform script: export in, per-table SQL/JSON out, every row validated, failures listed. |
| IF-503 | K | Import op: creates InsForge users by email, upserts rows by `legacy_convex_id` (idempotent, safe to re-run). Conflict rule (preview and production): an incoming import row never overwrites a stored row that has a newer row `updated_at`. Webhook-sourced subscription state is authoritative over imported subscription fields. Webhook/subscription ordering uses a subscription-specific watermark, never the user row's general `updated_at` (`users.updatedAt` is also written by profile and onboarding edits and by `updateUserType`). Imported watermark: for each imported `subscriptionStates` row, IF-503 writes a dedicated watermark equal to that row's own `updatedAt` (epoch ms). Source, verified in `convex/schema.ts` on integration: `subscriptionStates` has `userId`, `plan`, `billingCycle`, `status`, `trialUsed`, optional `source`, `createdAt`, and `updatedAt`. It has no event id, event timestamp, or version field. Verified writers of that table: `convex/auth.ts` `ensureGrantedSubscription` (insert or patch `GRANTED_SUBSCRIPTION`, `source: "open_signup_grant"`, timestamps `Date.now()`); `convex/lib/accountDeletion.ts` (patch `status: "inactive"`, `updatedAt` = now; does not change `source`). The RevenueCat webhook does not write `subscriptionStates`. Verified path: `convex/revenuecat.ts` calls `internal.users.updateSubscriptionStatus`, which patches only `users.userType` and `users.updatedAt` (`Date.now()`); `activeEntitlements` and `revenueCatEvent` are unused; the handler reads `event.type`, `event.app_user_id`, and `event.entitlement_ids`, and does not read an event id or event timestamp. Whether production payloads always include those fields is UNKNOWN until IF-503 inspects a real payload. `users.userType` is imported as the paid/free flag, not as the watermark. Because the webhook does not update `subscriptionStates`, imported `users.userType` and imported `subscriptionStates.plan`/`status` can disagree. For any such user, before replay, fetch current provider subscription state and write that state plus a watermark from the provider event timestamp or version when present; if the fetch fails, leave both imported values unchanged and retry — do not guess from `users.updatedAt`. If they agree, IF-503 still records a dedicated watermark equal to `subscriptionStates.updatedAt` for audit, but any comparison of an incoming event against that imported local write-time value is treated as ambiguous even when the numbers differ. Do not apply or reject the event from that comparison; fetch current provider state and write that state plus a provider-sourced watermark (event timestamp or version when present). After cutover, once a watermark has been set from a provider event timestamp or version, unambiguous events use that provider-sourced watermark. If an incoming event has no timestamp, use the provider-fetch path rather than applying the event blindly. `subscriptionStates.updatedAt` is a local write time, not a RevenueCat event timestamp. Missing watermark (no imported `subscriptionStates` row, or watermark column null): do not apply an incoming event by overwrite and do not compare it to `users.updatedAt`. Fetch current provider state and write it with a watermark from the provider. If the fetch fails, leave imported state unchanged and retry, so an older replay cannot overwrite newer imported state. Retries are distinguished by event ID and are applied at most once. Unambiguous events (different timestamps or versions): upsert subscription state only when the incoming watermark is newer; otherwise keep the stored subscription state. Distinct events with the same timestamp (different event IDs): do not silently discard one; reconcile by fetching the current subscription state from the provider and writing that state. That provider fetch is only for this ambiguous equal-timestamp case and for the missing-watermark / disagreed-import cases above, not the default path for unambiguous events. The reconciliation write must not replace subscription state that became newer after the fetch, including when that newer write left the same watermark. The fetch and the write for a given subscription are serialized together (one fetch-then-write in flight per subscription row). Every committed subscription-state write also increments a revision (a monotonic value that changes on every commit, even when the watermark is unchanged). The write is a compare-and-set on both the watermark and the revision observed at fetch start: it commits only if both still match (the watermark may also be absent or older than the fetched state's watermark, but the revision must still be the one observed). If another apply or reconcile committed in between, including a same-timestamp reconcile that wrote a different state with the same watermark, the stale write is rejected and the already-committed state is kept. This docs PR does not change the webhook handler; that work stays a later ticket. |
| IF-504 | R | Import into `insforge-app` (preview). Counts match. |
| IF-505 | R | Vercel Preview `NEXT_PUBLIC_DATA_BACKEND=insforge`; Playwright + alpha sweep green. Also prove the conflict rule in this preview, in seven cases, all prerequisites for IF-506: (1) after a webhook update has landed on a row, replay an older import row for the same `legacy_convex_id` and assert the webhook value is kept; (2) after a newer webhook event has been stored, replay an older webhook event for the same row (including a retry with the same event ID) and assert the newer state is kept; (3) two distinct events with the same timestamp (for example a purchase and a cancellation) are reconciled so the stored subscription state matches the provider, and the cancellation is not discarded; (4) a delayed subscription event arrives after an unrelated profile edit that advanced the user's general `updated_at`, and the subscription change is still applied; (5) after a newer webhook event has been stored, an equal-timestamp reconcile whose provider fetch still saw the older state does not replace the newer stored state (commit-time watermark compare-and-set); (6) a stored row has no watermark, or only a watermark imported from local `subscriptionStates.updatedAt`: an incoming event is reconciled from the provider (the comparison against that imported local timestamp is not used, even if the numbers differ), and the stored subscription state matches the provider; if the provider fetch is unavailable, imported state is left unchanged; (7) two reconciles observe the same watermark, the first commits, and the later stale write does not replace the first committed state (revision compare-and-set). |
| IF-505a | R/AT | Before IF-506: impose a Convex write-freeze, or run a final incremental export/sync after that freeze, then reconcile against the IF-501 baseline (and any later incremental batches). Convex writes made after the IF-501 export must not be lost. A row-count check alone is not enough: reconcile by `legacy_convex_id` (and equivalent keys) for inserts, updates and deletes in the window between IF-501 and the freeze. The freeze must also cover webhook writes (RevenueCat and any other provider webhook that writes Convex). A webhook event rejected during the freeze must not be acknowledged as delivered. Before IF-505a runs, choose one: (a) return a non-2xx status for a failed subscription/update write so the provider retries, and confirm before the freeze starts that the provider retry window covers the full freeze duration (from freeze start through the production import, the webhook endpoint switch, IF-505b drain/replay, and the IF-506 flip); or (b) store the event in a durable queue to be replayed by IF-505b after the endpoint switch. The current `convex/revenuecat.ts` 200-on-error behavior must not acknowledge freeze-rejected events. Changing that handler is a later ticket, not this docs PR. IF-505a is complete when the freeze is in place (or the final incremental sync is done) and reconciliation against the IF-501 baseline has succeeded. Drain/replay and freeze release are IF-505b, not this ticket. |
| IF-506 | AT | Production project (UNKNOWN: second InsForge project or Pro). Order: run the production import first (same IF-503 conflict rule), then switch provider webhook endpoints to the InsForge route, then flip production traffic. Amit's yes. Must not run until (1) IF-505a (write-freeze or final incremental sync plus reconciliation against the IF-501 baseline) has succeeded, (2) the IF-505 preview has proved all seven conflict cases (older import vs newer webhook; older or retried webhook vs newer stored webhook state; distinct same-timestamp events reconciled to provider state; delayed subscription event still applied after an unrelated profile edit; equal-timestamp reconcile cannot overwrite a newer event that committed after the fetch; a missing or imported-local-`subscriptionStates.updatedAt` watermark is reconciled so the stored state matches the provider; a stale same-watermark reconcile cannot replace already-committed state), and (3) Stage 6 (mobile app migrated) is done, so installed mobile clients are not still writing to Convex. The write-freeze stays in effect through the import and the endpoint switch; it ends only when IF-505b completes. |
| IF-505b | R/AT | Starts only after IF-506 has finished the production import and switched provider webhook endpoints to the InsForge route. Drain or replay events queued or in flight before that switch to the InsForge route; they must not be replayed to Convex after the flip. Retries and replayed events must land on the InsForge webhook route, not on the Convex `/api/revenuecat-webhook` (or equivalent). A replayed or late webhook event must not overwrite subscription state written by a newer event (same IF-503 conflict rule): compare the subscription-specific watermark, not the user row's general `updated_at`; treat same event ID as a retry; for distinct events with equal timestamps, fetch current provider state instead of discarding one event; the fetch and write are serialized together per subscription; the write is a compare-and-set on watermark and revision so a stale reconcile cannot replace committed state, including when the watermark is unchanged; a missing watermark, or a watermark imported from local `subscriptionStates.updatedAt`, is reconciled from the provider (that local timestamp is not used to apply or reject an event), or left unchanged if the fetch fails. Owner: R/AT (same as IF-505a). Completion check: every queued or in-flight provider event has been drained or replayed to the InsForge route (counts reconciled; none left on Convex), a late or older replay does not overwrite a newer stored event, same-timestamp distinct events are reconciled from the provider without a stale same-watermark write replacing already-committed state, a delayed subscription event is still applied after an unrelated profile edit, and a missing or imported-local watermark is reconciled so the stored state matches the provider (or imported state is kept if the fetch fails). The write-freeze ends when this ticket completes: production traffic, including provider webhooks, is on InsForge and Convex is no longer the source of truth for those writes. |
| IF-507 | R | After soak: Convex half of each hook, `convex/`, Convex packages/vars/workflows, and the unused Firebase helpers moved to an archive folder (never deleted). |
| IF-508 | R | AGENTS.md, CLAUDE.md, HARD_RULES, SLOTS, six docs name InsForge only. |

**IF-506 gates.** The production flip waits for all of the following. A green IF-505 preview is not enough.

1. **No lost writes after the IF-501 export.** IF-505a must complete a write-freeze or a final incremental sync, plus reconciliation against the IF-501 baseline, before IF-506 starts. Writes made on Convex after IF-501 and before the flip can otherwise be dropped while a count check still passes. Webhook writes are in scope: a freeze-rejected RevenueCat (or other provider) event must get a non-2xx retry or durable queue-and-replay; do not acknowledge it with a 200-on-error response. IF-505a's success means only that the freeze (or final incremental sync) and reconciliation have succeeded, not that queued events have been drained or that the freeze has been released.
   **Import first, then switch on webhooks.** The production import must finish before any provider webhook endpoint is moved to InsForge. After the import succeeds, IF-506 switches the RevenueCat (and other provider) endpoint to the InsForge webhook route. Then IF-505b (R/AT) starts: drain or replay events queued before the switch to InsForge, never back to Convex after the flip. A replayed or late webhook event must not overwrite subscription state written by a newer event; ordering uses the event timestamp or version (same IF-503 conflict rule). Under option (a), confirm the provider retry window covers the entire freeze, including the import, the switch, IF-505b, and the flip. The freeze ends when IF-505b completes: production traffic, including webhooks, is on InsForge, the drain/replay is done, and Convex is no longer the source of truth for those writes.
   **Conflict rule.** An incoming import row never overwrites a stored row that has a newer row `updated_at`. Webhook/subscription ordering uses a subscription-specific watermark, never the user row's general `updated_at`. The watermark written for an imported `subscriptionStates` row is that row's own `updatedAt` (legacy source: `convex/schema.ts`; no event id or event timestamp exists on that table). A stored row with no watermark, or with only a watermark imported from local `subscriptionStates.updatedAt`, is reconciled from the provider (that local timestamp is never used to apply or reject an event, even when the numbers differ), or left unchanged if the fetch fails. Retries are distinguished by event ID. Unambiguous events, once the watermark is provider-sourced, upsert only when the incoming subscription watermark is newer. Distinct events with the same timestamp are reconciled from the provider, not by silently discarding one. The fetch and write are serialized together per subscription, and the write is a compare-and-set on watermark and revision so a stale reconcile cannot replace committed state, including when the watermark is unchanged. Webhook-sourced subscription state is authoritative over imported subscription fields. IF-505 must already have proved all seven cases: older import vs newer webhook; older or retried webhook vs newer stored webhook state; two distinct same-timestamp events reconciled to the provider state; a delayed subscription event still applied after an unrelated profile edit; equal-timestamp reconcile cannot overwrite a newer event that committed after the fetch; a missing or imported-local-`subscriptionStates.updatedAt` watermark is reconciled so the stored state matches the provider; and a stale same-watermark reconcile cannot replace already-committed state.
2. **Stage 6 (mobile) is done.** IF-506 must not run until the mobile app has migrated (Stage 6 complete). Otherwise installed mobile clients can keep writing to Convex after the production flip. The preview web flip (IF-505) may happen before Stage 6; the production flip may not.

### Stage 6: mobile
22 files in `apps/mobile`, same pattern, after the web flip on preview (IF-505). RN support of `@insforge/sdk`: UNKNOWN.

Stage 6 must be complete before the production flip (IF-506). Do not start IF-506 while installed mobile clients could still write to Convex. If RN support of `@insforge/sdk` is a blocker, stop and report; do not flip production around it. Whether the mobile app is already released or in production use is UNKNOWN at the time of this plan. Until that is confirmed otherwise, treat it as in use: Stage 6 stays a hard prerequisite for IF-506. If later evidence shows it is not released and not in production use, document that evidence and get Amit's yes before any skip; the default is do not skip.

### Stage 7: hosting from Vercel to InsForge deployments (after the migration merges)
Amit, 2026-11-25: "InsForge also once it's merged should replace Vercel because it's one subscription to rule them all."

What InsForge deployments are (from the `insforge-cli` skill `references/deployments/deploy.md`, `domains.md`, and `insforge deployments --help`, checked 25 Nov):
- `insforge deployments deploy [dir]` zips the app source, uploads it, and InsForge builds and hosts it **on Vercel, run by InsForge** ("Deploy a frontend project to Vercel"). Supports static sites, SPAs and Next.js. So Vercel stays underneath; what changes is that the account, billing and env vars live in InsForge.
- Excluded from the upload: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`, `.env*`, `.insforge/`, `*.log`, plus anything in `.vercelignore`.
- Env vars: `deployments env list | set <key> <value> | delete <id>` (persist across deploys) or `--env '{...}'` per deploy.
- Other commands: `list`, `status <id>`, `cancel <id>`, `metadata` (current deployment + domain URLs), `slug [slug]` (custom subdomain slug).
- Custom domains: `insforge domains attach | dns sync | verify | status` through a connected Cloudflare account; buying a domain is a separate, non-refundable purchase (AT).
- Backend containers (if ever needed): `insforge compute deploy` (Docker on Fly.io). Not needed for Tempo.

| Vercel today | InsForge deployments | Status |
|---|---|---|
| Git push auto-deploys (preview per PR, production from `master`) | CLI upload (`deployments deploy`). Git integration / PR previews not documented. A GitHub Action can run the CLI for each PR head. | Plan (IF-703): one InsForge preview per PR head SHA, used by the required preview check. Whether the platform already offers preview-per-PR is UNKNOWN; if it cannot, that is a blocker — do not fall back to the shared integration URL. EXTRAPOLATED hosting split: one InsForge project = preview (`insforge-app`), a second project = production. |
| Projects `tempo-web`, `tempo-marketing` | One site per InsForge project (`deployments metadata`). Two sites may need two projects. | UNKNOWN |
| Env vars per environment | `deployments env` per project | works; but `env set <key> <value>` puts the value on the command line. Amit's rule forbids keys on command lines. UNKNOWN: a stdin or file-free way to set them. Until verified, Amit sets secret env vars himself (AT). Public names (`NEXT_PUBLIC_INSFORGE_URL`) are fine. |
| Next.js route handlers (`/api/op/*`, webhooks), `proxy.ts` middleware | Built on Vercel underneath, so expected to work | UNKNOWN until a test deploy proves it |
| Vercel Cron | Not used after Stage 4 (InsForge schedules replace it) | n/a |
| Vercel OIDC keyless Firestore access | Not needed after the Firebase move stops | n/a |
| `VERCEL_AUTOMATION_BYPASS_SECRET`, `e2e-preview.yml` against Vercel previews | Must point at that PR head's own InsForge preview URL. `wait-preview.mjs` uses the head URL, not the shared integration deployment. Required check names unchanged. | plan: IF-703; this config PR is docs only (no workflow file or check-name changes) |
| Domains on Vercel | `domains attach` via Cloudflare | DNS move is AT |
| Vercel Analytics / logs / runtime errors | `insforge logs`, PostHog integration (`insforge posthog`) | UNKNOWN parity |
| Free plan limits for deployments | not listed in the docs read | UNKNOWN; ask InsForge |

Tickets (all after Stage 5 flip and soak):
| ID | Lane | What |
|---|---|---|
| IF-701 | WALK/R | Test deploy of `apps/web` to the free `insforge-app` project with the switch on `insforge` and mock-free public env names; prove route handlers, `proxy.ts`, sign-in and one webhook work. Record the live URL. |
| IF-702 | AT | Amit sets the secret deploy env vars (`INSFORGE_API_KEY`, `WHOP_WEBHOOK_SECRET`, `TEMPO_CRON_SECRET`, `MISTRAL_API_KEY`, ...) in InsForge, until a no-command-line method is verified. |
| IF-703 | R | GitHub Action: on each pull request, deploy that PR's head SHA to its own InsForge preview (CLI auth as a GitHub secret, names only). The required preview check must use that head's preview URL, not the shared integration deployment. `wait-preview.mjs` is pointed at the head URL. `e2e-preview.yml` is planned to consume that same head URL. Required check names stay unchanged. This PR records the plan only; it does not change workflow files or check names. |
| IF-704 | AT | Production InsForge project (second free project or Pro), production env vars, domain attach + DNS (Cloudflare). |
| IF-705 | R | Release workflow: promote to production from `master` via the CLI; Vercel workflows (`deploy-live.yml`, release steps) archived, not deleted. |
| IF-706 | AT | After a soak: Amit cancels or downgrades Vercel (plan change). |

Risks: InsForge hosting is Vercel underneath, so Vercel's own content rules still apply indirectly (not an issue for Tempo); less control over build settings; preview-per-PR support on InsForge is UNKNOWN and is a blocker for IF-703 if missing (the required preview check must not be pointed at the shared integration deployment); one more vendor dependency for everything ("one subscription to rule them all" is also one point of failure).

## UNKNOWN
- InsForge deployments: whether the platform can provision a preview per PR head SHA (required by IF-703; do not use the shared integration URL as a fallback), two sites per project, setting secret env vars without the command line, free-plan limits.
- Whether `@insforge/sdk` offers magic-link (not OTP) passwordless sign-in.
- How many real people have data in Convex production/preview.
- Production InsForge project: separate free project, or Pro (spend, AT).
- Whether `@insforge/sdk` works in Expo / React Native.
- Embedding model and vector dimension for `memories`.
- Whether InsForge's PostgREST accepts quoted camelCase columns well; plan uses snake_case + a mapper.
- InsForge cloud terms on cron/email limits on the free plan.
