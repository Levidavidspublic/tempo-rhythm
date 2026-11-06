# Feature follow-ups — held proposals

WALK — These audited proposals preserve concrete contracts for a later authorized worker. They are not filed implementation issues, completed features or preview proof. Existing held/protected ownership remains in force. Independent checkbox, hero, Plan and pricing tickets proceed separately.

# WALK — CHAT audit and held ticket drafts

Verdict: no honest, independently mounted implementation of the remaining chat research/cancel request can start now without touching reserved files. Three bounded proposals are prepared beside this file; none has been filed, implemented, tested or merged. They each reserve at most three implementation files plus one test file. No repository or remote writes were made by this audit.

| Proposal | New behavior | Dependencies / gate |
| --- | --- | --- |
| TEMPO-FEAT-CHAT-01 | Abort reaches provider fetch/body/backoff | Narrow ownership release from held #1112; convex-arch authorization; reconcile #1116 if adapter lands |
| TEMPO-FEAT-CHAT-02 | Owned request preparation, web/deep policy, persisted cancel, save fence | CHAT-01; narrow release #1110/#1112; approved runtime and cancellation cost policy; convex-arch |
| TEMPO-FEAT-CHAT-03 | Mounted composer calls the genuine lifecycle | CHAT-02; protected #1193 released/landed by owner; narrow release #1129; serialized CoachChat ownership |

The hold dependencies name reservations, not instructions to complete held persona, memory or council features. No blanket hold release is assumed. #1198 stays untouched. All proposals remain hold:true. Root owns issue IDs, ordering, register and remote activity.

## AWAY — Existing behavior, not new work to duplicate

- Coaching intensity already mounts on /coach via CoachControls. getSettings/setDial feed claimTurn's dial and the prompt. Do not create a new slider and count it as a new feature.
- Voice-to-voice already mounts through CoachChat → useVoiceCall/VoiceCall → voiceSession, convex/voice.ts and voicePolicy.ts. It uses Deepgram streaming transcription, the existing coach reply and DeepInfra Chatterbox speech. This audit made no provider call.
- Current availability reason is not knowable from source alone. api.voice.availability({}) returns {available,reason:null|off|language|budget|resting|pending,minutesLeft}. Off requires missing configuration (DEEPGRAM_API_KEY or DEEPINFRA_API_KEY); pending means account approval; language means unsupported locale; budget/resting mean per-person/global limits. Do not claim keys are missing without observing a non-secret status result. No configuration values were read.
- English is the only enabled live voice lane. Hebrew is intentionally held pending an owner-approved Hebrew crisis phrase list. Preview is capped at 15 minutes/person/day and 120 global minutes/day with lease/session caps; those limits are not to be bypassed. Real voice verification spends provider usage and remains unverified under this run's no-spending rule.
- Structured live proposal cards are already mounted. ChatProposal selects OpenUiProposal by a default-on flag, mapping validated stored task/note/template/decision proposals through the existing OpenUI library. Accept/Edit/Reject/Save and five-minute Undo already call existing backend paths. DecisionSteps already uses json-render; CoachSources has an OpenUI source-card path. OpenUI is a different project from Open WebUI: do not claim imported Open WebUI code or parity.
- The requested Open WebUI/json-render SKILL was not found. Existing implementation patterns are available. KA-45/#1128 owns renderer consolidation and study types and depends on #1081/#1101; do not duplicate that work or pretend those extra types already render.

## AT — Proposed Needs Amit lines for the lead to collect

1. Chat research ownership: may the lead allocate narrow, sequential access to coach.ts/coachPrompt.ts/ai_router.ts and later CoachChat.tsx without releasing held persona #1110, memory #1112, or council #1129 features? Protected #1193 cannot be edited in this run; its ownership must resolve before mounted composer work.
2. Think hard runtime model and cost: approve an exact reasoning capability/request schema and bounded budget for the already configured provider/model. Current fast/balanced/deep all resolve to the same model, so tier:deep alone does not satisfy the feature. Provider support for an actual reasoning mode is UNKNOWN; no guessed request field is proposed as implemented.
3. Remote cancellation policy: approve or replace the proposed persisted-state watcher (500ms checks, 90s overall deadline, maximum 180 reads). It adds Convex work and changes long-running behavior. Transport abort can stop continued work but cannot refund completed provider processing. Until approved, CHAT-02 stays held.
4. Hebrew voice: approve the Hebrew crisis phrase list before enabling that lane. Existing English voice does not need a new implementation, but provider-backed preview proof still needs an explicitly authorized, bounded verification path; no paid calls in this run.

These are recommendations for the lead's existing register, not newly assigned AT numbers or remote comments. The lead should deduplicate against existing questions before adding lines.

## UNKNOWN

