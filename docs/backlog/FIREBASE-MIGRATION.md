# Firebase migration — preview preparation

Status: **DRAFT — NOT DISPATCHABLE. This PR performs no application migration or deployment.**

## Reconciliation — 2026-11-09

The planning snapshot below was prepared on 2026-11-06. It is historical evidence, not the current setup contract or a dispatch queue. Later merged work supersedes its project alias, deny-all bootstrap, Firebase-policy and missing-contract statements:

- PR #1366 supplies `.firebaserc`, `firebase.json`, `firestore.rules` and `firestore.indexes.json` on `integration`. This branch preserves those files byte-for-byte at integration revision `8354b61f`. The three add/add conflicts were resolved in favor of that merged setup, not the old bootstrap.
- The source alias now names `tempo-flow-preview-20261106`; the Firestore database location is `europe-west3`. These are repository observations, not fresh remote identity or billing verification.
- The merged rules allow authenticated owners under `users/{uid}/**` and deny other client access. See [the merged data model](FIREBASE-DATA-MODEL.md) for owner/private collection boundaries. Never put secret records under the owner-readable tree. This PR does not change or deploy those rules.
- [The merged environment mapping](FIREBASE-ENV-MAPPING.md) supersedes the old claim that Firebase variable names lack a documented contract. No variable is set or credential retrieved in this conflict-resolution pass.
- PR #1365 reconciled the Firebase ban in `docs/HARD_RULES.md`. The old policy blocker below is historical; it is not a reason to reverse that merged decision.

Revalidate every draft ticket against those current contracts and current source before dispatch. In particular, FM-01/02/12 describe earlier gaps and are not evidence that the merged contracts or setup are missing. Historical access errors below do not establish current vault access. No fresh Firebase, Auth, Vercel, deployment or application-behavior verification was performed here. Convex and protected paths remain unchanged relative to `integration`.

## Historical evidence and boundaries — 2026-11-06

