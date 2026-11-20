# Tempo Flow: Backend Schema

> **Last updated 2026-10-03** (IDT) · Written by Grok Bot from the sources below · Decisions are Amit's.
> **Sources:** the repo on `integration` at `5b9675e` (3 Oct): [`convex/schema.ts`](https://github.com/Division6066/tempo-rhythm/blob/integration/convex/schema.ts) (11 app tables + Convex Auth tables), `convex/*.ts`, `convex/lib/accountDeletion.ts`, `convex/lib/requireUser.ts`, `convex/MIGRATIONS.md`, `docs/HARD_RULES.md` · factory-v2 product docs v2 (20 Sep 2026): `05-BACKEND-SCHEMA.md` (block model) · the 3 Oct schema proposal (compile-checked with `tsc` on a scratch copy, no Convex command run) and umbrella [#546](https://github.com/Division6066/tempo-rhythm/issues/546) with its children #526–#545 · Basic Memory `Weekend factory plan 2026-10-02` (sign-up cap).
> **Markers:** UNKNOWN = not known or not decided. (EXTRAPOLATED) = Grok Bot's own fill, not a decision. Newer Amit decisions win over older sources; conflicts are listed in §7.
> **Deployments:** dev/preview `ceaseless-dog-617`; prod `precious-wildcat-890` (agents never touch it). See [TRD](./TRD.md) §2.
> **Companion docs:** [PRD](./PRD.md) · [TRD](./TRD.md) · [App flow](./APP-FLOW.md) · [UI brief](./UI-BRIEF.md) · [Roadmap](./ROADMAP.md)

## 1. Conventions (verified in the repo)

| Convention | Rule |
|---|---|
| Owner | `userId: v.id("users")` on every user-owned table, set on the server from `requireUser(ctx)`, never sent by the client |
| Timestamps | `createdAt`, `updatedAt` (ms numbers, required); `deletedAt?` for soft delete |
| Soft delete | Every "remove" patches `deletedAt`. Live rows are read with `.eq("deletedAt", undefined)` on a compound index. Account deletion soft-deletes every table in `USER_OWNED_TABLES` (`convex/lib/accountDeletion.ts`), which needs `by_userId` + `updatedAt` on each table |
| Index names | `by_userId`, `by_userId_deletedAt`, `by_userId_deletedAt_<field>` |
| Enums | `v.union(v.literal(...))` |
| References | `v.id("table")` |
| Queries | No `Date.now()` inside a query; the browser passes the time or the local day |
| Reads during auth settle | Today reads use `fetchCurrentUser` and return `[]` / `null` with no user; mutations use `requireUser` |
| Migrations | Additive changes need no migration but are logged in `convex/MIGRATIONS.md` |
| Generated API | `convex/_generated/api.d.ts` is committed; new modules are listed there |

## 2. Tables today (11 + Convex Auth)

| Table | Key fields | Indexes | Notes |
|---|---|---|---|
| `users` | `email`, `name?`, `fullName?`, `role?` (admin/user), `userType?`, `betaAccess?` (none/tester/founder), `entitlementTier?` (none/basic/pro/max/god), `isGodTier?`, `betaApprovedAt?`, `isActive?`, `deletedAt?` | `by_email`, `by_role`, `by_userType`, `by_betaAccess`, `by_deletedAt` | No time zone or preferences field. Purpose of `god`: UNKNOWN. |
| `subscriptionStates` | `userId`, `plan` (none/trial/basic/pro/max), `billingCycle`, `status`, `trialUsed`, `source?` | `by_userId` | Granted on first sign-in (`source: "open_signup_grant"`) |
| `conversations` | `userId`, `title`, `technique?`, `deletedAt?` | `by_userId`, `by_userId_updatedAt`, `by_userId_deletedAt` | Coach threads |
| `messages` | `conversationId`, `role`, `content`, `modelUsed?`, `councilResponse?`, `toolCalls?`, `deletedAt?` | `by_conversationId`, `…_createdAt`, `…_deletedAt` | No `dial` field yet (20 Sep target adds it) |
| `memories` | `userId`, `content`, `sector` (semantic/episodic/procedural/emotional/general), `salience`, `decayRate`, `lastAccessed`, `accessCount`, `metadata?` | `by_userId`, `by_userId_salience`, `by_userId_deletedAt` | The memory port sits on it. No search index yet. |
| `tasks` | `userId`, `title`, `description?`, `status` (todo/in_progress/done/cancelled), `priority`, `energy?`, `timeEstimate?`, `repeatCfgId?`, `parentTaskId?`, `projectId?`, `projectName?`, `dueAt?`, `checklist?` | `by_userId`, `by_userId_status`, `by_userId_dueAt`, `by_userId_projectId`, `by_userId_deletedAt` | No `completedAt` |
| `taskRepeatCfgs` | `repeatCycle`, `repeatEvery`, `weekdays`, monthly fields, `skipOverdue`, `isPaused`, `lastTaskCreationDay?` … | `by_userId`, `by_userId_deletedAt` | Nothing spawns the next task (no cron) |
| `calendarEvents` | `userId`, `title`, `startsAtMs` | `by_userId`, `by_userId_deletedAt_startsAtMs`, `by_userId_deletedAt` | No end time, no edit or delete functions |
| `notes` | `userId`, `title`, `body`, `pinned`, `periodType` (daily/weekly/monthly/none), `aiGenerated?` | `by_userId`, `by_userId_pinned`, `by_userId_updatedAt`, `by_userId_deletedAt` | Soft delete since #516 |
| `habits` | `userId`, `name`, `cadence` (daily/weekly), `currentStreak`, `longestStreak`, `lastCompletedAt?` | `by_userId`, `by_userId_deletedAt` | "Checked today" is a rolling 24 h window, not a calendar day (`convex/lib/habitStreak.ts`) |
| `goals` | `userId`, `title`, `description?`, `targetDate?`, `progressPercent`, `status` | `by_userId`, `by_userId_status`, `by_userId_deletedAt` | No UI wired |

**Functions today** (`export const`): `tasks` list, listDueInRange, create, update, remove, createQuick, listToday, toggleCompletion, repeat-cfg functions · `habits` list, create, completeToday, update, remove · `calendar_events` listInRange, create · `notes` list, get, create, update, togglePin, remove · `conversations`, `messages`, `coach.sendMessage` · `memories` queryMemories, addMemory, updateSalience, deleteMemory, decayMemories, extractMemories, getMemoryStats · `analytics` overview, insightsSummary · `streaks.getCurrent` · `brain_dump.prioritize` · `goals` list, create, update, remove · `users` profile and account functions incl. deleteMyAccount · `revenuecat.revenueCatWebhook` (HTTP).
**Hard-delete defects** (`ctx.db.delete`): `tasks.remove`, `habits.remove`, `goals.remove`, `memories.deleteMemory`, `messages.remove`, `conversations.remove`, `users.remove`.

## 3. Proposed planner tables (#546, additive only, triaged, not built)

Ticket [#529](https://github.com/Division6066/tempo-rhythm/issues/529) (T-PLAN-01). Design choices are (EXTRAPOLATED); the snippets type-check against the repo. **Paused**: no `ready` label.

| Table | Purpose | Key fields | Indexes |
|---|---|---|---|
| `dayPlans` | One row per user per local day | `localDate` ("YYYY-MM-DD"), `timezone?`, `intention?`, `topTaskIds?` (max 3), `energy?`, `status` draft/committed, `committedAt?`, `reflection?` | `by_userId`, `by_userId_deletedAt`, `by_userId_deletedAt_localDate` |
| `timeBlocks` | A planned slot on one local day | `localDate`, `dayPlanId?`, `title`, `startMinute` (0–1439), `durationMinutes` (5–720), `startsAtMs`, `endsAtMs`, `kind` focus/task/habit/break/other, `taskId?`, `habitId?`, `status` planned/done/skipped, `source` user/coach | + `by_userId_deletedAt_startsAtMs`, `by_taskId` |
| `habitCheckIns` | One row per habit per local day checked; undo = soft delete | `habitId`, `localDate`, `checkedAt`, `source` habits/today/suggestion/legacy, `note?` | + `by_habitId_deletedAt_localDate` |
| `focusSessions` | Logged focus blocks (today React state only) | `localDate`, `intention`, `durationMinutes`, `completedAt`, `timeBlockId?`, `taskId?` | + `by_userId_deletedAt_completedAt` |
| `inboxItems` | Brain-dump captures before sorting | `rawText`, `source`, `status` unsorted/sorted/dismissed, `urgency?`, `sortedInto?`, links to task/note/event | + `by_userId_deletedAt_status` |
| `calendarEvents.endsAtMs?` | Optional end time | additive field; the strict return validator must change in the same PR | — |

- **Day key:** `localDate` is computed in the browser, because the server has no user time zone. Absolute instants are kept too, for range queries.
- **Uniqueness** (one plan per day, one check-in per habit per day) is enforced inside the upsert mutation; Convex mutations are transactions.
- **`habits` cache fields stay** and are recomputed on check-in, so `/habits`, `/tracking` and `/insights` keep working.
- Every new table joins `USER_OWNED_TABLES`. Only one open PR may edit `convex/schema.ts` at a time.
- Function modules planned: `convex/dayPlans.ts` (#531), habit check-ins (#532), calendar edit/delete (#533), `focusSessions` (#534), `inbox` (#535), tasks soft delete + carry-over (#530).
- **Later, not proposed for Sunday:** `coachSuggestions` (accept / tweak / skip cards with 5-minute undo), `journalEntries` amendment to #446 (add `deletedAt`, `by_userId_deletedAt`), `users.preferences` (time zone, week start, theme, dyslexia font, language).

## 4. Target model: pages with JSON blocks (20 Sep design)

### 4.1 The idea
The storage unit is the markdown page: one row in `notes`, with JSON blocks embedded as fenced code. The markdown is the truth. `noteBlocks` and `noteLinks` are derived indexes, rebuilt on every save. Memory stays the `memories` table behind a five-call port. Status: **design only, nothing built.**

### 4.2 Naming convention (decided 20 Sep under Amit's delegation)
- Fence info string `json tempo`; envelope `type`, `id`, `v`, `data`, nothing else at the top level.
- Block `type` kebab-case; block `id` = `blk_` + ULID; phrase `id` = `phr_` + ULID. Ids never change and are never reused. `v` = schema version, starting at 1.
- Inside blocks: ISO 8601 times with offset, dates `YYYY-MM-DD`, clock times `HH:MM`. On table rows: ms numbers.
- One block per task, event, habit, nag. `userId` and row timestamps live on the row, never in a block.

### 4.3 New tables in this model

| Table | Holds |
|---|---|
| `notes` (extended) | the pages; add `pageType`, `date?`, `folderId?`. `pageType` values (EXTRAPOLATED): daily, weekly, monthly, project, note, dump, study, template |
| `noteBlocks` | derived: `noteId`, `blockId`, `type`, `v`, `data`, `position`, lifted `status?`, `startAtMs?`, `nextFireAtMs?` |
| `noteLinks` | derived backlinks: `fromNoteId`, `toNoteId?`, `toTitle` |
| `proposals` | brain-dump proposal: `dumpNoteId`, `rows[]` (`sourceLine`, `title`, `durationMin`, `reason`, `decision`) |
| `nagEvents` | `blockId`, `phraseId`, `firedAt`, `answer` now / snooze / notToday / none (EXTRAPOLATED) |
| Study: `studySources`, `decks`, `flashcards`, `reviewSessions`, `testResults`, `ragScopes` | planned; each its own component (Amit) |
| `tasks`, `taskRepeatCfgs`, `calendarEvents`, `habits` | migrate into blocks, then retire (EXTRAPOLATED). Where repeat rules live afterwards: UNKNOWN. `goals`: fate UNKNOWN. |

### 4.4 Block schemas

| Block | Fields | Rules |
|---|---|---|
| `page-meta` | `pageType`, `date?`, `tags[]` | At most one per page |
| `task` | `title`, `durationMin` (default 15), `status` now/later/done, `order`, `reason?`, `scheduledAt?`, `inelastic`, `doneAt?` (EXTRAPOLATED) | No manual time entry is ever demanded |
| `event` | `title`, `startAt`, `endAt`, `inelastic: true`, `source` manual/connector (EXTRAPOLATED) | |
| `habit` | `name`, `cadence` daily/weekly, `window?` | No streak field |
| `nag` | `targetId`, `enabled`, `snoozeMin`, `phrases[]` of `{id, text, origin, sourceRef}` | `enabled` can't be true with no phrase; `origin` user or derived (`derived` needs `sourceRef`); emoji rejected |
| `template` | `name`, `forPageType`, `isDefault`, `tokens[]` | One default per `forPageType` |

Example, as stored in `notes.body`:

````markdown
# Thursday

```json tempo
{ "type": "page-meta", "id": "blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4", "v": 1,
  "data": { "pageType": "daily", "date": "2026-09-17", "tags": ["uni"] } }
```

Slept badly. Keep today small. See [[Thesis outline]].

```json tempo
{ "type": "task", "id": "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6", "v": 1,
  "data": { "title": "Email supervisor about the draft", "durationMin": 5, "status": "now",
            "order": 1, "reason": "You wrote it twice. That usually means it matters.",
            "scheduledAt": null, "inelastic": false, "doneAt": null } }
```
````

### 4.5 Write path
1. `notes.save(id, body)` checks auth, parses every `json tempo` fence, validates each block, and replaces that page's `noteBlocks` and `noteLinks` rows in the same mutation.
2. An invalid block stays in `body` untouched, indexed as `type: "broken"`. One bad block never fails a save (EXTRAPOLATED).
3. Small edits use `notes.patchBlock(noteId, blockId, dataPatch)`.
4. Zod schemas (EXTRAPOLATED path `packages/core/blocks/schemas.ts`) validate both saves and model output.

### 4.6 json-render points still UNKNOWN
Read the installed version first: the import path of `schema`; whether the providers are required when no state is used; whether `children: []` may be omitted; whether one catalog serves both registries; the native provider names; API stability before 1.0.

## 5. The open architecture question

Two plans exist and **no Amit ruling picks between them**:
- **20 Sep (A20):** pages with JSON blocks; typed `tasks` / `calendarEvents` / `habits` migrate into blocks and retire.
- **3 Oct (#546):** a Sunday daily planner built now on **new typed tables** (`dayPlans`, `timeBlocks`, `habitCheckIns`, …) next to the existing ones.

They can coexist for a while: #546 is additive, and its tables could later become block types or derived indexes (EXTRAPOLATED). Which is the long-term model: UNKNOWN. Amit decides.

## 6. Access and sign-in

- Every query and mutation checks `ctx.auth`, then filters by `userId`. A user sees only their own rows. No sharing at V1.
- `role: "admin"` exists. What an admin may read: UNKNOWN; never page bodies or memories (EXTRAPOLATED).
- Shells never read `memories` directly; only the memory port does, server-side.
- Sign-in: Convex Auth + Resend magic link only (`convex/auth.ts`), 30-minute link, 30-day session. First sign-in creates `users` + `subscriptionStates`. A new sign-in links to the live user with the same email.
- Sign-up cap 30 (Amit, 1–2 Oct) vs code "Signup is open … every account is granted the max entitlement tier": enforcement mechanism UNKNOWN.

## 7. Conflicts and open questions

| Older source | Newer decision or fact |
|---|---|
| `docs/HARD_RULES.md`: `userId: v.optional(v.string())`, `by_user` indexes | Repo uses `v.id("users")` and `by_userId` everywhere; 20 Sep closed this ("contradiction 4"). #546 question 1 asks Amit to confirm. |
| 20 Sep: sign-in = Password + magic link | 1–2 Oct: magic link only (in code). |
| 20 Sep: nine Convex tables (FACTS) | Repo has eleven. Repo wins. |
| `docs/HARD_RULES.md:108`: routines are `libraryItems` with a `type` | #447 adds separate routine / template tables. Amit decides. |
| `docs/HARD_RULES.md` §15: `askFounderQueue` | #475: `feedback`. One name has to win: UNKNOWN. |
| PRD: soft delete everywhere | Memory spec: forget must be complete; `deleteMemory` hard-deletes today. Open. |

Open questions from #546 (Amit): (1) owner field type `v.id("users")` OK? (2) may real planner data live on `ceaseless-dog-617`? (3) week starts Sunday or Monday (code: Monday)? (4) store the user's IANA time zone on `users`? (5) weekly habit streak rule? (6) private channel for signed-in screenshots?
Also UNKNOWN: whether `bunx convex codegen` can regenerate `api.d.ts` without a deployment; pre-sign-in capture (onboarding brain dump) and its owner field; `/history` meaning (#461).
