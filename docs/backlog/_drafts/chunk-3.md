# CHUNK 3 — MVP coach & memory (Stage C) · TFV2-0149 … TFV2-0232

Draft for `docs/backlog/BACKLOG-v2.md`, ticket standard v2 (1 Nov 2026). Written against branch
`docs/source-2026-11-01`, `integration` at `f9b17d7`, and the v3 design screens (`coach.html`,
`coach-thread.html`, `coach-history.html`, `memory.html`, `memory-import.html`).

- **Count:** 84 tickets (TFV2-0149 … TFV2-0232).
- **Stage:** C · **Pass:** 1 for every ticket (clunky, every state works).
- **OPEN conflicts carried:** §4.3 (interim text model), §4.6 (accept-reject vs auto-apply),
  §4.8 (`forget` semantics), §4.9 (confidence auto-apply threshold), §4.12 (AI SDK vs HARD_RULES §2).
  Every ticket touching one marks the value `UNKNOWN` and names "Amit".
- **Fold-ins:** #743 (Chat backend: real AI replies) → TFV2-0153; #744 (/coach chat uses chat.send,
  Thinking + Retry) → TFV2-0154. Both also appear in chunk 1's chat tickets; the coach-side wiring
  here is kept distinct (the Convex Agent definition + streaming and the send/Thinking/Retry loop).

Dependency order (groups in build order):

| IDs | Area |
|---|---|
| 0149–0152 | Schema & backend architecture (memory vector index, entities/edges/observations) |
| 0153–0165 | Coach Agent definition, chat wiring, context, tools, approval, history |
| 0166–0170 | Adaptive coach backend (dial, panic, bad-day, realism, proposals) |
| 0171–0191 | Memory port (remember/list/recall×5/context/forget/restore/export/embeddings/Hebrew eval/life graph/reflect) |
| 0192–0194 | Memory import (preview/commit/undo) |
| 0195–0199 | Cross-cutting (salience decay, anti-shaming, mock model, entitlement, quota) |
| 0200–0217 | Coach UI components |
| 0218–0220 | Memory UI components |
| 0221–0225 | Screens (coach panel, coach thread, coach history, memory, memory import) |
| 0226–0232 | Verify-existing + chunk integration E2E |

---
### TFV2-0149 — Schema: `memories.embedding` field + 1024-dim vector index
- **Stage:** C · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `convex-arch` per `factory/SLOTS.md`.
- **WHEN:** first (backend architecture ticket for this chunk).
- **WHY:** TRD §5 ("`memories` gains an `embedding` field and a vector index, 1,024 dimensions, filter field `userId`"); PRD F-50 (recall by meaning).
- **GOAL:** `memories` holds an optional 1,024-float embedding and a Convex vector index over it, filtered by `userId`, so recall-by-meaning can run.
- **SCOPE:** `convex/schema.ts` (one table edit + one index) · `convex/lib/testFakeCtx.ts` (add a fake embedding helper if absent) · test: `convex/schema.test.ts`.
- **MUTATES:** `convex/schema.ts` (additive column + vector index; no existing column changed).
- **STEPS:** 1) Graphify code-map check of `convex/schema.ts` → `memories` (the field/index may already exist — then verify and add the missing test). 2) Add `embedding: v.optional(v.array(v.float64()))` to `memories`. 3) Add `.vectorIndex("by_userId_embedding", { vectorField: "embedding", dimensions: 1024, filterFields: ["userId"] })`. 4) Add a Zod/validator guard elsewhere is out of scope; only the column + index land here. 5) Write a schema unit test asserting the index registers (dimensions 1024, filter `userId`) and that an insert with and without `embedding` validates. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="schema"` → all schema tests pass (no Convex schema error for the new column/index).
- **EVIDENCE:** terminal output of DONE + the exact diff lines for the `embedding` field and `.vectorIndex` line.
- **DO NOT:** change any existing `memories` column, drop/rename the existing indexes, edit any other table, or write an embedding *value* (dimension constants only, never data).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `memories` (convex/schema.ts) gains `embedding: v.optional(v.array(v.float64()))` (exactly 1,024 floats when present; empty array rejected at insert time by the index) and `.vectorIndex("by_userId_embedding", { vectorField: "embedding", dimensions: 1024, filterFields: ["userId"] })`. No other table changes. Error case: a vector of wrong length must be rejected by Convex at insert. Limit: Convex vector search is action-only and returns at most 256 results (callers enforce the cap; this ticket only declares the index).
- **TESTS:** Given `memories` has no `embedding` column / When the schema file is compiled with the new field + index / Then it registers with dimensions 1024 and filter `userId`. Given a memory insert with `embedding` of 1,024 floats / When validated / Then it passes. Given an insert with a 1,023-float vector / When validated / Then Convex rejects it.
- **NUMBERS:** vector dimensions 1024 → pass (Convex 2–2,048 dims, source https://docs.convex.dev/search/vector-search) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0150 — Schema: `entities` table (life graph)
- **Stage:** C · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `convex-arch` per `factory/SLOTS.md`.
- **WHEN:** first (backend architecture).
- **WHY:** TRD §5c (`entities` table: `userId`, `kind`, `name`, `aliases`, `embedding`); PRD F-54 (life graph).
- **GOAL:** An `entities` table exists to hold people/projects/goals/places/habits with aliases and an embedding.
- **SCOPE:** `convex/schema.ts` · `convex/lib/testFakeCtx.ts` · test: `convex/schema.test.ts`.
- **MUTATES:** `convex/schema.ts` (new table).
- **STEPS:** 1) Graphify code-map of `convex/schema.ts` (table may exist — then verify + add missing test). 2) Add `entities: defineTable({ userId: v.id("users"), kind: v.union(v.literal("person"), v.literal("project"), v.literal("goal"), v.literal("place"), v.literal("habit")), name: v.string(), aliases: v.array(v.string()), embedding: v.optional(v.array(v.float64())), createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()) })` with indexes `by_userId` and `by_userId_kind`. 3) Test the validators.
- **DONE:** `bun run test -- --test-name-pattern="schema"` → green.
- **EVIDENCE:** DONE output + the `entities` defineTable lines.
- **DO NOT:** add business logic, wire extraction, or edit any other table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** New table `entities` (fields above). `kind` is one of `person|project|goal|place|habit`. `aliases` are alternative names used for matching (no uniqueness constraint). `embedding` mirrors `memories.embedding` (1,024 floats, optional). Soft delete via `deletedAt`. No extraction logic here.
- **TESTS:** Given a valid `entities` row / When inserted / Then it validates. Given `kind:"person"` vs an out-of-union `kind` / Then the latter is rejected. Given a row with `deletedAt` set / When queried by a live-entities index / Then soft-deleted rows are excluded.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0151 — Schema: `edges` table (life graph)
- **Stage:** C · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `convex-arch` per `factory/SLOTS.md`.
- **WHEN:** first (backend architecture).
- **WHY:** TRD §5c (`edges`: `userId`, `from`, `to`, `relation`, `origin`, `confidence`, `sourceRef`); PRD F-54.
- **GOAL:** An `edges` table links entities and memories with an extracted/inferred origin tag and confidence.
- **SCOPE:** `convex/schema.ts` · `convex/lib/testFakeCtx.ts` · test: `convex/schema.test.ts`.
- **MUTATES:** `convex/schema.ts` (new table).
- **STEPS:** 1) Graphify code-map (table may exist — verify + add test). 2) Add `edges: defineTable({ userId: v.id("users"), from: v.string(), to: v.string(), relation: v.string(), origin: v.union(v.literal("extracted"), v.literal("inferred")), confidence: v.number(), sourceRef: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()) })` with indexes `by_userId`, `by_userId_from`, `by_userId_to`. 3) Test validators.
- **DONE:** `bun run test -- --test-name-pattern="schema"` → green.
- **EVIDENCE:** DONE output + the `edges` defineTable lines.
- **DO NOT:** add extraction/confirm logic, or edit any other table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** New table `edges`. `from`/`to` are entity names (string keys, not ids, per TRD §5c mirroring Graphify's tags). `origin` is `extracted` (from `[[links]]`/blocks, no model) or `inferred` (model-guessed). `confidence` 0..1. `sourceRef` points at the note/chat that produced it. Soft delete via `deletedAt`.
- **TESTS:** Given a valid `edges` row / When inserted / Then validates. Given `origin:"inferred"` vs `origin:"extracted"` / Then both validate; an out-of-union origin is rejected. Given `confidence:1.4` / When validated / Then accepted by Convex (clamping is a caller concern; document it) — assert the validator accepts a number in 0..1.
- **NUMBERS:** `confidence` range 0..1 → pass (caller clamp; no numeric source needed) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0152 — Schema: `observations` table (reflect)
- **Stage:** C · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `convex-arch` per `factory/SLOTS.md`.
- **WHEN:** first (backend architecture).
- **WHY:** TRD §5c (`observations` rows, each with the memory ids that support it); PRD F-55 (reflect).
- **GOAL:** An `observations` table exists to hold reflect consolidations with their supporting memory ids.
- **SCOPE:** `convex/schema.ts` · `convex/lib/testFakeCtx.ts` · test: `convex/schema.test.ts`.
- **MUTATES:** `convex/schema.ts` (new table).
- **STEPS:** 1) Graphify code-map (table may exist — verify + add test). 2) Add `observations: defineTable({ userId: v.id("users"), text: v.string(), memoryIds: v.array(v.id("memories")), createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()) })` with index `by_userId_deletedAt`. 3) Test validators.
- **DONE:** `bun run test -- --test-name-pattern="schema"` → green.
- **EVIDENCE:** DONE output + the `observations` defineTable lines.
- **DO NOT:** add the reflect cron or deletion logic, or edit any other table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** New table `observations`. `text` is a human-readable observation. `memoryIds` are the memories that support it. Soft delete via `deletedAt`.
- **TESTS:** Given a valid `observations` row / When inserted / Then validates. Given a row with `memoryIds` referencing `memories` ids / Then validates. Given a row with non-id strings in `memoryIds` / Then Convex rejects.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0153 — Coach Agent: `Agent` definition, languageModel, streaming (folds-in #743)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149 · **Folds-in:** #743
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149.
- **WHY:** TRD §3 (coach is one `Agent` with `createTool` tools + `streamText(..., { saveStreamDeltas: true })`); PRD F-20; TRD §7.3 (auth → entitlement → quota order before any model call).
- **GOAL:** `convex/lib/agentComponent.ts` defines the coach `Agent` with a runtime language model and embedding model, streaming reply deltas, so the coach stops returning fixed technique replies.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/lib/ai_router.ts` · test: `convex/lib/agentComponent.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (new), `convex/lib/ai_router.ts` (expose the language/embedding model seams).
- **STEPS:** 1) Graphify code-map of `convex/lib/agentComponent.ts` + `convex/lib/ai_router.ts` (the Agent may already be defined — then verify and add the missing test). 2) Define `export const coachAgent = new Agent(...)` with `languageModel` from the AI SDK DeepInfra provider (`deepInfra("…")`) and `embeddingModel` (`deepInfra.embeddingModel("…")`). 3) Set `saveStreamDeltas: true` so replies stream token-by-token to open screens. 4) Register `createTool` stubs for the six tools named in TFV2-0156…0161 (empty handlers that throw `not_implemented` until those tickets land). 5) Keep `requireApprovedForAi` as the first call. 6) Run DONE.
- **DONE:** `bun run typecheck` → 0 errors, and `bun run test -- --test-name-pattern="agentComponent"` → the component loads its real schema under `convex-test`.
- **EVIDENCE:** DONE output + the `Agent` definition lines (model ids as names only).
- **DO NOT:** hard-code a real key value, call `api.mistral.ai`, edit `convex/auth.ts`, or open the streaming path to unapproved users.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `coachAgent` is an `Agent` whose `languageModel` resolves through the one model seam (names only; the exact runtime model id is OPEN §4.3, source of truth `convex/lib/ai_router.ts` until Amit settles it). `embeddingModel` is the embedding seam (OPEN §4.3/TRD §5 — the pick is Qwen3-Embedding-8B by default, UNKNOWN until the Hebrew eval in TFV2-0185 lands). Replies stream via `saveStreamDeltas`. Auth rule: approved-for-AI accounts only (`requireApprovedForAi` runs first). Error cases: missing provider key → the Agent's stream resolves to `unavailable` (no key text ever surfaced).
- **TESTS:** Given `coachAgent` is instantiated under `convex-test` / When the component's schema loads / Then no import-time error. Given a signed-out or unapproved identity / When a model call is attempted / Then it is rejected before any provider request. Given `saveStreamDeltas` is set / When a reply is produced / Then deltas are observable.
- **NUMBERS:** streaming first-token budget — ack < 0.2 s, response ~1 s (16 Sep latency budget, PRD §4.3) → pass range ≤ 1.2 s | UNKNOWN (measured later; Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 interim text model id and §4.12 AI SDK vs HARD_RULES §2 — the model id and the SDK choice are UNKNOWN; answerer: Amit.

### TFV2-0154 — Coach chat: send + Thinking + Retry (folds-in #744)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** #744
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** PRD F-20 (live replies, Thinking + Retry); #744 (/coach chat uses chat.send, Thinking + Retry); TRD §3.
- **GOAL:** The coach chat surfaces a `send` action that stores the user message, streams the Agent reply with a "Thinking…" indicator, and exposes Retry that re-runs only the last turn.
- **SCOPE:** `convex/coach.ts` · `convex/lib/agentComponent.ts` · test: `convex/coach_chat.test.ts`.
- **MUTATES:** `convex/coach.ts` (send/reply surface), `convex/lib/agentComponent.ts` (send plumbing).
- **STEPS:** 1) Graphify code-map of `convex/coach.ts` (`sendMessage`/`reply` exist — extend, don't replace). 2) Add a `send` surface that trims and validates the message (non-empty, ≤ `MAX_MESSAGE_CHARS` 4000), inserts the user `messages` row, then starts the Agent turn. 3) Add a per-turn "Thinking…" state and a Retry idempotency key so Retry re-runs only the newest unanswered turn and overlapping sends resolve to one model call (the existing `claimTurn` lease holds). 4) Surface the exact user-facing error strings below in EN/HE. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coach_chat"` → send/Thinking/Retry cases green.
- **EVIDENCE:** DONE output + the send/retry handler lines.
- **DO NOT:** replace `claimTurn`'s lease logic, bypass approval, or call the model directly from a mutation.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `send({ conversationId, content })` returns `{ success, crisis? }`. Empty message → `EN: "Message is empty." / HE: "ההודעה ריקה."`. Too long → `EN: "That message is too long. Try a shorter one." / HE: "ההודעה ארוכה מדי. נסו קצרה יותר."`. Crisis text stores the fixed card (no model). Thinking state copy `EN: "Thinking…" / HE: "חושב…"`. Retry re-runs the last user turn once; a second concurrent Retry returns "busy" and waits for the in-flight answer. Auth: approved user owning the conversation.
- **TESTS:** Given an empty message / When `send` runs / Then "Message is empty." / "ההודעה ריקה." is thrown. Given a >4000-char message / When `send` runs / Then the too-long message is thrown. Given crisis words / When `send` runs / Then the fixed card is stored and no model is called. Given two overlapping Retries / When both run / Then one claims the turn and the other resolves "busy".
- **NUMBERS:** `MAX_MESSAGE_CHARS` 4000 → pass (already the product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0155 — Coach context: page + memory injection (F-21)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** PRD F-21 (coach reads the user's pages and memory for context); TRD §5 (`context` = recall trimmed to a token cap).
- **GOAL:** Each coach turn is built with the open page (title + trimmed text) and the user's top memories (recalled + token-capped), never the other user's data.
- **SCOPE:** `convex/lib/coachPrompt.ts` · `convex/lib/coachLoad.ts` · test: `convex/lib/coachPrompt.test.ts`.
- **MUTATES:** `convex/lib/coachPrompt.ts` (context assembly), `convex/lib/coachLoad.ts` (no change — read only).
- **STEPS:** 1) Graphify code-map of `convex/lib/coachPrompt.ts` (`buildCoachMessages` already injects the page — extend for memory). 2) Add a `memory` context block (recalled memories, capped to `COACH_LIMITS` chars) between the page block and the tasks block. 3) Keep the existing owner-isolation check (only the caller's live page is included, never named otherwise). 4) Add the memory block to the unit test. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachPrompt"` → green including a memory-context assertion.
- **EVIDENCE:** DONE output + the `buildCoachMessages` memory-block lines.
- **DO NOT:** read another user's memories, exceed the char caps, or persist memories in the prompt.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `buildCoachMessages(args)` gains `memory?: readonly string[]`; each item is a single-line `- <content>` under a `<memory>` system block, truncated to `COACH_LIMITS.memoryChars` (new constant, 2000). Order of system blocks: role → today's date → `<page>` → `<memory>` → `<tasks>` → web-search line → thread. Page cap stays `COACH_LIMITS.pageChars` (6000). No cross-user data.
- **TESTS:** Given an owned page + 3 memories / When `buildCoachMessages` runs / Then the system block contains `<memory>` with the three `- ` lines and no other user's text. Given memories exceeding the cap / When built / Then they are truncated with a visible `…` (never a split surrogate pair). Given no memories / Then no `<memory>` block is emitted.
- **NUMBERS:** memory context cap 2000 chars → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0156 — Coach Agent tool: `createNote`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 (tools: `createNote`); PRD F-22 (create a note); HARD_RULES §1/§6.2 (proposal, 5-min Undo).
- **GOAL:** `createNote` proposes a new Markdown page; Accept creates it and Undo soft-deletes it for 5 minutes.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/coach.ts` · test: `convex/coach_chat.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool), `convex/coach.ts` (accept path uses the tool's proposal shape).
- **STEPS:** 1) Graphify code-map of the existing `note` proposal (coachPrompt.ts `readProposal` + coach.ts `acceptProposal` already do note insert — reuse). 2) Implement `createNote` as a `createTool` whose output is the `note` proposal `{ kind:"note", title, body }`. 3) Title ≤ `COACH_LIMITS.titleChars` (200), body plain Markdown ≤ `COACH_LIMITS.bodyChars` (20,000), both required. 4) Nothing is written until Accept; Accept inserts `notes` with `pageType:"plain"`, `aiGenerated:true`; Undo soft-deletes within 5 min. 5) Test every error case below. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coach_chat"` → createNote cases green.
- **EVIDENCE:** DONE output + the `createNote` tool definition.
- **DO NOT:** auto-create a note (must be a proposal), bypass the 5-min Undo window, or write to any other table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `createNote({ title, body })` → proposal `{ kind:"note", title, body }`. Auth: approved-for-AI. Error cases: missing title → `EN: "Give it a name and some words first." / HE: "תנו לו שם וקצת מילים קודם."`; body containing Tempo JSON blocks is stripped to plain Markdown (`plainMarkdown`); body > 20,000 chars truncated. Limits: title 200, body 20,000.
- **TESTS:** Given `createNote` with a title and body / When run / Then a `note` proposal returns and nothing is in `notes`. Given an empty title / When run / Then the "name and words" error is thrown. Given a body with a `json tempo` fence / When parsed / Then the fence is dropped (plain Markdown only). Given Accept then Undo within 5 min / Then the note is soft-deleted; after 5 min Undo throws.
- **NUMBERS:** title 200 / body 20,000 chars → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0157 — Coach Agent tool: `addTaskToToday`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 (`addTaskToToday`); PRD F-22 (add a task to Today); HARD_RULES §6.2 (proposal + Undo).
- **GOAL:** `addTaskToToday` proposes a task due today (or with no date); Accept creates it; Undo soft-deletes within 5 minutes.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/coach.ts` · test: `convex/coach_chat.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool), `convex/coach.ts` (accept path).
- **STEPS:** 1) Graphify code-map of the existing `task` proposal (coachPrompt.ts + coach.ts `acceptProposal` already create tasks — reuse). 2) Implement `addTaskToToday` as a `createTool` producing `{ kind:"task", title, minutes, when:"today"|"later" }`. 3) `minutes` clamped 1..`COACH_LIMITS.maxMinutes` (480); `when` is `today` or `later` (no other day or clock time). 4) Accept creates the task (`dueAt` = end of the caller's local day for "today", from the client's `dueTodayAt`); Undo soft-deletes within 5 min. 5) Test errors. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coach_chat"` → addTaskToToday cases green.
- **EVIDENCE:** DONE output + the tool definition.
- **DO NOT:** accept a day other than today/later, create the task without Accept, or bypass Undo.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `addTaskToToday({ title, minutes?, when })` → `{ kind:"task", title, minutes, when }`. Auth: approved-for-AI. Error cases: empty title → `EN: "Give it a name and some words first." / HE: "תנו לו שם וקצת מילים קודם."`; `when` not `today`/`later` → coerce to `later` (the model is separately told not to propose other days). Limits: title 200, minutes 1..480.
- **TESTS:** Given a valid task / When run / Then a `task` proposal returns. Given minutes 1000 / When clamped / Then it is 480. Given "today" and a valid `dueTodayAt` / When Accept runs / Then the task is created due that day. Given Undo within 5 min / Then the task soft-deletes.
- **NUMBERS:** minutes 1..480 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0158 — Coach Agent tool: `fillTemplate`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 (`fillTemplate`); PRD F-22 (fill a template); HARD_RULES §6.2.
- **GOAL:** `fillTemplate` proposes a `template` (name, body, period) that Accept saves as a template and Undo soft-deletes.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/coach.ts` · test: `convex/coach_chat.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool), `convex/coach.ts` (accept path).
- **STEPS:** 1) Graphify code-map of the existing `template` proposal (coachPrompt.ts `readProposal` + coach.ts `acceptProposal` insert into `templates` — reuse). 2) Implement `fillTemplate` producing `{ kind:"template", name, body, period }`, `period` ∈ `daily|weekly|none`. 3) Name ≤ 200, body plain Markdown ≤ 20,000, tokens such as `{{date}}` / `{{weekday}}` allowed verbatim. 4) Accept inserts `templates`; Undo soft-deletes within 5 min. 5) Test errors. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coach_chat"` → fillTemplate cases green.
- **EVIDENCE:** DONE output + the tool definition.
- **DO NOT:** set a default template weekday (that is chunk D/billing-scope), or write the template without Accept.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `fillTemplate({ name, body, period })` → `{ kind:"template", name, body, period }`. Auth: approved-for-AI. Error cases: empty name → `EN: "Give it a name and some words first." / HE: "תנו לו שם וקצת מילים קודם."`; `period` not daily/weekly → `none`; body with Tempo JSON stripped to Markdown; body > 20,000 truncated.
- **TESTS:** Given a template proposal / When run / Then it returns and nothing is in `templates`. Given empty name / Then error. Given `period:"daily"` / Then Accept inserts a `daily` template. Given Undo within 5 min / Then soft-delete.
- **NUMBERS:** name 200 / body 20,000 chars → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0159 — Coach Agent tool: `draftModule`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 (`draftModule` + built-in tool approval for Approve/Discard); PRD F-40/F-41; TRD §4a.
- **GOAL:** `draftModule` produces a validated module draft that enters the Agent's approval-requested state, so it goes live only on the user's tap.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/lib/aiGate.ts` (read only) · test: `convex/lib/agentComponent.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool).
- **STEPS:** 1) Graphify code-map of module validation (chunk D owns modules; here the tool emits a `draft` module spec using only catalog component/action names). 2) Implement `draftModule` as a `createTool` that returns a `draft` module spec (a data module, catalog-only). 3) Route it through the Agent's built-in tool approval (`approval-requested` state) so the UI shows Approve/Discard. 4) Validation (Zod against the catalog) is invoked here; an unknown component/action/URL/script is rejected and the module stays `draft`. 5) Test the rejection cases. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="agentComponent"` → draftModule cases green.
- **EVIDENCE:** DONE output + the tool definition + approval wiring.
- **DO NOT:** run module code, touch `convex/templates.ts` schema, or make a module `live` without approval.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `draftModule({ spec })` → `{ status:"draft", spec }`; a valid spec uses only catalog component names and catalog action names (Zod-validated). Error cases: unknown component → rejected, stays `draft`; unknown action → rejected; any URL or script → rejected. Auth: approved-for-AI. Approval: the Agent's tool-approval state carries the Approve/Discard step.
- **TESTS:** Given a valid catalog-only spec / When `draftModule` runs / Then it returns `draft` and awaits approval. Given a spec with an unknown component / Then it is rejected and stays `draft`. Given a spec with a URL or script / Then it is rejected. Given approval / Then only the approving mutation can flip it to `live`.
- **NUMBERS:** module never `live` without approval → pass (boolean gate) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (AI SDK vs HARD_RULES §2) — whether the Agent tool-approval path is permitted as written is UNKNOWN; answerer: Amit.

