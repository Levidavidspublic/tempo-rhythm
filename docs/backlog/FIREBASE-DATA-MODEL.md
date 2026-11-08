# Firebase data model

Dated 2026-11-08. Preview project `tempo-flow-preview-20261106` only. Convex stays. This file maps tables and functions. It does not switch production.

## Verdict

Owner data the signed-in person may edit lives at `users/{uid}/...`, where `uid` is the Firebase Auth user id. The client reads and writes that tree with the Firestore client SDK and `onSnapshot`. Ciphertext, token hashes, OAuth client secrets, PKCE verifiers, authorization fields, billing state, and voice-budget leases do not live in that tree. They live under `private/...`, which the preview rules deny to every client. Server work uses the Admin SDK in Vercel routes with the existing keyless workload identity. Nothing in this map is deployed by this document.

`firestore.rules` is not on `integration` yet. PR #1366 adds deny-by-default plus owner access to `users/{uid}/**`. That owner rule is an OR, so a later `allow if false` on a subcollection would not close it. Secret rows must stay outside `users/{uid}`.

## Rules this map needs

#1366 adds deny-by-default plus an owner allow on `users/{userId}/{document=**}` that checks only the uid. That allow is not enough. `isInactiveAccount` in `convex/lib/accountDeletion.ts` is `deletedAt !== undefined || isActive === false`, and `requireUser` rejects those accounts. A Firebase ID token can still be presented after the account is deactivated. Replace the owner allow. Do not add a second allow beside it: rules OR together, so the wide allow would stay open.

```
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId
    && accountIsActive(userId);
}
function accountIsActive(userId) {
  let gate = get(/databases/$(database)/documents/private/$(userId)/account/gate).data;
  return gate.deletedAt == null && gate.isActive != false;
}
```

A missing gate fails closed (`get` fails). The sign-up route writes the gate before the client is expected to use the tree. `approvalStatus` is not part of this rule: a pending account can still read its own tree, and `requireApprovedUser` stays on the server routes that spend money.

The catch-all deny stays. `private/**` is already denied by it. Admin SDK bypasses rules. This document does not edit `firestore.rules`. The replacement is the rules change that follows #1366, preview project only.

## Identity

