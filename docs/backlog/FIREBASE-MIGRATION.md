# Firebase migration — R1 PART4 additive preparation

Status: **DRAFT / OPEN / NOT DISPATCHABLE. Runtime migration NOT IMPLEMENTED.**

## Ownership, provenance and reconciliation

Baseline: `5504fc4038fc45d6c8412c23c45b9a9b6cb2ba73` on `integration`.
This is the continuation of the SAME **13 FM-01–FM-13** work items from
[PR1361](https://github.com/Levidavidspublic/tempo-rhythm/pull/1361) at
`379b11db5b521cae0b88880ead38f84ecbb06669`, not a second migration queue.
No additional FM IDs, issues, dispatcher activity or workers are created.
Apply this backlog as the reconciled planning successor if reviewed; do not dispatch both versions.
PR1361's four bootstrap files are not copied, deployed or modified.

Standard source: [TICKET-STANDARD v2 in draft PR1359](https://github.com/Levidavidspublic/tempo-rhythm/blob/69735e789880719ececc211a8581511d4aebe7cf/docs/backlog/TICKET-STANDARD.md).
That standard is now inspected, not missing. The original 11 fields are retained below;
SPEC, TESTS, NUMBERS and GATES are added to each existing ID. Broad items remain explicit
decomposition gates, not compliant one-shot implementation assignments.
Unknown signatures, copy, collection paths or commands mean OPEN, never buildable.
Product architecture source is the same PR1359 head, still draft/unmerged; neither PR is altered.

Current user authorization supersedes legacy Convex-only prose for this **additive,
preview/emulator-only migration preparation**. It does not authorize changing enforcement.
Exact owning blockers remain `docs/HARD_RULES.md` §2 (Firebase forbidden in dependencies,
code/env/docs), `docs/TRD.md` §9 and `docs/PRD.md` §6; these files remain untouched.
`scripts/scan-forbidden-tech.ts` rejects `firebase`, `firebase-admin`, `@firebase/`
dependencies and application imports. No allowlist, scanner edit, dynamic import workaround
or dependency/source wiring is introduced. A passing docs-only scan does NOT prove a
Firebase implementation would pass. Parent B3 alias/CLI profile/judge scope repair is
exhausted/BLOCKED and is not retried by this worker.

## Scope and actual inventory

Current change scope: this backlog, `convex-inventory.py`,
`CONVEX-INVENTORY.json`, `R1-PART4-CHECKS.md` and one test file
`firebase-emulator-check.py` under `docs/backlog/`.
Sizing exception: five additive files instead of three plus one test because the
reproducible inventory needs its generated artifact and a separate check record;
there are no application source changes.
MUTATES: additive tracked documentation and local read-only inventory tooling only.
No runtime, dependencies, credentials, env files, Convex, schema/auth, .github,
production/security settings or remote systems change. No deployments or model calls.

Run `python3 docs/backlog/convex-inventory.py`, then
`python3 docs/backlog/convex-inventory.py --check`.
The generated artifact pins baseline blobs, SHA-256 and matching line numbers without
source excerpts or env contents. Counts: **716 inventoried files**, **639 text-hit files**,
**9,621 matching lines**, **3 excluded env paths**. Includes 151 Convex paths,
167 web paths, 34 mobile paths, docs/tests/tooling/config references.
These are case-insensitive tracked references plus Convex-named paths, NOT runtime counts.
Env completeness and untracked/runtime-generated references remain UNKNOWN.
No baseline content is edited; new migration docs are deliberately outside the immutable baseline.

Actual interfaces: `convex/lib/requireUser.ts:resolveUserFromIdentity/requireUser`;
`convex/notes.ts:list/create/get/update`; `convex/dayPlans.ts:getForDate/upsert/commit/moveTaskToDay`;
`apps/web/components/providers/providers.tsx:Providers`;
`apps/web/proxy.ts`; `apps/web/app/api/mcp/route.ts:resolveMcpTarget/GET/POST/DELETE/OPTIONS`.
The inventory supplies remaining exact paths and lines; FM-06/09/10/11 must be decomposed
from those paths rather than pretending the whole module/consumer set fits one ticket.

## Identity, email-link and preview plan

Firebase Auth + Firestore **Spark only**. No Blaze, Cloud Functions, App Hosting,
new account, payment, Venice product runtime or external generation.
Vercel functions own all server/model execution; no server key in browser/mobile.
Keep Convex auth/schema/deployment and current product behavior intact.

Per-user isolation: derive UID from a verified Firebase identity, not request owner fields.
No assumed equality between Convex `Id<"users">` and Firebase UID and no email-only merge.
Accepted collection paths, owner field, UID migration mapping and exact API types remain
UNKNOWN pending DATA/AUTH contracts. Server Admin calls bypass rules, so independently
enforce and test ownership in Vercel handlers. Default-deny unspecified paths. No allow-rule
or production/security-setting edits are authorized by this preparation.

Email-link plan (FM-03/04): preserve passwordless sign-in, beta approval/revocation,
safe relative return destinations and logout. Current routes render
`apps/web/components/auth/SignInForm.tsx` and `SignUpForm.tsx`;
`convex/auth.ts` currently uses Resend and `convex/lib/signInEmail.ts`.
Choose Firebase Auth email-link completion APIs only after sender, preview callback allowlist,
session-cookie vs token verification, expiry and EN/HE copy contracts are accepted.
Sender (Firebase/Resend/both) remains UNKNOWN; do not remove current sender or change
Auth provider/authorized domains. Required emulator cases are one-time success,
expiry/replay/tampering, wrong email, foreign redirects, revoked/unapproved user and logout.
Auth emulator proof does not prove mail delivery or signed-in preview.

Emulator isolation gate (FM-05/12): official Auth + Firestore emulators, synthetic users A/B,
accepted temporary rules fixture, no live network or credentials. A must create/read;
B and anonymous must fail read/write/list on A; owner reassignment and cross-owner links deny.
The deny-all PR1361 bootstrap cannot pass owner-positive acceptance.
`firebase-emulator-check.py` is an independently runnable standard-library REST test
against official Auth/Firestore emulators, with a temporary demo-only fixture. Its
`--fixture` mode creates only a new directory under the system temporary directory.
See its module documentation for the exact `firebase emulators:exec` command.
It verifies fixed loopback hosts and `demo-tempo-r1`, obtains actual emulator-issued
synthetic identities and tests A create/read plus B/anonymous read/write/list denial,
forged/reassigned owner and default-deny paths. Synthetic password sign-up is used
only to obtain test identities; it is NOT product email-link proof. The fixture has
no relations, so cross-document link validation remains a future product-contract test.
**NOT RUN against emulators:** initial checkout lacks Java and Firebase CLI. Parent
owns authorized Java prerequisite work; this worker does not race installation.
No SDK dependencies, product mapping or mail delivery are exercised. Never fake a
token, use Admin bypass or mock a PASS. Runtime assertions remain unverified until
run against official emulators; local fixture/preflight checks prove only tooling behavior.

Parent reports both preview databases checked as FIRESTORE_NATIVE/STANDARD/europe-west3,
freeTier=true, PITR disabled and billing disabled/unlinked; this worker did not repeat or
independently attest those remote checks. Four real vault items, Auth/rules and Vercel
Preview wiring await secure GCP-to-vault handoff. This does not block inventory/tickets.
Actual signed-in preview, credentials, Hebrew chain and runtime migration remain UNKNOWN.

## Required gates

Copied criteria from TICKET-STANDARD v2; judge is described by role, not a model assignment.
No provider/judge invocation is authorized in this run.

### Binary checks (CI): pass or fail
1. Build, typecheck, lint.
2. The ticket's own TESTS, unit and Playwright, all green.
3. Every NUMBER inside its pass range.
4. Formatting and naming per Google's official style guides (TypeScript: https://google.github.io/styleguide/tsguide.html), via the repo's configured formatter and linter.
5. Secret scan and forbidden-tech scan.
6. Scope guard: the changed files must be inside SCOPE and MUTATES. ANY other file touched = automatic reject, even if the code works. Amit prefers false rejects to letting bad code through.
7. Config guard: no config or secret changes outside a config ticket.
8. Never weaken, skip, lower or delete a check or test to make something pass. Doing so = automatic reject.

### Judgement checks
The configured judge role gets the ticket, Amit's style guide and Google's style guide,
and the PR diff plus REPORT. It returns instruction-following, formatting, naming
conventions and clean-code probabilities. Each must be ≥0.85. Any massive violation
fails the PR. Existing judge gate remains unchanged and NOT RUN here.

### Process check
REPORT lists every STEP and every DONE item with its evidence. A missing item fails the PR.
See R1-PART4-CHECKS.md for actual worker results, not future ticket acceptance.

## Existing ticket sequence (same IDs, expanded fields)

### FM-01 — Approve collection and identity contracts

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Read-only inputs: `convex/schema.ts`, `resolveUserFromIdentity(ctx, identity): Promise<Doc<"users"> | null>` and `requireUser(ctx)` in `convex/lib/requireUser.ts`. Existing identity resolves a subject then email and rejects inactive accounts. New Firebase UID must be verified, never trusted from request JSON; no automatic email-only account merge. Exact collection paths, migration ID mapping, types, server-only records and index list: UNKNOWN — contract owner. No contract edit or data copy in this PR.
- **TESTS:** Given the immutable baseline, when the inventory runs twice, then byte-identical artifacts include every tracked case-insensitive text hit and Convex-named path except env contents. Given each proposed collection, when mapping is reviewed, then every source ID has an explicit owner/UID/index decision or remains OPEN.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-02 — Define client and server configuration boundaries

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
- **WHEN:** FM-01 and credential handoff.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** define client and server configuration boundaries without changing production.
- **SCOPE:** apps/web/lib/firebase-client.ts (proposed); apps/web/lib/firebase-server.ts (proposed); apps/web/package.json; one boundary test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Read providers.tsx and all process.env consumers. Obtain an approved variable-name contract rather than guessing names. Add client initialization using only public web config; isolate Admin SDK initialization in server-only code. Verify project identity tempo-flow before use. Handle missing configuration without logging credentials. No credentials in source or committed env files.
- **DONE:** Boundary test rejects server imports in client bundles and wrong project identity; lint/typecheck pass. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: Firebase env names undefined; unchanged SDK scanner gate. No rule/check changes authorized here. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.


- **SPEC:** Current inputs: `Providers({children})` in `apps/web/components/providers/providers.tsx`; proposed client/server modules remain uncreated. Public web config must not contain Admin credentials. Exact initialization exports, variable-name schema and verified project binding: UNKNOWN — secure handoff/config contract. Wrong-project or missing config must fail closed without logging values. SDK imports/dependencies remain blocked by unchanged scanner.
- **TESTS:** Given absent or wrong-project config, when initialization is attempted, then it fails closed and logs no credential. Given a client bundle, when inspected, then no Admin key/module is present. NOT RUN until approved imports and tooling exist.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-03 — Replace web session provider and route protection

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
- **WHEN:** FM-02; approved email-link delivery and beta admission contract.
- **WHY:** Product docs PR #1359 ARCHITECTURE / BACKEND-SCHEMA / CONFIG-PLAN and ownership constraints in current docs/BACKEND-SCHEMA.md.
- **GOAL:** replace web session provider and route protection without changing production.
- **SCOPE:** apps/web/components/providers/providers.tsx; apps/web/app/layout.tsx; apps/web/proxy.ts; one session boundary test.
- **MUTATES:** Future preview-only source/config after approval; this backlog itself mutates no external system.
- **STEPS:** First code-map the listed sources and their callers with rg; read their current tests. Inspect ConvexAuthNextjsProvider, server provider and middleware redirects. Replace only after the Firebase verified-token/session-cookie contract is accepted. Preserve signed-out redirects, revoked/pending tester denial and no live guest access. Verify server-side identity, not client-supplied user IDs. Keep Resend until sender choice is approved.
- **DONE:** Preview tests: valid approved user admitted; stranger, expired token, revoked user and unauthenticated API denied; logout clears session. Repository commands: `bun run lint`, `bun run typecheck`, `bun run test`; feature-specific commands must be recorded in the scoped ticket before dispatch.
- **EVIDENCE:** Per-ticket source/caller inventory, exact commands and decisive outputs; preview proof on verified build if authorized. No secrets or placeholder checks counted as live proof.
- **DO NOT:** No production, deploy, spend, plan upgrade, Cloud Functions/App Hosting, Cloudflare change, Convex change/deletion, protected paths or committed env edits under this setup request. Do not weaken tests or invent env/collection names.
- **REPORT:** Draft/not dispatchable. BLOCKED: mail sender/session contract and unchanged SDK scanner gate. Separate sign-in form tickets are FM-04. Report changed files, passing/failing checks and UNKNOWN separately in that ticket's draft PR.


- **SPEC:** Current provider `Providers`, `ConvexAuthNextjsMiddleware` usage in `apps/web/proxy.ts`, and server layout provider are ownership boundaries, not permission to edit protected auth. Proposed verified-token/session interface, cookie options, revocation and beta-admission mapping: UNKNOWN — AUTH contract. Reject missing, invalid, expired, revoked or wrong-project identity before data access.
- **TESTS:** Given approved user A, when valid session is verified, then only A enters; given anonymous, expired, revoked, wrong-project or unapproved identity, then APIs deny. Given logout, then cookie/session and listeners are cleared. Official Auth emulator plus actual preview required separately.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-04 — Replace web email-link sign-in consumers

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Actual consumers: `SignInPage` and `SignUpPage` call `SignInForm` and `SignUpForm` in `apps/web/components/auth/`. The listed route-only scope is insufficient for a complete change; split/re-scope before dispatch. Existing `getPostAuthDestination(nextPath: string | null)` rejects external/protocol-relative destinations and auth/dashboard loops. Proposed email-link send/complete signatures, sender, allowed callback host, expiry, EN/HE strings and UI tokens: UNKNOWN — AUTH/UX contract. See email-link plan above.
- **TESTS:** Given a valid email link, when completed once in the Auth emulator, then sign-in resolves the verified UID; replay, expired link, tampered code, wrong email and foreign redirect are denied. Given request-send failure/offline, then exact approved EN/HE state is shown. Playwright must click send/complete/logout, keyboard and RTL states after copy/token contract exists; no actual mail here.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-05 — Implement owner-scoped planner persistence

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Decomposition gate, NOT one implementation assignment. Actual APIs include `convex/tasks.ts`, `notes.create`, `notes.get`, `notes.update` and `dayPlans.getForDate/upsert/commit/moveTaskToDay`. `notes.body` remains authoritative; noteBlocks is derived. Choose ONE endpoint and specify exact args/return schema and error codes before dispatch; destination and UID map UNKNOWN. Each request derives owner from verified Auth identity; cross-owner task/note references and owner reassignment denied.
- **TESTS:** Given A and B emulator identities, when A creates and reads the scoped record, then fields round-trip. When B or anonymous reads/updates/lists A's record, then permission-denied. Forged owner, owner change, cross-owner relation and soft-deleted row are rejected. This is mandatory emulator evidence, NOT a mock or Admin-only assertion.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-06 — Port remaining data and event modules individually

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Decomposition gate for each remaining module, with files/lines/hashes in CONVEX-INVENTORY.json. Actual table/module and caller list must select exactly ONE function/table/endpoint per child ticket. Exact new exports, field validators, pagination, soft-delete and derived-index contracts: UNKNOWN until FM-01. No generic bulk port or assumed collection-name equality.
- **TESTS:** Given each selected module's valid and invalid arguments, when its replacement runs, then current business invariants and all error paths match. A create/read succeeds and B/anonymous access and cross-owner references fail in the emulator. No module marked migrated from inventory alone.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-07 — Move coach/model execution to Vercel

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Read-only source interfaces: `convex/coach.ts`, `convex/lib/ai_router.ts`, `convex/crisis.ts` and their callers from inventory. Split one Vercel endpoint per ticket; exact streaming, timeout, cancellation and error contracts UNKNOWN. Server/model calls belong only in Vercel functions; no Venice runtime or browser secret. Provider calls and paid judge calls NOT authorized in this run. Preserve proposal acceptance and RAM-only import rules.
- **TESTS:** Given a proposed change, when rejected, then no state changes; when accepted by A, then only A changes. Given B's record/token mismatch, then deny before model execution. Given imported raw content, then it is not persisted. Provider runtime, crisis quality and Hebrew chain remain NOT RUN in this task.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-08 — Replace MCP/Executor backend transport

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Current `resolveMcpTarget(env: Record<string, string | undefined>): string | null` and exported GET/POST/DELETE/OPTIONS in `apps/web/app/api/mcp/route.ts` forward to existing Convex transport. Read-only `convex/mcpHttp.ts`, `connectionsHttp.ts` and tool implementations define current semantics. New transport exports, token scopes and limits UNKNOWN — endpoint contract. One handler per child ticket; reject cross-owner connections/tools independently of Firestore rules.
- **TESTS:** Given A's connection, when B calls each supported HTTP method/tool, then deny; missing/invalid token denied; approved A request reaches only A's scoped handler. Malformed payloads and unsupported methods have contract-defined errors; secrets never appear in logs.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-09 — Replace web reactive consumers by feature slice

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Decomposition gate; select exact runtime callers, not all 167 inventory paths under apps/web. Existing hooks `useQuery/useMutation/useAction` and generated api types require approved replacement read/write/listener contracts. New signatures, unsubscribe lifecycle, empty/loading/offline/error behavior, EN/HE copy and tokens UNKNOWN per screen. No provider-wide replacement in one ticket.
- **TESTS:** Given A's active listener, when auth switches to B or unmount occurs, then A's listener unsubscribes and cached A data is cleared. Given B's request for A's record, then deny. Playwright exercises each approved loading/empty/error/offline/success state and EN/HE RTL behavior before preview-tested.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-10 — Replace Expo auth/config and data consumers

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Read-only `apps/mobile/app/_layout.tsx`, `apps/mobile/utils/convexConfig.ts` and all 34 mobile inventory paths. Proposed session-storage, deep-link completion and listener interfaces UNKNOWN — mobile contract. Alpha is web; mobile work waits for MVP authorization. One route/component per child ticket, no service-account material in Expo bundles.
- **TESTS:** Given emulator users A and B, when mobile identity switches, then private storage/listeners do not expose A to B. Email-link deep-link replay/expiry/wrong-project and logout are tested on an authorized simulator; NOT RUN here.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-11 — Replace schedules, webhooks and retention jobs

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Read-only `convex/crons.ts`, `convex/http.ts`, `convex/pageCleanup.ts` plus inventory-listed handlers. Exact event payloads, authenticated invocation, idempotency keys, retries and retention windows UNKNOWN — one job contract per child. Vercel execution must fit verified free limits. No Cloud Functions, App Hosting, Blaze or scheduler purchase.
- **TESTS:** Given a duplicate authenticated event, when invoked twice in an isolated fixture, then one scoped effect results; unauthorized or cross-owner events deny. Retention checks use synthetic emulator fixtures only; no real records deleted.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-12 — Enable specific owner rules and query indexes

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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


- **SPEC:** Existing undeployed deny-all files are ONLY in PR1361, not copied here. Collection matches, owner field and allowed query/index contract UNKNOWN until FM-01. Future emulator-only fixture must permit A create/read on A's approved path, reject B and anonymous read/write/list, reject UID reassignment/cross-owner links and unknown/server-only paths. Admin bypass means Vercel ownership checks need separate tests. No security-setting/rules deployment authorized.
- **TESTS:** Given official Firestore emulator and accepted rules fixture, when A creates/reads, then allow; when B/anonymous read/write/query A, then deny; owner reassignment, cross-owner link, unmatched/server-only path deny. Deny-all bootstrap must fail the positive owner test; never count that as PASS. Verify actual rules compilation, not text matching.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

### FM-13 — Retire Convex dependencies after complete parity

- **FOR:** Tempo Flow, Levidavidspublic/tempo-rhythm; migration planning, implementation by WORKHORSE role only after unblocked.
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

- **SPEC:** Retirement is OUT OF SCOPE and separately authorized only after complete parity. Current manifests, generated types, convex.json, auth/schema, CI and env consumers remain intact. Exact removable symbols and rollback contract UNKNOWN. No deletion or dependency removal in this draft.
- **TESTS:** Given every approved migrated slice and full parity evidence, when read-only inventory reruns, then every remaining Convex reference has a reviewed disposition. Existing tests/build and rollback preview pass before any later retirement permission; no cleanup check is simulated here.
- **NUMBERS:** Scope ≤3 source files +1 test per implementation ticket (TICKET-STANDARD v2); larger decomposition items are planning gates only. Cross-user/anonymous unauthorized successes = 0; owner create/read successes ≥1 per tested slice (task acceptance). Other latency/quota/UX thresholds UNKNOWN until sourced; no invented benchmark. Required judge-role probabilities ≥0.85 per standard, NOT RUN (no provider calls authorized).
- **GATES:** All gates in “Required gates” below apply unchanged, plus this ticket's TESTS and scope check. Status OPEN / NOT DISPATCHABLE until the exact destination interface, args/returns, limits, errors, UI copy/tokens where relevant, and emulator DONE command are resolved. Existing original DONE commands are future acceptance, not passing evidence for this draft.

## Supersedes and unresolved work

Supersedes only PR1361 backlog statements that the ticket standard was unavailable and its narrower case-sensitive inventory counts. Does not supersede its deny-all warning or any enforcement. Legacy prose conflict is resolved for this task's additive preparation only; scanner, scope/config guards and all required reviews remain. No full-PASS/preview-tested claim. Draft review must resolve exact contracts and bounded child scopes before implementation.
