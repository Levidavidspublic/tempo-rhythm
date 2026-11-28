# Tempo Flow: Convex to Firebase migration plan

> Superseded 2026-11-25 by `docs/backlog/INSFORGE-MIGRATION-PLAN.md` (Amit's decision: Tempo's backend moves to InsForge and the Firebase move stops). Kept for reference.

Dated 2026-11-20. Owner decision: Amit, 20 Nov 2026 ("Tempo Flow and OmniAgent are moving from Convex to Firebase"). Written by the round-1 orchestrator (Lane F2). This file is the single plan. Tickets are cut from the WORK LIST below, in order.

Older files this plan builds on (still valid where they do not disagree): `docs/backlog/FIREBASE-DATA-MODEL.md` (where every table goes) and `docs/backlog/FIREBASE-ENV-MAPPING.md` (projects and variable names). Where they say "Convex stays", this plan wins.

## Verdict

Today the app runs 100% on Convex. 117 Firestore helper modules exist under `apps/web/lib/` and none of them is used by a screen. There is no Firebase SDK in the repo and sign-in is still Convex Auth.

The move is done with ONE switch, `NEXT_PUBLIC_DATA_BACKEND` (`convex`, the default, or `firebase`). Every screen is moved behind that switch, one screen per ticket. With the switch on `convex` nothing changes. With it on `firebase` the same screen reads and writes Firestore. When every screen works on `firebase` in preview, data is copied, the switch is flipped, and only then is Convex removed.

Rule for every ticket from now on: **no orphan code**. A ticket is done only when a screen or a server route uses what it added.

## What exists today (measured 20 Nov, integration d77f1d1)

| Thing | Number |
|---|---|
| Convex tables (`convex/schema.ts`) | 36, plus the Convex Auth tables |
| Convex functions | 62 queries, 90 mutations, 11 actions, 5 HTTP actions, 49 internal |
| Lines in `convex/` | about 46,600 (56 test files) |
| Files outside `convex/` that call Convex | 119 (97 web, 22 mobile), tests not counted |
| Convex extras in use | Convex Auth (Resend magic link), 1 cron (page payload cleanup every 5 min), 4 HTTP routes (RevenueCat webhook, MCP, Executor callback), `@convex-dev/agent` component, scheduler in 4 files, 1 vector index. No file storage. |
| Firestore helpers already built | 117 modules: `apps/web/lib/firestore/` (28), `firestore-ops/` (36), `firestore-docs/` (24), `server/` (29). Used only by `/api/waitlist` and `/api/whop/webhook`. |
| Firebase SDK in `package.json` | none |

The full list of call sites, file by file, is in `docs/backlog/CONVEX-CALL-SITES.md`.

## Firebase side

| | Preview | Production |
|---|---|---|
| Project | `tempo-flow-preview-20261106` | `tempo-flow-production` |
| Plan | Spark (no billing) | Spark |
| Auth | Email link (passwordless) | Email link |
| Firestore | `(default)`, Native, `europe-west3` | same |
| Server access | Keyless: Vercel OIDC to a Workload Identity pool to `firebase-preview-admin` | `firebase-production-admin`. Three Vercel Production names were missing on 10 Nov: `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`. Current state UNKNOWN. |

Products used: **Auth** and **Firestore**. Not used: Storage (the app stores no files, and a bucket needs the paid plan), Cloud Functions (paid plan; server work runs in Vercel route handlers instead), Hosting (Vercel hosts the app).

Convex feature and its Firebase home:

| Convex | Firebase side |
|---|---|
| query on the owner's own data | Firestore client SDK, `onSnapshot`, under `users/{uid}/...` |
| mutation on the owner's own data | Firestore client SDK write, checked by the existing `firestore-docs` shapes |
| action, internal function, HTTP action, anything touching `private/**` | one Vercel route, `POST /api/op/<name>`, keyless Firestore REST (`apps/web/lib/server/`) |
| Convex Auth | Firebase Auth email link |
| cron | Vercel Cron calling an op |
| `@convex-dev/agent`, vector index | coach ops; memory search is planned in Stage 4 (UNKNOWN: which vector store, decide there) |

## Keys (names only)

Runtime needs no secret: the server is keyless and the web config is public (`NEXT_PUBLIC_FIREBASE_*`, already set on Vercel Preview).

1Password dev vault, checked 20 Nov (names only): `Convex — tempo-rhythm — CONVEX_DEPLOY_KEY (preview)` and `(production)` = SET (needed for the export). No Firebase or GCP item exists. None is needed for runtime.