Prepared 2026-11-06 from assigned checkout `5504fc4038fc45d6c8412c23c45b9a9b6cb2ba73` and [product docs PR #1359](https://github.com/Levidavidspublic/tempo-rhythm/pull/1359) at `ebd5446dbaef49dbdc4548319c2d573eb30e43a5` (ARCHITECTURE, BACKEND-SCHEMA, CONFIG-PLAN, TECH-STACK). Those docs remain a draft, not merged project law. The current request explicitly authorizes preview preparation despite the older Firebase ban; this PR does not rewrite policy or weaken a scanner.

Expected preview project `tempo-flow` comes from the setup request, not verified service-account access. `.firebaserc` has only the explicit `preview` alias, no default. Project identity, Spark billing, region, database existence, user count and IAM remain UNKNOWN. A local alias is not proof of any remote project.

`firestore.rules` denies all client reads/writes, including signed-in owners, because collection paths and Firebase UID mapping are not approved. It is an undeployed bootstrap placeholder, not application-ready owner access. Admin SDK bypasses rules: Vercel handlers must separately verify identity and ownership. `firestore.indexes.json` declares no composite indexes or field overrides. This does not disable Firestore automatic single-field indexing. Never apply this empty manifest over existing remote indexes without a reviewed comparison; deployment could offer to remove existing indexes.

`firebase.json` references only the two Firestore files. No Hosting, App Hosting, Functions, storage, deployment hooks or live target. Server code/model calls belong on Vercel; Cloudflare stays. No key or env value is in these files. No deployment command is run by this preparation.

## Access and standards gaps

- Exact dev-vault lookups previously returned `item_not_found` for `FIREBASE_SERVICE_ACCOUNT_TEMPO` and `FIREBASE_WEB_CONFIG_TEMPO`. Access handoff already pending; do not duplicate or request values in chat.
- No Firebase environment-variable names exist in the inspected app configuration. Vault item names are not env names. Do not invent or set them. Existing consumers include `NEXT_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `MISTRAL_API_KEY`, `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL`; these are not Firebase replacements.
- `TICKET-STANDARD.md` and `00-RULES-shared.md` not found in this checkout; neither was provided. Tickets below use AGENTS.md's 11 fields only. Compliance with the missing standard is UNKNOWN. No issue, label or dispatcher action is authorized.
- Product docs explicitly leave Firestore collections UNKNOWN and require accepted mapping before implementation. Magic-link sender remains UNKNOWN. No invented collection, UID translation, callback domain or region.
- Current `docs/HARD_RULES.md` section 2 forbids Firebase, and section 6.1 still requires the existing model router. A later authorized policy reconciliation is needed before SDK migration; do not edit a check to force green. The current forbidden-tech scanner checks dependency/import specifiers, not these root configuration files; its passing would not settle that policy conflict.

## Actual Convex leftovers

At the inspected revision, case-sensitive `rg -l convex apps/web --glob '*.{ts,tsx}'` finds **149 files**, and the equivalent mobile search finds **24 files**, including tests. These counts are references, not proof of runtime behavior.

- Web session: `apps/web/components/providers/providers.tsx`, `apps/web/app/layout.tsx`, `apps/web/proxy.ts`; auth screens and feature components still consume Convex hooks/generated APIs.
- Mobile: `apps/mobile/app/_layout.tsx`, `apps/mobile/utils/convexConfig.ts`, sign-in/sign-up/onboarding routes and planner screens.
- MCP bridge: `apps/web/app/api/mcp/route.ts` still forwards to the Convex site URL.
- Data modules under `convex/`: activity, analytics, approval, brain_dump, calendar_events, conversations, dayPlans, focusBlocks, goals, habitCheckIns, habits, memories, memory, memoryImport, messages, nags, notes, notifications, preferences, search, streaks, tasks, templates, timeBlocks, users.
- Server/runtime modules: ai_smoke, coach, crisis, connections, connectionsHttp, mcp, mcpHttp, mcpTools, revenuecat, voice, crons, http, pageCleanup; `convex/lib/` includes ai_router, requireUser, accountDeletion, entitlement/approval guards, page ledger/privacy, connection/MCP helpers and soft-delete logic.
- Protected auth/schema remain untouched: `convex/auth.ts`, `convex/auth.config.ts`, `convex/schema.ts`. `convex/convex.config.ts`, `convex/_generated/`, `convex.json`, root/web/mobile package manifests and existing scripts still configure Convex.
- Existing Convex test suites, generated types, URL fixtures and env expectations remain. Nothing in this PR removes, disables or migrates them.

## Draft ticket sequence

Proposed destination filenames are **EXTRAPOLATED planning suggestions**, not accepted collection names or new environment-variable names. Every code ticket is blocked until its destination contract and bounded scope are approved. FM-05/06/07/08/09/10/11 are decomposition gates: they must produce one bounded implementation ticket per module or consumer slice before dispatch, not one large migration assignment. This backlog is not a claim that all final implementation tickets can be specified before those contracts exist.

### FM-01 — Approve collection and identity contracts

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** none; contract review only.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** approve collection and identity contracts without changing production.
- **SCOPE:** docs/product/BACKEND-SCHEMA.md in PR #1359; convex/schema.ts; convex/lib/requireUser.ts (read-only).
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Define the Convex user-ID to Firebase UID mapping, per-table collection paths, owner field, server-only records, deletion policy and approved query/index list. Submit each mapping for Amit acceptance; do not infer it from table names.
- **DONE:** Amit accepts the map before any client allow rule, index, data copy or handler is implemented. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. UNKNOWN: no approved mapping or acceptance exists. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-02 — Define client and server configuration boundaries

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01 and credential handoff.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** define client and server configuration boundaries without changing production.
- **SCOPE:** apps/web/lib/firebase-client.ts (proposed); apps/web/lib/firebase-server.ts (proposed); apps/web/package.json; one boundary test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Read providers.tsx and all process.env consumers. Obtain an approved variable-name contract rather than guessing names. Add client initialization using only public web config; isolate Admin SDK initialization in server-only code. Verify project identity tempo-flow before use. Handle missing configuration without logging credentials. No credentials in source or committed env files.
- **DONE:** Boundary test rejects server imports in client bundles and wrong project identity; lint/typecheck pass. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: Firebase env names undefined; SDK dependency forbidden by current HARD_RULES and scanner. No rule/check changes authorized here. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-03 — Replace web session provider and route protection

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-02; approved email-link delivery and beta admission contract.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace web session provider and route protection without changing production.
- **SCOPE:** apps/web/components/providers/providers.tsx; apps/web/app/layout.tsx; apps/web/proxy.ts; one session boundary test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Inspect ConvexAuthNextjsProvider, server provider and middleware redirects. Replace only after the Firebase verified-token/session-cookie contract is accepted. Preserve signed-out redirects, revoked/pending tester denial and no live guest access. Verify server-side identity, not client-supplied user IDs. Keep Resend until sender choice is approved.
- **DONE:** Preview tests: valid approved user admitted; stranger, expired token, revoked user and unauthenticated API denied; logout clears session. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: mail sender/session contract and SDK-policy conflict. Separate sign-in form tickets are FM-04. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-04 — Replace web email-link sign-in consumers

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-03.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace web email-link sign-in consumers without changing production.
- **SCOPE:** apps/web/app/sign-in/page.tsx; apps/web/app/sign-up/page.tsx; one email-link flow test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Map actual components called by these routes first; if implementation lives elsewhere, re-scope before edits. Preserve magic-link flow, beta admission, safe return URL validation and one-time/expired link errors. Never add a password flow or silently remove Resend.
- **DONE:** Preview sign-in link succeeds once; expired/replayed links and foreign return URLs fail safely. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: sender contract and exact subordinate component scope need review. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-05 — Implement owner-scoped planner persistence

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01, FM-02.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** implement owner-scoped planner persistence without changing production.
- **SCOPE:** approved replacement modules for convex/tasks.ts, convex/notes.ts and convex/dayPlans.ts (read-only sources); one two-user test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Split into one ticket per source module before dispatch. Preserve validated fields, soft-delete filters and note body authority. Vercel handlers verify Firebase tokens and derive owner identity server-side. Reject supplied owner changes and references to another user's rows. Do not migrate real data.
- **DONE:** For each module, owner create/read/update works; second user, unauthenticated user, forged owner and cross-owner references are denied. Real preview proof waits on access. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: destination paths/collections unknown; scope must be split once the accepted map exists. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-06 — Port remaining data and event modules individually

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01, FM-02; module dependencies.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** port remaining data and event modules individually without changing production.
- **SCOPE:** inventory below (read-only sources); approved destination files UNKNOWN.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Create one bounded ticket per inventory module before dispatch, at most three changed files and one test. Inspect each exported query/mutation/action and every caller. Preserve pagination, subscriptions, transaction semantics, soft delete, derived-index rebuilds and rate limits. Do not equate an Admin SDK call with ownership enforcement. Replace consumers only after each handler contract exists.
- **DONE:** Each module has its own before/after tests and a two-user isolation case; all callers accounted for with rg before a slice is marked migrated. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: accepted map and destination contracts absent. This planning ticket is not a blanket migration authorization. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-07 — Move coach/model execution to Vercel

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01, FM-02, FM-05.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** move coach/model execution to vercel without changing production.
- **SCOPE:** convex/coach.ts; convex/lib/ai_router.ts; convex/crisis.ts (read-only sources); approved replacement files UNKNOWN.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Read actual call graph, then split provider/router, crisis and coach orchestration into bounded tickets. All runtime model calls remain server-only Vercel functions. Preserve accept/edit/reject, five-minute undo, crisis path and RAM-only imported content. Inventory current MISTRAL_API_KEY use; no invented replacement variable names or provider changes.
- **DONE:** Preview owner-scoped reply and accepted mutation succeed; rejected proposal never mutates; no raw imported mail/chat persisted; no provider secret in browser bundle. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: provider/name contract, model-policy conflict and function time/budget constraints unverified. No model calls or spend in setup. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-08 — Replace MCP/Executor backend transport

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01, FM-02; verified server auth contract.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace mcp/executor backend transport without changing production.
- **SCOPE:** apps/web/app/api/mcp/route.ts; convex/mcpHttp.ts; convex/connectionsHttp.ts (read-only backend sources); one transport isolation test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Inventory handlers in mcp.ts, mcpTools.ts, mcpHttp.ts, connections.ts and convex/lib/mcp before splitting tickets. Replace Convex site URL forwarding with approved Vercel endpoints. Preserve token validation, owner-scoped tool calls, connection limits and transient secrets. Keep Executor and Cloudflare; no OAuth consent on Amit's behalf.
- **DONE:** Two preview users cannot call each other's tools or connections; missing/invalid tokens denied; no secret values logged. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: endpoint/auth contracts missing; each backend implementation requires its own scoped ticket. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-09 — Replace web reactive consumers by feature slice

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-03, FM-05 and each feature's FM-06 handler.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace web reactive consumers by feature slice without changing production.
- **SCOPE:** 149 web reference files at inspected revision; individual dispatch scope selected by feature, maximum three source files plus one test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Run rg -l convex apps/web --glob '*.{ts,tsx}' and separate tests from runtime callers. Create one bounded ticket per screen/provider slice. Replace useQuery/useMutation/useAction and generated api imports only for handlers already ported. Specify listener unsubscribe, loading/error states and stale-data behavior; preserve RTL and accept/reject UX.
- **DONE:** Each slice proves read/write/realtime behavior in preview and cross-user isolation; rg confirms no Convex import in the migrated slice. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: replacement data/subscription contract absent. Count includes tests, not 149 runtime integrations. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-10 — Replace Expo auth/config and data consumers

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-03 and approved mobile email-link contract; mobile is MVP, not web alpha.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace expo auth/config and data consumers without changing production.
- **SCOPE:** apps/mobile/app/_layout.tsx; apps/mobile/utils/convexConfig.ts; apps/mobile/package.json; one session test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Read secure-storage and URL linking behavior before replacing ConvexAuthProvider/ConvexReactClient. Do not invent EXPO public Firebase names. Separately ticket the remaining auth routes and feature callers from the 24-file inventory after their handlers exist. Never expose service-account material to Expo.
- **DONE:** Mobile preview email-link/session persists and signs out safely; two-user data isolation; no server key in bundle. Each remaining consumer slice gets its own test. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: mobile callback/variable contract absent; this is not permission to expand alpha scope. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-11 — Replace schedules, webhooks and retention jobs

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01, FM-02; explicit free execution and preview-only contract.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace schedules, webhooks and retention jobs without changing production.
- **SCOPE:** convex/crons.ts; convex/http.ts; convex/pageCleanup.ts (read-only sources); replacement paths UNKNOWN.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Map every schedule and HTTP route, including revenuecat.ts and page-operation cleanup dependencies, then split per job/handler. Keep billing providers unchanged. Specify authenticated invocation, idempotency, retries and retention. Confirm free limits; no Cloud Functions/App Hosting, Blaze upgrade or new paid scheduler.
- **DONE:** Preview duplicate events are idempotent, unauthorized invocation denied and retention honors approved soft-delete window without touching production. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: free scheduler capability and retention contract unverified. No account data deletion authorized. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-12 — Enable specific owner rules and query indexes

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** FM-01 plus tested per-feature handlers and query contracts.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** enable specific owner rules and query indexes without changing production.
- **SCOPE:** firestore.rules; firestore.indexes.json; one rules emulator test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Keep deny-all until the accepted collection/UID map exists. Add only explicit approved collection matches: owner create/read/update, immutable owner identity and validated cross-document references; default-deny unmatched paths and server-only records. Derive composites from actual queries. Compare deployed indexes before any later authorized apply; empty indexes here are not a deletion instruction.
- **DONE:** Official rules emulator: owner permitted only on mapped records; unauthenticated/non-owner/owner reassignment denied; unknown paths denied. Preview identity/billing/users verified before any separately authorized apply. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: accepted map and emulator tooling missing; no rule deployment in this PR. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

### FM-13 — Retire Convex dependencies after complete parity

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by mid-tier role only after unblocked.
- **WHEN:** all prior slices and explicit later authorization.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** retire convex dependencies after complete parity without changing production.
- **SCOPE:** package.json; apps/web/package.json; apps/mobile/package.json; one dependency/import audit.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Inventory convex.json, generated API/types, scripts, test fixtures, env consumers and backend files again. Open separately approved cleanup tickets; do not delete or change Convex here. Remove dependencies only after all web/mobile, jobs, auth and API callers prove parity. No .github, schema, auth or env edits under this setup authorization.
- **DONE:** rg inventory has no unexplained runtime Convex references; full lint/typecheck/test/build and preview flows pass; rollback to old preview remains documented. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: application is not migrated; protected files and destructive cleanup require separate authorization. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.

## Local verification (2026-11-06)

- PASS: Python JSON parsing and exact-shape assertions for all three JSON files; static single deny-all statement check. These are not a Firestore compiler or emulator test.
- PASS: `git diff --check`, `bun run scan:forbidden-tech`, `bun run scan:ram-only-audit`, `bun run scan:design-tokens`, `bun run check:notices`.
- FAILED / BLOCKED_DEPENDENCY: `bun run lint`, `bun run typecheck`, `bun run build`: `/usr/bin/bash: line 1: turbo: command not found` (exit 127). Build used the repository-prescribed example Convex URL, not a credential.
- FAILED / BLOCKED_DEPENDENCY: `bun run test`: `KB-07 isolated fixture exited 1`; `Cannot find module 'react/jsx-dev-runtime'` from `apps/web/components/goals/GoalsProgressScreen.tsx`. First fixture reported 0 pass / 1 fail / 1 error. The suite's own isolation retry also failed; no further retry performed.
- UNKNOWN: installed Bun is 1.4.4, not required 1.3.9. No dependency/tool installation attempted, following the task's missing-package stop constraint.
- NOT RUN: install, Playwright E2E (no dependencies; do not let bunx fetch tooling), Firebase emulator/compiler (CLI absent), remote Firebase/Vercel checks (credentials unavailable). No visible app change, so no UI screenshot.

## Safe step record

- WALK — Read instructions, confirmed clean assigned branch and inspected draft product docs; no live systems queried this continuation.
- WALK — Added four new bootstrap config files; no existing file overwritten, so no original-file backup required.
- WALK — Added this source-backed inventory and draft 11-field backlog; missing standard and data contracts remain explicit.
- AT — Existing access handoff must make the two named dev items reachable. No duplicate card and no Google sign-in.
- UNKNOWN — Emulator compilation, deployed rules/indexes/auth, Firebase project/billing/users, Preview key wiring and application migration are not verified by local source review.