### TFV2-0160 — Coach Agent tool: `searchMemory`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149, TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149 + TFV2-0153.
- **WHY:** TRD §3 (`searchMemory` tool; `@convex-dev/rag` one namespace per user, MVP); PRD F-50.
- **GOAL:** `searchMemory` lets the coach search the user's pages + memories by meaning and keyword, scoped to that user.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/search.ts` · test: `convex/lib/agentComponent.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool), `convex/search.ts` (read path).
- **STEPS:** 1) Graphify code-map of `convex/search.ts` (`all` keyword query exists) and `memories` recall (TFV2-0173…0177). 2) Implement `searchMemory` as a `createTool` that merges keyword results (`search.all`) with vector results (the recall-by-meaning path) over the caller's own data. 3) Return at most 8 results per group (notes/tasks/habits/goals/memories), owner-filtered. 4) Test the empty-query and owner-isolation cases. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="agentComponent"` → searchMemory cases green.
- **EVIDENCE:** DONE output + the tool definition.
- **DO NOT:** search another user's rows, leak embeddings, or persist a search query.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `searchMemory({ query })` → `{ notes[], tasks[], habits[], goals[], memories[] }`, each capped at 8 (the existing `GROUP_LIMIT`). Empty query → empty groups. Auth: approved-for-AI + owner filter on every index. Meaning search runs only in an action (Convex vector search is action-only).
- **TESTS:** Given a query with hits in notes and memories / When `searchMemory` runs / Then both groups return, capped at 8, owner-filtered. Given an empty query / Then all groups are empty. Given a second user's memory matching the query / Then it never appears.
- **NUMBERS:** 8 results per group → pass (existing `GROUP_LIMIT`) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (RAG/vector search permitted vs HARD_RULES §2) — UNKNOWN; answerer: Amit.

### TFV2-0161 — Coach Agent tool: `scheduleJob`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 + §5d (`scheduleJob({ cron, task, targetPageType })` needs approval, registered with `@convex-dev/crons`); PRD F-47.
- **GOAL:** `scheduleJob` proposes a recurring job; approval registers it; Undo removes it within 5 minutes.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/crons.ts` · test: `convex/lib/agentComponent.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (tool), `convex/crons.ts` (runtime job registration).
- **STEPS:** 1) Graphify code-map of `convex/crons.ts` (system crons exist — add the runtime path). 2) Implement `scheduleJob` producing a `job` proposal `{ cron, task, targetPageType }`. 3) Route through tool approval; on approval register with `@convex-dev/crons`; each run writes the plan into the target page (e.g. Today). 4) Times stored in UTC, shown in the user's zone. 5) Test invalid cron and approval-gate. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="agentComponent"` → scheduleJob cases green.
- **EVIDENCE:** DONE output + the tool definition.
- **DO NOT:** register a job without approval, run `convex dev`/`convex deploy`, or write job output to a page the user did not approve.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Tool `scheduleJob({ cron, task, targetPageType })` → a `job` proposal (kind `job`). Auth: approved-for-AI. Error cases: invalid cron → `EN: "That schedule doesn't parse. Try something like 'every weekday at 8'." / HE: "הלוח הזה לא נקרא. נסו משהו כמו 'כל יום חול ב־8'."`; no approval → nothing registered. Times UTC internally, displayed in the user's time zone. Limits: one job per approval; Undo removes within 5 min.
- **TESTS:** Given a valid cron + task / When `scheduleJob` runs / Then a `job` proposal returns and nothing is registered. Given an invalid cron / Then the parse error is thrown. Given approval / Then the job registers; Undo within 5 min removes it. Given no approval / Then no job row exists.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0162 — Coach tool approval: draftModule Approve/Discard gate
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0159 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0159.
- **WHY:** TRD §3 (module drafts use the Agent's built-in tool approval — Approve/Discard without custom code); PRD F-41.
- **GOAL:** The approval-requested state is surfaced and the Approve/Discard decision flips a draft module to live or discards it, with no custom approval code.
- **SCOPE:** `convex/lib/agentComponent.ts` · `convex/lib/aiGate.ts` (read) · test: `convex/lib/agentComponent.test.ts`.
- **MUTATES:** `convex/lib/agentComponent.ts` (approval surface).
- **STEPS:** 1) Graphify code-map of the Agent tool-approval surface. 2) Expose `approval-requested` → pending, and the Approve/Discard actions that resolve it. 3) On Approve a validated draft flips to `live`; on Discard it is dropped (nothing persisted live). 4) A draft that fails validation can never be approved. 5) Test all three. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="agentComponent"` → approval cases green.
- **EVIDENCE:** DONE output + the approval surface lines.
- **DO NOT:** approve a draft that failed validation, write a second approval system, or bypass the owner.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Approval states: `approval-requested` (pending) → Approve (`live`) / Discard (dropped). Auth: the approving caller must be the conversation owner. Error cases: approving an invalid draft → rejected; approving twice → `EN: "This draft was already decided." / HE: "הטיוטה הזו כבר הוכרעה."`.
- **TESTS:** Given a pending valid draft / When approved / Then it flips to `live`. Given a pending invalid draft / When approved / Then rejected. Given Discard / Then nothing live is persisted. Given a second approve / Then "already decided" error.
- **NUMBERS:** one decision per draft → pass (boolean gate) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 — UNKNOWN; answerer: Amit.

### TFV2-0163 — Coach history: `listThreads` (paginated, grouped)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** PRD F-20 (Convex Agent provides chat threads); screen coach-history.html `@data threads = coach.listThreads({ paginationOpts })`.
- **GOAL:** `listThreads` returns the user's conversations newest-first, grouped Today / Last week / Earlier, each with title, last line, and time.
- **SCOPE:** `convex/lib/coachHistory.ts` · `convex/coach.ts` · test: `convex/lib/coachHistory.test.ts`.
- **MUTATES:** `convex/lib/coachHistory.ts` (new), `convex/coach.ts` (re-export/query).
- **STEPS:** 1) Graphify code-map of `convex/coach.ts` (`conversations`/`messages` exist; `coachHistory.ts` is MISSING). 2) Add `listThreads` as a paginated query over `conversations` (owner-filtered, live only), newest-first. 3) Derive `title` (the conversation title), `lastLine` (last message content, clamped to 2 lines / 160 chars), and `time` (updatedAt). 4) Group client-side into Today / Last week / Earlier (the backend returns a flat newest-first list; the grouping constants are documented). 5) Test empty + owner-isolation. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachHistory"` → listThreads cases green.
- **EVIDENCE:** DONE output + the `listThreads` query.
- **DO NOT:** return another user's conversations, load full thread bodies, or exceed pagination defaults.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `listThreads({ paginationOpts })` → `{ page }` of `{ id, title, lastLine, updatedAt }`. Auth: `requireUser`. Error cases: none beyond owner filter (empty page is valid). Limits: default page size 20, `lastLine` 160 chars.
- **TESTS:** Given two conversations / When `listThreads` runs / Then newest-first order. Given another user's conversations / Then none appear. Given none / Then empty page. Given a long last line / Then clamped to 160 chars with `…`.
- **NUMBERS:** page size 20 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0164 — Coach history: `searchThreads` (meaning + keyword)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149, TFV2-0163 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149 + TFV2-0163.
- **WHY:** PRD F-50 (coach can search the user's past chats — hybrid search across threads); screen coach-history.html `searchThreads({ query, mode })`.
- **GOAL:** `searchThreads` searches past conversations by meaning (vector) or exact words (keyword), merged, owner-scoped.
- **SCOPE:** `convex/lib/coachHistory.ts` · `convex/search.ts` · test: `convex/lib/coachHistory.test.ts`.
- **MUTATES:** `convex/lib/coachHistory.ts` (new), `convex/search.ts` (read path).
- **STEPS:** 1) Graphify code-map of `convex/search.ts` and the `conversations`/`messages` indexes. 2) Add `searchThreads({ query, mode })` — `mode:"words"` = full-text/keyword only; `mode:"meaning"` = vector over thread content merged with keyword. 3) Return `{ id, title, lastLine, updatedAt }` matches, owner-filtered, capped at 20. 4) Empty query returns the newest list. 5) Test both modes + owner isolation. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachHistory"` → searchThreads cases green.
- **EVIDENCE:** DONE output + the `searchThreads` action.
- **DO NOT:** run vector search in a query (action-only), or search another user's threads.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `searchThreads({ query, mode })` → array of `{ id, title, lastLine, updatedAt }` (≤ 20). `mode` ∈ `meaning|words`. Auth: `requireUser`. Error cases: empty query → newest list. Limits: 20 results, vector dims 1024 (from TFV2-0149).
- **TESTS:** Given `mode:"words"` and a literal term / When run / Then literal matches only. Given `mode:"meaning"` and a paraphrase / Then vector matches surface. Given another user's thread / Then never returned.
- **NUMBERS:** 20 results max → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 — vector search across threads permitted vs HARD_RULES §2 is UNKNOWN; answerer: Amit.