Still missing (AT, for Amit or an agent with his go):
1. A way for an agent to deploy `firestore.rules` and indexes and to run the one-time import. Either a 1Password dev-vault item named `Firebase — tempo-flow — deploy (preview)` and `(production)` holding a credential for `firebase-preview-admin` / `firebase-production-admin`, or Amit runs `firebase deploy --only firestore` himself. UNKNOWN how the 8 Nov rules deploy was done.
2. Vercel Production: the three `GCP_*` names above, if still unset.
3. `EXPO_PUBLIC_FIREBASE_*` for mobile (Stage 6).

## Data model

Unchanged from `FIREBASE-DATA-MODEL.md`: owner data at `users/{uid}/{collection}/{docId}`, secrets and authority fields at `private/{uid}/...`, shared OAuth clients at `private/shared/oauthClients/{docId}`. Field names stay as in `convex/schema.ts` minus `userId`. Soft delete stays `deletedAt`.

## How a screen is moved (the pattern every port ticket follows)

Every Convex call a screen makes is moved in two small steps. Step A can start today. Step B needs the rails (FB-002, FB-013, FB-014).

**Step A, the seam (ticket IDs ending in `a`).** The screen stops calling `useQuery(api.x.y)` / `useMutation(api.x.y)` directly. It calls a small hook from `apps/web/lib/data/<area>/`, for example `useTaskList(args)`. The hook is the old Convex call, moved as it is: same arguments, same return value. Nothing changes for the person using the app. The hook file exports a small factory that takes the Convex hook as an argument, for example `makeUseTaskList(useQueryImpl)`, and the hook itself built from it: `export const useTaskList = makeUseTaskList(useQuery)`. Test: call the factory with a fake `useQuery` / `useMutation` and check it is given the same Convex function and the same arguments. Never use `mock.module` and never call the real hook in a test: in the full test run that fails with "Invalid hook call".

**Step B, the Firebase half (ticket IDs ending in `b`).** Only the hook file changes, never the screen. The file gets a second implementation built on `useLiveList` / `useLiveDoc` and the existing `firestore-ops` and `firestore-docs` modules, and picks one at module level: `export const useTaskList = DATA_BACKEND === "firebase" ? useTaskListFirebase : useTaskListConvex;` (no hook is called inside an `if`). It must return the same shape as the Convex half. Test: the Firebase half against the in-memory store (FB-014).

Rules for both steps:
1. One new file per hook, one hook per Convex function. A ticket never edits another ticket's hook file. If the hook already exists, reuse it and name the earlier ticket in WHEN.
2. A step A ticket owns: the new hook file, its test, and the one screen that starts using it. A screen with several Convex calls is moved one call (one ticket) at a time, or in one ticket when the hooks it needs already exist.
3. DONE runs the ticket's own test. The screen's existing test must still pass.
4. A file leaves `CONVEX-CALL-SITES.md` when it no longer imports `convex/react` or `api`.

Server work follows the same idea: one op module per job under `apps/web/lib/server/ops/`, registered once, reached through `POST /api/op/<name>`.

## Sign-in

Firebase Auth email link, same flow people know today. Convex Auth keeps working while the switch is on `convex`. Accounts are matched by email at import. The first Firebase sign-in runs the `account.ensure` op, which creates the gate document (`private/{uid}/account/gate`) with the same approval defaults as `convex/auth.ts`.

## Data copy

Order: export, count, transform, import into preview, compare counts, then the same for production.

1. Export both Convex deployments with `npx convex export` (deploy key from the vault, never printed). Keep the zip files. Nothing is changed on Convex.
2. Count rows per table. If a deployment holds only test data, Amit decides whether to import at all (question open, see FOR AMIT).
3. A transform script turns the export into one JSON file per person, in the Firestore layout, and checks every row with the `firestore-docs` shapes. Rows that fail are listed, not dropped silently.
4. An import op creates the Firebase Auth user by email and writes the documents. It can be run twice without making duplicates.
5. Counts per collection must match the export. The check is a command, not a look.

## Cut-over and rollback

- Preview: set `NEXT_PUBLIC_DATA_BACKEND=firebase` on Vercel Preview only after the whole Playwright suite passes with the switch on `firebase` and the alpha sweep (`e2e/alpha/`) passes against preview.
- Production: needs Amit's yes in chat. Production today serves only the coming-soon page, so the first production app release can start directly on Firebase.
- Rollback: set the switch back to `convex` and redeploy. Convex is not touched until Stage 5, so the old data is still there. Anything written to Firestore after the flip is not copied back; that is why the flip happens on preview first and soaks for a few days.
- Convex is removed only after the soak, in Stage 5, and the last export is kept.