- Actual preview voice configuration/status and end-to-end provider audio behavior; no live call was made.
- A verified, approved think-hard request mapping and its cost ceiling.
- A connected repository-specific Open WebUI rendering skill; no matching skill was found, and no external code was copied.
- Whether KA-24's future search adapter or KA-45 consolidation has landed after the audited checkout. Re-map immediately before claiming a ticket.
- CI/CodeRabbit state for these proposals: they have no PRs. No check result is claimed.

Current source mismatch for ticket sync: HARD_RULES §6 still describes Mistral tier routing, while ai_router.ts documents an owner-approved interim DeepInfra single-model route. These tickets preserve the actual existing route; they must not silently switch providers to reconcile the docs. The existing web-search adapter separately uses Mistral and may incur usage cost. No additional model call or new provider is authorized by this audit.


---

# [TEMPO-FEAT-CHAT-01] Running coach provider requests can be cancelled

---
ticket: TEMPO-FEAT-CHAT-01
batch: FEATURES
type: data
lane: astra
wave: 1
browser_test: false
scope:
  - convex/lib/ai_router.ts
  - convex/lib/ai_errors.ts
  - convex/lib/webSearch.ts
  - convex/lib/research_cancellation.test.ts
depends_on: ["#1112"]
overlap_test: false
expected_merge: small-conflict
hold: true
---