### TFV2-0165 — Coach history: `getThread` + `createThread`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** coach-thread.html `@data thread = coach.getThread({ threadId })`; coach-history.html `coach.createThread({})`.
- **GOAL:** `getThread` returns one conversation's messages + proposals live, and `createThread` opens an empty conversation.
- **SCOPE:** `convex/lib/coachHistory.ts` · `convex/coach.ts` · test: `convex/lib/coachHistory.test.ts`.
- **MUTATES:** `convex/lib/coachHistory.ts` (new), `convex/coach.ts` (query/mutation).
- **STEPS:** 1) Graphify code-map of `messages` (`storedProposal` already reconstructs proposal cards). 2) Add `getThread({ threadId })` → `{ id, title, messages:[{ role, content, proposal?, status?, streaming? }] }`, owner-filtered, live. 3) Add `createThread({})` → inserts a `conversations` row and returns its id. 4) Proposals reconstructed via `storedProposal` (kind, status, preview). 5) Test owner isolation + empty. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachHistory"` → getThread/createThread cases green.
- **EVIDENCE:** DONE output + the two functions.
- **DO NOT:** return another user's thread, persist model replies as stored text, or create a thread without an owner.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `getThread({ threadId })` → thread with messages in ascending order; each assistant message carries `proposal` (kind/status/`preview`) when present and a `streaming` flag. `createThread({})` → `v.id("conversations")`. Auth: `requireUser`; owner check on every read. Error cases: wrong owner / missing thread → `EN: "Conversation not found." / HE: "השיחה לא נמצאה."`.
- **TESTS:** Given an owned thread with a proposal message / When `getThread` runs / Then messages + proposal status return. Given another user's threadId / Then "Conversation not found." is thrown. Given `createThread` / Then a new owned conversation returns its id.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.
### TFV2-0166 — Adaptive coach: dial backend (`getSettings` + `setDial`)
- **Stage:** C · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** first in adaptive coach.
- **WHY:** PRD F-25 (adaptive coach dial 0–10); components.md §2.8 Dial 0–10 (`profiles.setCoachDial`).
- **GOAL:** The 0–10 coach dial is persisted per user and read back, clamped and validated.
- **SCOPE:** `convex/coach.ts` · `convex/lib/coachLoad.ts` · test: `convex/coachLoad.test.ts`.
- **MUTATES:** `convex/coach.ts` (verify existing `getSettings`/`setDial`).
- **STEPS:** 1) Graphify code-map of `convex/coach.ts` (`getSettings`/`setDial` + `coachSettings` exist — verify and add the missing test). 2) Confirm `setDial` validates integer 0..10 and `getSettings` returns defaults when no row exists (dial 5). 3) Add the error string EN/HE below. 4) Test clamp/validation + default. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → dial cases green.
- **EVIDENCE:** DONE output + the `setDial` validation lines.
- **DO NOT:** change the dial's effect on the system prompt here (that is TFV2-0226), or allow out-of-range values.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `setDial({ dial })` → `{ success:true }`; `getSettings({})` → `{ dial, taskLoad, panicUntil, acceptedStreak }`. Default dial 5. Error case (non-integer or <0 or >10): `EN: "The dial is a whole number from 0 to 10." / HE: "החוגה היא מספר שלם מ־0 עד 10."`. Auth: `requireUser`.
- **TESTS:** Given `setDial(4)` / When run / Then `getSettings().dial === 4`. Given `setDial(11)` / Then the range error. Given `setDial(3.5)` / Then the whole-number error. Given no `coachSettings` row / Then `getSettings().dial === 5`.
- **NUMBERS:** dial integer 0..10 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0167 — Adaptive coach: panic backend (`pressPanic` + `clearPanic` + 10-second action)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0166 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0166.
- **WHY:** PRD F-25 (panic button, 10-second action); components.md §2.10 PanicButton (`panic`, no model call).
- **GOAL:** Pressing panic sets a 30-minute panic window, returns one fixed 10-second action, and clearPanic ends the window.
- **SCOPE:** `convex/coach.ts` · `convex/lib/coachLoad.ts` · test: `convex/coachLoad.test.ts`.
- **MUTATES:** `convex/coach.ts` (verify `pressPanic`/`clearPanic`).
- **STEPS:** 1) Graphify code-map (`pressPanic`/`clearPanic` + `pickTenSecondAction` exist — verify + test). 2) Confirm `pressPanic` sets `panicUntil = now + 30 min` and returns a deterministic action from the fixed list. 3) Add EN/HE for the five actions and the two realism notes (shared with TFV2-0169). 4) Test window + deterministic pick + clear. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → panic cases green.
- **EVIDENCE:** DONE output + the panic lines.
- **DO NOT:** call a model for panic, randomise the action per call (deterministic by seed), or leak the panic reason.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `pressPanic({})` → `{ panicUntil, action:{ text } }`; `clearPanic({})` → `{ success:true }`. `PANIC_MS = 30 min`. The action is `TEN_SECOND_ACTIONS` picked by seed. EN/HE (five actions): 1 `EN: "Take one slow breath, then put your hand on the first thing you need." / HE: "קחי נשימה איטית אחת, ואז הניחי את היד על הדבר הראשון שאת צריכה."` · 2 `EN: "Stand up and drink a sip of water." / HE: "קומי ושתי לגימה של מים."` · 3 `EN: "Open the first task and read just its title." / HE: "פתחי את המשימה הראשונה וקראי רק את הכותרת שלה."` · 4 `EN: "Unclench your jaw and drop your shoulders once." / HE: "שחררי את הלסת והורידי את הכתפיים פעם אחת."` · 5 `EN: "Put one thing you do not need away from your desk." / HE: "הרחיקי דבר אחד שאת לא צריכה מהשולחן."`. Auth: `requireUser`. No model call.
- **TESTS:** Given `pressPanic` / When run / Then `panicUntil > now` by 30 min and `action.text` is one of the five. Given the same seed / Then the same action returns (deterministic). Given `clearPanic` / Then `panicUntil` is cleared.
- **NUMBERS:** panic window 30 min → pass (product constant `PANIC_MS`) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0168 — Adaptive coach: bad-day detection
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0167 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0167.
- **WHY:** PRD F-25 (bad-day detection); HARD_RULES (no shame — low activity is a quiet stretch, never failure).
- **GOAL:** `badDay` reports a bad day (panic window, or no completed task in 3 days) and a suggested load of 2.
- **SCOPE:** `convex/coach.ts` · `convex/lib/coachLoad.ts` · test: `convex/coachLoad.test.ts`.
- **MUTATES:** `convex/coach.ts` (verify `badDay`/`computeBadDay`).
- **STEPS:** 1) Graphify code-map (`computeBadDay`/`badDay` + `effectiveLoad` exist — verify + test). 2) Confirm reasons `panic` (window active) and `low_activity` (no `done` task in 3 days) and `suggestedLoad = MIN_LOAD` (2). 3) Confirm a completed task in-window clears `low_activity`. 4) Test both reasons + clear. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → bad-day cases green.
- **EVIDENCE:** DONE output + the `computeBadDay` lines.
- **DO NOT:** word a bad day as failure/shame in any string, or raise load on a bad day.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `badDay({})` → `{ isBadDay, reason: "panic"|"low_activity"|null, suggestedLoad }`. `LOW_ACTIVITY_DAYS = 3`. A panic window (panicUntil > now) → `{ isBadDay:true, reason:"panic", suggestedLoad:2 }`; else no completed live task in the last 3 days → `{ isBadDay:true, reason:"low_activity", suggestedLoad:2 }`; else `{ isBadDay:false, reason:null, suggestedLoad: effectiveLoad(taskLoad,false) }`. Auth: `requireUser`.
- **TESTS:** Given an active panic window / Then `reason:"panic"`. Given no done task in 3 days / Then `reason:"low_activity"`. Given a done task within 3 days / Then `isBadDay:false`. Given a bad day / Then `suggestedLoad === 2`.
- **NUMBERS:** 3-day quiet window → pass (product constant `LOW_ACTIVITY_DAYS`) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0169 — Adaptive coach: realism checker
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0168 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0168.
- **WHY:** PRD F-25 (realism checker); components.md (a plan is checked against available minutes).
- **GOAL:** `checkRealism` compares planned minutes against available minutes and returns an honest, non-shaming note.
- **SCOPE:** `convex/lib/coachLoad.ts` · test: `convex/lib/coachLoad.test.ts`.
- **MUTATES:** `convex/lib/coachLoad.ts` (verify `checkRealism`).
- **STEPS:** 1) Graphify code-map (`checkRealism` exists — verify + test). 2) Confirm it sums `taskMinutes` (default 25) vs `availableMinutes` and returns `ok` + EN/HE note. 3) Add Hebrew to the two notes. 4) Test fits / over / defaults. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → realism cases green.
- **EVIDENCE:** DONE output + the `checkRealism` lines.
- **DO NOT:** shame on an over-full plan, lower the threshold silently, or change `DEFAULT_TASK_MINUTES`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `checkRealism(tasks, availableMinutes)` → `{ ok, totalMinutes, availableMinutes, note }`. `taskMinutes` = rounded estimate/60,000 or `DEFAULT_TASK_MINUTES` (25). `ok = totalMinutes <= availableMinutes`. Notes: fits → `EN: "This fits the time you have. Pick it up when you are ready." / HE: "זה מתאים לזמן שיש לך. קחי את זה כשאת מוכנה."`; over → `EN: "This is more than the time you have today. Do what you can; the rest can wait, and that is fine." / HE: "זה יותר מהזמן שיש לך היום. עשי מה שאפשר; השאר יכול לחכות, וזה בסדר."`. Pure (no ctx).
- **TESTS:** Given tasks summing 50 min vs 120 available / Then `ok:true` and the fits note. Given 200 min vs 60 available / Then `ok:false` and the over note. Given a task with no estimate / Then it counts as 25 min. Given `availableMinutes: 60` on a bad day (60-min budget) / Then the over note never shames.
- **NUMBERS:** default task 25 min → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0170 — Adaptive coach: proposal lifecycle (create / current / decide)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0169 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0169.
- **WHY:** PRD F-25 (graduated load 2→4, forgiveness contract); components.md §3 (`TP.acceptProposal`/`rejectProposal`); HARD_RULES §1 (accept/reject is law).
- **GOAL:** A code-built proposal (tasks + 10-second action + realism) is created once, and Accept/Reject is the only path that changes tasks and load.
- **SCOPE:** `convex/coach.ts` · `convex/lib/coachLoad.ts` · test: `convex/coachLoad.test.ts`.
- **MUTATES:** `convex/coach.ts` (verify `createProposal`/`currentProposal`/`decideProposal`).
- **STEPS:** 1) Graphify code-map (the three exist — verify + test). 2) Confirm `createProposal` returns the existing pending proposal id (idempotent), picks open tasks up to `effectiveLoad`, and builds `realism`. 3) Confirm `decideProposal` Accept sets `dueAt: now` on the chosen tasks and raises load after 3 accepts in a row (max 4); Reject resets load to 2 (forgiveness). 4) Test idempotency, accept, reject, load transitions. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → proposal lifecycle cases green.
- **EVIDENCE:** DONE output + the three functions.
- **DO NOT:** let a rejected proposal change tasks, or accept twice.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `createProposal({})` → `v.id("coachProposals")` (idempotent — returns the existing pending id); `currentProposal({})` → proposal or null; `decideProposal({ proposalId, decision })` → `{ status, taskLoad }`. `afterAccept`: streak ≥ `STREAK_FOR_RAISE` (3) → `min(MAX_LOAD, taskLoad+1)`, streak 0; else streak+1. `afterReject` → `{ taskLoad: MIN_LOAD(2), acceptedStreak:0 }`. Error cases: no open tasks → `EN: "No open tasks to plan yet. Add one and come back." / HE: "אין עדיין משימות פתוחות לתכנון. הוסיפי אחת וחזרי."`; already decided → `EN: "This proposal was already decided." / HE: "ההצעה הזו כבר הוכרעה."`; not found → `EN: "Proposal not found." / HE: "ההצעה לא נמצאה."`. Auth: `requireUser`.
- **TESTS:** Given a pending proposal / When `createProposal` runs again / Then the same id returns. Given 2 tasks / When `createProposal` runs on load 2 / Then the proposal holds ≤ 2 tasks. Given Accept / Then the tasks get `dueAt: now`. Given 3 accepts in a row / Then `taskLoad` rises by 1 (≤ 4). Given Reject / Then `taskLoad` resets to 2 and no task changes.
- **NUMBERS:** load 2..4, raise at streak 3 → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0171 — Memory: `remember`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149.
- **WHY:** TRD §5 (`remember(userId, text, meta)` → insert into `memories`); PRD F-50.
- **GOAL:** `remember` inserts a live memory for the caller, trimmed and length-bounded.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `remember`).
- **STEPS:** 1) Graphify code-map of `convex/memory.ts` (`remember` exists — verify + test). 2) Confirm trim, non-empty, `CONTENT_MAX` 2000, sector default `general`, salience 0.5. 3) Add EN/HE errors. 4) Test empty/too-long/success. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → remember cases green.
- **EVIDENCE:** DONE output + the `remember` mutation.
- **DO NOT:** accept empty content, exceed 2000 chars, or store another user's memory.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `remember({ content, sector? })` → `v.id("memories")`. Trims; empty → `EN: "Write something to remember first." / HE: "קודם כתבי משהו לזכור."`; > 2000 → `EN: "Keep a memory to 2000 characters or fewer." / HE: "שמרי זיכרון עד 2000 תווים או פחות."`. Sector ∈ `semantic|episodic|procedural|emotional|general`, default `general`. Auth: `requireUser`.
- **TESTS:** Given valid content / When `remember` runs / Then a live memory row returns. Given empty / Then the empty error. Given 2001 chars / Then the length error.
- **NUMBERS:** content ≤ 2000 chars → pass (product constant `CONTENT_MAX`) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0172 — Memory: `list`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** PRD F-52 (see memories); memory.html `memory.list({ kind })`.
- **GOAL:** `list` returns the caller's live memories by salience, optionally filtered by sector, bounded.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `list`).
- **STEPS:** 1) Graphify code-map (`list` exists — verify + test). 2) Confirm sector filter, salience desc (then updatedAt desc), limit clamp 1..200 (default 50). 3) Test filter/bound/owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → list cases green.
- **EVIDENCE:** DONE output + the `list` query.
- **DO NOT:** return soft-deleted rows or another user's rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `list({ sector?, limit? })` → `memoryValidator[]` (`{ _id, content, sector, salience, createdAt, updatedAt, lastAccessed, importedFrom? }`). Live rows only, owner-filtered. Sort salience desc → updatedAt desc. Limit clamp `clampLimit` (1..200, default 50).
- **TESTS:** Given memories in two sectors / When `list({ sector })` / Then only that sector returns. Given limit 5 / Then ≤ 5 rows. Given a soft-deleted row / Then excluded. Given another user's row / Then excluded.
- **NUMBERS:** limit 1..200, default 50 → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0173 — Memory: `recall` — keyword (search index)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** TRD §5 (`recall` = keyword via the existing search index, part of the merged recall); PRD F-50.
- **GOAL:** `recall` finds live memories whose content contains the query, case-insensitive, bounded.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `recall` keyword path).
- **STEPS:** 1) Graphify code-map (`recall` exists as substring match — verify + test). 2) Confirm lowercase normalize, empty → `[]`, limit clamp. 3) Test case/empty/owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → recall-keyword cases green.
- **EVIDENCE:** DONE output + the `recall` query.
- **DO NOT:** return another user's rows or soft-deleted rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recall({ query, limit? })` → `memoryValidator[]`. Normalizes the query to lower-case, substring match on `content`. Empty query → `[]`. Sort salience desc. Limit clamp (default 50). Auth: `requireUser`.
- **TESTS:** Given a memory "Phone calls before noon" / When `recall({ query:"phone" })` / Then it returns. Given `query:"PHONE"` / Then still returns (case-insensitive). Given empty query / Then `[]`. Given another user's match / Then excluded.
- **NUMBERS:** limit clamp default 50 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0174 — Memory: `recall` — vector (meaning)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149, TFV2-0183 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149 + TFV2-0183 (embedding action).
- **WHY:** TRD §5 (`recall` = Convex vector search (meaning)); PRD F-50.
- **GOAL:** `recallMeaning` returns memories by embedding similarity, action-only, owner-filtered.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add `recallMeaning` action).
- **STEPS:** 1) Graphify code-map (no vector recall yet — add it). 2) Add an action that embeds the query (via TFV2-0183's seam), runs Convex vector search over `by_userId_embedding` filtered by `userId`, and returns the top ≤ 256 → capped to `limit` (default 10). 3) Test empty query, owner filter, result cap. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → recall-vector cases green (with a fake embedding seam).
- **EVIDENCE:** DONE output + the `recallMeaning` action.
- **DO NOT:** run vector search in a query, or use a real provider key in tests.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recallMeaning({ query, limit? })` (action) → `memoryValidator[]`. Embeds the query (1,024 dims), vector-search over `by_userId_embedding` with filter `userId`, returns ≤ min(256, limit) (default 10). Empty query → `[]`. Auth: `requireApprovedForAi` (embedding is a provider call).
- **TESTS:** Given a query and a fake embedding seam / When `recallMeaning` runs / Then owner-filtered results return. Given empty query / Then `[]`. Given limit 5 / Then ≤ 5.
- **NUMBERS:** ≤ 256 results (Convex cap) → pass (https://docs.convex.dev/search/vector-search) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (vector search permitted) — UNKNOWN; answerer: Amit.

### TFV2-0175 — Memory: `recall` — links (edges)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0186, TFV2-0187 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0186 (entities) + TFV2-0187 (edges).
- **WHY:** TRD §5c (recall four ways: links via `edges`); PRD F-54.
- **GOAL:** `recallLinks` returns memories linked to entities whose names/aliases match the query.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add `recallLinks`).
- **STEPS:** 1) Graphify code-map of `edges` (table lands in TFV2-0151). 2) Add `recallLinks` that finds edges (from/to) matching the query or an entity alias, then returns the related memories/entities. 3) Test match-by-alias + owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → recall-links cases green.
- **EVIDENCE:** DONE output + the `recallLinks` query.
- **DO NOT:** cross user boundaries, or mix user-written vs guessed links without the `origin` tag.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recallLinks({ query, limit? })` → `{ entities[], memories[] }`. Matches `edges.from`/`edges.to` against the query and entity `aliases`; returns the matched entities and the memories referenced. Guessed (`inferred`) links carry `origin` so the UI can mark them. Empty query → empty. Auth: `requireUser`.
- **TESTS:** Given an edge "Dana → Thursday talk" with alias "manager" / When `recallLinks({ query:"Dana" })` / Then the edge's memories return. Given query "manager" / Then the alias still matches. Given another user's edge / Then excluded.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0176 — Memory: `recall` — time
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** TRD §5c (recall by time via `createdAt` index); PRD F-54.
- **GOAL:** `recallByTime` returns the caller's memories within a time range, newest-first.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add `recallByTime`).
- **STEPS:** 1) Graphify code-map of `memories` indexes. 2) Add `recallByTime({ fromMs, toMs, limit? })` reading the `createdAt` range, owner-filtered, live only. 3) Test range + order + owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → recall-time cases green.
- **EVIDENCE:** DONE output + the `recallByTime` query.
- **DO NOT:** read another user's rows or soft-deleted rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recallByTime({ fromMs, toMs, limit? })` → `memoryValidator[]` newest-first, live only. `toMs > fromMs`. Limit clamp default 50. Auth: `requireUser`.
- **TESTS:** Given memories at t1 < t2 / When `recallByTime({ fromMs:t1, toMs:t2 })` / Then both return newest-first. Given `toMs <= fromMs` / Then `[]`. Given another user's row in range / Then excluded.
- **NUMBERS:** limit default 50 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0177 — Memory: `recall` — merged router (meaning + keyword + links + time)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0173, TFV2-0174, TFV2-0175, TFV2-0176 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0173…0176.
- **WHY:** TRD §5 (`recall` = vector (meaning) + search index (keyword), merged; links and time as further signals); PRD F-50/F-54.
- **GOAL:** One `recall` action merges the four recall modes, dedupes by id, and returns a ranked, bounded result.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (unify `recall`).
- **STEPS:** 1) Graphify code-map of the four recall paths. 2) Add `recall({ query, limit?, modes? })` that merges keyword + vector (+ links + time when requested), dedupes by `_id`, and caps at `limit` (default 10). 3) Preserve the keyword results when the vector seam is unavailable (degrade gracefully). 4) Test merge + dedupe + degrade. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → recall-merged cases green.
- **EVIDENCE:** DONE output + the merged `recall` action.
- **DO NOT:** leak provider errors, or let a vector failure empty the keyword results.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `recall({ query, limit?, modes? })` (action) → `memoryValidator[]`. `modes` ∈ subset of `keyword|meaning|links|time` (default `keyword|meaning`). Merge by `_id` union, dedupe, cap `limit` (default 10). If meaning fails (no key/provider), return keyword-only (never empty on provider error). Auth: `requireApprovedForAi`.
- **TESTS:** Given a query matching both keyword and meaning / When `recall` runs / Then one row per memory (deduped). Given meaning fails / Then keyword results still return. Given `modes:["keyword"]` / Then only keyword runs. Given limit 3 / Then ≤ 3.
- **NUMBERS:** default limit 10 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (meaning mode) — UNKNOWN; answerer: Amit.