## Tests

- Every ticket ships its own unit test (`bun test`).
- The Playwright suite must pass with the switch on `convex` (today) and on `firebase` (from FB-015). No test is weakened or skipped.
- Firestore rules get rule tests before any deploy.
- Required checks on integration stay as they are: ci, e2e-preview, secret-scan, config-guard, scope-guard.

## Lanes

- **K** = kitchen ticket. Type `component`, at most 3 files + 1 test, no hot files.
- **R** = rail. It needs a hot or guarded file (package.json, lockfile, a `route.ts`, `.github/**`, `AGENTS.md`, `firestore.rules`). The orchestrator runs it as one Codex job and one `config` PR. Rails are few on purpose.

## WORK LIST (in order; a ticket may start when the items it names are merged)

### Stage 0: rails and the switch

| ID | Lane | What exists after it | Needs |
|---|---|---|---|
| FB-001 | R | This plan and `CONVEX-CALL-SITES.md` are on integration. `AGENTS.md` (repo part) and `factory/SLOTS.md` say: the backend is moving to Firebase, tickets come from this plan, `convex/**` is read-only until Stage 5. | none |
| FB-002 | R | `firebase` (web SDK) is in `apps/web/package.json` and `bun.lock`. `NEXT_PUBLIC_DATA_BACKEND=` is in `apps/web/.env.example`. No code change. | FB-001 |
| FB-003 | K | `apps/web/lib/backend-flag.ts`: reads the switch, `convex` unless the value is exactly `firebase`. Used by `app/layout.tsx`, which puts it on the `<html>` element as `data-backend` so a test can see which backend a build runs on. | none |
| FB-004 | K | `apps/web/lib/firebase/client.ts`: one lazy Firebase app, auth and Firestore handle, built from `lib/firebase-web-config.ts`; `null` when the config is missing. Used by FB-005. | FB-002 |
| FB-005 | K | `apps/web/lib/session/use-session.ts`: one hook, `useSession()`, giving `loading / signedOut / signedIn` plus uid and email on both backends. `lib/tab-state` sign-out clearing uses it. | FB-003, FB-004 |
| FB-006 | K | `components/providers/providers.tsx` and `app/layout.tsx` mount the Convex providers only when the switch is `convex`, and a Firebase session provider otherwise. | FB-005 |
| FB-007 | K | `proxy.ts` skips the Convex auth middleware when the switch is `firebase`; a client `SessionGate` sends signed-out people from app routes to `/sign-in`. Surface gate and E2E bypass unchanged. | FB-005 |
| FB-008 | K | `components/auth/SignInForm.tsx` sends a Firebase email link when the switch is `firebase` (helpers: `lib/email-link-sign-in.ts`). | FB-004 |
| FB-009 | K | `/sign-in/finish` page completes the email-link sign-in and calls the `account.ensure` op, then goes to the page the person wanted. | FB-008, FB-011 |
| FB-010 | R | `apps/web/app/api/op/[name]/route.ts`: POST only, checks the Firebase ID token, finds the op in `lib/server/ops/registry.ts`, runs it, answers JSON. Unknown op = 404, bad token = 401. | FB-002 |
| FB-011 | K | Op `account.ensure`: creates the gate, the profile document and the subscription state once; a second call changes nothing. | FB-010 |
| FB-012 | R | `firestore.rules` uses the `accountIsActive` gate from the data model file, with rule tests; indexes file filled as ports need them; deployed to the PREVIEW project. | FB-011, deploy access (AT 1) |
| FB-013 | K | `apps/web/lib/firebase/use-live-list.ts` and `use-live-doc.ts`: React hooks that feed `onSnapshot` into the existing `lib/firestore/live-list.ts` and `live-doc.ts`. Used by the first step B ticket (FB-101b) in the same batch. | FB-004 |
| FB-014 | K | In E2E mode (`NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS=1`) the live hooks and writes use an in-browser store with the same contract, so Playwright needs no real project. | FB-013 |
| FB-015 | R | CI runs the Playwright suite twice: switch `convex` and switch `firebase`. Both are part of `ci`. | FB-014 and at least one ported screen |

### Stage 1: Tasks (web)

Screens and files: see `CONVEX-CALL-SITES.md`, section "web - Tasks" (9 files) plus the task calls inside Today and Plan.

