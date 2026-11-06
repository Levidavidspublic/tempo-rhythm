# Backend schema

## Verdict

The schema that ships today lives in `convex/schema.ts`. This job does not edit that file. The table names below are from `integration` at `5504fc40`. Field lists for the largest tables are summarised. That file is the authority for every field that exists now.

The product target is Cloud Firestore on the free Spark plan, with Firebase Authentication, and server code as Vercel functions (FACTORY-LOOP.md, Nir, 2026-11-05). Spark has no Cloud Functions and no App Hosting. Every model call runs as a Vercel function. Cloudflare stays. Upgrading to the paid Blaze plan is an open decision. It is Amit's only. It is not a step. No Firestore collection list exists yet. Collection names are UNKNOWN. A ticket must not invent collection names. It maps one Convex table at a time, after Amit accepts the map. Raw mail and chat bodies stay out of the new store the same way they stay out of Convex. The code at `5504fc40` is still Convex.

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

- Dollar tier names. Evening of 5 Nov 2026: $20 is the bare essential, $50 adds the voice feature, $100 is more agentic (API and calls on the person's behalf). Whether $100 includes the voice feature is UNKNOWN. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md). These are not table names. The evening decision explicitly associates $100 with Gen 2. Mapping that public price to a persisted plan identifier is still UNKNOWN; this is not a new schema field.
- A Gen 2 read-only assistant as a table. Gen 2 is phone calls, and a website turned into a read-only API on half a CPU core and a headless browser. He said that is not reverse-engineering. Half a CPU core is his figure. It is not an alpha limit and not a collection.
- A Gen 3 read-write store. Gen 3 waits on a compliance level. The level is UNKNOWN.
- An alpha text-model column. Alpha text is stock GLM 5.3 Flash or DeepSeek, chosen by the task (2026-11-05 evening). The morning GLM-only line is older for the alpha. Qwen 8B still tags. gpt-oss-safeguard 20B is still the crisis classifier (2026-10-21). None of those names is a new table.
- A custom-model table. Custom models that teach subtasks and threading are a later stage. Which generation is UNKNOWN. They are not in the alpha.
- A voice-model or GPU table. Voice-to-voice belongs to MVP, not Alpha. The 6 Nov hosted-first chain and conditional later GPU path are in [VOICE-TO-VOICE.md](./VOICE-TO-VOICE.md); no model/GPU table or approved retention schema is inferred. Existing Deepgram listening is not silently replaced.
- A WhatsApp table. Gen 1 does not add one until a ticket says so. Raw mail and chat bodies stay in memory only (`docs/HARD_RULES.md` section 6.4).
- Any Firestore collection name. UNKNOWN. Do not invent one.

## Flow

```
sign-in (Resend magic link, code today)
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

This flow is the code today: Convex, and a Resend magic link. The 5 Nov target is Firebase Authentication plus Cloud Firestore. The 6 Nov FIREBASE-PLAN names Resend as Tempo's sender; the exact Firebase email-link delivery integration remains OPEN. On the alpha, Executor runs in the backend. The person does not connect MCPs. Collection names stay UNKNOWN.

## Sources

`convex/schema.ts` at `5504fc40`. `docs/HARD_RULES.md` sections 1, 6 and 10. Decision packet 2026-10-21. Backend target: [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md), 2026-11-05.
