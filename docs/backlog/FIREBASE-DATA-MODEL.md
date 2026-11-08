# Firebase data model

Dated 2026-11-08. Preview project `tempo-flow-preview-20261106` only. Convex stays. This file maps tables and functions. It does not switch production.

## Verdict

Owner data lives at `users/{uid}/...`, where `uid` is the Firebase Auth user id. The signed-in client reads and writes that tree with the Firestore client SDK and `onSnapshot`. Ciphertext, token hashes, OAuth client secrets, and PKCE verifiers do not live in that tree. They live under `private/...`, which the preview rules deny to every client. Server work uses the Admin SDK in Vercel routes with the existing keyless workload identity. Nothing in this map is deployed by this document.

`firestore.rules` is not on `integration` yet. PR #1366 adds deny-by-default plus owner access to `users/{uid}/**`. That owner rule is an OR, so a later `allow if false` on a subcollection would not close it. Secret rows must stay outside `users/{uid}`.

## Rules this map needs

After #1366 is on `integration`, the rules stay:

- `users/{userId}/{document=**}` — read and write only when `request.auth.uid == userId`.
- `/{document=**}` — deny.

No new allow rule. `private/**` is already denied by the catch-all. Admin SDK bypasses rules.

## Identity

| Convex | Firebase |
|---|---|
| `...authTables` from `@convex-dev/auth/server` | Not copied. Firebase Auth email link replaces them. Individual auth table names are UNKNOWN here (they come from the package, not this repo's schema). |
| `users` | Document `users/{uid}` (profile fields from `convex/schema.ts`). `email` stays a field. Lookup by email is a server query, not a client list of every user. |
| Convex `userId` (`v.id("users")`) | Dropped. The path uid is the owner. |

## Owner collections

Path: `users/{uid}/{collection}/{docId}`. Fields stay as in `convex/schema.ts` on this date, minus `userId`. Soft-delete stays `deletedAt`. These tables each declare `userId` in the schema:

`subscriptionStates`, `conversations`, `voiceSessions`, `chatRequests`, `memories`, `tasks`, `taskRepeatCfgs`, `calendarEvents`, `focusBlocks`, `notes`, `noteBlocks`, `pageOperations`, `pageOperationPayloads`, `pageProposals`, `habits`, `goals`, `dayPlans`, `timeBlocks`, `habitCheckIns`, `templates`, `userPreferences`, `coachWebSearches`, `nags`, `coachSettings`, `coachProposals`, `notifications`, `connections`, `connectionLimits`, `connectionCalls`.

`messages` has no `userId`. It has `conversationId`. Store it at `users/{uid}/messages/{docId}` for the conversation's owner. The client never sees another uid's messages because the path is the rule.

`connections` may be read by the owner (status, no token). `confirmNonceHash` is a hash. The nonce itself is not a schema field.

## Private collections (Admin SDK only)

| Convex | Firestore path | Why it is not under `users/{uid}` |
|---|---|---|
| `connectionSecrets` | `private/{uid}/connectionSecrets/{docId}` | Access and refresh token ciphertext. |
| `oauthPending` | `private/{uid}/oauthPending/{docId}` | PKCE verifier ciphertext and state hash. |
| `mcpTokens` | `private/{uid}/mcpTokens/{docId}` | SHA-256 of a personal MCP token. The owner may list name and prefix through a Vercel route, not the client SDK. |
| `oauthClients` | `private/oauthClients/{docId}` | Shared across people. No `userId`. Holds `clientSecretCipher`. |

## Functions

Public `query` / `mutation` for the owner collections above become client SDK reads and writes. A live query becomes `onSnapshot`. `action`, `internalQuery`, `internalMutation`, `internalAction`, and `httpAction` become Vercel route handlers using the Admin SDK. Convex files are not edited.

Port order, one PR each, after this map and the scanner PR are on `integration`:

1. Tasks: `convex/tasks.ts` (`tasks`, `taskRepeatCfgs`).
2. Notes: `convex/notes.ts` plus page ledger modules (`notes`, `noteBlocks`, `pageOperations`, `pageOperationPayloads`, `pageProposals`, `templates`).
3. Day: `habits`, `habitCheckIns`, `goals`, `dayPlans`, `timeBlocks`, `focusBlocks`, `calendarEvents`.
4. Coach: `conversations`, `messages`, `chatRequests`, `memories`, `nags`, `coachSettings`, `coachProposals`, `coachWebSearches`. Reply, web search, and Executor calls stay server routes.
5. Profile: `users` profile fields, `userPreferences`, `notifications`, `subscriptionStates`. Billing webhooks stay server routes (`convex/revenuecat.ts`).
6. Voice: `voiceSessions` plus `convex/voice.ts` actions as server routes.
7. Connections and MCP: owner-visible rows in `connections`, `connectionLimits`, `connectionCalls`. Everything in the private table stays a server route (`convex/connections.ts`, `connectionsHttp.ts`, `mcp.ts`, `mcpHttp.ts`).

`convex/auth.ts` (`signIn`, `signOut`, `isAuthenticated`) is Phase 2, behind the Firebase flag. Convex Auth keeps working when the flag is off.

## Not done

- Rules file is still only on PR #1366. This document does not deploy rules.
- No collection is created by this PR. Firestore creates a collection on first write.
- EXPO public Firebase env names are unset. Mobile is out of this map's first code PRs.