| ID | Lane | What exists after it |
|---|---|---|
| FB-101a | K | `lib/data/tasks/use-task-list.ts` (`tasks.list`), first used by `components/projects/ProjectsScreen.tsx`. |
| FB-102a | K | `lib/data/tasks/use-create-quick-task.ts` (`tasks.createQuick`), used by `components/today/TodayQuickAdd.tsx`. |
| FB-103a | K | `lib/data/tasks/use-toggle-task.ts` (`tasks.toggleCompletion`), used by `components/today/TodayTaskList.tsx`. |
| FB-104a | K | `lib/data/tasks/use-done-tasks-in-range.ts` (`tasks.listDoneInRange`), used by `components/notes/WeekGlance.tsx`. |
| FB-105a.. | K | Hooks for `tasks.create`, `update`, `remove`, `restore`, `renameProject`, `createRepeatCfg`, `setTaskRepeatCfg`, then the remaining task screens switch to the hooks (TaskViewsScreen, TaskKanbanBoard, PriorityBoard, ChecklistBoard, ProjectDetailScreen, TodayEnergyRecommendations and the task calls in other areas). The planner lists the exact files with a code-map step before writing each ticket. |
| FB-101b.. | K | The Firebase half of each task hook, one ticket per hook. Needs FB-013 and FB-014. |

### Stage 2: Notes and pages (web)

Step A then step B, as in Stage 1. Section "web - Notes and pages" (16 files): notes list, page editor, period pages (journal), templates, page operations and proposals. The page ledger writes that must stay atomic go through ops.

### Stage 3: Day (web)

Step A then step B. Section "web - Day" (17 files): habits and check-ins, goals, day plan, time blocks, focus blocks, calendar events, streaks.

### Stage 4: Coach, profile, voice, connections (web)

- Coach (21 files): conversations, messages, chat requests, memories, nags, coach settings, proposals are owner collections. Reply, web search, memory import, crisis check and the AI router become ops. Memory search needs a decision on the vector store before its ticket is written (UNKNOWN).
- Profile and account (22 files): profile, preferences, notifications on the client; approval, admin approvals, account deletion and restore, entitlements as ops.
- Voice (1 file + `convex/voice.ts`): leases and speak as ops.
- Connections and MCP: all ops; `/mcp` and the Executor callback become route handlers (rails).
- Webhooks and cron: RevenueCat webhook route; page payload cleanup as a Vercel Cron op (rails).

### Stage 5: data, flip, remove

| ID | Lane | What exists after it |
|---|---|---|
| FB-501 | R | Convex exports of preview and production are saved and row counts are written down. |
| FB-502 | K | Transform script: export in, per-person Firestore JSON out, every row checked. |
| FB-503 | K | Import op, safe to run twice. |
| FB-504 | R | Import into preview done; counts match. |
| FB-505 | R | Preview switch set to `firebase`; Playwright and the alpha sweep pass. |
| FB-506 | AT | Production import and flip. Amit's yes needed. |
| FB-507 | R | After the soak: remove the Convex half of every hook, `convex/`, the Convex packages, Convex variables, Convex CI workflows (`convex-deploy-test.yml`, `convex-test-admin.yml` and the Convex steps in `ci.yml`, `release*.yml`, `deploy-live.yml`), the `.agents/skills/convex-*` skills. `scope-guard.config.json` data folders point at the Firebase server folders. |
| FB-508 | R | `AGENTS.md`, `CLAUDE.md`, `docs/HARD_RULES.md`, `factory/SLOTS.md`, the six docs and the kitchen prompts name Firebase and no longer mention Convex. The shared template rule "Never touch Convex" is changed in the template repo. |

### Stage 6: mobile

22 files in `apps/mobile`. Same pattern with the Firebase JS SDK and `EXPO_PUBLIC_FIREBASE_*`. Starts after the web flip on preview.

## Old open work

About 55 open pull requests from October add Convex functions or screens on top of them (`t/11xx` to `t/13xx`). They are not part of this plan. Each one is either re-cut as a port ticket or closed; that is Amit's call (see FOR AMIT in the lane report).

## UNKNOWN

- How many real people have data in Convex production and preview (FB-501 answers it).
- How rules were deployed on 8 Nov, and which credential an agent may use to deploy now.
- Whether the three `GCP_*` names exist on Vercel Production today.
- Vector store for memory search.
- Whether mobile gets its own Firebase app ids or shares the web app's.