### TFV2-0178 — Memory: `context` (token cap)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0177 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0177.
- **WHY:** TRD §5 (`context(userId, topic)` = recall then trim to a token cap).
- **GOAL:** `context` returns the top memories as a single trimmed text block for the coach prompt.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify/extend `context`).
- **STEPS:** 1) Graphify code-map (`context` exists — verify + test). 2) Confirm it sorts by salience, takes ≤ limit (default 10), joins as `- <content>` lines, returns `{ text, count }`. 3) Add a char/token cap constant. 4) Test cap + join + owner. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → context cases green.
- **EVIDENCE:** DONE output + the `context` query.
- **DO NOT:** return another user's memories, or exceed the cap.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `context({ limit? })` → `{ text, count }`. Live memories sorted by salience desc, slice ≤ limit (default 10), joined `- <content>\n`. Cap the joined text at 4000 chars (truncate with `…`, never split a surrogate pair). Auth: `requireUser`.
- **TESTS:** Given 3 memories / When `context({ limit:2 })` / Then `count:2` and text has 2 lines. Given a huge memory set / Then text ≤ 4000 chars. Given another user's row / Then excluded.
- **NUMBERS:** text cap 4000 chars → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0179 — Memory: `forget` (soft delete — OPEN §4.8)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** PRD F-52 (forget memories); TRD §5 (`forget(userId, memoryId|all)`; hard vs soft: open, patch C4).
- **GOAL:** `forget` removes one memory with a 5-minute Undo window.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `forget`).
- **STEPS:** 1) Graphify code-map (`forget` soft-deletes via `deletedAt` — verify + test). 2) Confirm owner check, "Memory not found" for missing/foreign, and that the row is soft-deleted (not hard-deleted). 3) Test missing/foreign/already-deleted. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → forget cases green.
- **EVIDENCE:** DONE output + the `forget` mutation.
- **DO NOT:** hard-delete here (semantics are OPEN §4.8 — soft delete is the current code, kept as-is), or forget another user's row.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `forget({ memoryId })` → `{ success:true }`. Soft delete (`deletedAt = now`). Error cases: missing/foreign/already-deleted → `EN: "Memory not found." / HE: "הזיכרון לא נמצא."`. Auth: `requireUser`.
- **TESTS:** Given an owned memory / When `forget` runs / Then `deletedAt` is set (not hard-deleted). Given a foreign memoryId / Then "Memory not found." Given an already-deleted id / Then "Memory not found."
- **NUMBERS:** 30-day grace (HARD_RULES §9 soft delete) → pass | **UNKNOWN** — whether `forget` must be *complete* (hard) per the memory spec is OPEN §4.8; answerer: Amit.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 — hard vs soft `forget` semantics: UNKNOWN; answerer: Amit.

### TFV2-0180 — Memory: `restore`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0179 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0179.
- **WHY:** PRD §5 (Undo within the grace window); memory.html `memory.restore({ id })`.
- **GOAL:** `restore` brings back a forgotten memory while still inside the grace window.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `restore`).
- **STEPS:** 1) Graphify code-map (`restore` exists — verify + test). 2) Confirm `isRestorable` grace check and clearing `deletedAt`. 3) Test in-window success / out-of-window false / foreign. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → restore cases green.
- **EVIDENCE:** DONE output + the `restore` mutation.
- **DO NOT:** restore after the grace window, or restore another user's row.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `restore({ memoryId })` → `{ success:boolean }`. Clears `deletedAt` only while `isRestorable(deletedAt, now)`. Error: missing/foreign → `EN: "Memory not found." / HE: "הזיכרון לא נמצא."`. Auth: `requireUser`.
- **TESTS:** Given a memory forgotten 1 min ago / When `restore` runs / Then `success:true`, `deletedAt` cleared. Given forgotten 31 days ago / Then `success:false`. Given a foreign id / Then "Memory not found."
- **NUMBERS:** 5-minute Undo + 30-day grace → pass (product constants) | **UNKNOWN** — grace length if `forget` becomes hard-delete (OPEN §4.8); answerer: Amit.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 — UNKNOWN; answerer: Amit.

### TFV2-0181 — Memory: `forgetAll` + `restoreAll` (batch)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0180 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0180.
- **WHY:** memory.html `memory.forgetAll({})` (asks first) + `memory.restoreAll({ batchId })`.
- **GOAL:** `forgetAll` soft-deletes a batch (or everything) as one `forgottenAt` stamp; `restoreAll` brings that batch back within the grace window.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `forgetAll`/`restoreAll`).
- **STEPS:** 1) Graphify code-map (both exist — verify + test). 2) Confirm `BATCH_MAX` 300, same `deletedAt` stamp, and `restoreAll({ forgottenAt })` restores only that stamp. 3) Test batch bound, restore, foreign ids. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → forgetAll cases green.
- **EVIDENCE:** DONE output + the two mutations.
- **DO NOT:** forget without a batch stamp, exceed 300, or restore a stamp that is another user's.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `forgetAll({ memoryIds? })` → `{ count, forgottenAt }`; without `memoryIds` forgets all live memories. > 300 ids → `EN: "Forget up to 300 memories at a time." / HE: "אפשר לשכוח עד 300 זיכרונות בבת אחת."`. `restoreAll({ forgottenAt })` → `{ restored }` (0 if out of window). Auth: `requireUser`.
- **TESTS:** Given 3 memories / When `forgetAll` runs / Then all get the same `deletedAt`. Given 301 ids / Then the 300 error. Given `restoreAll({ forgottenAt })` in-window / Then the batch restores. Given out-of-window / Then `restored:0`.
- **NUMBERS:** batch ≤ 300 → pass (product constant `BATCH_MAX`) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 (if `forget` becomes hard, batch restore semantics change) — UNKNOWN; answerer: Amit.

### TFV2-0182 — Memory: `export` (Markdown)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** PRD F-52 (export all memories as markdown); TRD §5 (`export(userId)` → plain markdown).
- **GOAL:** `exportAll` returns every live memory as one Markdown string, grouped by sector, with source marks.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify `exportAll`).
- **STEPS:** 1) Graphify code-map (`exportAll` exists — verify + test). 2) Confirm sections per sector, imported sources marked, empty → "No memories saved yet.". 3) Test grouping + source marks + empty. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → export cases green.
- **EVIDENCE:** DONE output + the `exportAll` query.
- **DO NOT:** remove anything, or export another user's rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `exportAll({})` → `{ filename, exportedAt, count, markdown }`. `filename` `tempo-memories-<YYYY-MM-DD>.md`. Markdown: `# Tempo memories`, one `## <Sector>` per non-empty sector, bullets `- <content>`; imported rows append `(imported from ChatGPT|Claude|Grok)` or `(imported)`. Empty → a line `EN: "No memories saved yet." / HE: "עוד אין זיכרונות שמורים."`. Auth: `requireUser`.
- **TESTS:** Given memories in 2 sectors / When `exportAll` runs / Then two `##` sections appear. Given an imported row / Then its bullet ends with `(imported from ChatGPT)`. Given none / Then the empty line and `count:0`.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0183 — Memory: embedding generation action
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0149 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0149.
- **WHY:** TRD §5 (embedding model Qwen3-Embedding-8B, 1,024 dims via Matryoshka truncation); PRD F-50.
- **GOAL:** `embedMemory` generates and stores a 1,024-float embedding for a memory via the one embedding seam.
- **SCOPE:** `convex/memory.ts` · `convex/lib/ai_router.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add `embedMemory` action), `convex/lib/ai_router.ts` (expose `embeddingModel` seam).
- **STEPS:** 1) Graphify code-map of `convex/lib/ai_router.ts` (add an embedding seam, names only). 2) Add `embedMemory({ memoryId })` that calls the embedding model, keeps the first 1,024 values (re-normalised), and patches `memories.embedding`. 3) Test with a fake embedding seam (no real key). 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → embedding cases green.
- **EVIDENCE:** DONE output + the `embedMemory` action.
- **DO NOT:** print a key value, call the provider from a query, or exceed 1,024 dims.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `embedMemory({ memoryId })` (action) → `{ success:true }`. Embedding model id resolved through the seam (names only; default `Qwen/Qwen3-Embedding-8B`, OPEN §4.3). Native 4,096 → keep first 1,024, re-normalise to unit length. Patch `memories.embedding`. Error: missing key → throw internal (never surface key text). Auth: `requireApprovedForAi`.
- **TESTS:** Given a fake seam returning 4,096 floats / When `embedMemory` runs / Then the stored vector has exactly 1,024 floats and unit norm. Given a missing key seam / Then it throws without surfacing key text. Given a foreign memoryId / Then "Memory not found."
- **NUMBERS:** 1,024 dims → pass (Convex 2–2,048 dims, https://docs.convex.dev/search/vector-search) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 embedding model id (default Qwen3-Embedding-8B, EXTRAPOLATED) — UNKNOWN; answerer: Amit.

### TFV2-0184 — Memory: re-embed backfill action
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0183 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0183.
- **WHY:** TRD §5 ("Changing the model later means re-embedding everything"); PRD F-50.
- **GOAL:** `reembedAll` re-embeds every live memory missing an embedding (or on model change) in bounded batches.
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add `reembedAll` action).
- **STEPS:** 1) Graphify code-map. 2) Add `reembedAll({})` that batches live memories without an embedding (≤ 50 per run) and patches each via the seam. 3) Test batch bound + skip-already-embedded. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → reembed cases green.
- **EVIDENCE:** DONE output + the `reembedAll` action.
- **DO NOT:** re-embed rows that already have a current-model embedding, or exceed the batch bound.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `reembedAll({})` (action) → `{ embedded }`. Processes live memories with no `embedding` (or a stale model tag) up to 50 per run. Auth: internal/system only.
- **TESTS:** Given 3 un-embedded memories / When `reembedAll` runs / Then all 3 get embeddings (≤ 50). Given an already-embedded row / Then it is skipped. Given > 50 un-embedded / Then only 50 are done per run.
- **NUMBERS:** 50 per run → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 (model change re-embed) — UNKNOWN; answerer: Amit.

### TFV2-0185 — Memory: Hebrew embedding eval
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0183 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0183.
- **WHY:** TRD §5 ("Before locking one, run a check on 20 Hebrew + 20 English questions against about 200 of Amit's own notes. Compare Qwen3-Embedding-8B, bge-m3 and multilingual-e5-large-instruct on top-3 hit rate."); PRD §7.
- **GOAL:** A scripted eval compares the three candidate embedding models on top-3 hit rate over 20 Hebrew + 20 English questions, and records the result (no model is locked in by this ticket).
- **SCOPE:** `scripts/` (one eval script) · `convex/lib/ai_router.ts` (read the seam) · test: `scripts/hebrew-embedding-eval.test.ts`.
- **MUTATES:** `scripts/` (new eval script).
- **STEPS:** 1) Graphify code-map of the embedding seam. 2) Write `scripts/hebrew-embedding-eval.mjs` that, given 20 Hebrew + 20 English (question, expected note) pairs and ~200 note embeddings per model, computes top-3 hit rate for `Qwen/Qwen3-Embedding-8B`, `BAAI/bge-m3`, `intfloat/multilingual-e5-large-instruct`. 3) Print a per-model table (names only, no keys). 4) Unit-test the scoring function (deterministic). 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="hebrew-embedding"` → the scoring function is green (network run reported separately as UNKNOWN if offline).
- **EVIDENCE:** DONE output + the script + the scoring test.
- **DO NOT:** run a paid API without Amit's OK, print a key, or write a value to `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Scoring = fraction of 40 questions whose correct note is in the top-3 by cosine similarity. Model ids are names only. The real network run is `UNKNOWN` in a sandbox without keys/network.
- **TESTS:** Given a fixed embedding matrix and expected hits / When the scorer runs / Then the top-3 hit rate matches a hand-computed value. Given 0 questions / Then the scorer returns 0 (not NaN).
- **NUMBERS:** top-3 hit rate (higher is better) → pass range ≥ 0.7 (internal bar) | **UNKNOWN** — no public Hebrew-specific benchmark exists (TRD §5); answerer: Amit.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 (which embedding model locks in) — UNKNOWN; answerer: Amit.
### TFV2-0186 — Life graph: `entities` CRUD
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0150 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0150.
- **WHY:** TRD §5c (`entities` table); PRD F-54.
- **GOAL:** Entities (person/project/goal/place/habit) can be created, read, and soft-deleted with aliases.
- **SCOPE:** `convex/lib/lifeGraph.ts` (new) · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/lib/lifeGraph.ts` (new).
- **STEPS:** 1) Graphify code-map of `entities` (table from TFV2-0150). 2) Add `upsertEntity({ kind, name, aliases })` (dedupe by lower-case name+owner), `listEntities({ kind? })`, and `forgetEntity({ id })` (soft delete). 3) Owner-filter every read. 4) Test dedupe/kind/owner/delete. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → entities cases green.
- **EVIDENCE:** DONE output + the three functions.
- **DO NOT:** infer entities from text here (that is edges/extraction), or cross user boundaries.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `upsertEntity({ kind, name, aliases })` → `v.id("entities")` (dedupe by lower-case name within the owner); `listEntities({ kind? })` → `{ _id, kind, name, aliases }[]`; `forgetEntity({ id })` → `{ success:true }`. Error: name empty → `EN: "Give it a name." / HE: "תני לו שם."`. Auth: `requireUser`.
- **TESTS:** Given two upserts of the same name / Then one row. Given `kind:"person"` / Then `listEntities({ kind:"person" })` returns only people. Given `forgetEntity` / Then soft-deleted and excluded. Given another user's entity / Then never returned.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0187 — Life graph: `edges` extraction (extracted vs inferred)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0151, TFV2-0186 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0151 + TFV2-0186.
- **WHY:** TRD §5c (extract entities and claims into `edges`; `origin: extracted` from `[[links]]`/blocks, no model; `inferred` model-guessed); PRD F-54.
- **GOAL:** Links the user wrote (`[[links]]`, blocks) become `extracted` edges with no model; a model may add `inferred` edges marked as guesses.
- **SCOPE:** `convex/lib/lifeGraph.ts` · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/lib/lifeGraph.ts` (add extraction).
- **STEPS:** 1) Graphify code-map of `notes.body` and `[[links]]`. 2) Add `extractEdges({ noteId })` that reads the caller's page, finds `[[links]]`/block references, and writes `origin:"extracted"` edges (no model). 3) Add `inferEdges({ noteId })` (action) that may write `origin:"inferred"` edges with `confidence` from the model (approved-for-AI). 4) Test extracted vs inferred origin + owner. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → edges cases green.
- **EVIDENCE:** DONE output + the two functions.
- **DO NOT:** mark an inferred link as extracted, or let a model write `extracted`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `extractEdges({ noteId })` → `{ created }` (links the user wrote, `origin:"extracted"`, `confidence:1`); `inferEdges({ noteId })` (action) → `{ created }` (`origin:"inferred"`, `confidence` 0..1, model-guessed, approved-for-AI). Both owner-filtered. `sourceRef` = the note id.
- **TESTS:** Given a page with `[[Dana]]` / When `extractEdges` runs / Then an `extracted` edge appears (no model called). Given `inferEdges` / Then `inferred` edges carry `confidence` and origin. Given another user's note / Then rejected.
- **NUMBERS:** `confidence` 0..1 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.6/§4.9 (whether inferred edges may be auto-applied vs confirm-first) — UNKNOWN; answerer: Amit.