FOR: tempo-rhythm, Lane 2 Backend, code model: WORKHORSE (Amit's assigned mid-tier model).

WHEN: After the lead obtains an explicit, narrow ownership release for these files from held KA-20/#1112, records it in the shared register, and Amit supplies the existing convex-arch authorization. This does not release the memory feature hold. Re-map KA-24/#1116 before starting: if its provider adapter has landed, extend that adapter's existing seam rather than resurrecting the old implementation. Do not start while another worktree owns any scoped file.

WHY: docs/HARD_RULES.md §§6, 10, 11; docs/design/v3/DESIGN.md §13; Amit's Lane 2 request for real composer cancellation without additional spend. Cancelling the visible spinner alone leaves provider work running.

GOAL: Existing model and search callers can supply an AbortSignal that stops fetch, response-body consumption, and retry backoff, without changing provider, model, retry limits, or callers that omit the signal.

SCOPE: Exactly the three implementation files and one new test file in front matter. No evidence files or other repository edits; paste check evidence into the draft PR.

MUTATES: Existing in-memory provider request lifecycle only; schema none; routes none; env none; dependencies none.

CONTRACT:
```ts
// convex/lib/ai_router.ts: additive optional field; AiResult unchanged.
type AiCallOptions = ExistingAiCallOptions & { signal?: AbortSignal };
function callLLM(options: AiCallOptions): Promise<AiResult>;

// convex/lib/ai_errors.ts: distinct cancellation; never retry this error.
class AiCancelledError extends AiError {} // name: "AiCancelledError"

// convex/lib/webSearch.ts: additive optional field; result unchanged.
type WebSearchProvider = {
  search(query: string, options: {
    maxResults: number;
    signal?: AbortSignal;
  }): Promise<WebSearchResult[]>;
};
// Add "cancelled" to WebSearchErrorKind; retain every existing kind.
```
External cancellation wins if the supplied signal is aborted before an attempt or during body reading/backoff. It throws AiCancelledError for model work and WebSearchError("cancelled") for search. Internal timeout remains the existing upstream/timeout failure, eligible only for the existing retry policy. The 30-second model deadline must cover headers and body; the search deadline stays 20 seconds. No provider-response content, prompt, secret or audio in new logs/errors.

STEPS:
1. Code map: read AGENTS.md, HARD_RULES, SLOTS; read callLLM/attemptCall/sleep and all callers of callLLM; read WebSearchProvider/mistralWebSearch/stubWebSearch and coach.runCoachReply. Recheck the current held issue and KA-24 adapter scopes without modifying them.
2. Add the optional signal and typed cancellation. Check pre-aborted signals before work; forward cancellation to the attempt's AbortController and retain the existing timeout until body consumption completes.
3. Make the existing one-retry backoff cancellable. Remove signal listeners and clear timers in every success/error/abort path. Do not retry cancellation or start another attempt after it.
4. Extend the existing search seam and test stub. Forward abort through headers/body; preserve error redaction, result bounds and existing timeout behavior. No additional provider calls or fallback.
5. Add at least 10 deterministic tests covering pre-abort; abort before headers; during JSON body; during error body; during retry backoff; no retry after abort; timeout remains distinct; listener/timer cleanup; search cancellation; unchanged callers without signals. Use intercepted native fetch and fake timers only. Never send a request to a provider.
6. Open one draft PR to integration only after checks, noting that this is transport support, not a mounted Cancel feature. Root handles ordering/review/merge.

DONE: Bun 1.3.9. Run the complete AGENTS.md cloud sequence in order, continuing after a failure: bun install --frozen-lockfile; bun run lint (0 errors); bun run typecheck (all workspaces pass); bun run test (0 fail, the new file has at least 10 passing tests); bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices (all pass); CI=1 bunx playwright test --reporter=line (no unexpected failure); NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build (pass). No preview/provider tests, deploy commands or env inspection. Network-blocked checks remain UNKNOWN; do not weaken them. Browser appearance is unchanged; existing local browser suite is the regression check.

EVIDENCE: PR check table with actual counts, Bun version and last 20 lines of any failure; test names proving abort reaches the mocked transport and prevents retry. No screenshot is required for this backend-only change. Every fixture is fictional.

DO NOT:
- Touch protected #1193/#1198, any held file without its recorded release, or any file outside SCOPE.
- Call providers, change runtime model/provider, add env names/dependencies, inspect keys, or deploy.
- Claim that abort refunds work already billed, or that this ticket completes composer cancellation.
- Change checks/config/baselines; invoke review bots; merge or push to a default branch.

REPORT: AGENTS.md format on the draft PR: status; ticket; evidence; changed; unknowns; notes for ticket sync. Include Test results (cloud agent sandbox). User's current CodeRabbit gate supersedes old Bugbot wording; do not request a bot run. State coded/locally-tested truthfully; preview/live verification is outside this ticket.

_Planning draft only. No issue, branch or PR has been created for this proposal._


---

# [TEMPO-FEAT-CHAT-02] Coach research requests have an owned, cancellable lifecycle

---
ticket: TEMPO-FEAT-CHAT-02
batch: FEATURES
type: data
lane: astra
wave: 2
browser_test: false
scope:
  - convex/coach.ts
  - convex/lib/coachPrompt.ts
  - convex/lib/coach_research_policy.ts
  - convex/coach_chat.test.ts
depends_on: [TEMPO-FEAT-CHAT-01, "#1110", "#1112"]
overlap_test: false
expected_merge: small-conflict
hold: true
---

FOR: tempo-rhythm, Lane 2 Backend, code model: WORKHORSE (Amit's assigned mid-tier model).

WHEN: After CHAT-01, the lead records a narrow release of coach.ts/coachPrompt.ts from held KA-17/#1110 and KA-20/#1112, and Amit supplies convex-arch authorization. The persona and memory features stay held. Also requires Amit's explicit runtime model/cost decision described below; until that decision, leave this proposal held and continue other work. Never edit protected #1193/#1198.

WHY: HARD_RULES §§1, 6, 10, 11; DESIGN.md §13; Amit's request for use-the-web, think-hard and cancel in the composer. Current reply has no caller request identity or cancellation API; a tier name alone does not change runtime reasoning.

GOAL: A prepared, owner-checked coach turn snapshots its research controls, can be cancelled before or during provider work, and can never save a stale answer after cancellation.

SCOPE: Exactly three implementation files and one existing test file above. New policy file contains only the approved bounded mode policy and cancellation limits. No schema or generated-code edits; if generated typing needs edits outside this scope, report blocked: scope overflow instead of running codegen.

MUTATES: Bounded request metadata in existing messages.toolCalls and existing coach search reservations; no new table/schema, env, route or dependency. Existing message and proposal ownership rules stay in force.

CONTRACT (new public API; existing sendMessage/reply contracts remain compatible):
```ts
type ResearchControls = { useWeb: boolean; thinkHard: boolean };
type TurnKey = {
  conversationId: Id<"conversations">;
  requestId: string; // UUID, bounded to 36 characters, generated by caller
  replyTo: Id<"messages">;
};

// Authenticated query. Does not call providers or disclose configuration values.
coach.researchCapabilities({}): {
  web: { available: boolean; reason: null | "off" | "budget" | "pending" };
  thinkHard: { available: boolean; reason: null | "off" | "pending" };
};

// Mutation. Atomically prepare the newest live user message before the action starts.
coach.beginReply({
  conversationId: Id<"conversations">, requestId: string,
  noteId?: Id<"notes">, dayStartMs?: number, dayEndMs?: number,
  todayDate?: string, research: ResearchControls
}):
  | { status: "ready"; requestId: string; replyTo: Id<"messages"> }
  | { status: "busy" | "idle" }
  | { status: "unsupported"; control: "web" | "thinkHard" };

// Action; one execution claim only. A retry must not duplicate model calls.
coach.replyWithControls(key: TurnKey): {
  status: "replied" | "cancelled" | "unavailable" | "superseded" | "busy";
};

// Mutation; owned conversation required even for an unknown/stale request.
coach.cancelReply(key: TurnKey): { status: "cancelled" | "idle" };

// Internal query used by the running action; validates full stored turn identity.
coach.researchRequestState(key: TurnKey): {
  state: "prepared" | "running" | "cancelled" | "finished" | "superseded";
};
```
Use strict Convex validators for every argument/return. `noteId` must match the current coach/page schema on the target integration revision; if its actual ID table differs from this audited proposal, report the contract drift before editing callers. Store only bounded typed metadata: requestId, replyTo binding, control snapshot, state, lease/deadline and execution claim. Do not persist raw provider output, raw sources or chain of thought in metadata. Existing toolCalls metadata must survive. A repeated beginReply with the same requestId and payload is idempotent; mismatched replay is rejected. Only the current owned turn may reserve search or persist the answer. Cancellation is monotonic and idempotent; stale cancellation cannot cancel a newer request. A cancelled turn cannot be silently reclaimed by legacy automatic reply behavior.

Runtime decision required before implementation:
- Think-hard must map to an explicitly approved, documented capability of the existing configured runtime model, with exact request fields and maximum output/reasoning budget. The current router maps fast/balanced/deep to the same model; merely passing tier: deep is not this feature. No approved mapping has been established. If the approved mapping requires router fields beyond CHAT-01, the lead must first issue a scoped router follow-up; this ticket cannot edit the router.
- Running Convex actions do not receive a browser AbortSignal. Proposed genuine remote cancellation uses a persisted fence plus a bounded status-query watcher that aborts CHAT-01's transport. Proposed policy for Amit to accept or replace: 500 ms check interval, 90-second total action deadline, at most 180 status reads, no new paid provider calls beyond the existing reply/search chain. This adds Convex work and changes a possible long-running timeout; it is not approved by this draft. A different approved transport/policy must keep the same public contract and preserve bounded cost. No browser-only cancellation substitute.
- Per-turn useWeb:true is explicit consent for this turn only; false suppresses search even if the stored preference is on. Neither value changes the global preference. Preserve provider availability, daily search cap, source privacy and crisis rules. The existing adapter can itself bill; no live calls are authorized by this planning work.

STEPS:
1. Code map: read AGENTS/HARD_RULES/SLOTS; sendMessage, claimTurn, claimOf, holdsTurn, reserveWebSearch, releaseTurn, saveReply, runCoachReply, reply, crisis handling and all callers. Read coachPrompt/buildCoachMessages, the CHAT-01 signal contract, and the actual messages.toolCalls validator. Verify the recorded ownership release and runtime decision before editing.
2. Add capabilities and atomic preparation. Require an approved user and owned live conversation/page; enforce request bounds, stable idempotency and mutual exclusion with legacy turns. Snapshot controls and page/day context without authorizing AI mutations.
3. Implement the internal state query, cancel mutation and controlled action. Start the approved bounded watcher before any awaited provider call; cancel the exact transport signal, stop later search/model stages, clean up watcher/timers in finally, and fence every reservation/save. Keep legacy callers working without the new controls.
4. Apply the approved real think-hard policy through callLLM only; no chain-of-thought output, alternate provider, silent escalation or additional model pass. Search results remain untrusted data. A failed or unavailable requested mode returns an honest status rather than silently downgrading.
5. Add at least 14 tests in coach_chat.test.ts: owned preparation; ownership denial; idempotent preparation; mismatched replay; cancel before action; cancel during model; during search; before save; stale cancel; parallel execution claim; no quota reservation after cancel; false web overriding preference; true per-turn web without preference mutation; actual approved think-hard request shape. Include the new mutation happy/error cases and crisis-no-provider regression. All providers and cancellation timing are deterministic fakes.
6. Open one draft PR into integration. Root owns review/merge. Report lifecycle support as code until the dependent mounted UI and local/browser checks land.

DONE: Bun 1.3.9, then the complete AGENTS cloud sequence in order (continue after failures): bun install --frozen-lockfile; bun run lint (0 errors); bun run typecheck (all workspaces pass); bun run test (0 fail and at least 14 new relevant cases pass); bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices (all pass); CI=1 bunx playwright test --reporter=line; NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build. No paid calls, real keys, preview test URL, Convex script or deployment. Blocked network checks are UNKNOWN, not passed. Browser regression uses the existing local suite; this backend ticket has no new visible surface.

EVIDENCE: PR table of actual check counts and Bun version; last 20 failure lines; tests showing transport abort, no stale answer/proposal save, cross-user denial, bounded watcher and exact approved model request fields. No screenshots required for backend-only code. Fictional data only.

DO NOT: Edit any unlisted/reserved file; add schema/env/packages; release persona/memory/council holds; guess the model or cost policy; hide a live request behind a cancelled spinner; promise billing refunds; create AI-originated tasks without existing Accept/Undo; weaken checks; invoke bots; merge/deploy.

REPORT: AGENTS.md status/ticket/evidence/changed/unknowns/notes-for-ticket-sync format plus Test results (cloud agent sandbox). Apply the user's CodeRabbit gate, not obsolete Bugbot instructions. Explicitly list any unapproved runtime policy as blocked and keep hold:true.

_Planning draft only. This contract is proposed, not present on integration. No issue, branch or PR has been created._


---

# [TEMPO-FEAT-CHAT-03] Composer controls use real research and cancellation APIs

---
ticket: TEMPO-FEAT-CHAT-03
batch: FEATURES
type: component
lane: astra
wave: 3
browser_test: true
scope:
  - apps/web/components/coach/CoachChat.tsx
  - apps/web/lib/i18n-groups/coach-chat.ts
  - apps/web/app/v3/coach-research.css
  - apps/web/components/coach/CoachChat.test.tsx
depends_on: [TEMPO-FEAT-CHAT-02, "#1193", "#1129"]
overlap_test: false
expected_merge: small-conflict
hold: true
---

FOR: tempo-rhythm, Lane 2 UI, code model: WORKHORSE (Amit's assigned mid-tier model).

WHEN: After CHAT-02 merges with a real approved runtime policy, protected #1193 is released/landed by its owner, and the lead records a narrow release of CoachChat.tsx from held council/#1129 without releasing the council feature hold. Never touch #1193/#1198 in this run. This ticket is not executable while either reservation remains. Root schedules it after all other CoachChat writers; no parallel edits.

WHY: DESIGN.md §§6, 13; HARD_RULES §§1, 7, 8, 11; Amit's Lane 2 request for use-the-web, think-hard and cancel as first-class composer controls.

GOAL: The mounted shared CoachConversation composer lets the person choose web and genuine approved think-hard research per turn, then cancel that exact prepared/running turn through the server contract, preserving drafts and page context.

SCOPE: Exactly the three implementation files and one existing mounted test file above. Reuse the already registered coach-chat copy group; import the scoped CSS from the component. No route, globals, i18n registry, backend, new package or detached demo component. No new gallery registration because no new component is introduced; use the existing mounted coach/gallery harness for browser evidence.

MUTATES: UI only, calling CHAT-02's already-landed API; no schema/env/routes. The control choice applies to one turn and does not mutate the global web preference.

CONTRACT: Call only the landed CHAT-02 APIs with their exact types: researchCapabilities({}); beginReply({conversationId,requestId,noteId?,dayStartMs?,dayEndMs?,todayDate?,research:{useWeb,thinkHard}}); replyWithControls({conversationId,requestId,replyTo}); cancelReply({conversationId,requestId,replyTo}). Existing sendMessage({conversationId,content}) remains unchanged. Do not fabricate a message ID from its {success:true,crisis?} result: beginReply provides replyTo. Begin must resolve before starting replyWithControls; cancel clicked during preparation is remembered and applied to that exact prepared key before starting the action. If preparation returns unsupported/busy/idle, show its honest state without starting a legacy fallback.

STEPS:
1. Code map: read AGENTS/HARD_RULES/SLOTS; CoachConversation and every send path in CoachChat (typed, suggested follow-up, page and spoken); useVoiceCall/sendSpoken/crisis guard; existing waiting status, draft cleanup and page flush; coach-chat copy exports and CoachChat.test.tsx harness. Read CHAT-02's actual merged validators and compare the contract before implementation. Read protected/held reservations; do not proceed while blocked.
2. Add token-styled, keyboard-reachable per-turn Web and Think hard controls beside the existing composer. Use real capability data; an unavailable mode explains its reason. Do not present a disabled mode as completed functionality, and do not ship this ticket as fulfilling think-hard if its backend is still unapproved. Keep short English and impersonal/plural Hebrew copy; flag Hebrew for Amit's native read.
3. Route typed research turns through sendMessage then prepare then controlled reply. Preserve page save-before-chat and day context. Maintain a stable request key across action retries and account/conversation switches. Never send a crisis turn to the model; preserve existing safety handling. Follow-ups use the same explicit choice policy; voice continues its existing path unless the backend and tests explicitly support identical controls without touching voice files.
4. Add Cancel during preparation/running state. Invoke the exact persisted turn key. Keep pending state until server cancellation/result is known; preserve the draft if preparation/send fails and never discard a newer draft. Do not merely hide a spinner or suppress the action result. Cancellation cannot undo provider work already completed, and copy must not promise it does.
5. Extend the mounted test file with at least 10 cases: toggle args; false web despite preference; actual think-hard args; prepare-before-action; cancel during preparation; cancel during action; stale completion after thread switch; failure retains newer draft; page flush ordering; keyboard/accessible names. Existing voice and crisis tests must still pass. Mock Convex transport only, never providers.
6. Run the complete local checks and existing gallery/screenshot harness at 390 and 1280 widths, English/Hebrew, light/dark, reduced motion. Check no overflow, visible focus, at least 44px-equivalent token touch targets on mobile, one main/one h1 preserved, RTL order and Cancel pending states. Attach fictional-data before/after contact sheets to the PR using the existing artifact workflow; do not add repository evidence outside this strict file scope. Real preview checks remain the root's existing authorized CI/review gate; this worker must not set PLAYWRIGHT_BASE_URL or call a paid model.
7. Open one draft PR to integration; root handles review and merge. Include the scope/reservation and runtime approvals by reference, not secret values.

DONE: Bun 1.3.9; bun install --frozen-lockfile; bun run lint (0 errors); bun run typecheck (all workspaces pass); bun run test (0 fail, at least 10 new mounted cases pass); bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices (all pass); CI=1 bunx playwright test --reporter=line (no unexpected failure); NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build (pass). Run all AGENTS steps even after a failure. Existing local browser/gallery checks must exercise the mounted composer; if the existing harness cannot do so inside scope, report blocked: scope overflow and propose a separate harness ticket without editing it here. Do not claim screenshot mocks prove live provider behavior.

EVIDENCE: Actual check table/Bun version/failure tails; before/after browser contact sheets attached to the PR; mounted test output; separate coded/locally-tested versus preview verification state. All fixture data fictional; no account/provider values.

DO NOT: Touch Convex, routes, protected PRs, held files without release, configs, globals, registry files or checks; install packages; edit e2eWiringRoutes.ts; duplicate existing coaching dial, voice session or OpenUI renderer; fake cancellation/deeper reasoning; invoke paid calls, review bots or deploy; merge.

REPORT: AGENTS.md format and Test results (cloud agent sandbox). Use the user's CodeRabbit review gate. List Hebrew native review and unverified preview/provider behavior separately. Any missing backend function is blocked: missing backend <function>.

_Planning draft only; no issue, branch or PR has been created. It cannot start while #1193 remains protected._


---

# WALK — Accounts follow-up proposals (read-only audit, 21 October 2026)

Paid admission is not complete. New accounts currently get `userType: paid`, `betaAccess: tester`, `entitlementTier: max`, and a lifetime Max subscription, while most accounts remain approval-pending. RevenueCat changes only userType, leaving subscriptionStates unchanged. These are concrete implementation gaps, not payment-provider setup evidence.

These are proposed tickets, not filed issues. All backend tickets need the owner's architecture gate before merge. No account data, provider request, env value, deploy or remote mutation was accessed. No new dependency is needed. Literal RevenueCat product/entitlement IDs remain UNKNOWN and must never be guessed.

## Existing contracts and ownership

- `users.getMyPlan({})` returns null or `{plan: none|trial|basic|pro|max, status: inactive|active|grace|cancelled, label:string, betaAccess:none|tester|founder, entitlementTier:none|basic|pro|max|god, userType:free|paid, isBeta:boolean}`. It reads `subscriptionStates.by_userId.unique()`.
- `approval.setStatus({userId:Id<users>,status:pending|approved|revoked})` returns `{userId,status}` and is admin-only. Internal `setStatusByEmail({email,status})` returns `{userId,email,status}`. Preserve these names and returns.
- `approval.myStatus({})` returns null or `{status:pending|approved|revoked,isAdmin:boolean,email:string}`. `listForAdmin({})` currently lists all live accounts, not explicit beta requests.
- `internal.users.updateSubscriptionStatus({userId:string,userType:free|paid,activeEntitlements:string[],revenueCatEvent:string})` changes only userType. Its implementation ignores entitlement/event fields and resolves email or a cast ID. Do not reuse this as the new billing source of truth.
- `POST /api/revenuecat-webhook` exists in convex/http.ts. `revenueCatWebhook` uses `REVENUECAT_WEBHOOK_SECRET`; invalid/missing secret returns 401/503, but failed mutations currently return 200. No current event ledger or ordered version fields exist.
- `currentTier()` in web billing maps existing beta/founder to Max. This proves the existing Max mapping; it does not prove any RevenueCat product ID or a separate Premium SKU.
- #1193 is OPEN and owns convex/auth.ts, convex/lib/approval.ts, convex/lib/requireUser.ts, TempoShell.tsx and i18n.ts, among other files. Never edit those during the protected run. #1198 is OPEN and owns product/spec docs. Admission tickets requiring those paths are AT, not ready workers.

## A — Regular signup stops granting a beta subscription

Type data; scope: `convex/lib/entitlements.ts`, `convex/auth.ts`, `convex/users.ts`; test `convex/lib/entitlements.test.ts`. Depends on explicit release of protected #1193 ownership, plus approved policy for preserving existing grants. Not runnable in the current protected run.

Keep pure helper function names `newUserFields(profile,now,approvalStatus?)`, `buildReturningUserPatch(existing,profile,now)`, `shouldGrantSubscription(existing?)`. New ordinary accounts receive free/none/none, not tester/Max/paid. Their auth sessions still work; approval is not self-granted. Replace open-signup subscription insertion with an inactive/none/none regular-signup row or absence, consistently in both creation paths. Leave historical approved beta/founder accounts and real billing rows untouched. Returning sign-in never inserts a fresh lifetime grant, never erases fields via undefined, never upgrades an explicit downgrade. Normalize historical god to max only where that historical entitlement is already evidenced.

Test at least: both creation paths use neutral policy; ordinary registration cannot grant beta/paid; returning approved beta and founder persist; explicit free downgrade persists; no undefined patch fields; cancelled/grace/inactive paid subscription never becomes lifetime; missing ordinary row does not grant paid; historical approved grants remain. Existing tests explicitly expecting universal Max must be rewritten as deliberate changed-policy assertions, not removed or skipped.

AT: existing pending accounts were already granted tester/Max. Do not silently reclassify or revoke them en masse. Owner must decide grandfathering separately; this ticket only changes future creation and avoids regranting on login.

## B — Explicit beta request and admin grant

Type data; scope: `convex/schema.ts`, `convex/approval.ts`, new `convex/lib/beta_access.ts`; test new `convex/beta_access.test.ts`. Depends on A and serialization with every schema/approval owner. No protected lib/approval.ts edit.

Schema adds optional `users.betaRequestedAt: number`; absence means no new explicit request. Existing betaApprovedAt is retained. Public new `approval.requestBetaAccess({}) -> {status: pending|approved|revoked, requested:boolean}` resolves only the signed-in user, rejects inactive/deleted accounts, records a timestamp once, and never changes revoked to pending. No userId/email/tier input. Existing approved tester/founder returns approved without downgrade or timestamp churn. Repeated pending request is an idempotent no-op. Ordinary paying users must not be downgraded by requesting beta.

Add `approval.listBetaRequests({}) -> Array<{_id:Id<users>,email:string,fullName?:string,status:pending|approved|revoked,requestedAt:number}>`, admin-only; use an explicit request index in schema instead of a full user scan. Reuse existing admin authentication helper. Do not repurpose listForAdmin or omit legacy accounts from it.

Both existing admin status setters use one pure policy plus shared write helper in approval.ts. Approval of an explicit pending beta request sets tester, betaApprovedAt, Max entitlement and paid access, with an active lifetime Max subscription if there is no real paid/founder row to preserve. Never duplicate by_userId subscription rows. Preserve approvedAt on repeated approval. Revocation removes the beta-derived access while preserving independent provider entitlement; precise coexistence requires the canonical projection in D below. Until D exists, do not implement destructive downgrade of paid rows by inference from userType.

Tests: signed-out refusal; cross-user input impossible; ordinary user cannot approve/list; revoked request cannot self-reopen; deleted target cannot receive grant; repeated request/approval stable; one subscription row; founder/real paid row preserved; both admin entry points have identical policy. A UI request button/admin beta-queue ticket follows this backend; it must not use a mock request or change protected auth/shell files during this run.

AT: this ticket can be prepared but must not ship a partial coexistence/revocation rule. Resolve D policy and historic request classification before merge.

## C — Validate RevenueCat envelopes behind an off switch

Type data; scope: `convex/revenuecat.ts`, `convex/lib/revenuecat_events.ts`; test `convex/lib/revenuecat_events.test.ts`. Independent from auth files. No schema or new environment variable needed.

Introduce explicit server-owned `REVENUECAT_PROCESSING_ENABLED = false` and an empty typed product catalog in revenuecat_events.ts; no client-controlled flag. This is separate from unchanged frontend PAYMENT_SYSTEM_ENABLED=false. With processing off, authenticated requests return an explicit disabled result and cannot call any mutation. Keep missing/bad secret 503/401. Document that provider enablement is owner-only and out of scope.

Pure proposed `parseRevenueCatEvent(input:unknown, catalog:Readonly<Record<string,{plan:trial|basic|pro|max,billingCycle:monthly|annual}>>) -> {ok:true,event:{eventId:string,eventAtMs:number,appUserId:string,productId:string,plan:trial|basic|pro|max,billingCycle:monthly|annual,eventType:string,paidThroughMs:number}} | {ok:false,reason: malformed|unsupported-event|unmapped-product}`. Strict finite nonnegative timestamps, nonempty bounded IDs, object/array validation. Reject aliases/transfers until their identity semantics are explicitly implemented; unknown events never revoke. Map only verified server catalog entries; catalog remains empty in shipping code. Synthetic test products stay in test fixtures and never production maps.

Keep the old exported mapRevenueCatEventToUserType unchanged for existing callers until D replaces the webhook call path; do not redefine old cancellation tests into silently weaker assertions. Tests cover null/arrays/missing fields, invalid timestamps, unknown product/event, configured synthetic fixture normalization, off switch causing zero mutation calls, missing/bad authorization, invalid JSON. No provider calls or charge in tests.

## D — Canonical subscription event application and paid admission

Type data; proposed scope `convex/schema.ts`, `convex/revenuecat.ts`, new `convex/lib/subscription_policy.ts`; test new `convex/revenuecat.test.ts`. Depends on A/B/C and owner architecture decision for the following contract. Keep C’s processing switch false throughout this ticket.

New internal-only `revenuecat.applyEvent({userId:Id<users>,eventId:string,eventAtMs:number,productId:string,plan:trial|basic|pro|max,billingCycle:monthly|annual,status:active|grace|cancelled|inactive,paidThroughMs:number}) -> {result:applied|duplicate|stale|inactive-account|revoked-account}`. Handler normalizes provider app_user_id via db.normalizeId before dispatch, never email alias matching or unchecked casts. Event plan/cycle comes only from C’s server catalog. Mutation performs all state, paid projection and approval writes in one transaction; no public caller can self-upgrade.

Add optional provider event ID/time, product ID and paid-through fields to subscriptionStates. A repeated latest event is duplicate; older timestamps are stale. Same-timestamp different events must not be arbitrarily ordered by lexical IDs: reject/record as an ambiguous conflict for reconciliation. The precise conflict return extends the proposed result union before implementation. Keep full receipts or a stable sequence only if the architecture owner requires them; do not invent a new unbounded raw payload store.

Valid active paid purchase atomically updates subscriptionStates plus userType/entitlementTier and approvalStatus approved, without waiting for beta admin approval. Explicit revoked, deleted or inactive account is never reopened. Cancellation preserves paid access until paidThroughMs; expiry affects provider access only and never removes an independently approved beta/founder grant. Mutation failure returns retryable HTTP 5xx, not current false-success200; no raw provider payload/error logging.

Security tests: invalid ID cannot target another account; public mutation invocation impossible; duplicate/out-of-order delivery does not regress tier or approval; concurrent unique-row insertion safe; expiry/cancellation semantics; revocation precedence; paid purchase gets immediate approval; provider expiry preserves approved beta; disabled HTTP cannot write; failed writes return non-2xx.

This remains flagged preparation, not operational checkout. Before enabling, a separate bounded read-projection/access ticket must make getMyPlan and paid capability checks evaluate paidThroughMs (and beta grant precedence) at read time; relying only on timely expiration webhooks is insufficient. Enumerate actual guards before scoping that ticket. Do not claim D alone closes access expiry or all payment wiring.

## AT / UNKNOWN to copy to the shared register

- AT: release protected #1193 admission files for a follow-up; current run must leave them untouched.
- AT: owner architecture approval for beta/provider coexistence and historical open-signup grants; no automatic mass reclassification.
- AT: actual RevenueCat product/entitlement IDs and approved mapping to existing trial/basic/pro/max; no invented Premium SKU. Keys later, names only: existing REVENUECAT_WEBHOOK_SECRET; any checkout SDK key need remains UNKNOWN until provider path is chosen.
- AT: enablement only after full contract, read-time expiry and tests; all shipping provider flags remain false, with no live charges or deployment by agents.
- UNKNOWN: existing preview provider configuration, any real successful paid entitlement, historical grants policy and paid capability guard inventory. Public pricing is not evidence for these.


---

# WALK — Habit and goal starter follow-up (21 October 2026)

The catalog has daily, weekly, monthly, meeting, project, reading, journal, task-review and project-review starters. Habit and goal are missing. Locale-aware catalog work already belongs to open KA-02 #1095, and template UI integration belongs to KA-11 #1104. Do not build a parallel locale implementation.

Proposed type:data ticket depends on #1095 and #1104. Scope: `convex/lib/templateCatalog.ts`, `apps/web/lib/i18n-groups/starter-templates.ts`; test `convex/templates.test.ts`; evidence only otherwise. Backend architecture gate still applies. No schema, environment, runtime AI, route or package changes.

Add exact IDs `starter:habit` and `starter:goal`, both periodType none. Use KA-02's optional `he: {name,description,body}` field and existing `templates.list/get/applyToNote` locale contract. Card copy uses existing starter group ID mapping. Listing automatically mounts both in the real TemplatesLibrary; do not add isolated gallery-only components. The existing run flow creates user-owned editable notes, not actual goal/habit records; copy must say what is created.

Original short body sections: Habit — small action, cue, smallest version, what helps, gentle restart, notes. Goal — what matters, what done looks like, next small step, support, review, notes. English and machine-drafted impersonal Hebrew, flagged for native review. No completion/streak pressure, invented automatic schedules, AI mutation or unconfirmed cross-feature writes.

Exact inherited calls: `templates.list({scope?,locale?:en|he})`, `templates.get({templateId,locale?:en|he})`, `templates.applyToNote({templateId,title?,locale?:en|he}) -> Id<notes>`. Preserve existing starter IDs and English bodies byte-for-byte. Neither starter is eligible for period auto-proposal.

Tests add at least six cases: both IDs listed, none period, Hebrew names/body/sections, default English, apply creates owned editable note, existing starters unchanged. Run existing period-page-body regression too. Browser evidence must open both real cards, create fictional pages and edit them in EN/HE; if KA-11 still uses notes.create without locale, do not patch that caller outside scope—dependency is not fulfilled.

AT: approved ownership/dependency handoff and Hebrew native read. UNKNOWN: whether KA-02/KA-11 merge before this run ends. No issue or PR was created by this audit.