| Convex | Firebase |
|---|---|
| `...authTables` from `@convex-dev/auth/server` | Not copied. Firebase Auth email link replaces them. Individual auth table names are UNKNOWN here (they come from the package, not this repo's schema). |
| `users` | Document `users/{uid}` holds only fields the person may edit: `name`, `fullName`, `onboardedAt`. Authorization fields are not on this document. Lookup by email is a server query, not a client list of every user. |
| Convex `userId` (`v.id("users")`) | Dropped. The path uid is the owner. |

## Owner collections

Path: `users/{uid}/{collection}/{docId}`. Fields stay as in `convex/schema.ts` on this date, minus `userId`. Soft-delete stays `deletedAt`. These tables each declare `userId` in the schema:

`conversations`, `chatRequests`, `memories`, `tasks`, `taskRepeatCfgs`, `calendarEvents`, `focusBlocks`, `notes`, `noteBlocks`, `pageOperations`, `pageOperationPayloads`, `pageProposals`, `habits`, `goals`, `dayPlans`, `timeBlocks`, `habitCheckIns`, `templates`, `userPreferences`, `coachWebSearches`, `nags`, `coachSettings`, `coachProposals`, `notifications`, `connections`, `connectionCalls`.

`connectionLimits` declares `userId` but is not in this list. It holds the connect-attempt and Executor-call counters (`convex/connections.ts`). A client write could reset them. It is private.

`subscriptionStates` and `voiceSessions` declare `userId` but are not in this list. Their writes decide billing and the shared voice cap, so they are private. See the next section.

`messages` has no `userId`. It has `conversationId`. Store it at `users/{uid}/messages/{docId}` for the conversation's owner. The client never sees another uid's messages because the path is the rule.

`connections` may be read by the owner (status, no token). `confirmNonceHash` is a hash. The nonce itself is not a schema field.

## Private collections (Admin SDK only)

| Convex | Firestore path | Why it is not under `users/{uid}` |
|---|---|---|
| `connectionSecrets` | `private/{uid}/connectionSecrets/{docId}` | Access and refresh token ciphertext. |
| `oauthPending` | `private/{uid}/oauthPending/{docId}` | PKCE verifier ciphertext and state hash. |
| `mcpTokens` | `private/{uid}/mcpTokens/{docId}` | SHA-256 of a personal MCP token. The owner may list name and prefix through a Vercel route, not the client SDK. |
| `oauthClients` | `private/shared/oauthClients/{docId}` | Shared across people. No `userId`. Holds `clientSecretCipher`. Four path segments, so it is a document. `private/oauthClients/{docId}` is three segments (a collection) and cannot be written as a document. |
| `users` authorization fields | `private/{uid}/account/gate` | `email`, `emailVerificationTime`, `emailVerified`, `role`, `userType`, `betaAccess`, `entitlementTier`, `isGodTier`, `betaApprovedAt`, `isActive`, `approvalStatus`, `approvalUpdatedAt`, `approvalUpdatedBy`, `createdAt`, `updatedAt`, `deletedAt`. `convex/lib/approval.ts` treats `role` and the admin email list as authorization. `updateProfile` and `updateMyProfile` only write `fullName`. `updateUserType` stays a Vercel route that keeps `assertClientMaySetUserType`. The client SDK does not write this document. |
| `subscriptionStates` | `private/{uid}/subscriptionStates/{docId}` | Plan and status. Inserted at sign-up (`convex/auth.ts`) and patched on account deletion (`convex/lib/accountDeletion.ts`). The RevenueCat webhook does not write this collection. `updateSubscriptionStatus` patches `userType` on `private/{uid}/account/gate`. |
| `connectionLimits` | `private/{uid}/connectionLimits/{docId}` | Connect-attempt and Executor-call counters. The owner may see the numbers through a Vercel route. The client SDK does not write the counters. |
| `voiceSessions` | `private/{uid}/voiceLeases/{docId}` | `usedGlobalMs` in `convex/voice.ts` sums every lease on one UTC day, and a day with too many rows counts as fully spent. A client insert under the owner rule could fill that cap for everyone. `start`, `renew`, and `stop` stay server routes. |

## Functions

Public `query` / `mutation` for the owner collections above become client SDK reads and writes. A live query becomes `onSnapshot`. `action`, `internalQuery`, `internalMutation`, `internalAction`, and `httpAction` become Vercel route handlers using the Admin SDK. Convex files are not edited.

Port order, one PR each, after this map and the scanner PR are on `integration`:

1. Tasks: `convex/tasks.ts` (`tasks`, `taskRepeatCfgs`).
2. Notes: `convex/notes.ts` plus page ledger modules (`notes`, `noteBlocks`, `pageOperations`, `pageOperationPayloads`, `pageProposals`, `templates`).
3. Day: `habits`, `habitCheckIns`, `goals`, `dayPlans`, `timeBlocks`, `focusBlocks`, `calendarEvents`.
4. Coach: `conversations`, `messages`, `chatRequests`, `memories`, `nags`, `coachSettings`, `coachProposals`, `coachWebSearches`. Reply, web search, and Executor calls stay server routes.
5. Profile: client writes `name`, `fullName`, and `onboardedAt` on `users/{uid}`. `userPreferences` and `notifications` stay owner collections. Authorization fields and `subscriptionStates` are server routes. Billing webhooks stay server routes (`convex/revenuecat.ts`).
6. Voice: leases at `private/{uid}/voiceLeases/{docId}`. `convex/voice.ts` `start`, `renew`, `stop`, and the speak actions are server routes. The client does not write the lease rows the global cap reads.
7. Connections and MCP: owner-visible rows in `connections` and `connectionCalls`. `connectionLimits` stays a server route. Everything in the private table stays a server route (`convex/connections.ts`, `connectionsHttp.ts`, `mcp.ts`, `mcpHttp.ts`).

`convex/auth.ts` (`signIn`, `signOut`, `isAuthenticated`) is Phase 2, behind the Firebase flag. Convex Auth keeps working when the flag is off.

## Not done

- Rules file is still only on PR #1366. This document does not deploy rules.
- No collection is created by this PR. Firestore creates a collection on first write.
- EXPO public Firebase env names are unset. Mobile is out of this map's first code PRs.