### TFV2-0188 — Life graph: `edges` confirm + query
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0187 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0187.
- **WHY:** memory.html `lifeGraph.confirmGuess({ id })` (Guess → "You confirmed this"); PRD F-54 (guesses kept apart until confirmed).
- **GOAL:** `confirmEdge` flips an inferred edge to confirmed; `listEdges` returns edges with their origin.
- **SCOPE:** `convex/lib/lifeGraph.ts` · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/lib/lifeGraph.ts` (add confirm + query).
- **STEPS:** 1) Graphify code-map. 2) Add `confirmEdge({ id })` (inferred → confirmed; the badge changes) and `listEdges({ from?|to? })`. 3) Test confirm + origin preserved + owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → confirm/query cases green.
- **EVIDENCE:** DONE output + the two functions.
- **DO NOT:** let a confirmed edge revert to a guess, or expose another user's edges.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `confirmEdge({ id })` → `{ success:true }` (sets a `confirmed` flag while keeping `origin:"inferred"` for provenance); `listEdges({ from?, to? })` → edges array with `origin`, `confidence`, `confirmed`. Auth: `requireUser`.
- **TESTS:** Given an inferred edge / When `confirmEdge` runs / Then it is confirmed. Given a foreign edge / Then rejected. Given `listEdges({ from })` / Then only that side returns, owner-filtered.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0189 — Life graph: graph neighbors query
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0188 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0188.
- **WHY:** TRD §5c (graph view of life projects — END; the neighbors read is MVP); PRD F-54.
- **GOAL:** `graphNeighbors` returns an entity plus its directly linked entities (one hop), owner-scoped.
- **SCOPE:** `convex/lib/lifeGraph.ts` · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/lib/lifeGraph.ts` (add query).
- **STEPS:** 1) Graphify code-map of `edges`. 2) Add `graphNeighbors({ entityName })` returning the entity and its `from`/`to` neighbors in one hop. 3) Test one-hop + owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → neighbors cases green.
- **EVIDENCE:** DONE output + the `graphNeighbors` query.
- **DO NOT:** traverse beyond one hop, or cross users.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `graphNeighbors({ entityName })` → `{ entity?, neighbors[] }`. Neighbors = entities sharing an edge with the name/alias (one hop). Owner-filtered. Auth: `requireUser`.
- **TESTS:** Given "Dana" ↔ "Thursday talk" ↔ "Slides" / When `graphNeighbors({ entityName:"Thursday talk" })` / Then both neighbors return (one hop, no further). Given a foreign entity / Then empty.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0190 — Reflect: consolidation cron → `observations`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0152, TFV2-0183 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0152 + TFV2-0183.
- **WHY:** TRD §5c (reflect cron consolidates memories into `observations`, each with the memory ids that support it); PRD F-55.
- **GOAL:** A nightly cron consolidates many memories into observations, each recording its supporting memory ids.
- **SCOPE:** `convex/crons.ts` · `convex/lib/lifeGraph.ts` · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/crons.ts` (register nightly reflect), `convex/lib/lifeGraph.ts` (add `reflect`).
- **STEPS:** 1) Graphify code-map of `convex/crons.ts`. 2) Add `reflect({})` (action) that groups recent memories and writes `observations` rows (model-written text + `memoryIds`). 3) Register a nightly cron in `crons.ts`. 4) Test grouping + ids + no-op when few memories. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → reflect cases green.
- **EVIDENCE:** DONE output + the cron registration + `reflect`.
- **DO NOT:** run reflect per-message (nightly only), or write observations without supporting memory ids.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `reflect({})` (action) → `{ created }`. Consolidates the owner's memories into observation text via the model (approved-for-AI), each row carrying `memoryIds`. Cron: nightly in `crons.ts`. Auth: system/internal.
- **TESTS:** Given 5 related memories / When `reflect` runs / Then an observation is written with all 5 ids. Given 1 memory / Then no observation (needs a minimum of 3). Given another user's memories / Then never consolidated into this user's observations.
- **NUMBERS:** minimum 3 memories per observation → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (model-written observation text vs HARD_RULES §2) — UNKNOWN; answerer: Amit.

### TFV2-0191 — Reflect: `observations` list + delete
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0190 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0190.
- **WHY:** TRD §5c (observations shown to the user, deletable); PRD F-55.
- **GOAL:** Observations can be listed (newest-first) and soft-deleted by the user.
- **SCOPE:** `convex/lib/lifeGraph.ts` · test: `convex/lib/lifeGraph.test.ts`.
- **MUTATES:** `convex/lib/lifeGraph.ts` (add list + delete).
- **STEPS:** 1) Graphify code-map of `observations`. 2) Add `listObservations({})` and `forgetObservation({ id })` (soft delete). 3) Test owner + delete. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="lifeGraph"` → observations cases green.
- **EVIDENCE:** DONE output + the two functions.
- **DO NOT:** surface another user's observations, or hard-delete.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `listObservations({})` → `{ _id, text, memoryIds, createdAt }[]` newest-first; `forgetObservation({ id })` → `{ success:true }` (soft delete). Auth: `requireUser`.
- **TESTS:** Given two observations / When listed / Then newest-first. Given `forgetObservation` / Then soft-deleted and excluded. Given a foreign id / Then rejected.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0192 — Memory import: `importPreview` (parse, save nothing)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** TRD §5 (`importPreview(userId, text, source)` splits into candidate items; nothing saved); PRD F-51; RAM-only rule.
- **GOAL:** `importPreview` splits pasted/uploaded text into candidate memory items, in RAM, saving nothing.
- **SCOPE:** `convex/memoryImport.ts` · `convex/lib/memoryImport.ts` · test: `convex/lib/memoryImport.test.ts`.
- **MUTATES:** `convex/memoryImport.ts` (add preview surface), `convex/lib/memoryImport.ts` (parse helpers).
- **STEPS:** 1) Graphify code-map of `convex/lib/memoryImport.ts` (`parseMemoryExport` exists — verify + test). 2) Add `importPreview({ source, text })` returning `{ items: string[] }` (≤ 300, cleaned, deduped). 3) Confirm nothing is inserted. 4) Test JSON/line parsing + dedupe + bound. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memoryImport"` → preview cases green.
- **EVIDENCE:** DONE output + the `importPreview` mutation.
- **DO NOT:** save anything, persist the raw text, or exceed 1 MB.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `importPreview({ source, text })` → `{ items: string[] }`. `source` ∈ `chatgpt|claude|grok|other`. > 1 MB → `EN: "That memory import is too large. Keep it under 1 MB." / HE: "הייבוא הזה גדול מדי. עד 1 MB."`. Parses JSON or lines via `parseMemoryExport`; ≤ 300 items, each ≤ 1000 chars, deduped case-insensitively. Saves nothing. Auth: `requireUser`.
- **TESTS:** Given pasted ChatGPT JSON / When `importPreview` runs / Then cleaned items return and nothing is in `memories`. Given 3 duplicate lines / Then deduped. Given > 1 MB / Then the size error. Given > 300 candidates / Then ≤ 300.
- **NUMBERS:** ≤ 300 items, ≤ 1000 chars each, ≤ 1 MB input → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0193 — Memory import: `importCommit` (save kept items)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0192 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0192.
- **WHY:** TRD §5 (`importCommit(userId, items)` → `remember` for each kept item with `metadata.source`); PRD F-51.
- **GOAL:** `importCommit` saves the kept/edited items, skips duplicates, and returns the new ids for the 5-minute Undo.
- **SCOPE:** `convex/memoryImport.ts` · test: `convex/memoryImport.test.ts`.
- **MUTATES:** `convex/memoryImport.ts` (verify `saveReviewed`/add `importCommit`).
- **STEPS:** 1) Graphify code-map (`saveReviewed` exists — verify + test). 2) Add `importCommit({ source, items })` that cleans each item, skips duplicates (case-insensitive), inserts with `metadata:{ source, importedAt }`, and returns `{ added, skipped, memoryIds }`. 3) Test duplicate skip + bound + owner. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memoryImport"` → commit cases green.
- **EVIDENCE:** DONE output + the `importCommit` mutation.
- **DO NOT:** persist raw import text, or create a second copy of an existing memory.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `importCommit({ source, items })` → `{ added, skipped, memoryIds }`. Items cleaned via `cleanImportItem`; duplicates (lower-case) skipped; each saved with `metadata.source` and `metadata.importedAt`. ≤ 300 items; > 300 → `EN: "Save up to 300 items at a time." / HE: "אפשר לשמור עד 300 פריטים בבת אחת."`. Auth: `requireUser`.
- **TESTS:** Given 3 kept items / When `importCommit` runs / Then 3 memories with source metadata and 3 ids. Given one duplicate of an existing memory / Then `skipped:1`. Given 301 items / Then the 300 error.
- **NUMBERS:** ≤ 300 items → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0194 — Memory import: `undoImport` (5-minute)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0193 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0193.
- **WHY:** memory-import.html `memory.undoImport({ batchId })` within 5 minutes; PRD §5.
- **GOAL:** `undoImport` forgets exactly the batch committed, within the 5-minute window.
- **SCOPE:** `convex/memoryImport.ts` · test: `convex/memoryImport.test.ts`.
- **MUTATES:** `convex/memoryImport.ts` (add `undoImport`).
- **STEPS:** 1) Graphify code-map (`forgetAll({ memoryIds })` exists — reuse). 2) Add `undoImport({ memoryIds })` that soft-deletes exactly those ids (≤ 300) via `forgetAll`. 3) Test window + exact batch. 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memoryImport"` → undo cases green.
- **EVIDENCE:** DONE output + the `undoImport` mutation.
- **DO NOT:** forget ids the user did not just import, or bypass the 5-minute window.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `undoImport({ memoryIds })` → `{ count, forgottenAt }`. Delegates to `memory.forgetAll({ memoryIds })`. Only the caller's own ids. Auth: `requireUser`.
- **TESTS:** Given 3 just-imported ids / When `undoImport` runs / Then all 3 soft-delete. Given a foreign id in the list / Then it is skipped. Given out-of-window restore attempt / Then restore fails.
- **NUMBERS:** 5-minute Undo → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 (if `forget` becomes hard-delete) — UNKNOWN; answerer: Amit.

### TFV2-0195 — Memory: salience decay cron
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0171 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0171.
- **WHY:** PRD F-50 (salience decay over time); `memories.decayRate`.
- **GOAL:** A cron lowers salience of long-unaccessed memories toward a floor, never below 0.1.
- **SCOPE:** `convex/crons.ts` · `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/crons.ts` (register), `convex/memory.ts` (add `decay` action).
- **STEPS:** 1) Graphify code-map of `memories.decayRate`/`salience`. 2) Add `decay({})` (action) that, for live memories accessed > 1 day ago, lowers `salience` by `salience * (1 - decayRate * days)`, floor 0.1. 3) Register a daily cron. 4) Test floor + decay. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → decay cases green.
- **EVIDENCE:** DONE output + the cron + `decay`.
- **DO NOT:** lower below 0.1, or touch a memory accessed today.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `decay({})` → `{ updated }`. For each live memory with `now - lastAccessed > 1 day`, `salience = max(0.1, salience * (1 - decayRate * daysSince))`. Daily cron. Auth: system.
- **TESTS:** Given a memory 10 days un-accessed with decayRate 0.01 / Then salience drops toward 0.1 (never below). Given accessed today / Then unchanged. Given already at 0.1 / Then unchanged.
- **NUMBERS:** salience floor 0.1 → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0196 — Anti-shaming wiring (shame-word guard)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** PRD F-25/F-26 (anti-shaming, never say they are behind/failing/lazy); HARD_RULES §6 (no shame).
- **GOAL:** A fixed shame-word list flags shaming phrases in a coach reply, and the reply path filters/refuses them.
- **SCOPE:** `convex/lib/shameWords.ts` (new) · `convex/lib/coachPrompt.ts` · test: `convex/lib/shameWords.test.ts`.
- **MUTATES:** `convex/lib/shameWords.ts` (new), `convex/lib/coachPrompt.ts` (guard hook).
- **STEPS:** 1) Graphify code-map (no `shameWords.ts` yet — create it). 2) Add `SHAME_PHRASES` (fixed list: "you are lazy", "why didn't you", "you're behind", "you keep failing", "you should have", "that's easy", "just", etc.) and `isShaming(text)` (normalised substring). 3) Hook a guard into the reply path that, when a reply is shaming, replaces it with a fixed neutral line (no model). 4) Add the neutral line EN/HE. 5) Test detection + replacement. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="shameWords"` → guard cases green.
- **EVIDENCE:** DONE output + the list + guard.
- **DO NOT:** call a model to detect shame, or silently drop a reply without the neutral line.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `SHAME_PHRASES` fixed in code; `isShaming(text)` normalises (lower-case, apostrophes, single spaces) and substring-matches. Neutral replacement: `EN: "I would not put it that way. Let me try again more gently." / HE: "לא הייתי מנסחת את זה ככה. אנסה שוב בעדינות."`. Auth: the guard runs inside the coach reply path (already approved-for-AI). No model call.
- **TESTS:** Given "Why didn't you do this yet?" / When `isShaming` runs / Then true. Given a neutral reply / Then false. Given a shaming model reply / When the guard runs / Then it is replaced by the neutral line. Given empty text / Then false.
- **NUMBERS:** none → n/a | **UNKNOWN** — whether a shaming reply is auto-filtered vs surfaced for edit (OPEN §4.6 accept-reject vs auto-apply) and the confidence threshold for any auto-behaviour (OPEN §4.9); answerer: Amit.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.6, §4.9 — UNKNOWN; answerer: Amit.

### TFV2-0197 — Mock model wiring (`lib/mockModel.ts`)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §3 (a mock model seam so tests/dev run with no key); `convex/lib/mockModel.ts` (MISSING).
- **GOAL:** `mockModel.ts` provides a deterministic, key-free model/embedding seam for tests and local dev.
- **SCOPE:** `convex/lib/mockModel.ts` (new) · test: `convex/lib/mockModel.test.ts`.
- **MUTATES:** `convex/lib/mockModel.ts` (new).
- **STEPS:** 1) Graphify code-map (file is MISSING — create). 2) Add `mockLanguageModel` and `mockEmbeddingModel` returning deterministic replies/vectors (no network, no key). 3) Make the coach Agent accept a model seam override so tests inject the mock. 4) Test determinism + no-key. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="mockModel"` → mock cases green.
- **EVIDENCE:** DONE output + the mock seam.
- **DO NOT:** let the mock ever hit a network or read a real key; never use the mock as evidence for a real-model DONE check.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `mockLanguageModel` returns a fixed `{ content }` for any input (deterministic); `mockEmbeddingModel` returns a fixed 1,024-float unit vector. Both typed to the AI SDK model interface so the Agent accepts them. No key read, no network.
- **TESTS:** Given the same input / When `mockLanguageModel` runs twice / Then identical content. Given `mockEmbeddingModel` / Then a 1,024-float vector. Given no key in env / Then the mock still works.
- **NUMBERS:** mock embedding 1,024 dims → pass (product constant) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 (the real model the mock mirrors) — UNKNOWN; answerer: Amit.

### TFV2-0198 — Entitlement gate: approved + premium tier before AI
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0153 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0153.
- **WHY:** TRD §7.3 (auth → entitlement → quota before any model call); `convex/lib/entitlements.ts` (GRANTED_ENTITLEMENT_TIER = "max", GRANTED_USER_TYPE = "paid").
- **GOAL:** Every coach/memory AI action checks auth then entitlement (approved + entitled tier) before any provider call, verified by test.
- **SCOPE:** `convex/lib/aiGate.ts` · `convex/lib/entitlements.ts` · test: `convex/lib/aiGate.test.ts`.
- **MUTATES:** `convex/lib/aiGate.ts` (verify/extend), `convex/lib/entitlements.ts` (read only).
- **STEPS:** 1) Graphify code-map of `requireApprovedForAi` + `entitlements.ts`. 2) Confirm the order: `ctx.auth` → approval (`assertApprovedForAi`) → entitlement tier check → provider. 3) Add a pure helper `assertEntitledForAi(user)` that reads the granted tier. 4) Test signed-out / pending / revoked / entitled. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="aiGate"` → entitlement-order cases green.
- **EVIDENCE:** DONE output + the gate order.
- **DO NOT:** move the gate after the provider call, or grant AI to a non-entitled account.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `requireApprovedForAi(ctx)` runs `approval.assertApprovedForAi` then an entitlement check (every approved user gets the premium tier per F-01a). Order is asserted by test: no provider call may precede the gate. Auth: actions pass identity to `ctx.runQuery`.
- **TESTS:** Given a signed-out identity / When a model action runs / Then rejected before provider. Given a revoked account / Then rejected. Given an approved+entitled account / Then the gate passes.
- **NUMBERS:** gate strictly before provider → pass (boolean ordering) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0199 — Quota gate: daily coach-turn limit before AI
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0198 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0198.
- **WHY:** TRD §7.3 (quota step in the server-side order); `convex/lib/bounded.ts` (MISSING).
- **GOAL:** A per-user daily coach-turn quota is enforced before the model call, in the auth → entitlement → quota order.
- **SCOPE:** `convex/lib/bounded.ts` (new) · `convex/lib/aiGate.ts` · test: `convex/lib/bounded.test.ts`.
- **MUTATES:** `convex/lib/bounded.ts` (new), `convex/lib/aiGate.ts` (call quota after entitlement).
- **STEPS:** 1) Graphify code-map (no quota yet). 2) Add `bounded.ts` with `assertWithinQuota({ used, limit })` and a daily coach-turn counter (UTC day, like `coachWebSearches`). 3) Insert the quota check in the reply path after entitlement. 4) Add the EN/HE over-limit line. 5) Test order + over-limit. 6) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="bounded"` → quota cases green.
- **EVIDENCE:** DONE output + the quota gate.
- **DO NOT:** bill/charge, or let the quota run after the provider call.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `assertWithinQuota({ used, limit })` throws over-limit; counter counts coach turns per UTC day (like `WEB_SEARCH_DAILY_LIMIT`). Over-limit user line: `EN: "You've reached today's coach limit. It resets at midnight." / HE: "הגעת למגבלת המאמן היומית. היא מתאפסת בחצות."`. Order: auth → entitlement → quota → provider. Auth: `requireApprovedForAi`.
- **TESTS:** Given used == limit / When a turn starts / Then the over-limit line returns and no model call. Given used < limit / Then it proceeds. Given a fresh UTC day / Then the counter resets.
- **NUMBERS:** daily coach-turn limit → pass | **UNKNOWN** — the exact per-day turn cap is not in the docs; answerer: Amit.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** daily turn cap — UNKNOWN; answerer: Amit.

