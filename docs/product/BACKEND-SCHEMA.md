# Backend schema

## Verdict

The schema that ships today lives in `convex/schema.ts`. This job does not edit that file. The table names below are from `integration` at `5504fc40`. Field lists for the largest tables are summarised. That file is the authority for every field that exists now.

The product target is Firestore, with Firebase Auth, and server code as Vercel functions (FACTORY-LOOP.md, Nir, 2026-11-05). No Firestore collection list exists yet. A ticket must not invent collection names. It maps one Convex table at a time, after Amit accepts the map. Raw mail and chat bodies stay out of the new store the same way they stay out of Convex.

## Tables

| Table | What it holds | Lines |
|---|---|---|
| `users` | Email, name, role `admin` or `user`, `userType` `free` or `paid`, `betaAccess` `none` / `tester` / `founder`, `entitlementTier` `none` / `basic` / `pro` / `max` / `god`, `approvalStatus` `pending` / `approved` / `revoked`, `onboardedAt`, soft delete | 19–61 |
| `subscriptionStates` | `plan` `none` / `trial` / `basic` / `pro` / `max`, cycle, status | 63–88 |
| `conversations` | Chat threads, one person, a title | 90 |
| `messages` | Turns inside a conversation | 113 |
| `voiceSessions` | A voice session. `docs/HARD_RULES.md` says it stores start, end, and duration | 150 |
| `chatRequests` | Coach request rows | 183 |
| `memories` | Per user. `content`, `sector` semantic / episodic / procedural / emotional / general, `salience`, decay, access counts, soft delete | 228–258 |
| `tasks` | Title, status, the person's tasks | 260 |
| `taskRepeatCfgs` | Repeat rules for a task | 315 |
| `calendarEvents` | Events | 354 |
| `focusBlocks` | Focus time | 366 |
| `notes` | `title`, `body` (the page), `pinned`, `periodType` daily / weekly / monthly / none, optional `pageType` daily / weekly / project / plain / template, local `date`, `revision` | 379–415 |
| `noteBlocks` | Derived index of json-render blocks inside `notes.body`. Disposable | 418 |
| `pageOperations` | Ledger of page writes | 536 |
| `pageOperationPayloads` | Payloads for those writes | 596 |
| `pageProposals` | Coach proposals waiting for a person | 641 |
| `habits` | Habits | 696 |
| `goals` | Goals | 710 |
| `dayPlans` | A day's plan | 725 |
| `timeBlocks` | Blocks inside a plan | 745 |
| `habitCheckIns` | Check-ins | 777 |
| `templates` | Templates the coach and the person can run | 801 |
| `userPreferences` | Preferences | 820 |
| `coachWebSearches` | Coach web search rows | 843 |
| `nags` | Nags in the person's own words. Behaviour is Gen 1 unless a screen already shows them | 855 |
| `coachSettings` | Coach settings. The dial in `docs/HARD_RULES.md` section 6.5 is 0 to 10 | 875 |
| `coachProposals` | Proposal rows for accept / edit / reject | 890 |
| `notifications` | Notification rows | 910 |
| `mcpTokens` | MCP tokens. Values are never copied into docs | 929 |
| `connections` | Executor connections | 955 |
| `connectionLimits` | Limits on a connection | 1009 |
| `connectionSecrets` | Secret rows. Never print a value | 1028 |
| `oauthClients` | OAuth client rows | 1048 |
| `oauthPending` | OAuth in progress | 1076 |
| `connectionCalls` | Calls made through a connection | 1105 |

## Rules that match the schema

- One person owns their rows. Queries filter by that person before any model sees the data (`docs/HARD_RULES.md` section 6.6).
- Soft delete uses `deletedAt` where the table has it. Account deletion's 30-day window is in `docs/HARD_RULES.md` section 10. Whether every table honours it was still an open conflict on 2026-10-21.
- `notes.body` is the page. `noteBlocks` is not a second copy the person edits (2026-10-12).
- AI does not write a task or a note by calling a mutation with model arguments and no confirm (`docs/HARD_RULES.md` section 6.2).

## What is not in the schema

- A $20 or $50 plan name. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
- A $100 Gen 2 plan.
- A WhatsApp table. Gen 1 does not add one until a ticket says so. Raw mail and chat bodies stay in memory only (`docs/HARD_RULES.md` section 6.4).

## Flow

```
sign-in (Resend magic link)
  -> users row, approvalStatus
  -> notes.body for the day
  -> noteBlocks derived
  -> coach reads notes + memories
  -> coachProposals / pageProposals
  -> person accepts
  -> tasks / notes / dayPlans update
  -> voiceSessions records duration
  -> connections call Executor
```

## Sources

`convex/schema.ts` at `5504fc40`. `docs/HARD_RULES.md` sections 1, 6 and 10. Decision packet 2026-10-21. Backend target: [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md), 2026-11-05.