### TFV2-0200 — UI: `CoachPanel`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0154 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0154.
- **WHY:** components.md §1 Stage 1 (`CoachPanel`) + §2.10; coach.html `@component CoachPanel`.
- **GOAL:** A dockable glass `CoachPanel` shell renders the coach head, thread slot, composer slot, and all states, docked at 1280+ and a sheet below.
- **SCOPE:** `apps/web/components/coach/CoachPanel.tsx` · `apps/web/components/coach/CoachPanel.css` (or tokens via classes) · test: `apps/web/components/coach/CoachPanel.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/CoachPanel.tsx` (new).
- **STEPS:** 1) Graphify code-map of `apps/web` coach folder. 2) Build the component per the markup below. 3) Wire `data-component="CoachPanel"`, `role`/`aria` per the catalogue. 4) Add the Playwright click-through. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "CoachPanel"` → all states asserted at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + a screenshot of the default state.
- **DO NOT:** edit `convex/`, invent copy, or dock the panel as a modal on mobile.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Classes: `.tp-coach-panel.tp-glass`, `__head`, `__title`, plus the head actions. Copy EN/HE: `coach.name` `EN: "Coach" / HE: "מאמן"`; `coach.sub` `EN: "Reads Today and your pages. Asks before changing anything." / HE: "קורא את היום ואת הדפים שלך. שואל לפני כל שינוי."`; close aria `EN: "Close coach" / HE: "סגירת המאמן"`; voice aria `EN: "Talk with voice" / HE: "לדבר בקול"`. States: default (thread + composer), empty, loading, error, offline all render inside the panel; the page behind stays. Breakpoints: docked right of Today at 1280 and up (`.tp-coach-panel` fixed width 360), a bottom sheet below 1280. Motion ≤ 250 ms ease-out on open/close; Esc closes; focus returns to the opener. RTL: `dir="rtl"`, logical `start/end` spacing, chevron icons mirrored.
- **TESTS:** Given a closed panel / When `Ctrl J` or the CoachButton opens it / Then it docks (1280) or sheets (390), focus lands on the thread. Given offline state / Then "The coach is offline. Your list still works." shows. Given empty / Then the opener shows. Playwright asserts each state at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 (WCAG 2.2 AA, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · target size 24×24 px (WCAG 2.5.8, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0201 — UI: `CoachMessage`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0200 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0200.
- **WHY:** components.md §1 (`CoachMessage`); coach.html `@component CoachMessage`.
- **GOAL:** A coach message bubble shows the who-label, `dir="auto"` text, a Read-aloud action, and a streaming variant.
- **SCOPE:** `apps/web/components/coach/CoachMessage.tsx` · test: `apps/web/components/coach/CoachMessage.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/CoachMessage.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build per markup. 3) Support `streaming` (aria-busy) and read-aloud. 4) Playwright states. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "CoachMessage"` → states at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** invent copy, or read aloud automatically.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-msg` (no `--user`), `__who` `EN: "Coach" / HE: "מאמן"`, `__text` `dir="auto"`, `__actions` with `ReadAloudButton`. Streaming adds `aria-busy="true"` and a `TypingIndicator` under the text. RTL: `dir="auto"` per paragraph; the who-label sits at the logical start.
- **TESTS:** Given a message / When rendered / Then the who-label and text show. Given `streaming` / Then `aria-busy` and the indicator show. Given HE locale / Then `dir="rtl"` and Hebrew who-label. Playwright asserts each at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0202 — UI: `UserMessage`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0200 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0200.
- **WHY:** components.md §1 (`UserMessage`); coach.html `@component UserMessage`.
- **GOAL:** A user message bubble shows the "You" label and `dir="auto"` text.
- **SCOPE:** `apps/web/components/coach/UserMessage.tsx` · test: `apps/web/components/coach/UserMessage.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/UserMessage.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-msg.tp-msg--user` with `__who` and `__text`. 3) Playwright. 4) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "UserMessage"` → states at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** add actions to a user message.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-msg.tp-msg--user`, `__who` `EN: "You" / HE: "את"`, `__text` `dir="auto"`. No read-aloud on user messages.
- **TESTS:** Given a message / When rendered / Then "You"/"את" and the text show with `dir="auto"`.
- **NUMBERS:** contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0203 — UI: `CoachButton`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0200 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0200.
- **WHY:** components.md §1 (`CoachButton`); coach.html `@component CoachButton` (Ctrl J).
- **GOAL:** A floating glass button opens the coach panel (Ctrl J) with the correct label and aria.
- **SCOPE:** `apps/web/components/coach/CoachButton.tsx` · test: `apps/web/components/coach/CoachButton.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/CoachButton.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-coach-fab.tp-glass` with `data-action="open-coach"`, `aria-expanded`, `aria-controls="coach"`. 3) Keyboard Ctrl J. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "CoachButton"` → open at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** open the panel on hover, or drop the Ctrl J shortcut.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-coach-fab.tp-glass`, icon `#i-coach`, label `EN: "Coach" / HE: "מאמן"`, aria `EN: "Open coach (Ctrl J)" / HE: "פתיחת המאמן (Ctrl J)"`. Bottom-right at 1280+, above the tabbar on mobile. Motion ≤ 250 ms.
- **TESTS:** Given a closed panel / When the button or Ctrl J is pressed / Then the panel opens and `aria-expanded` flips. Playwright at 390/1280, EN/HE.
- **NUMBERS:** target 24×24 · contrast 4.5:1 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0204 — UI: `Composer` (coach wiring)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0154, TFV2-0200 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0154 + TFV2-0200.
- **WHY:** components.md §1 (`Composer`); coach.html `@component Composer`.
- **GOAL:** The coach composer sends a message, shows the hint, and disables offline.
- **SCOPE:** `apps/web/components/coach/Composer.tsx` · test: `apps/web/components/coach/Composer.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/Composer.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-composer` with textarea, attach, send. 3) Wire `onSend → coach.send`. 4) Playwright: type + send, empty disabled, offline hidden. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "Composer"` → send + offline at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** send an empty message, or allow send while offline.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-composer`, `__box`, textarea `dir="auto"` placeholder `EN: "Ask, plan, or think out loud" / HE: "לשאול, לתכנן, או לחשוב בקול"`, label `EN: "Message the coach" / HE: "הודעה למאמן"`, attach aria `EN: "Attach a page" / HE: "צירוף דף"`, send aria `EN: "Send" / HE: "שליחה"`, hint `EN: "The coach can be wrong. Every change waits for your yes." / HE: "המאמן יכול לטעות. כל שינוי מחכה לאישור שלך."`. Offline hides the form (`data-state-hide="offline"`). Empty textarea → send disabled.
- **TESTS:** Given text / When send / Then `coach.send` is called and the box clears. Given empty / Then send is disabled. Given offline / Then the form is hidden. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0205 — UI: `TypingIndicator`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0200 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0200.
- **WHY:** components.md §2.10 (`TypingIndicator` — text carries meaning, dots pulse only without reduced motion).
- **GOAL:** A status indicator shows a label with pulsing dots that stop under reduced motion.
- **SCOPE:** `apps/web/components/coach/TypingIndicator.tsx` · test: `apps/web/components/coach/TypingIndicator.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/TypingIndicator.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-typing[role=status]` with `__dots` and a label. 3) Respect `prefers-reduced-motion`. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "TypingIndicator"` → label + reduced-motion at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** animate under reduced motion, or use dots without a text label.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-typing[role=status]`, `__dots` (three spans, aria-hidden), label default `EN: "Opening your conversation" / HE: "פותח את השיחה שלך"` and streaming `EN: "Coach is writing" / HE: "המאמן כותב"`. Reduced motion → dots static.
- **TESTS:** Given the indicator / When rendered / Then role=status and the label show. Given reduced motion / Then no pulse animation. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · motion ≤ 250 ms (or none under reduced motion).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.
### TFV2-0206 — UI: `ReadAloudButton`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0201 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0201.
- **WHY:** components.md §2.10 (`ReadAloudButton` → `voice.speak`); coach.html `@component ReadAloudButton`.
- **GOAL:** A ghost toggle reads a message aloud and swaps volume/pause icon and label.
- **SCOPE:** `apps/web/components/coach/ReadAloudButton.tsx` · test: `apps/web/components/coach/ReadAloudButton.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ReadAloudButton.tsx` (new).
- **STEPS:** 1) Graphify code-map of the voice speak surface (chunk E owns voice; here the button calls the `voice.speak` stub). 2) Build `.tp-btn.tp-btn--ghost.tp-btn--sm.tp-readaloud[aria-pressed]` with `[data-label]`. 3) Toggle label/icon. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ReadAloudButton"` → toggle at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** ship a real voice call here (chunk E), or keep the label fixed on toggle.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** classes above; labels `EN: "Read aloud" / HE: "הקראה"` ↔ `EN: "Stop reading" / HE: "עצירת ההקראה"`; icon swaps `#i-volume` ↔ `#i-pause`. `aria-pressed` reflects state. Motion ≤ 250 ms.
- **TESTS:** Given a message / When the button is pressed / Then label/icon swap and `aria-pressed` flips; pressing again stops. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0207 — UI: `ChatHistoryList`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0163 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0163.
- **WHY:** components.md §2.10 (`ChatHistoryList`); coach-history.html `@component ChatHistoryList`.
- **GOAL:** A grouped list (Today / Last week / Earlier) renders conversation rows with title, time, and a 2-line clamped last line.
- **SCOPE:** `apps/web/components/coach/ChatHistoryList.tsx` · test: `apps/web/components/coach/ChatHistoryList.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ChatHistoryList.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-chat-list`/`.tp-chat-group`/`.tp-chat-row[aria-current]` with `__title`, `__time`, `__last`. 3) Group headers `g.today`/`g.week`/`g.earlier`. 4) Clamp last line to 2 lines, time in `.tp-num`. 5) Playwright. 6) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ChatHistoryList"` → rows + groups at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** render more than 2 lines of the last line, or invent group names.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** group headers `EN: "Today"/"Last week"/"Earlier" / HE: "היום"/"בשבוע שעבר"/"מוקדם יותר"`. Row: title `dir="auto"`, time `.tp-num.tp-mono`, last line clamped to 2 lines. Row opens the conversation. `aria-current` on the open one.
- **TESTS:** Given 3 groups / When rendered / Then each header shows and rows are newest-first within groups. Given a long last line / Then it clamps to 2 lines. Playwright at 390/1280, EN/HE.
- **NUMBERS:** last line 2 lines max → pass (product constant) · contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0208 — UI: `ChatSearch`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0164 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0164.
- **WHY:** components.md §2.10 (`ChatSearch`); coach-history.html `@component ChatSearch` + mode `Segmented`.
- **GOAL:** A search box + "By meaning / Exact words" toggle drives `coach.searchThreads` with a 250 ms debounce.
- **SCOPE:** `apps/web/components/coach/ChatSearch.tsx` · test: `apps/web/components/coach/ChatSearch.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ChatSearch.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-search` input + `.tp-segmented` meaning/words. 3) Debounce 250 ms, then `coach.searchThreads({ query, mode })`. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ChatSearch"` → debounce + mode at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** search on every keystroke without debounce, or drop the mode toggle.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** label `EN: "Search conversations" / HE: "חיפוש בשיחות"`, placeholder `EN: "Try “tired” or “lease”" / HE: "נסי ״עייפה״ או ״חוזה״"`, modes `EN: "By meaning"/"Exact words" / HE: "לפי משמעות"/"מילים מדויקות"`, mode group aria `EN: "Search by" / HE: "חיפוש לפי"`. Debounce 250 ms. `role="search"`.
- **TESTS:** Given typing / When 250 ms passes / Then one `searchThreads` call. Given mode switch to "Exact words" / Then `mode:"words"`. Playwright at 390/1280, EN/HE.
- **NUMBERS:** debounce 250 ms → pass (product constant) · contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (meaning mode) — UNKNOWN; answerer: Amit.

### TFV2-0209 — UI: `CrisisCard`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0230 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0230 (fixed-card content).
- **WHY:** components.md §2.10 (`CrisisCard` — fixed text written by people; coaching stops; no animation); PRD F-24.
- **GOAL:** A fixed crisis card renders real resources with `tel:` links; coaching pauses; no animation.
- **SCOPE:** `apps/web/components/coach/CrisisCard.tsx` · test: `apps/web/components/coach/CrisisCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/CrisisCard.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-crisis` with `__title`, `__body`, `__list`, `__item`, `__item-text`, `__name`, `__detail`, `__note`. 3) `tel:` links. 4) Playwright crisis view. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "CrisisCard"` → crisis view at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** write any card text from a model, or animate the card.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE (Israel, from coach-thread.html): `cr.title` `EN: "You don't have to carry this alone." / HE: "את לא צריכה לשאת את זה לבד."`; `cr.body` `EN: "What you're feeling matters. The people below are trained to help, any hour, and talking to them is free." / HE: "מה שאת מרגישה חשוב. האנשים כאן למטה הוכשרו לעזור, בכל שעה, והשיחה איתם בחינם."`; resources ERAN `1201`, SAHAR `sahar.org.il`, MDA `101` (each with `tel:` / link). Note `cr.note` `EN: "This card was written by people, not by the coach. The coach has paused. Resources shown for Israel; you can change the country in Settings." / HE: "את הכרטיס הזה כתבו אנשים, לא המאמן. המאמן עצר. המידע מוצג לישראל; אפשר לשנות מדינה בהגדרות."`. Coaching paused notice `EN: "Coaching is paused." / HE: "האימון מושהה."` + `EN: "Your list and pages still work. You can come back to the coach whenever you want." / HE: "הרשימה והדפים שלך ממשיכים לעבוד. אפשר לחזור למאמן מתי שתרצי."`. No animation; fixed focus on the card.
- **TESTS:** Given crisis view / When rendered / Then the fixed card, `tel:` links, and paused notice show; the composer hides. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · no animation.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** per-country resources (PRD F-24 "per-country data MVP") — UNKNOWN beyond Israel; answerer: Amit.

### TFV2-0210 — UI: `GroundingCard`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0167 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0167.
- **WHY:** components.md §2.10 (`GroundingCard` — steps every 4 s, each transition ≤ 240 ms; the word carries meaning); PRD F-25.
- **GOAL:** A grounding card shows a breathing line with words and one 10-second action; no model call.
- **SCOPE:** `apps/web/components/coach/GroundingCard.tsx` · test: `apps/web/components/coach/GroundingCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/GroundingCard.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-grounding` with `__title`, `__body`, `.tp-breath[data-phase]`, `__track`, `__line`, `__label`, `__action`, `[data-grounding-done]`. 3) Phase cycle in/out every 4 s, transition ≤ 240 ms; the word ("Breathe in"/"Hold"/"Breathe out") carries meaning. 4) Done button reveals the after-line. 5) Playwright. 6) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "GroundingCard"` → phases + done at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** call a model, or animate under reduced motion.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `gr.title` `EN: "Let's slow down for a moment." / HE: "בואי נאט רגע."`; `gr.body` `EN: "Nothing needs deciding right now. Your list will wait. Follow the line with your breath." / HE: "שום דבר לא צריך החלטה עכשיו. הרשימה תחכה. עקבי אחרי הקו עם הנשימה."`; phases `breath.in/out` `EN: "Breathe in"/"Breathe out" / HE: "שאיפה"/"נשיפה"` and hold `EN: "Hold" / HE: "החזקה"`; action lead `EN: "One thing," / HE: "דבר אחד,"`; `gr.done` `EN: "Done" / HE: "סיימתי"`; after `gr.after` `EN: "That counts. Stay here as long as you like, or carry on when you're ready." / HE: "זה נחשב. אפשר להישאר כאן כמה שתרצי, או להמשיך כשתהיי מוכנה."`. `aria-live` on the phase label; reduced motion → static line.
- **TESTS:** Given the card / When open / Then the word cycle runs every 4 s with each transition ≤ 240 ms. Given "Done" / Then the after-line reveals. Playwright at 390/1280, EN/HE.
- **NUMBERS:** phase 4 s, transition ≤ 240 ms → pass (product constants) · contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0211 — UI: `CoachDial` (component)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0166 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0166.
- **WHY:** components.md §2.8 Dial 0–10 + §2.10 (`CoachDial`); coach-thread.html dial sheet.
- **GOAL:** A 0–10 slider shows both the number and the word (quiet/steady/push) and debounces `setCoachDial` 400 ms.
- **SCOPE:** `apps/web/components/coach/CoachDial.tsx` · test: `apps/web/components/coach/CoachDial.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/CoachDial.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-dial` with `__head`, `__value`, `__num[data-dial-num]`, `__of`, `__word[data-dial-word]`, `__scale`, `input.tp-slider`. 3) Words: quiet 0–3, steady 4–7, push 8–10. 4) Debounce 400 ms → `coach.setDial`. 5) Playwright. 6) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "CoachDial"` → value + word at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** set the dial on every pixel without debounce, or show a number without the word.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `dial.label` `EN: "How much should the coach push?" / HE: "כמה המאמן ידחוף?"`; `dial.of` `EN: "of 10" / HE: "מתוך 10"`; words `EN: "Quiet"/"Steady"/"Push" / HE: "שקט"/"יציב"/"דוחף"`; help `EN: "Quiet: the coach waits for you to ask. Steady: gentle check-ins. Push: more nudges and firmer plans. You can change this any time." / HE: "שקט: המאמן מחכה שתשאלי. יציב: בדיקות עדינות. דוחף: יותר תזכורות ותוכניות נחרצות יותר. אפשר לשנות בכל רגע."`. Debounce 400 ms. `aria-valuetext` carries number + word.
- **TESTS:** Given value 4 / Then "4 of 10" and "Steady" show. Given value 9 / Then "Push". Given a change / Then one `setDial` after 400 ms. Playwright at 390/1280, EN/HE.
- **NUMBERS:** dial 0–10, debounce 400 ms → pass (product constants) · contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0212 — UI: `PanicButton` (component)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0167 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0167.
- **WHY:** components.md §2.10 (`PanicButton` — no model call); coach-thread.html `@component PanicButton`.
- **GOAL:** A panic button opens the GroundingCard at once with no model call, and exposes its `aria-controls`.
- **SCOPE:** `apps/web/components/coach/PanicButton.tsx` · test: `apps/web/components/coach/PanicButton.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/PanicButton.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-panic` with `data-action="panic"`, `aria-controls="grounding"`, `aria-expanded`. 3) On press call `coach.pressPanic` (no model) and open the GroundingCard. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "PanicButton"` → open at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** call a model, or open the card without setting `aria-expanded`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** label `EN: "I'm overwhelmed" / HE: "יותר מדי לי עכשיו"`. On press: `pressPanic` then show GroundingCard (`aria-controls`). No model call.
- **TESTS:** Given press / When the button is clicked / Then the grounding card opens, `aria-expanded` flips, and `pressPanic` ran. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · no model call.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0213 — UI: `ProposalCard` base + task variant
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0157 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0157.
- **WHY:** components.md §1/§2.10 (`ProposalCard`, `data-kind`); coach.html `@component ProposalCard`.
- **GOAL:** The shared proposal card shell (header, changes, Accept/Edit/Reject, note) with the task variant (kind label, title, minutes, before-time).
- **SCOPE:** `apps/web/components/coach/ProposalCard.tsx` · test: `apps/web/components/coach/ProposalCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ProposalCard.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-proposal` shell + task variant per markup. 3) Wire Accept/Edit/Reject → `coach.acceptProposal`/`editProposal`/`rejectProposal`; Undo toast on Accept. 4) Playwright accept/reject/edit/undo. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ProposalCard"` → task accept/edit/reject/undo at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** apply the change before Accept, or offer Undo after 5 minutes.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE (task): kind `EN: "Task" / HE: "משימה"`; head `EN: "1 change to Today" / HE: "שינוי אחד בהיום"`; target `EN: "Mon 12 Oct" / HE: "יום ב׳ 12.10"`; op `EN: "Add" / HE: "הוספה"`; detail `EN: "Task · 10 min · before 12:00" / HE: "משימה · 10 דק׳ · עד 12:00"`; buttons `EN: "Accept"/"Edit"/"Reject" / HE: "אישור"/"עריכה"/"דחייה"`; note `EN: "Done. “Call the bank” is on Today, before 12:00." / HE: "בוצע. ״להתקשר לבנק״ בהיום, עד 12:00."`. Accept applies the exact preview; Edit edits titles in place; Reject changes nothing; Undo 5 min.
- **TESTS:** Given a pending task proposal / When Accept / Then the change applies and Undo shows. Given Edit / Then the title becomes editable in place. Given Reject / Then nothing changes and the card says so. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms · Undo 5 min.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0214 — UI: `ProposalCard` template variant
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0158 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0158.
- **WHY:** components.md §2.10 (`ProposalCard` `data-kind="template"`); coach-thread.html turn 2.
- **GOAL:** The template variant shows name, adds, changes (`dl` of `.tp-what-row`) and the Accept/Edit/Reject actions.
- **SCOPE:** `apps/web/components/coach/ProposalCard.tsx` · test: `apps/web/components/coach/ProposalCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ProposalCard.tsx` (template variant).
- **STEPS:** 1) Graphify code-map. 2) Add the template variant markup (`data-kind="template"`, `__what` dl). 3) Wire Accept → `fillTemplate` apply. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ProposalCard"` → template variant at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** apply before Accept, or invent the "what it does" summary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: kind `EN: "Template" / HE: "תבנית"`; rows `EN: "Name"/"Adds"/"Changes" / HE: "שם"/"מוסיפה"/"משנה"`; example `EN: "Start Mondays from a gentler template" / HE: "להתחיל את ימי שני מתבנית רכה יותר"` with `name` "Gentle Monday"/"יום שני רך", `adds` "At most 3 tasks, a 10-minute walk, and one quiet hour"/"לכל היותר 3 משימות, הליכה של 10 דקות, ושעה שקטה אחת", `changes` "New Monday pages from 19 Oct…"/"דפי יום שני חדשים החל מ־19.10…". Accept applies the template; Undo 5 min.
- **TESTS:** Given a template proposal / When rendered / Then the three `what` rows show. Given Accept / Then it applies and Undo shows. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · Undo 5 min.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0215 — UI: `ProposalCard` module variant
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0159 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0159.
- **WHY:** components.md §2.10 (`ProposalCard` `data-kind="module"`); coach-thread.html turn 3.
- **GOAL:** The module variant shows name, adds, changes and the Approve/Discard-style Accept/Edit/Reject actions.
- **SCOPE:** `apps/web/components/coach/ProposalCard.tsx` · test: `apps/web/components/coach/ProposalCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ProposalCard.tsx` (module variant).
- **STEPS:** 1) Graphify code-map. 2) Add the module variant (`data-kind="module"`). 3) Wire Accept → `draftModule` approval. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ProposalCard"` → module variant at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** install a module before approval, or invent module behaviour.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: kind `EN: "Module" / HE: "מודול"`; example `EN: "Turn on a water tracker" / HE: "להפעיל מעקב מים"`, `name` "Water"/"מים", `adds` "A tracker on Today, goal 6 glasses"/"מעקב בהיום, יעד של 6 כוסות", `changes` "Nothing else. No reminders unless you ask."/"שום דבר אחר. בלי תזכורות אלא אם תבקשי.". Accept approves → live; Undo uninstalls within 5 min.
- **TESTS:** Given a module proposal / When rendered / Then the rows show. Given Accept / Then it goes live and Undo shows. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · Undo 5 min.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (module approval path) — UNKNOWN; answerer: Amit.

### TFV2-0216 — UI: `ProposalCard` job variant
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0161 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0161.
- **WHY:** components.md §2.10 (`ProposalCard` `data-kind="job"`); coach-thread.html turn 4.
- **GOAL:** The job variant shows name, when, does, stop-it rows and the Accept/Edit/Reject actions.
- **SCOPE:** `apps/web/components/coach/ProposalCard.tsx` · test: `apps/web/components/coach/ProposalCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ProposalCard.tsx` (job variant).
- **STEPS:** 1) Graphify code-map. 2) Add the job variant (`data-kind="job"`). 3) Wire Accept → `scheduleJob` approval. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ProposalCard"` → job variant at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** register the job before approval, or omit the stop-it row.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: kind `EN: "Scheduled job" / HE: "משימה מתוזמנת"`; rows `EN: "Name"/"When"/"Does"/"Stop it" / HE: "שם"/"מתי"/"מה עושה"/"להפסיק"`; example `EN: "Write my plan into Today" / HE: "לכתוב את התוכנית שלי בהיום"`, when `Mon–Fri 08:00` (LTR mono), does "Reads your tasks and calendar, then writes a short plan at the top of Today."/"קורא את המשימות ואת היומן שלך, ואז כותב תוכנית קצרה בראש דף היום.", stop "Switch it off in Modules, any time."/"לכבות במודולים, בכל רגע.". Accept registers; Undo removes within 5 min.
- **TESTS:** Given a job proposal / When rendered / Then the four rows show (When in LTR mono). Given Accept / Then it registers and Undo shows. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · Undo 5 min.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0217 — UI: `ProposalCard` decision variant
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0170 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0170.
- **WHY:** coachPrompt.ts (`CoachProposal` `kind:"decision"` — an order of steps); PRD F-22 (decision "what order should I do these in?").
- **GOAL:** The decision variant lists ordered steps (title, minutes, reason) and Accept saves them to Today's page.
- **SCOPE:** `apps/web/components/coach/ProposalCard.tsx` · test: `apps/web/components/coach/ProposalCard.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/coach/ProposalCard.tsx` (decision variant).
- **STEPS:** 1) Graphify code-map. 2) Add the decision variant (ordered list of steps). 3) Wire Accept → `acceptProposal` (saves steps to Today). 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ProposalCard"` → decision variant at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** save the order before Accept, or drop a step's reason.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** kind `EN: "Plan" / HE: "תוכנית"`; head e.g. `EN: "An order for this afternoon" / HE: "סדר לאחר הצהריים"`; steps are `1. <title> · N min · <reason?>`; buttons `EN: "Accept"/"Edit"/"Reject" / HE: "אישור"/"עריכה"/"דחייה"`. Accept appends the steps as task blocks to Today's page; Undo removes them within 5 min.
- **TESTS:** Given a decision with 3 steps / When rendered / Then 3 ordered steps with minutes show. Given Accept / Then the steps land on Today and Undo shows. Given Reject / Then nothing changes. Playwright at 390/1280, EN/HE.
- **NUMBERS:** steps 2..7 (COACH_LIMITS.minSteps/maxSteps) → pass (product constant) · contrast 4.5:1 · target 24×24.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0218 — UI: `MemoryItem`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0179 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0179.
- **WHY:** components.md §2.12 (`MemoryItem` — forget → `memory.forget` + Undo); memory.html `@component MemoryItem`.
- **GOAL:** A memory row shows fact, source, when, and a Forget button with Undo; guessed links add a "Guess" badge and confirm.
- **SCOPE:** `apps/web/components/memory/MemoryItem.tsx` · test: `apps/web/components/memory/MemoryItem.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/memory/MemoryItem.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-memory-list`/`.tp-memory-row` with `__fact`, `__source`, `__action`. 3) Forget (`.tp-btn--danger-ghost`) → `memory.forget` + Undo; guess rows add a caution `Badge` and "That's right" confirm → `lifeGraph.confirmGuess`. 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "MemoryItem"` → forget + confirm at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** hard-delete, or show "Guess" for a confirmed link.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** fact `dir="auto"`; source labels `EN: "You said it to the coach"/"From your page …"/"You said it in a voice call"/"Imported from ChatGPT"/"Imported from Claude" / HE: "אמרת את זה למאמן"/"מהדף שלך …"/"אמרת את זה בשיחה קולית"/"יובא מ־ChatGPT"/"יובא מ־Claude"`; Forget `EN: "Forget" / HE: "לשכוח"`; guess badge `EN: "Guess" / HE: "ניחוש"`; confirm `EN: "That's right" / HE: "נכון"` → badge `EN: "You confirmed this" / HE: "את אישרת את זה"`. Forget hides the row + Undo toast; focus moves to the next row.
- **TESTS:** Given a memory row / When Forget / Then it hides and Undo shows. Given a guess row / When confirm / Then the badge flips to confirmed. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · Undo 5 min.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 (forget semantics) — UNKNOWN; answerer: Amit.

### TFV2-0219 — UI: `ImportReview`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0192 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0192.
- **WHY:** components.md §2.12 (`ImportReview` — keep/edit/drop, nothing saved until Save); memory-import.html.
- **GOAL:** A review list gives each candidate item Keep/Edit/Drop (role=radio), with a running count and nothing saved until Save.
- **SCOPE:** `apps/web/components/memory/ImportReview.tsx` · test: `apps/web/components/memory/ImportReview.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/memory/ImportReview.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-import-list`/`.tp-import-row[data-choice]` with `__text`, `__bar`, `__note`, and a per-row `Segmented` keep/edit/drop. 3) Edit makes text contenteditable; Drop strikes through and says "Will be left out"; count updates. 4) Save → `memory.importCommit`. 5) Playwright. 6) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ImportReview"` → keep/edit/drop + save at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** save before Save, or let a dropped item be committed.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** choices `EN: "Keep"/"Edit"/"Drop" / HE: "לשמור"/"לערוך"/"לוותר"`; note `EN: "Will be saved" / HE: "יישמר"`, edit `EN: "Editing: type your change" / HE: "עריכה: הקלידי את השינוי"`, drop `EN: "Will be left out" / HE: "לא יישמר"`; save `EN: "Save N items" / HE: "לשמור N פריטים"`; duplicate note `EN: "Tempo already remembers something close to this. Keeping it won't make a second copy." / HE: "Tempo כבר זוכר משהו קרוב לזה. שמירה לא תיצור עותק שני."`. role=radio per choice.
- **TESTS:** Given 7 items / When Drop is chosen on one / Then it strikes through and count → 6. Given Edit / Then text is editable in place. Given Save / Then `importCommit` is called with only kept+edited items. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0220 — UI: `ExportArea`
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0182 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0182.
- **WHY:** components.md §2.12 (`ExportArea` → `memory.exportMarkdown`); memory.html.
- **GOAL:** An export card triggers the Markdown download and shows a status note; nothing is removed.
- **SCOPE:** `apps/web/components/memory/ExportArea.tsx` · test: `apps/web/components/memory/ExportArea.test.tsx` + Playwright.
- **MUTATES:** `apps/web/components/memory/ExportArea.tsx` (new).
- **STEPS:** 1) Graphify code-map. 2) Build `.tp-export` with `__text`, `__title`, `__note`, and a button. 3) Button → `memory.exportMarkdown` → download `memories.md`; note shows "Making your file…" then "Your file is ready…". 4) Playwright. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "ExportArea"` → download + note at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** remove any memory, or download before the file is ready.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `ex.title` `EN: "Export as Markdown" / HE: "ייצוא כ־Markdown"`; `ex.note` `EN: "One file with every memory and where it came from. Nothing is removed." / HE: "קובץ אחד עם כל זיכרון ומאיפה הוא הגיע. שום דבר לא נמחק."`; `ex.btn` `EN: "Export" / HE: "ייצוא"`; status `EN: "Making your file…"/"Your file is ready. It downloaded as memories.md." / HE: "מכין את הקובץ שלך…"/"הקובץ מוכן. הוא ירד בשם memories.md."`.
- **TESTS:** Given the card / When Export is pressed / Then the status note updates and `memories.md` downloads. Playwright at 390/1280, EN/HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0221 — Screen: coach panel (over Today)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0200, TFV2-0204, TFV2-0213 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0200 + TFV2-0204 + TFV2-0213.
- **WHY:** REWRITE-PLAN §5.1 ("Coach (panel over Today)" — `components/coach/CoachPanel` opened in `(tempo)/today`); coach.html.
- **GOAL:** The coach opens as a panel beside Today, with the accept/edit/reject/undo flow and the "moved to tomorrow" note working.
- **SCOPE:** `apps/web/app/(tempo)/today/page.tsx` · `apps/web/components/coach/CoachPanel.tsx` (wiring) · test: Playwright spec.
- **MUTATES:** `apps/web/app/(tempo)/today/page.tsx` (open the panel + wiring).
- **STEPS:** 1) Graphify code-map of Today's route. 2) Mount `CoachPanel` beside Today, docked at 1280+, sheet below. 3) Wire Accept → apply + Undo toast; Edit inline; Reject no-op. 4) Show the `moved.note` line on a move change. 5) Playwright click-through of every state at 390 and 1280, EN and HE. 6) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "coach-panel"` → every state asserted at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** edit `convex/`, or render JSON anywhere.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The Today page renders as coach.html: TaskBlock with 3 tasks, open count, and the panel. States: default, empty (opener `EN: "Hi Maya. I can see Today. Ask me to plan, shrink or sort anything. Nothing changes until you say yes." / HE: "היי מאיה. אני רואה את היום. אפשר לבקש ממני לתכנן, להקטין או לסדר כל דבר. שום דבר לא משתנה עד שתאשרי."`), loading (`EN: "Opening your conversation" / HE: "פותח את השיחה שלך"`), error (`EN: "Couldn't reach the coach." / HE: "לא הצלחנו להגיע למאמן."` + body), offline (`EN: "The coach is offline. Your list still works." / HE: "המאמן לא זמין כרגע. הרשימה שלך ממשיכה לעבוד."`). Accept shows toast `EN: "2 changes made to Today" / HE: "בוצעו 2 שינויים בהיום"` + Undo. Moved note `EN: "Moved to tomorrow: Draft 3 slides for Thursday." / HE: "עבר למחר: לנסח 3 שקפים ליום חמישי."`. No JSON visible.
- **TESTS:** Playwright: open panel, send, accept proposal → Undo toast; edit title; reject → unchanged; empty/loading/error/offline states. Each at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms · LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0222 — Screen: coach thread
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0165, TFV2-0213…0217, TFV2-0209, TFV2-0210 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0165 + the ProposalCard variants + CrisisCard + GroundingCard.
- **WHY:** REWRITE-PLAN §5.1 ("Coach thread" — `(tempo)/coach/[threadId]`); coach-thread.html.
- **GOAL:** The full conversation screen shows all proposal kinds, streaming, the dial sheet, panic/grounding, crisis view, and all states.
- **SCOPE:** `apps/web/app/(tempo)/coach/[threadId]/page.tsx` · `apps/web/components/coach/CoachThread.tsx` (or inline) · test: Playwright spec.
- **MUTATES:** `apps/web/app/(tempo)/coach/[threadId]/page.tsx` (new).
- **STEPS:** 1) Graphify code-map of coach-thread.html. 2) Build the thread with newest turn at bottom, composer under it, and the four proposal kinds + decision + streaming turn. 3) Dial sheet (CoachDial), PanicButton → GroundingCard, CrisisCard on `?view=crisis`. 4) Playwright every state at 390/1280, EN/HE. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "coach-thread"` → every state at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** edit `convex/`, show JSON, or auto-apply proposals.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Renders coach-thread.html faithfully: header (`EN: "A lighter Monday" / HE: "יום שני קליל יותר"`, `EN: "Started today at 08:58 · Reads Today and your pages. Asks before changing anything." / HE: "התחילה היום ב־08:58 · קורא את היום ואת הדפים שלך. שואל לפני כל שינוי."`); PanicButton; "Coach style" sheet; "Talk with voice" link. Proposals: task/template/module/job/decision (per TFV2-0213…0217). Streaming turn with `EN: "Coach is writing" / HE: "המאמן כותב"`. Crisis view hides the composer and shows CrisisCard + paused notice. States default/empty/loading/error/offline + crisis + undo.
- **TESTS:** Playwright clicks through: accept each proposal kind → Undo; open dial sheet and set value; press panic → grounding; `?view=crisis` → CrisisCard + paused; empty/loading/error/offline. Each at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms · LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** per-country crisis resources — UNKNOWN; answerer: Amit.

### TFV2-0223 — Screen: coach history
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0207, TFV2-0208 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0207 + TFV2-0208.
- **WHY:** REWRITE-PLAN §5.1 ("Coach history" — `(tempo)/history`); coach-history.html.
- **GOAL:** The history screen lists grouped conversations, searches by meaning/words, and handles empty/no-results/loading/error/offline.
- **SCOPE:** `apps/web/app/(tempo)/history/page.tsx` · `apps/web/components/coach/ChatHistoryList.tsx` (wiring) · test: Playwright spec.
- **MUTATES:** `apps/web/app/(tempo)/history/page.tsx` (new).
- **STEPS:** 1) Graphify code-map of coach-history.html. 2) Build the screen per markup. 3) Wire `listThreads`, `searchThreads`, `createThread`. 4) Playwright every state at 390/1280, EN/HE. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "coach-history"` → every state at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** edit `convex/`, or run vector search from the client.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `hist.title` `EN: "Chat history" / HE: "היסטוריית שיחות"`; `hist.sub` `EN: "Every conversation with your coach. Search by what it was about, or by the exact words." / HE: "כל השיחות שלך עם המאמן. אפשר לחפש לפי מה שדיברתן עליו, או לפי המילים המדויקות."`; `hist.new` `EN: "New conversation" / HE: "שיחה חדשה"`; no-results `EN: "Nothing matches that yet." / HE: "עוד אין התאמה."` + `EN: "Clear search" / HE: "ניקוי החיפוש"`; empty `EN: "No conversations yet." / HE: "עוד אין שיחות."` + `EN: "Talk to the coach" / HE: "לדבר עם המאמן"`; loading `EN: "Loading your conversations" / HE: "טוען את השיחות שלך"`; error `EN: "Couldn't load your conversations." / HE: "לא הצלחנו לטעון את השיחות."`; offline `EN: "You're offline. Your conversations are still here. Search uses exact words until you're back." / HE: "אין חיבור לרשת. השיחות שלך עדיין כאן. החיפוש עובד לפי מילים מדויקות עד שהחיבור יחזור."`. Count `EN: "conversations"/"conversation" / HE: "שיחות"/"שיחה"`.
- **TESTS:** Playwright: list groups render; type a query → results filter; switch mode; no-results → clear; empty state; loading; error; offline. Each at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.12 (meaning search) — UNKNOWN; answerer: Amit.

### TFV2-0224 — Screen: memory
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0218, TFV2-0220 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0218 + TFV2-0220.
- **WHY:** REWRITE-PLAN §5.1 ("Memory" — `(tempo)/settings/memory`); memory.html.
- **GOAL:** The memory screen lists/filters memories, shows life-graph guesses, exports, and forgets everything with a confirm sheet.
- **SCOPE:** `apps/web/app/(tempo)/settings/memory/page.tsx` · `apps/web/components/memory/MemoryItem.tsx` (wiring) · test: Playwright spec.
- **MUTATES:** `apps/web/app/(tempo)/settings/memory/page.tsx` (new).
- **STEPS:** 1) Graphify code-map of memory.html. 2) Build per markup. 3) Wire `memory.list`, `memory.forget`, `memory.forgetAll`, `memory.exportMarkdown`, `lifeGraph.confirmGuess`. 4) Playwright every state at 390/1280, EN/HE. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "memory-screen"` → every state at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** edit `convex/`, or forget without the confirm sheet.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `mm.title` `EN: "What Tempo remembers" / HE: "מה Tempo זוכר"`; `mm.sub` `EN: "Small things Tempo keeps so the coach doesn't make you repeat yourself. Forget anything, any time. Only you can see this." / HE: "דברים קטנים ש־Tempo שומר כדי שהמאמן לא יבקש ממך לחזור על עצמך. אפשר לשכוח כל דבר, בכל רגע. רק את רואה את זה."`; `mm.import` `EN: "Import from ChatGPT or Claude" / HE: "ייבוא מ־ChatGPT או מ־Claude"`; filter `EN: "All"/"From you"/"Imported" / HE: "הכול"/"ממך"/"מיובאים"`; `mem.title` `EN: "Things Tempo remembers" / HE: "דברים ש־Tempo זוכר"`; `g.title` `EN: "Links Tempo guessed" / HE: "קשרים ש־Tempo ניחש"`; export + `fa.label` `EN: "Forget everything" / HE: "לשכוח הכול"` with confirm sheet `fs.title` `EN: "Forget everything Tempo remembers?" / HE: "לשכוח את כל מה ש־Tempo זוכר?"` + `fs.confirm` `EN: "Forget everything" / HE: "לשכוח הכול"`; empty `EN: "Tempo doesn't remember anything yet." / HE: "Tempo עוד לא זוכר כלום."`; error `EN: "Couldn't load your memories." / HE: "לא הצלחנו לטעון את הזיכרונות."`; offline `EN: "You're offline. Changes save when you're back." / HE: "אין חיבור כרגע. השינויים יישמרו כשתחזרי."`.
- **TESTS:** Playwright: filter All/From you/Imported; forget one → Undo; confirm a guess; export; forget-all confirm sheet → empty + Undo; empty/loading/error/offline. Each at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms · LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.8 (forget semantics) — UNKNOWN; answerer: Amit.

### TFV2-0225 — Screen: memory import
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0219 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `web` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0219.
- **WHY:** REWRITE-PLAN §5.1 ("Memory import" — `(tempo)/settings/memory/import`); memory-import.html.
- **GOAL:** The import screen runs the paste/upload → review → save flow, with nothing saved until Save and a 5-minute Undo.
- **SCOPE:** `apps/web/app/(tempo)/settings/memory/import/page.tsx` · `apps/web/components/memory/ImportReview.tsx` (wiring) · test: Playwright spec.
- **MUTATES:** `apps/web/app/(tempo)/settings/memory/import/page.tsx` (new).
- **STEPS:** 1) Graphify code-map of memory-import.html. 2) Build the 3-step flow (paste/upload → review → saved). 3) Wire `importPreview`/`importCommit`/`undoImport`. 4) Playwright every state at 390/1280, EN/HE. 5) Run DONE.
- **DONE:** `CI=1 bunx playwright test -- --grep "memory-import"` → every state at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + screenshot.
- **DO NOT:** save before Save, or persist the raw text.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Copy EN/HE: `mi.title` `EN: "Bring your memory from ChatGPT or Claude" / HE: "להביא את הזיכרון שלך מ־ChatGPT או מ־Claude"`; `mi.sub` `EN: "So you don't have to explain yourself twice. You'll see every item first and choose what to keep. Nothing is saved until you press Save." / HE: "כדי שלא תצטרכי להסביר את עצמך פעמיים. תראי כל פריט קודם ותבחרי מה לשמור. שום דבר לא נשמר עד שתלחצי על שמירה."`; `s1.title` `EN: "Add the memory text" / HE: "להוסיף את טקסט הזיכרון"`; `s1.from` `EN: "Where is it from?" / HE: "מאיפה זה?"` (ChatGPT/Claude); `s1.paste`/`s1.upload` `EN: "Paste text"/"Upload a file" / HE: "הדבקת טקסט"/"העלאת קובץ"`; tip `EN: "Tip: ask ChatGPT or Claude \"List everything you remember about me\", then copy the whole answer." / HE: "טיפ: בקשי מ־ChatGPT או מ־Claude ״תכתוב את כל מה שאתה זוכר עליי״, ואז העתיקי את כל התשובה."`; `s1.find` `EN: "Find the items" / HE: "למצוא את הפריטים"`; `s2.title` `EN: "Choose what Tempo keeps" / HE: "לבחור מה Tempo ישמור"`; saved `EN: "memories saved." / HE: "זיכרונות נשמרו."`; empty `EN: "Tempo didn't find anything to remember in that text." / HE: "Tempo לא מצא בטקסט הזה משהו לזכור."`; error `EN: "Couldn't read that." / HE: "לא הצלחנו לקרוא את זה."`; offline `EN: "You're offline. Changes save when you're back." / HE: "אין חיבור כרגע. השינויים יישמרו כשתחזרי."`.
- **TESTS:** Playwright: empty paste → inline error; paste text → Find → review; keep/edit/drop → count; Save → saved panel + Undo toast; undo → back to review; empty/loading/error/offline. Each at 390 and 1280, EN and HE.
- **NUMBERS:** contrast 4.5:1 · target 24×24 · motion ≤ 250 ms · LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0226 — Coach prompt build + dial tone (verify + full test)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0166 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0166.
- **WHY:** PRD F-25 (dial changes tone); `convex/lib/coachPrompt.ts` (`systemPrompt(dial)`).
- **GOAL:** The system prompt carries the dial (0–10) and the never-shame / proposal-only rules, covered by a full unit test.
- **SCOPE:** `convex/lib/coachPrompt.ts` · test: `convex/lib/coachPrompt.test.ts`.
- **MUTATES:** `convex/lib/coachPrompt.ts` (verify existing).
- **STEPS:** 1) Graphify code-map (`systemPrompt(dial)` + `buildCoachMessages` exist — verify). 2) Confirm the dial is injected and tone rules are present. 3) Fill any missing unit-test coverage (dial range, page/memory/task block order, no-shame line). 4) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachPrompt"` → full coverage green.
- **EVIDENCE:** DONE output + the prompt lines.
- **DO NOT:** change the proposal JSON shape, or remove the never-shame rule.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `systemPrompt(dial)` includes "Current accountability dial: N / 10" and the never-shame line. `buildCoachMessages` emits role → today → page → memory → tasks → web → thread. Coverage: every `COACH_LIMITS` truncation, JSON parse, `withoutAcceptPromise`.
- **TESTS:** Given dial 0 and 10 / Then each injects its number and the tone line. Given a page + memory + tasks / Then blocks appear in the documented order. Given a reply promising a card with no proposal / Then `withoutAcceptPromise` strips it.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0227 — Coach load rules (verify + full test)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0170 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0170.
- **WHY:** PRD F-25 (graduated load 2→4, forgiveness contract); `convex/lib/coachLoad.ts`.
- **GOAL:** The pure load rules are fully unit-tested (accept/reject/raise/floor/10-second action).
- **SCOPE:** `convex/lib/coachLoad.ts` · test: `convex/lib/coachLoad.test.ts`.
- **MUTATES:** `convex/lib/coachLoad.ts` (verify existing).
- **STEPS:** 1) Graphify code-map (exists — verify). 2) Fill coverage for `afterAccept`, `afterReject`, `effectiveLoad`, `taskMinutes`, `checkRealism`, `pickTenSecondAction`. 3) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachLoad"` → full coverage green.
- **EVIDENCE:** DONE output + coverage report.
- **DO NOT:** change the constants, or lower a threshold.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `MIN_LOAD=2`, `MAX_LOAD=4`, `STREAK_FOR_RAISE=3`, `DEFAULT_TASK_MINUTES=25`, `PANIC_MS=30 min`. Tests cover every branch.
- **TESTS:** Given streak 3 / Then load rises ≤ 4 and streak resets. Given reject / Then load 2, streak 0. Given bad day / Then effective load 2. Given a task with no estimate / Then 25 min.
- **NUMBERS:** load 2..4 → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0228 — Coach proposal guard (verify + full test)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0157 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0157.
- **WHY:** `convex/lib/coachProposalGuard.ts` (a task already open on Today is never offered again); #1031.
- **GOAL:** The duplicate open-task guard is verified and fully tested (duplicate dropped + note appended).
- **SCOPE:** `convex/lib/coachProposalGuard.ts` · test: `convex/lib/coachProposalGuard.test.ts`.
- **MUTATES:** `convex/lib/coachProposalGuard.ts` (verify existing).
- **STEPS:** 1) Graphify code-map (exists — verify). 2) Fill coverage for `duplicateOfOpenTask`, `cardTitle`, and the `ALREADY_ON_TODAY_NOTE` EN/HE. 3) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coachProposalGuard"` → green.
- **EVIDENCE:** DONE output + coverage.
- **DO NOT:** change the note copy, or let a duplicate task card pass.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `duplicateOfOpenTask(proposal, openToday)` returns the matching open task title or null; `cardTitle` normalises title for comparison. Note EN/HE kept as-is.
- **TESTS:** Given a proposal for an already-open task / Then it is dropped and the note appended. Given a genuinely new task / Then the card stays.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0229 — Memory: salience/access bump on recall
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0177 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0177.
- **WHY:** `memories.accessCount`/`lastAccessed`/`salience` (access strengthens a memory).
- **GOAL:** A recalled memory has its `lastAccessed` and `accessCount` bumped and salience nudged up (capped 1.0).
- **SCOPE:** `convex/memory.ts` · test: `convex/memory.test.ts`.
- **MUTATES:** `convex/memory.ts` (add a touch step).
- **STEPS:** 1) Graphify code-map. 2) Add an internal `touchMemories(ids)` mutation that sets `lastAccessed = now`, `accessCount += 1`, and nudges `salience` up (capped 1.0). 3) Call it after recall returns. 4) Test bump/cap/owner. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memory"` → access-bump cases green.
- **EVIDENCE:** DONE output + the touch step.
- **DO NOT:** touch another user's rows, or exceed salience 1.0.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `touchMemories({ memoryIds })` → `{ touched }` (internal). Sets `lastAccessed`, increments `accessCount`, `salience = min(1.0, salience + 0.02)`.
- **TESTS:** Given a recall / Then the recalled rows get a bump. Given salience already 1.0 / Then unchanged. Given a foreign id / Then skipped.
- **NUMBERS:** salience cap 1.0, bump +0.02 → pass (product constants) | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0230 — Crisis fixed card + Hebrew crisis phrases (verify + test)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0154 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0154.
- **WHY:** PRD F-24 (fixed crisis card, never model-written); `convex/lib/crisisWords.ts`, `convex/crisis.ts`.
- **GOAL:** The fixed crisis word list and card are verified and the Hebrew crisis phrases are added, all model-free.
- **SCOPE:** `convex/lib/crisisWords.ts` · `convex/crisis.ts` · test: `convex/lib/crisisWords.test.ts`.
- **MUTATES:** `convex/lib/crisisWords.ts` (add Hebrew phrases), `convex/crisis.ts` (verify).
- **STEPS:** 1) Graphify code-map (exists — verify). 2) Add Hebrew crisis phrases (`להתאבד`, `רוצה למות`, `פגיעה עצמית`, `לפגוע בעצמי`, etc.) to a parallel list; `isCrisisText` matches either language. 3) Confirm `resourcesCard` is fixed content and no model is called. 4) Test EN + HE detection. 5) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="crisisWords"` → EN + HE cases green.
- **EVIDENCE:** DONE output + the phrase lists.
- **DO NOT:** write card text from a model, or remove an existing English phrase.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `isCrisisText(text)` normalises and substring-matches the EN `CRISIS_PHRASES` plus the new HE `CRISIS_PHRASES_HE`. The card stays fixed. Per-country resources: UNKNOWN (PRD F-24 "per-country data MVP").
- **TESTS:** Given "I want to die" / Then crisis true. Given "אני רוצה למות" / Then crisis true. Given a non-crisis message / Then false. Given crisis / Then `resourcesCard` returns the fixed text and no model call.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** per-country crisis resources — UNKNOWN; answerer: Amit.

### TFV2-0231 — Memory import source handling (verify + test)
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0192 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `memory` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0192.
- **WHY:** `convex/memory.ts` `importSourceOf`/`SOURCE_NAME` (import source labels); memory.html source marks.
- **GOAL:** Import-source metadata round-trips (store → read → label) and is fully tested.
- **SCOPE:** `convex/memory.ts` · `convex/lib/memoryImport.ts` · test: `convex/lib/memoryImport.test.ts`.
- **MUTATES:** `convex/memory.ts` (verify), `convex/lib/memoryImport.ts` (verify).
- **STEPS:** 1) Graphify code-map (exists — verify). 2) Fill coverage for `importSourceOf`, `SOURCE_NAME`, `exportLine` source marks, `parseMemoryExport` shapes. 3) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="memoryImport"` → source-handling cases green.
- **EVIDENCE:** DONE output + coverage.
- **DO NOT:** change the source labels, or mislabel an imported source.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `importSourceOf(metadata)` reads `metadata.source` ∈ `chatgpt|claude|grok|other`; `SOURCE_NAME` maps to `ChatGPT|Claude|Grok`; `exportLine` appends `(imported from X)` or `(imported)`.
- **TESTS:** Given `metadata:{ source:"chatgpt" }` / Then `importSourceOf` → `chatgpt` and export appends `(imported from ChatGPT)`. Given `other` / Then `(imported)`. Given no source / Then no mark.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0232 — Chunk 3 integration E2E: coach tool → accept → memory recall
- **Stage:** C · **Pass:** 1 · **Depends:** TFV2-0157, TFV2-0177, TFV2-0222, TFV2-0224 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane `coach` per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0157 + TFV2-0177 + TFV2-0222 + TFV2-0224.
- **WHY:** PRD §3.1 exit checks (coach acts on Today; memory recall feeds the coach); b03-style contract test.
- **GOAL:** One contract test proves: coach proposes a task → Accept → task on Today → memory recalls it → coach context sees it, end to end.
- **SCOPE:** `convex/coach_memory_smoke.test.ts` (new) · test only.
- **MUTATES:** `convex/coach_memory_smoke.test.ts` (new test).
- **STEPS:** 1) Graphify code-map. 2) Write a `convex-test` scenario (mock model seam) that: sends a message → gets a task proposal → accepts → asserts the task exists → recalls a related memory → asserts the coach context includes it. 3) Run DONE.
- **DONE:** `bun run test -- --test-name-pattern="coach_memory_smoke"` → the full round trip passes.
- **EVIDENCE:** DONE output + the scenario.
- **DO NOT:** call a real provider, or assert UI outside Playwright (covered by TFV2-0222/0224).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Uses the mock model seam; asserts: (1) user message stored; (2) a `task` proposal returned; (3) Accept creates the task; (4) `recall` finds a memory; (5) `context`/coach messages include it. No network, no key.
- **TESTS:** Given the scenario / When each step runs in order / Then all five assertions hold.
- **NUMBERS:** none → n/a | UNKNOWN none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** §4.3 (mock mirrors which real model) — UNKNOWN; answerer: Amit.
