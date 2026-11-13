# Chunk 1 — MVP core (chat-first) · Stage A · tickets TFV2-0001 … TFV2-0064

Draft for `docs/backlog/REWRITE-PLAN-v2.md` §6, chunk 1. Written by drafting sub-agent `draft-chunk-1-mvp-core` on branch `docs/source-2026-11-01`. Authority: `TICKET-STANDARD.md` (v2), `_drafts/TEMPLATE.md`, `REWRITE-PLAN-v2.md` §4/§5/§6/§7, `docs/design/v3/` (DESIGN.md, components.md, tokens.css, screens/web/*), `docs/PRD.md` (F-01..F-03, F-20..F-24), `docs/TRD.md`.

Code status is verified against the checkout at `integration` (GitHub is the truth). A unit marked EXISTS gets a verify-and-add-test ticket (never a rebuild); MISSING/PARTIAL gets a build ticket. Units touching a `REWRITE-PLAN-v2.md` §4 open conflict mark that value `UNKNOWN` and name "Amit".

Tickets are written in dependency order. `Depends` names only earlier tickets in this chunk.

---

### TFV2-0001 — Bounded query helper `convex/lib/bounded.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** #1348
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-130 (per-user isolation); REWRITE-PLAN-v2 §6 chunk 1 "bounded queries + resource quotas"; #1348 (TM-0032 — Bounded query helper).
- **GOAL:** A reusable query-wrapper that reads every list the way a coach tool would — with a hard row and byte budget and an explicit `truncated` flag, so no query can ever run unbounded.
- **SCOPE:** `convex/lib/bounded.ts` (+ `convex/lib/bounded.test.ts`).
- **MUTATES:** none (adds a pure helper module; no table, route or env).
- **STEPS:** 1) Graphify code-map check of `convex/lib/` (the unit is MISSING today — confirmed no `bounded*` file); 2) write `convex/lib/bounded.ts` exporting `boundedQuery<T>(rows: readonly T[], opts: { maxRows: number; maxBytes: number }): { rows: T[]; truncated: boolean }`; 3) count rows first, then bytes by `JSON.stringify` length, stopping at the first budget exceeded and setting `truncated: true`; 4) handle `maxRows=0` (empty, not truncated) and `maxBytes=0` (empty, truncated if rows present); 5) add the unit test file.
- **DONE:** `bun test convex/lib/bounded.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count) into the PR.
- **DO NOT:** do not change any existing query's call site; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, any `.env` or workflow.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Pure function, no Convex context. `maxRows` and `maxBytes` are positive integers; a non-finite or negative option throws a `ConvexError`. Return type is always `{ rows, truncated }`; `truncated` is `true` only when at least one row was dropped for budget. Budget check order: row count first, then cumulative byte size. Rows are kept in input order (no sort). Error messages (surfaced by callers, EN/HE): `EN: "Showing the first {n} results." / HE: "מוצגות התוצאות הראשונות: {n}."`. There is no other user-facing copy in this module.
- **TESTS:**
  - Given `rows=[]`, `maxRows=10`, `maxBytes=1_000_000` / When `boundedQuery` runs / Then returns `{rows:[], truncated:false}`.
  - Given 10 rows of 100 bytes and `maxRows=5` / Then `rows.length===5` and `truncated===true`.
  - Given rows whose cumulative bytes exceed `maxBytes` at row 3 / Then exactly 2 rows return and `truncated===true`.
  - Given `maxRows=0` with non-empty rows / Then `rows.length===0` and `truncated===true`.
  - Given `maxRows=0` with empty rows / Then `truncated===false`.
  - Given a negative `maxBytes` / Then a `ConvexError` is thrown.
  - Given 5 rows all under budget / Then `rows.length===5` and `truncated===false`.
- **NUMBERS:** `maxRows` and `maxBytes` are caller-set (UNKNOWN defaults until a caller fixes them — Amit). No industry number applies; correctness is byte-count exactness (deterministic, no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** default budgets for the coach-tool calls (UNKNOWN — Amit).

### TFV2-0002 — Mock language model `convex/lib/mockModel.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** #1349
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §7 (runtime models); REWRITE-PLAN-v2 §6 chunk 1 "mock model"; #1349 (TM-0050 — Mock language model).
- **GOAL:** A deterministic in-process stand-in for the runtime model that returns scripted replies and lets coach/chat tests assert exact behaviour without network, keys or spend.
- **SCOPE:** `convex/lib/mockModel.ts` (+ `convex/lib/mockModel.test.ts`).
- **MUTATES:** none (pure module; no table, route or env).
- **STEPS:** 1) Graphify code-map check of `convex/lib/` (unit MISSING — confirmed no `mockModel*` file); 2) write `mockModel.ts` exporting `mockModel({ queue }: { queue: readonly string[] }): (input: { messages: readonly { role: "system"|"user"|"assistant"; content: string }[] }) => Promise<{ text: string }>`; 3) replies consume `queue` in order; on empty queue return a fixed final reply `"Done."`; 4) record every received `messages` array on the returned callable (expose a `.calls` property) so tests assert the prompt; 5) no network, no `process.env`, no key reads; 6) add the unit test file.
- **DONE:** `bun test convex/lib/mockModel.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not call any real model, `fetch`, or `ai_router`; do not read or log secrets; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The returned callable is the only API; it is async and always resolves (never rejects). `messages` is validated to be an array of objects with `role` in the allowed set and `content: string`; an invalid `messages` argument throws a `ConvexError` with `EN: "Bad messages for the mock model." / HE: "הודעות לא תקינות למודל המדומה."`. Reply shape mirrors `ai_router.AiResult` minimal (`{ text }`) so callers can substitute it without changes.
- **TESTS:**
  - Given `queue=["First","Second"]` / When called twice / Then replies are `"First"` then `"Second"`.
  - Given empty `queue` / When called / Then returns `"Done."` and records the call.
  - Given a call / Then `.calls[0]` equals the exact `messages` array passed (deep equal).
  - Given `messages` missing `content` / Then a `ConvexError` is thrown.
  - Given 3 queued replies and 4 calls / Then the 4th returns `"Done."`.
- **NUMBERS:** reply determinism is exact (no range); no latency or score target applies (UNKNOWN — none needed; Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0003 — Anti-shaming copy check `convex/lib/shameWords.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** #1350
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §13 copy rules (never "failed", "overdue", "streak lost", "must"); REWRITE-PLAN-v2 §6 chunk 1 "anti-shaming"; #1350 (TM-0049 — Anti-shaming copy check).
- **GOAL:** A word/pattern list plus a pure checker that flags shaming language in any coach or app copy before it reaches the user, so generated text can be rejected or rewritten.
- **SCOPE:** `convex/lib/shameWords.ts` (+ `convex/lib/shameWords.test.ts`).
- **MUTATES:** none (pure module; no table, route or env).
- **STEPS:** 1) Graphify code-map check of `convex/lib/` (unit MISSING today — `crisisWords.ts` exists but `shameWords.ts` does not); 2) write `shameWords.ts` exporting `SHAME_PATTERNS: readonly RegExp[]` (source strings only, no secrets) and `containsShame(text: string): { found: boolean; matches: string[] }`; 3) cover EN and HE shaming terms (e.g. EN "failed", "overdue", "lazy", "must", "should have", "streak lost", "you never"; HE "נכשל", "איחרת", "עצלן", "חייב", "היית צריך"); 4) match whole words case-insensitively (EN) and plain substrings (HE, no case); 5) return the list of matched raw terms, not the text; 6) add the unit test file.
- **DONE:** `bun test convex/lib/shameWords.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not invent or hard-code user data; do not read/write any table; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows; do not log secrets.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `SHAME_PATTERNS` is a frozen array of compiled RegExps (source strings kept readable for review). `containsShame` accepts a string, never mutates it, and returns `{found, matches}` where `matches` is the array of matched source terms (deduplicated). Matching is conservative (no shaming word may slip through): the checker is allowed to over-flag borderline terms for a human/reviewer pass, but never to under-flag the canonical list.
- **TESTS:**
  - Given `"You failed to finish it."` / Then `found===true` and `matches` contains `"failed"`.
  - Given `"The task is overdue by a day."` / Then `found===true` and `matches` contains `"overdue"`.
  - Given `"איחרת עם המשימה."` / Then `found===true` and `matches` contains `"איחרת"`.
  - Given `"Write the plan for Monday."` / Then `found===false`.
  - Given `"Must do the dishes"` / Then `found===true` (matches `"must"`).
  - Given a word containing a term as a substring of a benign word (e.g. "mustard") / Then `found===false` for `"must"` (whole-word boundary).
  - Given `matches` dedupe / When the same term appears twice / Then it appears once in `matches`.
- **NUMBERS:** recall on the canonical shame list = 100% (must never under-flag); precision may be lower (over-flagging allowed). Source: product copy rule (PRD §13), no external standard — UNKNOWN numeric precision target (Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0004 — Entitlements `convex/lib/entitlements.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** #1340
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.11 F-110 (tiers), F-01a (every approved user gets the premium tier); REWRITE-PLAN-v2 §6 chunk 1 "entitlements"; #1340 (TEMPO-BL-0001 — Entitlements table).
- **GOAL:** The entitlement decision (tier, user type, beta access, subscription grant) is one reviewed module whose tests prove every approved sign-up lands on the granted tier.
- **SCOPE:** `convex/lib/entitlements.ts` (+ `convex/lib/entitlements.test.ts`).
- **MUTATES:** none (reads `users` fields; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check of `convex/lib/entitlements.ts` (EXISTS: `EntitlementTier`, `GRANTED_ENTITLEMENT_TIER`, `newUserFields`, `buildReturningUserPatch`, `shouldGrantSubscription`, and a test file exist); 2) verify each exported symbol against `convex/schema.ts` `users` fields (`entitlementTier`, `userType`, `betaAccess`); 3) confirm `GRANTED_ENTITLEMENT_TIER === "max"` and `GRANTED_USER_TYPE === "paid"` (premium-for-all, PRD F-01a); 4) read the existing test file and add any missing error/boundary cases listed below; 5) do not rename or re-sign exported symbols (other modules import them).
- **DONE:** `bun test convex/lib/entitlements.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change `GRANTED_*` values (they encode the premium-for-all ruling); do not edit `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows; do not call RevenueCat or Polar (that is chunk D).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Decision functions are pure of the Convex DB (they take snapshots in, return patches/booleans out). `newUserFields` returns the initial user fields for a newly approved account; `buildReturningUserPatch` returns a minimal patch for an existing row (never overrides an existing paid tier downward); `shouldGrantSubscription` returns `true` for a fresh approved sign-in and `false` when a current grant is still valid. Any tier value is one of `EntitlementTier` (from `Doc<"users">["entitlementTier"]`); unknown tier strings are rejected. User-facing copy when a tier is missing: `EN: "Your plan isn't set up yet." / HE: "התוכנית שלך עדיין לא מוגדרת."`.
- **TESTS:**
  - Given a fresh approved sign-in / When `newUserFields` runs / Then `entitlementTier==="max"`, `userType==="paid"`, `betaAccess==="tester"`.
  - Given an existing paid `max` user / When `buildReturningUserPatch` runs / Then the patch does not lower the tier.
  - Given an existing grant still valid / When `shouldGrantSubscription` runs / Then `false`.
  - Given an unknown tier string / Then the input is rejected (throw or `false`, matching current behaviour — assert the actual, documented behaviour).
  - Given a revoked/absent user snapshot / Then `shouldGrantSubscription` returns the expected (assert current behaviour and add a test if untested).
- **NUMBERS:** no industry number; correctness is the premium-for-all invariant (PRD F-01a). Pass range: invariant holds on 100% of test cases (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0005 — Lighthouse budget in CI
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** #1342
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.8 F-80 (polished look); TICKET-STANDARD.md NUMBERS (Core Web Vitals); REWRITE-PLAN-v2 §6 chunk 1 "smoke + a11y + perf budget"; #1342 (TEMPO-BL-0004 — Lighthouse budget in CI).
- **GOAL:** CI runs a Lighthouse check against the preview build and fails the loop when performance, accessibility, best-practices or SEO fall under a fixed budget.
- **SCOPE:** `.github/workflows/ci.yml` (+ `scripts/lighthouse-budget.mjs`, new).
- **MUTATES:** CI workflow (config). This is the chunk's single config ticket (allowed by the config-guard gate).
- **STEPS:** 1) Graphify code-map check of `.github/workflows/` (no Lighthouse job exists today — confirmed no `lighthouse` reference in any workflow); 2) add `scripts/lighthouse-budget.mjs` that runs `lighthouse-ci` (or the `lighthouse` package) against the local preview server, collects `performance`, `accessibility`, `best-practices`, `seo`, `largest-contentful-paint`, `cumulative-layout-shift`, `total-blocking-time`; 3) add one CI step that starts the dev server and runs the script, failing on any metric below budget; 4) keep the check non-blocking only for the font/network `UNKNOWN` case documented in AGENTS.md (report `UNKNOWN: lighthouse (Google Fonts blocked)`, do not hard-fail); 5) never weaken a threshold to pass.
- **DONE:** `bun scripts/lighthouse-budget.mjs` → prints each metric with pass/fail and exits 0 only when all are in budget.
- **EVIDENCE:** paste the CI step log line showing all four scores and the exit code.
- **DO NOT:** do not touch secrets or any other workflow; do not lower a threshold, skip a category, or gate the check behind an env flag to make it pass; do not edit `convex/schema.ts`, `convex/auth*` or any `.env`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Budgets (all fail-fast, no ranges that hide regressions): performance ≥ 90, accessibility ≥ 90, best-practices ≥ 90, SEO ≥ 90, LCP ≤ 2500 ms, CLS ≤ 0.1, TBT ≤ 200 ms. The script prints one line per metric with `PASS`/`FAIL` and the measured value; on `FAIL` it exits 1. On a network-blocked font fetch it prints `UNKNOWN: lighthouse (<reason>)` and exits 0 (per AGENTS.md sandbox rule), never a silent pass.
- **TESTS:** (config ticket — the check is the test) Given a preview server up / When the script runs / Then it prints all seven metrics; Given a metric below budget / Then exit code is 1; Given fonts blocked / Then it prints `UNKNOWN: lighthouse (Google Fonts blocked)` and exits 0.
- **NUMBERS:** performance ≥ 90, accessibility ≥ 90, best-practices ≥ 90, SEO ≥ 90 (https://developer.chrome.com/docs/lighthouse/overview); LCP ≤ 2.5 s, CLS ≤ 0.1 (https://web.dev/articles/vitals); TBT ≤ 200 ms (https://web.dev/articles/lighthouse-total-blocking-time).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether Lighthouse runs per-PR or once per loop (UNKNOWN — Amit; the plan says the preview builds from the loop PR).

### TFV2-0006 — Block codec + Zod schemas `packages/utils/src/blocks.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.1 F-02/F-03 (markdown + JSON blocks, JSON never shown); REWRITE-PLAN-v2 §6 chunk 1 "block codec + Zod schemas + derived indexes"; REWRITE-PLAN-v2 §4 conflict 7 (block model).
- **GOAL:** The single block codec — Zod schemas, `parseTempoBlocks` and `serializeTempoBlocks` — is verified against its limits and every error/broken-block case is tested.
- **SCOPE:** `packages/utils/src/blocks.ts` (+ `packages/utils/src/blocks.test.ts`).
- **MUTATES:** none (shared pure module; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check of `packages/utils/src/blocks.ts` (EXISTS: `BLOCK_CODEC_LIMITS`, `pageMetaDataSchema`, `taskDataSchema`, `templateDataSchema`, `tempoBlockSchema`, `parseTempoBlocks`, `serializeTempoBlocks`, and `blocks.test.ts`); 2) verify `BLOCK_CODEC_LIMITS` against `convex/schema.ts` `noteBlocks` union (page-meta/task/template/broken, `v:1`); 3) confirm the block model: `notes.body` is the page-content authority and `noteBlocks` is a disposable derived index (mark the authority claim OPEN per §4 conflict 7); 4) read the existing test file and add the missing broken-block/limit cases below; 5) do not rename exported symbols or change limit values (other modules depend on them).
- **DONE:** `bun test packages/utils/src/blocks.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change `BLOCK_CODEC_LIMITS` values or relax a Zod schema; do not surface JSON to the UI; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `parseTempoBlocks(body)` returns `BlockSegment[]` where each segment is `markdown`, `valid` (a parsed Tempo block) or `broken` (an `errorCode` + the offending source span). `serializeTempoBlocks(segments)` is the byte-exact inverse for valid segments. A block over `maxBodyChars`, `maxBlockChars`, `maxBlocks`, `maxJsonDepth`, `maxShortStringChars`, `maxTextChars` or `maxArrayItems` produces a `broken` segment with the matching `errorCode`, never a throw and never silent data loss. Broken-block `errorCode` values match the `noteBlocks` `broken` union in `convex/schema.ts` (`body_too_large`, `too_many_blocks`, `block_too_large`, …). No JSON is ever emitted to the UI.
- **TESTS:**
  - Given a body with one valid task block / When `parseTempoBlocks` runs / Then exactly one `valid` segment with `type==="task"`.
  - Given `serializeTempoBlocks(parseTempoBlocks(body))` / Then output equals input (round-trip) for valid bodies.
  - Given a block over `maxBlockChars` / Then a `broken` segment with `errorCode==="block_too_large"`.
  - Given a body over `maxBodyChars` / Then a `broken` segment with `errorCode==="body_too_large"`.
  - Given more than `maxBlocks` blocks / Then a `broken` segment with `errorCode==="too_many_blocks"`.
  - Given malformed JSON inside a block fence / Then a `broken` segment (never a throw).
  - Given a `page-meta` block with a bad `date` / Then Zod rejects (broken), asserting `isoDate` refinement.
  - Given plain markdown with no block fences / Then all segments are `markdown`.
- **NUMBERS:** limits are `BLOCK_CODEC_LIMITS` (repo code truth): `maxBodyChars 1_048_576`, `maxBlockChars 65_536`, `maxBlocks 256`, `maxJsonDepth 16`, `maxShortStringChars 200`, `maxTextChars 500`, `maxArrayItems 100`. Round-trip fidelity = byte-exact for valid segments (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority — `notes.body` as the single page-content authority with typed tables migrating into blocks and retiring (REWRITE-PLAN-v2 §4 conflict 7; UNKNOWN — Amit). The 12 Oct contracts are the newest and lean toward `notes.body`.

### TFV2-0007 — `notes.save` / `notes.patchBlock` (notes.body authority)
- **Stage:** A · **Pass:** 1 · **Depends:** 0006 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0006.
- **WHY:** PRD §4.1 F-02/F-03 (every page one markdown document; blocks drawn as elements); REWRITE-PLAN-v2 §6 chunk 1 "notes/pages port (notes.body authority, save/patchBlock)"; REWRITE-PLAN-v2 §4 conflict 7.
- **GOAL:** `convex/notes.ts` gains a block-aware `save` (whole-body, revision-advancing) and `patchBlock` (one block by id), both writing `notes.body`, advancing `revision`, and leaving an operation receipt for Undo.
- **SCOPE:** `convex/notes.ts` (+ `convex/notes.test.ts`).
- **MUTATES:** `notes` table writes (body, revision, updatedAt); adds mutations `save`, `patchBlock`.
- **STEPS:** 1) Graphify code-map check of `convex/notes.ts` (EXISTS `get`, `getSafe`, `create`, `update`, `remove`, `restore`, `togglePin`, `backlinks`; `save`/`patchBlock` are MISSING); 2) add `save({ id, body, expectedRevision? })` that validates `body` via `parseTempoBlocks`, rejects over-budget bodies, writes `body`, advances `revision` by exactly one, sets `updatedAt`, and writes the operation receipt through `convex/lib/pageLedger.ts`; 3) add `patchBlock({ id, blockId, patch })` that reads `notes.body`, re-serializes only the addressed block (byte-exact elsewhere), and routes through the same save path; 4) keep `update` working for legacy callers or mark it internal; 5) every body-changing write is owner-scoped (`userId` must equal the caller); 6) add the unit test file covering every error case below.
- **DONE:** `bun test convex/notes.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not write `noteBlocks` directly here (that is TFV2-0008); do not bypass `parseTempoBlocks`; do not change `notes.body` schema; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows; do not surface JSON.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Mutations run in `convex/notes.ts` under the user's own `userId` (auth via `lib/requireUser.ts`). `save` args: `{ id: Id<"notes">, body: string, expectedRevision?: number }`; returns `{ ok: true, revision: number }`. `patchBlock` args: `{ id, blockId, patch: TempoBlock }`; returns `{ ok: true, revision: number }`. On `expectedRevision` mismatch return a `ConvexError` with code `REVISION_CONFLICT`. Over-budget body returns code `BODY_TOO_LARGE`. A missing page or non-owner returns code `NOT_FOUND`. Error copy (EN/HE): `EN: "Someone else changed this page. Reload and try again." / HE: "מישהו אחר שינה את הדף. טענו מחדש ונסו שוב."` (conflict); `EN: "This page is too large to save." / HE: "הדף הזה גדול מדי לשמירה."` (too large).
- **TESTS:**
  - Given an owner calls `save` with a valid body / Then `body` updates, `revision` advances by 1, `updatedAt` increases, a page operation receipt exists.
  - Given `expectedRevision` stale / Then `REVISION_CONFLICT` and `body` unchanged.
  - Given a body over `BLOCK_CODEC_LIMITS.maxBodyChars` / Then `BODY_TOO_LARGE` and no write.
  - Given a non-owner calls `save` / Then `NOT_FOUND` (or auth reject) and no write.
  - Given `patchBlock` on an existing `blockId` / Then only that block's source changes; other segments byte-identical.
  - Given `patchBlock` on a missing `blockId` / Then `NOT_FOUND` and no write.
  - Given two sequential `save` calls / Then `revision` is 1 then 2.
- **NUMBERS:** `notes.body` budget = `BLOCK_CODEC_LIMITS.maxBodyChars` = 1,048,576 chars (repo code). Save round-trip of untouched blocks = byte-exact (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority (same as TFV2-0006; UNKNOWN — Amit). `expectedRevision` opt-in vs mandatory (UNKNOWN — Amit).

### TFV2-0008 — `noteBlocks` derived index
- **Stage:** A · **Pass:** 1 · **Depends:** 0007 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0007.
- **WHY:** PRD §4.1 F-02 (blocks drawn as their own elements); REWRITE-PLAN-v2 §6 chunk 1 "derived indexes".
- **GOAL:** Every write through `notes.save`/`patchBlock` keeps the disposable `noteBlocks` derived index in sync with `notes.body`, so block reads never re-parse the whole body.
- **SCOPE:** `convex/notes.ts` (+ `convex/notes.test.ts`).
- **MUTATES:** `noteBlocks` table writes (derived index rows for page-meta/task/template/broken blocks).
- **STEPS:** 1) Graphify code-map check of `convex/schema.ts` `noteBlocks` (EXISTS: union of page-meta/task/template/broken, `v:1`, positional `position`); 2) in the TFV2-0007 save path, after writing `notes.body`, delete-and-reinsert the page's `noteBlocks` rows derived from `parseTempoBlocks(body)` in the same transaction; 3) keep `position` in block order and `blockId` stable; 4) mark `deletedAt` on removed blocks (soft) or hard-delete — assert the existing convention and follow it; 5) add tests proving index/body consistency.
- **DONE:** `bun test convex/notes.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change the `noteBlocks` schema shape; do not write `noteBlocks` from any other module; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The derived index is disposable (rebuildable from `notes.body` at any time). For each valid block, one `noteBlocks` row is written with `userId`, `noteId`, `type`, `blockId`, `v:1`, `data`, `position`, `createdAt`, `updatedAt`. Broken blocks write a `broken` row with `errorCode`. A save that changes no blocks writes no rows. Consistency invariant: `parseTempoBlocks(body)` block list and `noteBlocks` rows for that page are equal in count, type and `blockId`.
- **TESTS:**
  - Given a save with 3 task blocks + 1 page-meta block / Then 4 `noteBlocks` rows exist in block order.
  - Given a save that removes a block / Then the removed block's row is gone and remaining `position` values are contiguous.
  - Given a broken block / Then one `broken` row with the right `errorCode`.
  - Given a save with zero blocks / Then zero rows.
  - Given index rebuild from the same body / Then the rows are identical (idempotent).
- **NUMBERS:** row count bound = `BLOCK_CODEC_LIMITS.maxBlocks` = 256 per page (repo code). Index/body consistency = exact on every save (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority (same as TFV2-0006; UNKNOWN — Amit).

### TFV2-0009 — `noteLinks` / backlinks derived index
- **Stage:** A · **Pass:** 1 · **Depends:** 0007 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0007.
- **WHY:** PRD §4.1 (pages), §4.5 F-54 (user-written `[[links]]`); DESIGN.md §9 (Wikilink → "Linked here"); REWRITE-PLAN-v2 §6 chunk 1 "noteLinks/backlinks derived index".
- **GOAL:** `[[page]]` links inside `notes.body` are indexed on every save so the editor's "Linked here" list and any backlink query return correct, current links without re-scanning pages.
- **SCOPE:** `convex/notes_links.ts` (+ `convex/notes_links.test.ts`).
- **MUTATES:** link-derived index writes (rows keyed by target page id); adds nothing to the `notes` schema itself.
- **STEPS:** 1) Graphify code-map check of `convex/notes_links.ts` and `convex/notes.ts` `backlinks` query (EXISTS; `notes.ts` `backlinks` is the reader); 2) confirm `notes.save`/`patchBlock` (TFV2-0007) invokes the link-index writer; if not wired, wire it in `notes_links.ts`; 3) index each `[[target]]` occurrence with source page, target page and a snippet; 4) de-duplicate and remove stale links on save; 5) add the unit test file for every error case below.
- **DONE:** `bun test convex/notes_links.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change the `notes` or `noteBlocks` schema; do not write links from the UI directly; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** A `[[target]]` match uses the same wikilink tokenizer as `packages/utils/src/wiki-links.ts` (EXISTS) so the editor and the index agree. Each indexed link records `sourceId`, `targetId`, a short context snippet and `updatedAt`. The `backlinks({ pageId })` query returns links whose target is `pageId`, ordered newest first, with the source title and snippet. User-facing header copy (EN/HE): `EN: "Linked here" / HE: "מקושר לכאן"`; empty state `EN: "Nothing links here yet." / HE: "עוד אין קישורים לכאן."`.
- **TESTS:**
  - Given a page body with `[[Target]]` / When saved / Then one link row exists targeting `Target`.
  - Given two pages both linking `[[Target]]` / When `backlinks({ pageId: Target })` runs / Then two links return, newest first.
  - Given a save removes `[[Target]]` / Then its link row is gone.
  - Given `[[Target]]` appears twice / Then one de-duplicated row.
  - Given a non-owner calls `backlinks` for another user's page / Then it returns only the caller's own links (isolation).
  - Given a `[[Target]]` where no page exists / Then the index records the raw text target without a resolved id (unresolved), and the query tolerates it.
- **NUMBERS:** link scan bound = `LINK_SCAN_LIMIT` (500) and `LINK_SCAN_BYTES` (12 KiB) already in `convex/notes.ts` (repo code). Index correctness = exact after every save (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority affects what "a link" is stored as (UNKNOWN — Amit).

### TFV2-0010 — Operation ledger + 5-min Undo `convex/lib/pageLedger.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** 0006 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0006.
- **WHY:** PRD §4.11 F-131 (Undo 5 minutes on internal changes); §6 rules (accept/reject, undo); REWRITE-PLAN-v2 §6 chunk 1 "operation ledger + 5-min Undo"; REWRITE-PLAN-v2 §4 conflict 6.
- **GOAL:** The existing page-operation ledger and its 5-minute Undo path are verified end-to-end, with every error and conflict case under test.
- **SCOPE:** `convex/lib/pageLedger.ts` (+ `convex/lib/pageLedger.test.ts`).
- **MUTATES:** none (pure ledger helpers; the write path lives in `notes.save`, TFV2-0007).
- **STEPS:** 1) Graphify code-map check of `convex/lib/pageLedger.ts` (EXISTS: `PAGE_LEDGER_LIMITS`, `PAGE_LEDGER_TIMING`, `validatePageOperationFacts`, `applyPageSplices`, `invertPageSplices`, `diffToSingleSplice`, `checkExpectedRevision`, `digestBody`, `sha256Hex`, and a test file); 2) verify `PAGE_LEDGER_TIMING` encodes the 5-minute Undo window; 3) confirm `notes.save` (TFV2-0007) writes a receipt with the body digest and previous revision; 4) read the existing test file and add the missing error/boundary cases below; 5) do not rename exported symbols.
- **DONE:** `bun test convex/lib/pageLedger.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change the Undo window duration (5 minutes is a product rule); do not weaken `checkExpectedRevision`; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** A page operation receipt stores `userId`, `pageId`, `kind`, `source`, the `before`/`after` body digests, the previous `revision`, and a `createdAt` timestamp. `checkExpectedRevision` compares the stored revision to the caller's and returns a `PageLedgerResult`. Undo eligibility: an operation is undoable only while `now - createdAt ≤ PAGE_LEDGER_TIMING.undoWindowMs` (5 minutes) and the current revision still equals the receipt's post-revision. `applyPageSplices(base, splices)` and `invertPageSplices(splices)` are exact inverses. User-facing Undo copy (EN/HE): `EN: "Done. You can undo for 5 minutes." / HE: "בוצע. אפשר לבטל למשך 5 דקות."` and `EN: "Undo" / HE: "ביטול"`.
- **TESTS:**
  - Given a valid operation receipt / When `validatePageOperationFacts` runs / Then `ok:true`.
  - Given a missing required field / Then `ok:false` with the right `errorCode`.
  - Given `checkExpectedRevision` with equal revisions / Then success.
  - Given a stale revision / Then a conflict result and no mutation.
  - Given `applyPageSplices` then `invertPageSplices` / Then the body round-trips byte-exact.
  - Given a receipt older than 5 minutes / Then it is not undoable (window enforced).
  - Given an invalid sha256 hex / Then `isValidSha256Hex` rejects it.
  - Given `digestBody` on the same body twice / Then equal digests (determinism).
- **NUMBERS:** Undo window = 5 minutes (`PAGE_LEDGER_TIMING`, repo code + PRD F-131). Digest determinism = exact (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** accept-reject vs auto-apply (REWRITE-PLAN-v2 §4 conflict 6): whether every AI mutation goes through `proposals.ts` confirm/edit/reject or `confidence ≥ 0.8` auto-applies with this 5-min Undo (UNKNOWN — Amit). The ledger supports both; the caller policy is not decided here.

### TFV2-0011 — `pagePrivacy` + resource quotas (4 MiB/file · 50 MiB · 100 files)
- **Stage:** A · **Pass:** 1 · **Depends:** 0006 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0006.
- **WHY:** PRD §4.11 F-130 (per-user isolation); REWRITE-PLAN-v2 §6 chunk 1 "bounded queries + resource quotas".
- **GOAL:** Every page read and block read goes through owner-scoped access checks, and per-user storage quotas (4 MiB per file, 50 MiB total, 100 files) are enforced at write time.
- **SCOPE:** `convex/lib/pagePrivacy.ts` (+ `convex/lib/pagePrivacy.test.ts`).
- **MUTATES:** none for existing helpers; adds quota constants and a `checkStorageQuota` helper (reads `notes`/file metadata only).
- **STEPS:** 1) Graphify code-map check of `convex/lib/pagePrivacy.ts` (EXISTS: `requireActiveOwner`, `requireLivePage`, `readLivePageBlocks`, `requireUndoAccess`, `requireLiveProposal`; quota constants 4 MiB/50 MiB/100 files are MISSING); 2) add `RESOURCE_QUOTA = { maxFileBytes: 4 * 1024 * 1024, maxTotalBytes: 50 * 1024 * 1024, maxFiles: 100 }`; 3) add `checkStorageQuota(ctx, userId, incomingBytes)` that sums the user's current stored bytes/file count and rejects when the incoming write would exceed a quota; 4) keep owner isolation (a `userId` can only ever read/write its own rows); 5) add the unit test file for every error case below.
- **DONE:** `bun test convex/lib/pagePrivacy.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change `convex/schema.ts`; do not add a new table for quota (compute from existing rows); do not touch `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `checkStorageQuota` is called before any file/blob write and before page-attachment writes. A single file over `maxFileBytes` is rejected with code `FILE_TOO_LARGE`; exceeding `maxTotalBytes` → `STORAGE_FULL`; exceeding `maxFiles` → `FILE_COUNT_EXCEEDED`. Quota user-facing copy (EN/HE): `EN: "This file is larger than the 4 MB limit." / HE: "הקובץ גדול מהמגבלה של 4 מגה־בייט."`; `EN: "You've reached your 50 MB storage limit." / HE: "הגעת למגבלת האחסון של 50 מגה־בייט."`; `EN: "You've reached the 100-file limit." / HE: "הגעת למגבלה של 100 קבצים."`.
- **TESTS:**
  - Given an owner reading its own live page / When `requireLivePage` runs / Then success.
  - Given a non-owner / Then a denial result, never the row.
  - Given a file of 5 MiB / When `checkStorageQuota` runs / Then `FILE_TOO_LARGE`.
  - Given a user already at 50 MiB / Then any added byte → `STORAGE_FULL`.
  - Given a user at 100 files / Then another file → `FILE_COUNT_EXCEEDED`.
  - Given a user under all quotas / Then success.
  - Given a soft-deleted page / Then `requireLivePage` denies it (30-day grace honoured).
- **NUMBERS:** 4 MiB per file, 50 MiB total, 100 files (product decision in REWRITE-PLAN-v2 §6 chunk 1; not an industry standard — UNKNOWN source beyond the plan; Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether the 50 MiB / 100 files quotas are per-user storage on Convex or a provider-side cap (UNKNOWN — Amit).

### TFV2-0012 — Approval-gated sign-up (`convex/auth.ts` + `convex/lib/approval.ts`)
- **Stage:** A · **Pass:** 1 · **Depends:** 0004 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0004.
- **WHY:** PRD §4.1 F-01a (approval-gated sign-up; unapproved email can never sign in; every approved user gets the premium tier); REWRITE-PLAN-v2 §6 chunk 1 "approval-gated sign-up"; REWRITE-PLAN-v2 §4 conflict 4.
- **GOAL:** The approval gate is verified: a pending email cannot sign in or receive a magic link, and an approved email gets the granted premium tier through `entitlements`.
- **SCOPE:** `convex/auth.ts` + `convex/lib/approval.ts` (+ `convex/lib/approval.test.ts`).
- **MUTATES:** none (reads approval state; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/auth.ts` `convexAuth`, `convex/lib/approval.ts` `ApprovalStatus`, `PENDING_APPROVAL_ERROR`, `isAdminUser`, `initialApprovalStatus`, `approvalStatusOf`, `isApproved`, `releaseApprovalDecision`, plus `approval.test.ts`); 2) verify the sign-in path refuses a `pending`/absent email before any magic link is sent; 3) verify an approved email proceeds to `entitlements.newUserFields` (TFV2-0004) and lands on `entitlementTier==="max"`; 4) read the existing test file and add the missing error cases below; 5) do not rename exported symbols.
- **DONE:** `bun test convex/lib/approval.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not change the premium-for-all grant; do not invent an approval UI here (that is TFV2-0060); do not touch `.github/**`, `.env` or workflows; do not read or log the admin email list values.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `approvalStatusOf(email)` returns `pending` | `approved` | `revoked`. `isApproved` gates the magic-link send. `initialApprovalStatus` is applied at first contact. `isAdminUser` derives admins from `adminEmails()`. Pending-approval user-facing copy (EN/HE): `EN: "You're on the list. We'll write when you're in." / HE: "אתה ברשימה. נכתוב כשתיכנס."` and `EN: "Your account is waiting for approval." / HE: "החשבון שלך ממתין לאישור."`.
- **TESTS:**
  - Given a `pending` email / When sign-in is attempted / Then no magic link is sent and `PENDING_APPROVAL_ERROR` is raised.
  - Given an `approved` email / Then a link is sent and the new user fields carry `entitlementTier==="max"`.
  - Given a `revoked` email / Then sign-in is refused.
  - Given an unknown email / Then it is treated as pending (never reveals existence) — assert the actual behaviour.
  - Given an admin email / Then `isAdminUser` is true.
  - Given `approvalStatusOf` with a normalized email (case, whitespace) / Then it matches the stored form.
- **NUMBERS:** no industry number; correctness is the F-01a invariant (unapproved can never sign in). Pass: invariant on 100% of cases (no range).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** sign-up policy (REWRITE-PLAN-v2 §4 conflict 4): the cap (PRD says 30) vs "unlimited, each approved by Amit", and the approval order, and where Amit approves (admin screen vs Convex dashboard vs email link) are all UNKNOWN — Amit.

### TFV2-0013 — Magic-link sign-in / sign-out parity (remove passkeys)
- **Stage:** A · **Pass:** 1 · **Depends:** 0012 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0012.
- **WHY:** PRD §4.1 F-01 (magic link only; no password, no passkeys); REWRITE-PLAN-v2 §6 chunk 1 "magic-link sign-in/sign-out parity (remove passkeys)".
- **GOAL:** Sign-in is magic-link only and sign-out is symmetric; there is no passkey/webauthn surface anywhere in auth.
- **SCOPE:** `convex/auth.ts` + `convex/lib/signInEmail.ts` (+ `convex/lib/signInEmail.test.ts`).
- **MUTATES:** none (auth wiring; removes nothing new because no passkey code exists).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/auth.ts` `signIn`/`signOut`/`store`, `convex/lib/signInEmail.ts` `signInEmail`; a repo-wide grep for `passkey|webauthn` returns nothing today, so the removal is already done); 2) verify `signOut` clears the session and returns the user to an unauthenticated state; 3) verify the email subject/body (`signInEmail`) carries both EN and HE and a 30-minute validity note; 4) add the missing parity tests below; 5) do not change the magic-link sender address or link lifetime.
- **DONE:** `bun test convex/lib/signInEmail.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count), plus the grep output showing zero passkey references.
- **DO NOT:** do not reintroduce passkeys, passwords or any second sign-in method; do not change the Resend sender or secret names; do not touch `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `signInEmail({ url, host })` returns the Resend payload with subject `EN: "Your Tempo Flow sign-in link · קישור הכניסה שלכם"` (already bilingual) and a link valid 30 minutes. `signOut` is idempotent (calling it twice is safe). The auth surface exposes exactly one sign-in method: email magic link. Link-sent copy (EN/HE): `EN: "We sent a link. It works for 30 minutes." / HE: "שלחנו קישור. הוא עובד 30 דקות."`.
- **TESTS:**
  - Given a valid `url` and `host` / When `signInEmail` runs / Then the payload has a subject containing both languages and a body containing the link.
  - Given `signOut` then a read / Then the session is unauthenticated.
  - Given `signOut` twice / Then no error.
  - Given a repo grep for `passkey|webauthn|WebAuthn` / Then zero matches (assert in test or as EVIDENCE).
  - Given the email HTML / Then it escapes user-controlled characters (no injection).
- **NUMBERS:** magic-link lifetime = 30 minutes (PRD F-01 + sign-in screen copy). No industry number; link lifetime is a product decision.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0014 — Chat backend: real AI replies via the seam `convex/lib/ai_router.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** 0002, 0004 · **Folds-in:** #743
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0002, TFV2-0004.
- **WHY:** PRD §4.2 F-20 (coach replies live from the runtime model); REWRITE-PLAN-v2 §6 chunk 1 "chat backend real AI replies via seam"; #743 (TEMPO-N2-01); REWRITE-PLAN-v2 §4 conflict 3.
- **GOAL:** The AI seam (`callLLM` in `ai_router.ts`) is verified as the single point where the coach and chat call the runtime model, with tier routing and no key leakage.
- **SCOPE:** `convex/lib/ai_router.ts` (+ `convex/lib/ai_router.test.ts`).
- **MUTATES:** none (seam wiring; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/lib/ai_router.ts` `AiTier`, `AiMessage`, `AiResult`, `DEFAULT_AI_MODEL`, `DEEPINFRA_CHAT_COMPLETIONS_URL`, `resolveAiModel`, `callLLM`, plus a test file); 2) verify `callLLM` accepts the mock model from TFV2-0002 (so tests never hit the network); 3) confirm the model id comes from the seam only and never reads a key into a log; 4) read the existing test file and add the missing error cases below; 5) do not rename exported symbols.
- **DONE:** `bun test convex/lib/ai_router.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not call a real model, the network or `fetch` in tests; do not print or log any key; do not change the provider URL; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `callLLM({ tier, messages })` returns `AiResult { text }` (or the existing richer shape). `resolveAiModel()` returns the configured model id, defaulting to `DEFAULT_AI_MODEL`. `AiTier` is `"fast"| "balanced"| "deep"`. Error cases return a typed error result (not a thrown `ConvexError`) so callers can degrade gracefully. The seam must never log the request/response body, the provider URL with credentials, or any key value. User-facing failure copy (EN/HE): `EN: "The coach is having a moment. Try again." / HE: "המאמן תקוע לרגע. נסו שוב."`.
- **TESTS:**
  - Given a mock model / When `callLLM` runs / Then it returns the mock reply and records the call.
  - Given a tier of `"fast"| "balanced"| "deep"` / Then the resolved model is a non-empty string.
  - Given an empty messages array / Then a typed error result, not a throw.
  - Given a missing model id / Then `resolveAiModel` falls back to `DEFAULT_AI_MODEL`.
  - Given a provider failure (mocked) / Then a typed error result with no key in the message.
  - Given the same input twice / Then deterministic with the mock (assert replay).
- **NUMBERS:** no latency/success-rate target is verifiable offline (UNKNOWN — Amit). Model string is a product decision (see OPEN).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** interim text model (REWRITE-PLAN-v2 §4 conflict 3): repo `DEFAULT_AI_MODEL` is `deepseek-ai/DeepSeek-V4.1-Flash` on DeepInfra; a later note says `GLM 5.3 Flash on DeepInfra` (that string appears nowhere in the repo). UNKNOWN — Amit; `ai_router.ts` is the source of truth until settled.

### TFV2-0015 — `/coach` chat uses `chat.send` + Thinking + Retry
- **Stage:** A · **Pass:** 1 · **Depends:** 0014 · **Folds-in:** #744
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0014.
- **WHY:** PRD §4.2 F-20 (coach chat); REWRITE-PLAN-v2 §6 chunk 1 "/coach chat uses chat.send + Thinking + Retry"; #744 (TEMPO-N2-02).
- **GOAL:** The coach chat path is verified to send messages through the chat send, surface a Thinking state, and retry once on a transient seam failure.
- **SCOPE:** `convex/coach.ts` (+ `convex/coach_chat.test.ts`).
- **MUTATES:** none (wiring; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/coach.ts`, `convex/coach_chat.test.ts`); 2) verify the send path calls `callLLM` (TFV2-0014) and not a hand-rolled `fetch`; 3) verify a Thinking/typing state precedes the reply; 4) verify one retry on a transient failure then a graceful error; 5) read the existing test file and add the missing cases below; 6) do not rename exported mutations/queries.
- **DONE:** `bun test convex/coach_chat.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not call a real model in tests (use `mockModel`); do not print keys; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The coach send path is: validate auth and AI gate (TFV2-0018) → enqueue the user message → set Thinking → `callLLM` → stream/write reply → clear Thinking. On a transient seam error, retry once; on the second failure, surface the graceful error copy. User-facing strings (EN/HE): `EN: "Coach is typing" / HE: "המאמן מקליד"`; `EN: "Couldn't reach the coach. Try again." / HE: "לא הצלחנו להגיע למאמן. נסו שוב."`.
- **TESTS:**
  - Given a queued mock reply / When the user sends a message / Then the reply appears and Thinking is cleared.
  - Given a transient failure then success / When sent / Then exactly one retry happens and the reply lands.
  - Given two failures / Then a graceful error, no infinite retry.
  - Given an unapproved user / Then the send is refused at the AI gate.
  - Given the Thinking state / Then it is announced (`role=status` equivalent) before the reply.
- **NUMBERS:** retry count = exactly 1 (product rule; PRD/TRD). No latency target offline (UNKNOWN — Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** interim text model (same as TFV2-0014; UNKNOWN — Amit).

### TFV2-0016 — Coach Agent foundation `convex/lib/agentComponent.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** 0002, 0018 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0002, TFV2-0018.
- **WHY:** PRD §4.2 F-20 (built on Convex's official Agent component: threads, tool calls, streaming); REWRITE-PLAN-v2 §6 chunk 1 "coach Agent foundation (convex/lib/agentComponent.ts)".
- **GOAL:** A thin `agentComponent.ts` wrapper over the pinned `@convex-dev/agent` 0.3.2 component exposes thread/message/tool primitives so `coach.ts` and `chat` use one reviewed integration point instead of raw component calls.
- **SCOPE:** `convex/lib/agentComponent.ts` (+ `convex/lib/agentComponent.test.ts`).
- **MUTATES:** none (wrapper over the existing component; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (the wrapper is MISSING today — only `agentComponent.test.ts` exists, which loads the pinned component from `node_modules` to prove it runs under Bun; `convex/coach.ts` imports `@convex-dev/agent` pieces directly); 2) write `agentComponent.ts` exporting `agentComponent()` returning the component handle, and helpers `agentThreads` / `agentMessages` that `coach.ts` can call; 3) keep the wrapper typed against `@convex-dev/agent/_generated/component`; 4) do not call a model or the network in tests; 5) add/reconcile the test file to import the wrapper, not raw `node_modules` paths.
- **DONE:** `bun test convex/lib/agentComponent.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not upgrade or unpin `@convex-dev/agent`; do not call a real model; do not print keys; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** The wrapper returns the component's threads/messages sub-components and their types. Every call is delegated to the pinned component with no added state. The wrapper must be side-effect-free at import time and must not run `import.meta.glob` (Bun unsupported, per the existing test's notes). Thread/message rows remain owned by the component's schema; the wrapper adds no new tables.
- **TESTS:**
  - Given the wrapper / When instantiated under `convex-test` / Then threads and messages sub-components resolve without network.
  - Given a synthetic user id / When a thread is created and a message appended / Then the message is retrievable (assert with synthetic data).
  - Given the wrapper import / Then no `import.meta.glob` is executed (assert the module loads under Bun).
  - Given a second instantiation / Then it returns an equivalent handle (no duplicate registration).
- **NUMBERS:** pinned `@convex-dev/agent` version = 0.3.2 (repo `package.json`). No industry number.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** whether the wrapper is required or `coach.ts` may keep importing the component directly (UNKNOWN — Amit); interim text model (UNKNOWN — Amit).

### TFV2-0017 — Crisis card `convex/crisis.ts` + `convex/lib/crisisWords.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** 0003 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0003.
- **WHY:** PRD §4.2 F-24 (fixed crisis card; text fixed, never model-written; stop coaching, show real resources); REWRITE-PLAN-v2 §6 chunk 1 "crisis card".
- **GOAL:** The crisis detection and fixed resource card are verified: crisis text stops coaching and returns the human-written card, never a model reply.
- **SCOPE:** `convex/crisis.ts` + `convex/lib/crisisWords.ts` (+ `convex/lib/crisisWords.test.ts`).
- **MUTATES:** none (read-only queries + fixed copy; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/crisis.ts` `check`/`resourcesCard`, `convex/lib/crisisWords.ts` `CRISIS_CARD`, `crisisCardText`, `isCrisisText`, plus `crisisWords.test.ts`); 2) verify `isCrisisText` matches EN and HE crisis signals (self-harm, no sleep, escalating distress); 3) verify `check`/`resourcesCard` return the fixed `CRISIS_CARD` copy and that `coach.ts` stops coaching on crisis; 4) read the existing test file and add the missing cases below; 5) do not rename exported symbols or edit the fixed copy (it is written by people).
- **DONE:** `bun test convex/lib/crisisWords.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not let a model write the card text; do not add emoji or animation to the card; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `CRISIS_CARD` is a frozen literal (per-country resources may expand later; the structure is fixed). `isCrisisText(text)` returns a boolean and is case-insensitive for EN, substring for HE. On crisis, `coach.ts` must not call `callLLM`; it returns the card. The card copy (EN/HE) must match the committed `CRISIS_CARD` exactly; the standard header `EN: "Let's pause coaching." / HE: "בואו נעצור את האימון."` plus real local helpline entries. No colour-only signalling (icon + word, per DESIGN.md §2).
- **TESTS:**
  - Given `"I want to hurt myself"` / Then `isCrisisText` is true.
  - Given `"לא ישנתי שלושה לילות ואני גמור"` / Then true.
  - Given `"Help me plan my Tuesday"` / Then false.
  - Given crisis text / Then the coach returns `resourcesCard`, not a model reply.
  - Given the card / Then it contains a real helpline (phone link) and no model-generated sentence.
  - Given the card in HE / Then it renders RTL and the numbers stay LTR (`.tp-num`).
- **NUMBERS:** no industry number; correctness is F-24 (coaching stops on crisis = 100% of matched cases, no range). Crisis-word recall = 100% on the committed list.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** per-country resource list completeness (PRD F-24: per-country data is MVP; UNKNOWN — Amit).

### TFV2-0018 — auth → entitlement → quota ordering `convex/lib/aiGate.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** 0004, 0012 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0004, TFV2-0012.
- **WHY:** PRD §4.11 (per-user isolation, tiers); REWRITE-PLAN-v2 §6 chunk 1 "auth→entitlement→quota ordering".
- **GOAL:** The AI gate is verified to enforce, in order, authentication → approval/entitlement → quota, so no model call happens before all three pass.
- **SCOPE:** `convex/lib/aiGate.ts` (+ `convex/lib/aiGate.test.ts`).
- **MUTATES:** none (read-only gate; adds no table, route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/lib/aiGate.ts` `requireApprovedForAi`); 2) verify the ordering: `requireUser` (auth) → `isApproved` (entitlement, TFV2-0012/0004) → quota check (TFV2-0011); 3) confirm `requireApprovedForAi` throws `ConvexError` before any model call when any stage fails; 4) add the unit test file for every error case below; 5) do not rename the exported symbol.
- **DONE:** `bun test convex/lib/aiGate.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not reorder the three stages; do not call a model in the gate; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `requireApprovedForAi(ctx)` returns `void` on success and throws a typed `ConvexError` on failure, in this order: (1) unauthenticated → `UNAUTHENTICATED`; (2) pending/revoked → `PENDING_APPROVAL_ERROR`; (3) quota exhausted → `QUOTA_EXCEEDED`. User-facing copy (EN/HE): `EN: "You're signed out." / HE: "התנתקת."`; `EN: "Your account is waiting for approval." / HE: "החשבון שלך ממתין לאישור."`; `EN: "You've used today's coach time." / HE: "ניצלת את זמן המאמן של היום."` (quota text is a placeholder until the voice/call quota lands in chunk E).
- **TESTS:**
  - Given an authenticated, approved, under-quota user / Then `requireApprovedForAi` resolves without throwing.
  - Given unauthenticated / Then `UNAUTHENTICATED` (and no quota/entitlement evaluation happens).
  - Given authenticated but pending / Then `PENDING_APPROVAL_ERROR`.
  - Given authenticated, approved, quota exhausted / Then `QUOTA_EXCEEDED`.
  - Given authenticated, approved, under quota / Then no model/network call is made.
- **NUMBERS:** no industry number; ordering invariant = exact (auth → entitlement → quota).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** quota value/source for the AI gate (voice-minute cap vs model-call cap) is UNKNOWN — Amit (chunk E).

### TFV2-0019 — Memory adapter foundation `convex/memory.ts`
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.5 F-50 (one memory adapter over the `memories` table: remember, recall, context, forget, export); REWRITE-PLAN-v2 §6 chunk 1 "memory adapter foundation".
- **GOAL:** The memory adapter's five operations (remember, recall, context, forget, export) are verified owner-scoped and complete for the coach to consume in chunk C.
- **SCOPE:** `convex/memory.ts` (+ `convex/memory.test.ts`).
- **MUTATES:** none (reads/writes the existing `memories` table only; adds no schema).
- **STEPS:** 1) Graphify code-map check (EXISTS: `convex/memory.ts` `remember`, `recall`, `list`, `context`, `forget`, `restore`, `forgetAll`, `restoreAll`, `exportAll`); 2) verify owner scoping (a user can only touch its own memories); 3) verify `forget` hard-deletes today and `restore` is the soft path (mark the forget-semantics question OPEN per §4 conflict 8); 4) read the existing `convex/memoryUndo.test.ts` and add the missing error cases below; 5) do not rename exported symbols.
- **DONE:** `bun test convex/memory.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not add an outside memory engine; do not change `forget` to hard-delete without the OPEN ruling; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows; do not call an embedding model here (chunk C).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `remember({ fact, source })` inserts under the caller's `userId`; `recall({ query })` and `context({})` return only the caller's items (keyword match now; meaning-search arrives in chunk C); `forget({ id })` removes the item (current code hard-deletes); `exportAll()` returns all items as Markdown. Error copy (EN/HE): `EN: "That memory isn't here anymore." / HE: "הזיכרון הזה כבר לא כאן."` (missing id).
- **TESTS:**
  - Given an owner calls `remember` / Then the item is retrievable by `list`.
  - Given a second user / Then `list` returns only its own items (isolation).
  - Given `forget({ id })` / Then the item is gone from `list`.
  - Given `forget` on a missing id / Then a graceful error, no crash.
  - Given `exportAll` / Then output is Markdown containing every item.
  - Given `restore` after `forget` (if soft path exists) / Then the item returns.
- **NUMBERS:** no industry number; correctness is owner isolation (100% of reads/writes scoped). Recall-by-meaning arrives in chunk C (UNKNOWN numeric benchmark — Amit).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** `forget` semantics (REWRITE-PLAN-v2 §4 conflict 8): PRD "soft delete everywhere, 30-day grace" vs memory spec "forget must be complete" (`deleteMemory` hard-deletes today). UNKNOWN — Amit.

### TFV2-0020 — EN/HE message baseline + RTL (`apps/web/lib/i18n.ts` + `apps/web/lib/i18n-groups/`)
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** PRD §4.7 F-70/F-71/F-72 (EN+HE copy; layout flips RTL/LTR; mixed direction per paragraph); REWRITE-PLAN-v2 §6 chunk 1 "EN/HE + RTL baseline".
- **GOAL:** The existing i18n baseline is verified: every string has EN and HE, `lang=he` sets `dir="rtl"` on `<html>`, and numbers/code stay LTR.
- **SCOPE:** `apps/web/lib/i18n.ts` + `apps/web/lib/i18n-groups/*` (+ `apps/web/lib/i18n.test.ts`).
- **MUTATES:** none (message dictionary; adds no route or env).
- **STEPS:** 1) Graphify code-map check (EXISTS: `apps/web/lib/i18n.ts` `LANG_STORAGE_KEY`, `LANGS`, `dirFor`, `resolveLang`, the EN/HE dictionaries, plus `apps/web/lib/i18n-groups/`; NOTE: the planned location `apps/web/messages/en.json`/`he.json` does NOT exist — the repo uses TS dictionaries in `apps/web/lib/`); 2) verify `resolveLang` precedence (URL param → stored → English); 3) verify `dirFor("he")==="rtl"` and digits use `.tp-num`/`.tp-mono` LTR isolation; 4) read the existing `i18n.test.ts` and add the missing cases below; 5) do not relocate the dictionaries (keep the existing file layout).
- **DONE:** `bun test apps/web/lib/i18n.test.ts` → all tests pass.
- **EVIDENCE:** paste the `bun test` output (pass count).
- **DO NOT:** do not create `apps/web/messages/*.json` (the repo's truth is `lib/i18n.ts`); do not machine-translate new copy as "final" (Hebrew needs native review — OVERNIGHT-RUN.md hard limit); do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `resolveLang(param, stored)` returns `"en" | "he"`. `dirFor` maps `he`→`rtl`. Every visible string has an EN and HE entry; keys are dotted (`nav.today`). Hebrew digits/times/dates/prices wrap in `.tp-num` (LTR isolate, tabular) and times also take `.tp-mono` (DESIGN.md §10). User-written text uses `dir="auto"` per paragraph (F-72). The baseline must compile both languages with no missing-key runtime error.
- **TESTS:**
  - Given `resolveLang("he", null)` / Then `"he"`.
  - Given `resolveLang(null, "he")` / Then `"he"`.
  - Given `resolveLang(null, null)` / Then `"en"`.
  - Given `dirFor("he")` / Then `"rtl"`; `dirFor("en")` → `"ltr"`.
  - Given the EN and HE dictionaries / Then every EN key exists in HE (no missing key).
  - Given a mixed-direction paragraph / Then `dir="auto"` is applied (component-level assert).
- **NUMBERS:** no industry number; completeness = every EN key has a HE value (100%).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** the task-specified location `apps/web/messages/en.json`/`he.json` differs from the repo reality `apps/web/lib/i18n.ts` (GitHub is truth; UNKNOWN whether to migrate to JSON — Amit).

### TFV2-0021 — TempoShell
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §8 (grid areas rail/top/main/coach); components.md §1 TempoShell; REWRITE-PLAN-v2 §6 chunk 1 "shell & editor primitives".
- **GOAL:** The app shell grid (rail / topbar / main / coach, with scrim) is verified at every breakpoint and both directions.
- **SCOPE:** `apps/web/components/tempo/TempoShell.tsx` (+ `tests/e2e/screens/tempo-shell.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `TempoShell.tsx` with `ShellSlots.tsx`, `ScaffoldScreen.tsx`); 2) verify grid areas `rail / top / main / coach` and the `toggle-rail` + scrim behaviour; 3) verify rail is a drawer under 1024 and a docked 264px column at ≥1280; 4) add the Playwright spec below; 5) no new tokens or colours in the component.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/tempo-shell.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours/fonts/spacing (tokens only); do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Grid `rail` (264px, `--tp-rail-w`), `top` (56px, `--tp-topbar-h`), `main` (centred paper, max 760px `--tp-paper-max`), `coach` (400px, `--tp-coach-w`, docked ≥1280). Under 768: full-bleed paper, bottom tab bar, coach as bottom sheet. Scrim `--tp-scrim`. Glass only on floating chrome. One primary action per screen. Motion ≤250ms (`--tp-dur-slow` 240ms, `--tp-ease-out`).
- **TESTS:** Given viewport 1280 / When shell renders / Then rail, topbar, main are visible and coach is dockable. Given 390 / Then rail is hidden behind a menu and main is full-bleed. Given `lang=he` / Then `dir=rtl` and rail moves to the right (logical properties). Given `toggle-rail` / Then the drawer opens and focus moves in; Esc closes.
- **NUMBERS:** rail 264px, coach 400px, topbar 56px (tokens, repo). WCAG 2.2 AA text 4.5:1 (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum); target ≥24×24px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum); motion ≤250ms (DESIGN.md §7).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0022 — Sidebar / PageTree
- **Stage:** A · **Pass:** 1 · **Depends:** 0021 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0021.
- **WHY:** DESIGN.md §9 Sidebar/PageTree; components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The page rail (brand, CommandTrigger, page tree with `aria-current`, nested folders) is verified, including the under-1024 drawer.
- **SCOPE:** `apps/web/components/tempo/Sidebar.tsx` (+ `tests/e2e/screens/sidebar.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `Sidebar.tsx`; `PageTree` is rendered inside it); 2) verify `aria-current="page"`, collapsible folders, and the `Pages` label; 3) verify the drawer variant under 1024; 4) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/sidebar.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-rail` width 264px; groups `Today / Inbox / Coach`, then `Library`, then `Pages` with nested folders. `aria-current="page"` on the active row. Rows use `--tp-hover` on hover/focus; active text `--tp-ink`, muted `--tp-ink-muted`. Copy (EN/HE): `EN: "Pages" / HE: "דפים"`; `EN: "Library" / HE: "ספרייה"`; `EN: "Search or jump to" / HE: "חיפוש או מעבר אל"`; `EN: "Reading font" / HE: "גופן קריאה"`; `EN: "Settings" / HE: "הגדרות"`. RTL: rail on the right; chevrons flip.
- **TESTS:** Given 1280 / Then the rail shows all groups and the current page has `aria-current`. Given a folder with children / Then tapping toggles collapse. Given 390 / Then the rail is a drawer opened from the topbar. Given `lang=he` / Then labels are Hebrew and the rail is on the right.
- **NUMBERS:** rail 264px (token). WCAG contrast 4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0023 — Topbar
- **Stage:** A · **Pass:** 1 · **Depends:** 0021 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0021.
- **WHY:** DESIGN.md §9 Topbar (breadcrumb, glass); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The glass topbar (menu, breadcrumbs, "Saved" state, theme toggle, avatar) is verified at both breakpoints.
- **SCOPE:** `apps/web/components/tempo/Topbar.tsx` (+ `tests/e2e/screens/topbar.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `Topbar.tsx`); 2) verify breadcrumb (`crumbs[]`), `Saved` status hides when offline, theme toggle `aria-pressed`, avatar; 3) verify glass (`tp-glass`) with solid fallback; 4) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/topbar.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Height 56px (`--tp-topbar-h`), glass recipe from DESIGN.md §5. Breadcrumbs with a chevron that flips in RTL (`tp-icon--flip`). Copy (EN/HE): `EN: "Saved" / HE: "נשמר"`; `EN: "Open pages" / HE: "פתיחת הדפים"`; `EN: "Dark theme" / HE: "ערכת צבעים כהה"`. Offline: "Saved" is hidden and the offline banner takes its meaning.
- **TESTS:** Given 1280 / Then breadcrumbs, Saved, theme toggle, avatar are visible. Given 390 / Then crumbs collapse (hide `--hide-sm`). Given offline / Then "Saved" is hidden. Given `lang=he` / Then crumbs are RTL and the chevron flips. Given theme toggle / Then `aria-pressed` flips and `data-theme` changes.
- **NUMBERS:** height 56px (token). WCAG contrast 4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0024 — Avatar
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Avatar (person's initials, never "User"); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** An accessible initials avatar (name → initials, `role="img"` + `aria-label`, never the word "User") exists in the design-system package.
- **SCOPE:** `packages/ui/src/primitives/Avatar.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Avatar.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING — no `Avatar` primitive; the editor HTML uses `tp-avatar` but no React component exists); 2) implement `Avatar({ name, initials? })` deriving initials from `name` (first letter of first + last word, uppercased); 3) render `role="img"` with `aria-label={name}`; 4) export from `index.ts`; 5) add render test + Playwright assertions via the topbar spec.
- **DONE:** `bun test packages/ui/src/primitives/Avatar.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not fall back to the text "User"; do not add colours (tokens only); do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** 32px circle, `--tp-paper` ground with `--tp-ink` initials, `--tp-line-strong` hairline. `initials` derived when omitted. `EN/HE` — no visible text; `aria-label` is the person's name in both scripts (name is user data, not translated). Keyboard: not focusable (decorative); `role="img"` exposes the name to screen readers.
- **TESTS:** Given `name="Maya Ronen"` / Then initials are `"MR"` and `aria-label="Maya Ronen"`. Given `name="Yoni"` / Then initials `"Y"`. Given `initials="D"` / Then it overrides derivation. Given a screen reader / Then it announces the name, never "User".
- **NUMBERS:** size 32px; contrast ≥4.5:1 (initials `--tp-ink` on `--tp-paper` = 16.67:1 light). WCAG 2.2 AA.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0025 — TabBar
- **Stage:** A · **Pass:** 1 · **Depends:** 0021 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0021.
- **WHY:** DESIGN.md §8 (glass tab bar under 768); components.md §1 TabBar; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The mobile glass tab bar (Today / Tasks / Pages / Calendar / More) is verified with `aria-current` and RTL.
- **SCOPE:** `apps/web/components/tempo/TabBar.tsx` (+ `tests/e2e/screens/tabbar.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `TabBar.tsx`); 2) verify it renders only under 768, glass with solid fallback, `aria-current` on the active tab; 3) verify the "More" tab opens the rail; 4) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/tabbar.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Height 64px (`--tp-tabbar-h`), glass, icons + labels. Copy (EN/HE): `EN: "Today" / HE: "היום"`; `EN: "Tasks" / HE: "משימות"`; `EN: "Pages" / HE: "דפים"`; `EN: "Calendar" / HE: "לוח שנה"`; `EN: "More" / HE: "עוד"`. Under 768 only; content reserves `padding-bottom` = tab bar + 64. RTL mirrors and chevrons flip.
- **TESTS:** Given 390 / Then the tab bar shows five tabs with the active tab `aria-current`. Given 1280 / Then the tab bar is hidden. Given `lang=he` / Then labels are Hebrew and order mirrors. Given "More" / Then the rail opens.
- **NUMBERS:** height 64px (token); target ≥24px; contrast ≥4.5:1; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0026 — CommandTrigger
- **Stage:** A · **Pass:** 1 · **Depends:** 0022 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0022.
- **WHY:** DESIGN.md §9 CommandTrigger (Ctrl K in dialog); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "Search or jump to" rail trigger opens the command palette on click and on Ctrl/Cmd+K, with focus moved into the dialog.
- **SCOPE:** `apps/web/components/tempo/CommandTrigger.tsx` (+ `tests/e2e/screens/command.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (CommandTrigger is MISSING; `CommandPalette.tsx`/`CommandList.tsx` exist and are the dialog it opens); 2) implement `CommandTrigger` as a `--tp-btn--secondary` button labelled "Search or jump to" with a `Kbd` hint `Ctrl K`; 3) wire click and Ctrl/Cmd+K to open `CommandPalette`; 4) focus moves into the dialog and Esc returns focus to the trigger; 5) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/command.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not rebuild the palette itself; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-rail__search` button (secondary), search icon, label `EN: "Search or jump to" / HE: "חיפוש או מעבר אל"`, trailing `Kbd` `Ctrl K` (renders `⌘ K` on macOS). Keyboard: Enter/Space opens, Esc closes and returns focus. RTL mirrors the trailing kbd to the start.
- **TESTS:** Given a click / Then the palette opens and focus is inside. Given Ctrl+K / Then it opens. Given Esc / Then it closes and focus returns to the trigger. Given 390 vs 1280 / Then the trigger renders in the rail/drawer in both. Given `lang=he` / Then label is Hebrew.
- **NUMBERS:** target ≥24px; contrast ≥4.5:1; motion ≤250ms (dialog 180ms).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0027 — Page / PageEditor (CodeMirror live preview + remark-gfm)
- **Stage:** A · **Pass:** 1 · **Depends:** 0007 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0007.
- **WHY:** PRD §4.1 F-02/F-03 (markdown editor, blocks as elements, no JSON); DESIGN.md §9 Page/PageEditor; REWRITE-PLAN-v2 §6 chunk 1 "markdown editor (CodeMirror live preview + GFM)".
- **GOAL:** The page editor renders `notes.body` as CodeMirror with a live `remark-gfm` preview and never shows raw JSON.
- **SCOPE:** `apps/web/components/notes/PageEditorView.tsx` + `apps/web/components/editor/LivePreviewEditor.tsx` (+ `tests/e2e/screens/notes-save.spec.ts`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `PageEditorView.tsx`, `LivePreviewEditor.tsx`, `editor/live-preview.ts`, `editor/ReadView.tsx`); 2) verify CodeMirror 6 editing + `remark-gfm` preview; 3) verify `- [ ]` stays plain markdown and `[[links]]` render as Wikilinks; 4) verify autosave calls `notes.save` (TFV2-0007) and no JSON appears; 5) add/refresh the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/notes-save.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not surface JSON; do not bypass `notes.save`; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `.tp-paper` centred, max 760px. CodeMirror edits + live preview via `remark-gfm`. `- [ ]` renders as a TaskBlock/TaskRow (tick → `tasks.complete`), `[[page]]` as Wikilink. Save is optimistic with the topbar "Saved" state and 5-min Undo. Empty state `EN: "This page is empty." / HE: "הדף הזה ריק."`; `EN: "Just start writing. Type / on a new line for tasks, time blocks and more." / HE: "פשוט להתחיל לכתוב. הקלדת / בשורה חדשה מוסיפה משימות, בלוקי זמן ועוד."`. Offline keeps editing; error shows `EN: "Couldn't open this page. Your data is safe." / HE: "לא הצלחנו לפתוח את הדף הזה. המידע שלך שמור."` + Retry.
- **TESTS:** Given a page / When a task block is ticked / Then optimistic check and Undo toast. Given a typed `[[Other page]]` / Then a Wikilink renders. Given `/` on an empty line / Then the SlashMenu opens (TFV2-0036). Given `lang=he` / Then the editor is RTL and `dir="auto"` per paragraph. Given 390 and 1280 / Then editing works at both. Assert no `{`-led JSON string is visible anywhere.
- **NUMBERS:** paper max 760px; text min 13px; contrast ≥4.5:1; motion ≤250ms; save autosave (no loss on refresh).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority (UNKNOWN — Amit).

### TFV2-0028 — PageTitle / Headings
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §3 (serif 42px page title, headings weight 560); components.md §1 PageTitle/Headings; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** Serif page-title and heading primitives (h1 `.tp-page-title`, h2 `.tp-h2`, h3 `.tp-h3`) exist in the design-system package with correct type tokens.
- **SCOPE:** `packages/ui/src/primitives/PageTitle.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/PageTitle.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `PageTitle({ children, as })` and `Heading({ level, children })` using `--tp-font-serif` / `--tp-text-3xl` (title 42px) and `--tp-text-xl` (h2 26px) / `--tp-text-lg` (h3 20px); 3) editable title uses `contenteditable` + `dir="auto"`; 4) export; 5) add render test + Playwright via the page-editor spec.
- **DONE:** `bun test packages/ui/src/primitives/PageTitle.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not set colours (tokens only); do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Title: `--tp-font-serif`, `--tp-text-3xl` (42px), weight 560, tracking −0.02em (0 for Hebrew). h2 `--tp-text-xl` 26px, h3 `--tp-text-lg` 20px, `--tp-leading-heading` 1.18. Editable title focus ring `--tp-accent` 2px. No visible copy beyond the title text itself.
- **TESTS:** Given a title / Then it renders in the serif face at 42px (assert class/token). Given an editable title / Then typing updates it and `dir="auto"` is set. Given `lang=he` / Then the serif face is Frank Ruhl Libre and tracking is 0.
- **NUMBERS:** title 42px, h2 26px, h3 20px (tokens). Contrast ≥4.5:1.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0029 — Tag
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Tag (inline `#tag`, badge); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** An inline `#tag` badge primitive (pill, `--tp-accent-wash` on selected, linkable) exists in the design system.
- **SCOPE:** `packages/ui/src/primitives/Tag.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Tag.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Tag({ name, href? })` rendering `tp-tag`; 3) selected state uses `--tp-accent-wash` with `--tp-accent` text (word + no colour-only signal); 4) export; 5) render test + Playwright via the editor/notes spec.
- **DONE:** `bun test packages/ui/src/primitives/Tag.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours (tokens only); do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Pill radius `--tp-radius-pill`, text `--tp-text-xs` (13px min), `#` prefix inline. Default `--tp-ink-muted` text on `--tp-paper` with `--tp-line` hairline; selected `--tp-accent` text on `--tp-accent-wash`. Linkable (`href`) with hover lift. The tag text is user data (untranslated), shown `dir="auto"`.
- **TESTS:** Given `name="home"` / Then it renders `#home`. Given selected / Then accent wash + accent text. Given `href` / Then it is a link. Given 390 vs 1280 / Then the pill wraps in both.
- **NUMBERS:** text ≥13px; contrast ≥4.5:1 (accent on wash; default muted on paper).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0030 — Wikilink
- **Stage:** A · **Pass:** 1 · **Depends:** 0009 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0009.
- **WHY:** DESIGN.md §9 Wikilink (`[[page]]`, popover picker); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A `[[page]]` link primitive renders inline, links to the page, and offers a popover picker; it feeds the backlinks index.
- **SCOPE:** `packages/ui/src/primitives/Wikilink.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Wikilink.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Wikilink({ page, href? })` rendering `tp-wikilink`; 3) unresolved links (no page yet) render as plain text with a create affordance; 4) resolved links navigate and register in `notes_links` (TFV2-0009); 5) render test + Playwright via the editor spec.
- **DONE:** `bun test packages/ui/src/primitives/Wikilink.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Inline link `--tp-accent` text with a subtle underline; `dir="auto"` for the page name. Resolved → navigate; unresolved → `EN: "Create '…'" / HE: "ליצור '…'"` affordance. Popover picker (command) lists matching pages on typing; arrows/Enter/Esc. Backlinks section header `EN: "Linked here" / HE: "מקושר לכאן"`.
- **TESTS:** Given `[[Moving checklist]]` / Then it renders as a link. Given a resolved page / Then clicking navigates and the target's backlinks list it. Given an unresolved page / Then a create affordance shows. Given `lang=he` / Then `dir="auto"` per name.
- **NUMBERS:** contrast ≥4.5:1 (accent on paper 5.78:1 light); target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0031 — Chip
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Chip (`--fixed`/`--flex`/`--done`, word always present); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A status chip primitive (done/fixed/flexible tones, icon + word, never colour-only) exists in the design system.
- **SCOPE:** `packages/ui/src/primitives/Chip.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Chip.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING; `Pill.tsx` exists but is not the Chip); 2) implement `Chip({ tone: "done"|"info"|"caution"|"danger", label, icon? })` rendering `tp-chip`; 3) map tones to `--tp-done`/`--tp-info`/`--tp-caution`/`--tp-danger` + their `-wash`; 4) always render icon + word; 5) render test + Playwright via the editor/calendar spec.
- **DONE:** `bun test packages/ui/src/primitives/Chip.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not signal by colour alone; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Small badge with `--tp-text-xs` label, radius `--tp-radius-sm`, tone wash + tone text. Copy (EN/HE): `EN: "Done" / HE: "בוצע"`; `EN: "Fixed" / HE: "קבוע"`; `EN: "Flexible" / HE: "גמיש"`. Icon always accompanies the word.
- **TESTS:** Given `tone="done"` / Then it renders icon + "Done" in `--tp-done`. Given `tone="caution"` / Then icon + "Flexible". Given `lang=he` / Then Hebrew word + icon. Given forced-colours mode / Then the word remains (no colour-only signal).
- **NUMBERS:** text ≥13px; contrast ≥4.5:1 (done 5.22:1, info 5.13:1, caution 5.05:1, danger 5.26:1 light).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0032 — Button
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Button (primary/secondary/ghost/icon, primary once per screen); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The button primitive's variants, sizes and focus ring are verified against tokens, with the accent reserved for one primary per screen.
- **SCOPE:** `packages/ui/src/primitives/Button.tsx` (+ `packages/ui/src/primitives/Button.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `packages/ui/src/primitives/Button.tsx`; also `apps/web/components/ui/button.tsx` shadcn wrapper — the ticket verifies the design-system primitive); 2) verify `variant: primary|secondary|ghost|icon|danger-ghost` and `size: sm|md`; 3) verify focus ring `--tp-accent` 2px with 2px gap and press/hover motion ≤250ms; 4) render test + Playwright via a screen with one primary.
- **DONE:** `bun test packages/ui/src/primitives/Button.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not use accent on more than one primary per screen; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** primary `--tp-accent`/`--tp-on-accent` (6.08:1 light); secondary `--tp-line-control` outline; ghost transparent; danger-ghost `--tp-danger`. Radius `--tp-radius-md` (10px). Height ≥44px (`--tp-touch`). Press = 1px down 98% scale 120ms; hover fade 120ms. Disabled: reduced opacity + `aria-disabled` + no action. Copy is per-screen (no fixed label).
- **TESTS:** Given `variant=primary` / Then accent background and white label. Given keyboard Tab / Then a 2px accent focus ring shows. Given disabled / Then no click handler fires. Given 390 / Then target ≥44px (tap). Given `lang=he` / Then label direction is correct.
- **NUMBERS:** min height 44px; contrast ≥4.5:1 (primary 6.08:1); target ≥24px (≥44px preferred); motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0033 — Kbd
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Kbd; components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A keyboard-key hint primitive (`Ctrl K`, `⌘ K`, `[]`, `#`, `-`) exists in the design system, mono and LTR-isolated.
- **SCOPE:** `packages/ui/src/primitives/Kbd.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Kbd.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Kbd({ keys })` rendering `tp-kbd` + `tp-num` (mono, LTR isolate); 3) map platform (Ctrl vs ⌘); 4) export; 5) render test + Playwright via the slash menu / command trigger spec.
- **DONE:** `bun test packages/ui/src/primitives/Kbd.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `--tp-font-mono` (`IBM Plex Mono`), `--tp-text-xs`, radius `--tp-radius-sm`, subtle sunken ground `--tp-sunken`. Always LTR (`direction:ltr; unicode-bidi:isolate`) even in Hebrew. Examples: `Ctrl K`, `⌘ K`, `[]`, `#`, `-`, `[[`.
- **TESTS:** Given `keys=["Ctrl","K"]` / Then it renders `Ctrl K` in mono, LTR. Given `lang=he` / Then the kbd stays LTR. Given macOS / Then it renders `⌘ K`. Given `keys=["#"]` / Then `#`.
- **NUMBERS:** text ≥13px; no contrast requirement below 3:1 for decorative hint (but label text beside it must clear 4.5:1).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0034 — Card
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Card (quiet inline block card); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The card primitive (`__head`/`__title`, paper surface, `--tp-shadow-card`) is verified.
- **SCOPE:** `packages/ui/src/primitives/SoftCard.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/SoftCard.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `SoftCard.tsx`; also `apps/web/components/ui/card.tsx`); 2) verify `--tp-paper` surface, `--tp-radius-lg` (14px), `--tp-shadow-card`; 3) verify hover lift (180ms) only when it is a link/button; 4) render test + Playwright via the blocks spec.
- **DONE:** `bun test packages/ui/src/primitives/SoftCard.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not put glass on a card; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Solid `--tp-paper`, `--tp-radius-lg`, `--tp-shadow-card`, head/title using `--tp-ink` and `--tp-ink-muted`. Cards on paper use the `raise` shadow. Interactive cards lift 1px at 180ms and show a focus ring.
- **TESTS:** Given a Card / Then paper surface + card shadow. Given interactive / Then hover lifts and it is keyboard-focusable. Given a block card / Then it is solid, never glass.
- **NUMBERS:** radius 14px (token); contrast ≥4.5:1; motion ≤250ms (180ms lift).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0035 — BlockHandle
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** DESIGN.md §9 BlockHandle (add below + options; buttons, never drag-only); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** Each block exposes a keyboard-reachable handle with "Add a block below" and "Block options" (move/copy/delete), never drag-only.
- **SCOPE:** `apps/web/components/editor/BlockHandle.tsx` (+ `apps/web/components/editor/BlockHandle.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `BlockHandle({ onAdd, onMove, onCopy, onDelete })` rendering two ghost icon buttons; 3) wire to `pages.insertBlock` / `pages.moveBlock` / `pages.duplicateBlock` / `pages.removeBlock` (TFV2-0007); 4) each action offers 5-min Undo; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/editor/BlockHandle.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not make actions drag-only; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Two ghost buttons (`.tp-block__handle`): add (`aria-label` `EN: "Add a block below" / HE: "הוספת בלוק מתחת"`) and options (`EN: "Block options: move, copy, delete" / HE: "אפשרויות בלוק: הזזה, העתקה, מחיקה"`). Hidden under 768 (long-press later). Options open a dropdown-menu with Move up / Move down / Duplicate / Delete (Delete uses `--tp-danger` + confirmation + Undo).
- **TESTS:** Given a block / When hovering/focusing / Then both buttons appear and are keyboard-focusable. Given "Add" / Then a new empty block inserts below and Undo shows. Given "Delete" / Then a confirm appears, then the block removes with Undo. Given 390 / Then the handle is hidden (menu via long-press later).
- **NUMBERS:** target ≥24px; contrast ≥4.5:1; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0036 — SlashMenu
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** DESIGN.md §9 SlashMenu (listbox, arrows/Enter/Esc); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The slash menu (`/` on an empty line) is verified: filter, arrow/Enter/Esc, RTL arrow swap, and insert calls `pages.insertBlock`.
- **SCOPE:** `apps/web/components/editor/SlashMenu.tsx` (+ `apps/web/components/editor/SlashMenu.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `editor/SlashMenu.tsx`); 2) verify listbox semantics (`role=listbox`, `aria-activedescendant`), item set (Task, Time block, Habit, Energy, Nag, Heading, Bullet, Link); 3) verify arrows move, Enter inserts, Esc closes; 4) verify RTL arrow swap; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/editor/SlashMenu.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Glass popover (`.tp-slash-menu.tp-glass`), grouped items. Copy (EN/HE): group `EN: "Tempo blocks" / HE: "בלוקים של Tempo"`, `EN: "Text" / HE: "טקסט"`; items `Task/משימה`, `Time block/בלוק זמן`, `Habit/הרגל`, `Energy check-in/בדיקת אנרגיה`, `Nag/תזכורת`, `Heading/כותרת`, `Bullet list/רשימת נקודות`, `Link to a page/קישור לדף`; hint `EN: "Type to filter · ↑ ↓ to move · Enter to add" / HE: "הקלידו לסינון · ↑ ↓ למעבר · Enter להוספה"`. Arrow direction flips in RTL.
- **TESTS:** Given `/` / Then the menu opens focused. Given typing "ta" / Then only matching items remain. Given ↓ then Enter / Then the highlighted block inserts and the menu closes. Given Esc / Then it closes with focus returned. Given `lang=he` / Then arrows are mirrored.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms (popover 180ms).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0037 — Composer
- **Stage:** A · **Pass:** 1 · **Depends:** 0015 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0015.
- **WHY:** DESIGN.md §9 Composer (textarea + send, send is ink not accent); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The coach message composer (textarea, Enter to send, Shift+Enter newline, ink send button) is verified.
- **SCOPE:** `apps/web/components/coach/Composer.tsx` (+ `apps/web/components/coach/Composer.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING as a component; the panel renders it inline in the coach HTML); 2) implement `Composer({ onSend, disabled? })`; 3) wire send to the coach send path (TFV2-0015); 4) voice button placeholder (`.tp-btn--ghost` mic, disabled until chunk E); 5) render test + Playwright via the coach spec.
- **DONE:** `bun test apps/web/components/coach/Composer.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not colour the send button accent (it is ink); do not enable voice yet; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Textarea `dir="auto"`, `rows=2`, grow with content; send button `--tp-btn--icon` with ink colour (not accent). Placeholder `EN: "Ask, plan, or think out loud" / HE: "לשאול, לתכנן, או לחשוב בקול"`; send `aria-label` `EN: "Send" / HE: "שליחה"`. Hint `EN: "Enter to send · Shift+Enter for a new line" / HE: "Enter לשליחה · Shift+Enter לשורה חדשה"`. Disabled while Thinking.
- **TESTS:** Given Enter / Then it sends and clears. Given Shift+Enter / Then a newline, no send. Given disabled (Thinking) / Then send is blocked. Given empty / Then send does nothing. Given `lang=he` / Then placeholder is Hebrew and `dir="auto"`.
- **NUMBERS:** target ≥24px; contrast ≥4.5:1; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0038 — UndoToast
- **Stage:** A · **Pass:** 1 · **Depends:** 0010 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0010.
- **WHY:** DESIGN.md §9 UndoToast (sonner, 5:00 countdown, Undo); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The Undo toast (title + countdown + Undo, 5-minute window) is verified with keyboard and screen-reader behaviour.
- **SCOPE:** `apps/web/components/you/UndoToast.tsx` (+ `apps/web/components/you/UndoToast.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `you/UndoToast.tsx` and `habits/UndoToast.tsx` — verify the canonical `you/` one); 2) verify it accepts `{ title, sub?, undoMs, onUndo }`; 3) verify 5:00 countdown and `aria-live=polite` region; 4) verify `prefers-reduced-motion` stops the countdown animation; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/you/UndoToast.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not shorten the 5-minute window; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Glass toast (`.tp-toast.tp-glass`), title + optional sub + Undo button + dismiss. Copy (EN/HE): `EN: "Done" / HE: "בוצע"`; `EN: "Undo" / HE: "ביטול"`; `EN: "Dismiss" / HE: "סגירה"`; countdown `EN: "You can undo for 5:00" / HE: "אפשר לבטל למשך 5:00"`. Rises 240ms (`--tp-dur-slow`), exits 160ms. Live region `aria-live=polite`.
- **TESTS:** Given an action / Then a toast with Undo shows and the 5:00 countdown starts. Given Undo / Then `onUndo` fires and the change reverts. Given dismiss / Then it closes. Given reduced motion / Then no countdown animation. Given `lang=he` / Then Hebrew copy, numbers LTR.
- **NUMBERS:** window = 5 minutes (PRD F-131); motion ≤250ms; contrast ≥4.5:1.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0039 — Skeleton
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Skeleton (content >100ms; shimmer stops with reduced motion); components.md §1/§2.18; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A skeleton primitive (`--w40/w60/w80/w100/sm/block` widths, shimmer gated on reduced motion) exists in the design system.
- **SCOPE:** `packages/ui/src/primitives/Skeleton.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Skeleton.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Skeleton({ width?: "w40"|"w60"|"w80"|"w100"|"sm"|"block" })`; 3) shimmer uses opacity only and stops under `prefers-reduced-motion`; 4) export; 5) render test + Playwright via the loading states spec.
- **DONE:** `bun test packages/ui/src/primitives/Skeleton.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not animate transform; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `--tp-sunken` fill on `--tp-paper`, radius `--tp-radius-sm`; shimmer opacity pulse, static under reduced motion. Widths map to the `--w40/w60/w80/w100` classes; a `block` variant is full-width card-shaped. Used only for content that takes >100ms.
- **TESTS:** Given `width="w80"` / Then it renders at 80% width. Given reduced motion / Then no shimmer animation. Given `width="block"` / Then a card-shaped block. Given a list / Then `tp-skel-list` rows render.
- **NUMBERS:** motion ≤250ms (and none under reduced motion); no contrast target (decorative).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0040 — Empty
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §9 Empty (kind copy + next step); PRD §13 copy rules; components.md §1/§2.18; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The web Empty-state primitive (icon + kind title + body + next-step action) is verified.
- **SCOPE:** `packages/ui/src/primitives/Empty.tsx` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Empty.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (mobile `TempoEmptyState.tsx` EXISTS; the web design-system `Empty` is MISSING); 2) implement `Empty({ icon?, title, body, action? })`; 3) no illustration — a line icon on a parchment disc (`--tp-sunken` + hairline + halo) or the shared page drawing; 4) copy is kind and offers a next step; 5) render test + Playwright via the notes/empty spec.
- **DONE:** `bun test packages/ui/src/primitives/Empty.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not shame the user (no "failed"/"overdue"/"must"); do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-state.tp-state--empty` with `__icon`, `__title`, `__body`, `__actions`. Copy example (EN/HE): `EN: "No pages yet. Your first one can be tiny." / HE: "עוד אין דפים. הראשון יכול להיות קטנטן."` + a next-step button. Icon on `--tp-sunken` disc with hairline ring and soft halo.
- **TESTS:** Given an empty list / Then the kind title, body and one next-step action render. Given no `action` / Then no dangling button. Given `lang=he` / Then Hebrew copy. Given a screen reader / Then title is announced.
- **NUMBERS:** contrast ≥4.5:1; text ≥13px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0041 — Glass + Helpers
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** DESIGN.md §5 (glass recipe + fallbacks), §10 (RTL helpers), §9 Helpers; components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The shared Glass mixin/component and the type/utility Helpers (`tp-num/mono/muted/small/eyebrow/sr-only/skip/icon--flip`) exist and fall back to a solid surface when unsupported.
- **SCOPE:** `packages/ui/src/primitives/Glass.tsx` + `packages/ui/src/primitives/helpers.ts` + `packages/ui/src/primitives/index.ts` (+ `packages/ui/src/primitives/Glass.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Glass` applying the §5 recipe with `--tp-glass-solid` fallback for `prefers-reduced-transparency`, no `backdrop-filter`, and `?glass=off`/`data-glass=off`; 3) implement the helper utilities (`tp-num` LTR isolate, `tp-mono`, `tp-muted`, `tp-small`, `tp-eyebrow`, `tp-sr-only`, `tp-skip`, `tp-icon--flip`); 4) export; 5) render test + Playwright via the shell spec.
- **DONE:** `bun test packages/ui/src/primitives/Glass.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not apply glass to non-floating surfaces (paper, cards, blocks, text); do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Glass: `background var(--tp-glass)` (82% light / 86% dark), `backdrop-filter: blur(18px) saturate(150%)`, 1px `--tp-glass-line` border, inset top highlight + `--tp-shadow-float`. Fallback switches to `--tp-glass-solid`. Helpers: `tp-num` = `direction:ltr; unicode-bidi:isolate` + tabular; `tp-mono` = `--tp-font-mono`; `tp-muted`/`tp-small`/`tp-eyebrow` map type tokens; `tp-sr-only` visually hidden; `tp-skip` the skip link; `tp-icon--flip` mirrors chevrons in RTL.
- **TESTS:** Given glass / Then it uses `--tp-glass` and blur. Given `prefers-reduced-transparency` / Then it uses `--tp-glass-solid`. Given `data-glass=off` / Then solid. Given `tp-num` around `"12:30"` in HE / Then it stays LTR. Given `tp-icon--flip` in RTL / Then the icon mirrors.
- **NUMBERS:** blur 18px, saturate 150% (tokens); worst-case glass text contrast ≥4.5:1 (DESIGN.md §6: muted-on-glass 5.13:1 light).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0042 — TaskBlock / TaskRow
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** PRD §4.1 F-05 (tasks as task blocks); DESIGN.md §9 TaskBlock/TaskRow (optimistic tick); components.md §1/§2.2; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The task block renders a list of TaskRows; ticking a row is optimistic, announces the change, and fires `tasks.complete({id})` with a 5-minute Undo.
- **SCOPE:** `apps/web/components/blocks/TaskBlock.tsx` (+ `apps/web/components/blocks/TaskBlock.test.tsx`).
- **MUTATES:** none (calls the existing `tasks.complete`; no schema change).
- **STEPS:** 1) Graphify code-map check (`TaskRow` EXISTS in `packages/ui/src/primitives/TaskRow.tsx`; `TaskBlock` is MISSING); 2) implement `TaskBlock({ tasks })` rendering a `tp-block-task` list of `TaskRow`; 3) tick is optimistic (`aria-checked`, check pop 180ms) and calls `tasks.complete({ id })` with Undo; 4) `- [ ]` markdown stays plain markdown; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/TaskBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not surface JSON; do not break `- [ ]` markdown parity; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Row shows title (`dir="auto"`), duration `EN: "min" / HE: "דק׳"` with `.tp-num`, optional day. Tick button is `role=checkbox aria-checked`, check pops 180ms; done row uses `--tp-done` + word `EN: "Done" / HE: "בוצע"` (never colour-only). Announce new state via the live region.
- **TESTS:** Given a task / When ticked / Then `aria-checked=true` immediately and `tasks.complete` is called with Undo shown. Given `lang=he` / Then duration `דק׳` and RTL. Given a done task / Then struck-through style + "Done". Given 390 and 1280 / Then rows render in both.
- **NUMBERS:** target ≥24px; contrast ≥4.5:1; motion ≤250ms (check 180ms).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0043 — EnergyBlock / Dial
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** DESIGN.md §9 EnergyBlock/Dial (quiet/steady/push, radio + arrows); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The energy check-in block (three-segment toggle: quiet/steady/push, `role=radio` + arrows, RTL arrow swap) is verified.
- **SCOPE:** `apps/web/components/blocks/EnergyBlock.tsx` (+ `apps/web/components/blocks/EnergyBlock.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (`Dial` helper EXISTS at `apps/web/components/coach-controls/dial.ts`; `EnergyBlock` is MISSING); 2) implement `EnergyBlock({ value })` with three `role=radio` options; 3) arrow keys move the selection and swap direction in RTL; 4) announce the chosen word; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/EnergyBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Three `tp-seg__opt` segments, one selected. Copy (EN/HE): `EN: "Quiet" / HE: "שקט"`; `EN: "Steady" / HE: "יציב"`; `EN: "Push" / HE: "דחיפה"`. `role=radio` group, `aria-checked` on the selected, arrows move selection (LTR ↔ RTL). The word always carries meaning.
- **TESTS:** Given value `steady` / Then "Steady" is selected and `aria-checked=true`. Given ← / Then selection moves left (right in RTL). Given `lang=he` / Then words are Hebrew and arrows swapped. Given 390 and 1280 / Then the toggle fits both.
- **NUMBERS:** target ≥24px; contrast ≥4.5:1; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0044 — Backlinks
- **Stage:** A · **Pass:** 1 · **Depends:** 0009 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0009.
- **WHY:** DESIGN.md §9 Backlinks ("Linked here", card list); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "Linked here" section renders a list of linking pages (page + context snippet) from `notes.backlinks`, verified with empty state.
- **SCOPE:** `apps/web/components/blocks/Backlinks.tsx` (+ `apps/web/components/blocks/Backlinks.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `Backlinks({ links })`; 3) render header `EN: "Linked here" / HE: "מקושר לכאן"` + count `.tp-num`; 4) each row shows page title + context snippet (`dir="auto"`); 5) empty → hide or show kind copy `EN: "Nothing links here yet." / HE: "עוד אין קישורים לכאן."`; 6) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/Backlinks.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-backlinks` section with eyebrow header + count; rows `tp-backlink` with `__page` and `__ctx`. Snippet clamps to 2 lines. Count uses `.tp-num`.
- **TESTS:** Given 3 links / Then 3 rows render with page + snippet. Given 0 links / Then the empty copy shows. Given `lang=he` / Then header Hebrew and snippets `dir="auto"`. Given a row click / Then it navigates to that page.
- **NUMBERS:** contrast ≥4.5:1; text ≥13px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0045 — PageMetaBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0006 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0006.
- **WHY:** components.md §2.2 PageMetaBlock (renders nothing; `display:none` + `aria-hidden`); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The page-meta block carries `pageType`/`date`/`tags` metadata but renders nothing and is hidden from assistive tech.
- **SCOPE:** `apps/web/components/blocks/PageMetaBlock.tsx` (+ `apps/web/components/blocks/PageMetaBlock.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `PageMetaBlock({ meta })` that returns an element with `display:none !important` + `aria-hidden="true"` and no text; 3) never leak JSON into the DOM; 4) render test + Playwright assert invisibility via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/PageMetaBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not render metadata text; do not surface JSON; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-block-meta` with `display:none !important` and `aria-hidden="true"`. Holds `{ pageType, date?, tags[] }` in memory for the page head, but paints nothing and announces nothing.
- **TESTS:** Given a page-meta block / Then the DOM node is hidden and `aria-hidden`. Given a screen reader / Then nothing is announced. Given the page head / Then it reads `pageType` from this block (not from the DOM).
- **NUMBERS:** none.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0046 — BrokenBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0006 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0006.
- **WHY:** PRD §4.1 F-03 (broken block draws as a quiet card with Undo); components.md §2.2 BrokenBlock (never shows JSON); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A broken block renders as a quiet card with a kind message and an Undo/revert action, never showing raw JSON.
- **SCOPE:** `apps/web/components/blocks/BrokenBlock.tsx` (+ `apps/web/components/blocks/BrokenBlock.test.tsx`).
- **MUTATES:** none (calls `pages.revertBlock`; no schema change).
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `BrokenBlock({ blockId, canUndo })` rendering `tp-block-broken`; 3) message `EN: "This part has a problem." / HE: "לחלק הזה יש בעיה."` and action `EN: "Restore" / HE: "שחזור"` → `pages.revertBlock` with Undo; 4) never render the raw source/JSON; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/BrokenBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not show JSON or ids; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Quiet `alert`-tone card, icon + word (never colour-only). Action `broken-undo` replaces the card with `EN: "Restored…" / HE: "שוחזר…"`.
- **TESTS:** Given a broken block / Then the kind message renders, no JSON/block id visible. Given Restore / Then `pages.revertBlock` fires with Undo. Given `lang=he` / Then Hebrew message. Given no undo available / Then the action is hidden.
- **NUMBERS:** contrast ≥4.5:1; text ≥13px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0047 — TemplateBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0046 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0046.
- **WHY:** PRD §4.1 F-06 (app proposes the right template, one tap accepts); DESIGN.md §9 TemplateBlock; components.md §2.2; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The template-offer block (icon, name, what-it-adds, Use / Not now) is verified; Use applies the template with a 5-minute Undo.
- **SCOPE:** `apps/web/components/blocks/TemplateBlock.tsx` (+ `apps/web/components/blocks/TemplateBlock.test.tsx`).
- **MUTATES:** none (calls `templates.apply`; no schema change).
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `TemplateBlock({ template, why })` rendering `tp-template-offer`; 3) Use (primary) → `templates.apply` + Undo toast; Not now (ghost) → `templates.dismissOffer`; 4) one primary per screen; 5) render test + Playwright via the new-page spec.
- **DONE:** `bun test apps/web/components/blocks/TemplateBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not use accent on Not now; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Card with icon, title `EN: "Use the Daily template?" / HE: "להשתמש בתבנית היומית?"`, reason, and a bulleted `adds[]` (e.g. Intention / Energy check-in / Top three tasks / End of day → `כוונה / בדיקת אנרגיה / שלוש משימות עיקריות / סוף היום`). Use = one primary; Not now = ghost `EN: "Not now" / HE: "לא עכשיו"`. Dismissed state persists.
- **TESTS:** Given an offer / When Use is tapped / Then `templates.apply` fires and an Undo toast shows. Given Not now / Then the offer dismisses and the page stays. Given `lang=he` / Then Hebrew copy. Given 390 and 1280 / Then the offer card renders in both.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0048 — EventBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** PRD §4.1 F-07 (fixed vs flexible events); DESIGN.md §9 EventBlock (solid "Fixed" / dashed "Flexible"); components.md §2.2; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The event block (time, title, place, fixed/flexible kind with word + edge) is verified.
- **SCOPE:** `apps/web/components/blocks/EventBlock.tsx` (+ `apps/web/components/blocks/EventBlock.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `EventBlock({ event })`; 3) render `__time` (mono LTR), `__title` (`dir="auto"`), `__place`, kind chip (solid edge + "Fixed" / dashed + "Flexible"); 4) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/EventBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-block-event` card. Time `EN: "08:00"` in `.tp-mono` `.tp-num` (LTR). Kind copy `EN: "Fixed" / HE: "קבוע"` (solid edge, `--tp-info`) and `EN: "Flexible" / HE: "גמיש"` (dashed edge, `--tp-caution`). Word + shape, never shape alone.
- **TESTS:** Given a fixed event / Then solid edge + "Fixed". Given a flexible event / Then dashed edge + "Flexible". Given `lang=he` / Then time stays LTR and kind is Hebrew. Given 390 and 1280 / Then the card renders in both.
- **NUMBERS:** contrast ≥4.5:1 (info 5.13:1, caution 5.05:1); text ≥13px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0049 — HabitBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** PRD §4.1 F-10 (habits as blocks, no streak counters); components.md §2.2 HabitBlock (no streak, per-day sr text); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The habit block (name, last-7 days as rings/dots, Log today, no streak counter) is verified.
- **SCOPE:** `apps/web/components/blocks/HabitBlock.tsx` (+ `apps/web/components/blocks/HabitBlock.test.tsx`).
- **MUTATES:** none (calls `habits.log`; no schema change).
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `HabitBlock({ habit })`; 3) render last-7 days with `data-done`/`data-today` and per-day sr text `EN: "logged" / HE: "נרשם"` / `EN: "not logged" / HE: "לא נרשם"`; 4) Log today → `habits.log({ habitId, date })`; 5) NO streak counter; 6) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/HabitBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add a streak counter; do not shame missed days; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-block-habit` card with `__log` toggle (Log today / Logged today). Missed day = empty ring (no "broken streak"). Per-day dot carries sr text. Copy `EN: "Log today" / HE: "לרשום להיום"`; `EN: "Logged today" / HE: "נרשם היום"`.
- **TESTS:** Given a habit / Then 7 day-dots render with sr text each. Given Log today / Then `habits.log` fires and today's dot fills with "Logged today". Given `lang=he` / Then Hebrew. Given a missed day / Then an empty ring, no counter or shame word.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0050 — NagBlock
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** PRD §4.6 F-60 (nags in the user's own words; no stock copy, no emoji); components.md §2.2 NagBlock; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The nag block (user's own phrase, Now / Snooze / Not today choices) is verified with no emoji or stock copy.
- **SCOPE:** `apps/web/components/blocks/NagBlock.tsx` (+ `apps/web/components/blocks/NagBlock.test.tsx`).
- **MUTATES:** none (calls `nags.respond`; no schema change).
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `NagBlock({ nag })`; 3) render the user's phrase (`dir="auto"`) with origin, choices Now / Snooze / Not today → `nags.respond`; 4) no icon, no emoji, no stock copy; 5) render test + Playwright via the editor spec.
- **DONE:** `bun test apps/web/components/blocks/NagBlock.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not use emoji or stock copy; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-block-nag` card, `__label` + `__phrase` (the user's own words, `dir="auto"`), `__meta` (about/at), `__actions` Now / Snooze / Not today (`nag` + `data-choice` → `nags.respond`). Copy (EN/HE): `EN: "Now" / HE: "עכשיו"`; `EN: "Snooze" / HE: "נדנוד"`; `EN: "Not today" / HE: "לא היום"`.
- **TESTS:** Given a nag / Then the user's phrase renders verbatim, no emoji. Given Now / Then `nags.respond` fires. Given Not today / Then status updates without shame. Given `lang=he` / Then choices Hebrew, phrase `dir="auto"`.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** nag delivery channel beyond in-app (REWRITE-PLAN-v2 §4 conflict 11; UNKNOWN — Amit; chunk B).

### TFV2-0051 — NextUpCard
- **Stage:** A · **Pass:** 1 · **Depends:** 0027 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0027.
- **WHY:** DESIGN.md §9 NextUpCard (the one primary); components.md §1; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "Next up" card (one task + why, Start / Not now / Make it smaller) is verified.
- **SCOPE:** `apps/web/components/today/NextUpCard.tsx` (+ `apps/web/components/today/NextUpCard.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (EXISTS: `today/NextUpCard.tsx`); 2) verify it renders one task with the reason (why) and three actions; 3) Start is the one primary; 4) render test + Playwright via the today spec (chunk 2 exercises the screen; here assert the card).
- **DONE:** `bun test apps/web/components/today/NextUpCard.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-nextup` card with task title (`dir="auto"`), `why` line, and actions Start (primary) / Not now (ghost) / Make it smaller (ghost). Copy (EN/HE): `EN: "Next up" / HE: "הבא בתור"`; `EN: "Start" / HE: "להתחיל"`; `EN: "Not now" / HE: "לא עכשיו"`; `EN: "Make it smaller" / HE: "לחלק לקטן"`.
- **TESTS:** Given a task / Then title + why render. Given Start / Then the one primary action fires. Given Not now / Then it dismisses without shame. Given 390 and 1280 / Then the card renders in both. Given `lang=he` / Then Hebrew.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0052 — AuthCard
- **Stage:** A · **Pass:** 1 · **Depends:** none · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** first.
- **WHY:** components.md §2.15 AuthCard (bare layout, no shell); DESIGN.md §9; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The bare auth card (brand, title, lede, form slot, foot) exists with no app shell.
- **SCOPE:** `apps/web/components/auth/AuthCard.tsx` (+ `apps/web/components/auth/AuthCard.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `AuthCard({ title, lede, children, foot? })` rendering `tp-auth-card` with brand, title, lede; 3) bare layout, no shell; 4) render test + Playwright via the sign-in/sign-up specs.
- **DONE:** `bun test apps/web/components/auth/AuthCard.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not render the app shell; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-auth` wrapper centred on `--tp-ground`; `tp-auth-card` is `--tp-paper` with `--tp-radius-xl` (20px) and `--tp-shadow-card`. Brand `Tempo`, title `--tp-text-2xl`, lede `--tp-ink-muted`. Foot holds the language switch.
- **TESTS:** Given title/lede / Then both render in the card. Given no shell / Then no rail/topbar renders. Given 390 and 1280 / Then the card centres in both. Given `lang=he` / Then title/lede Hebrew, RTL.
- **NUMBERS:** contrast ≥4.5:1; radius 20px (token); motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0053 — EmailField
- **Stage:** A · **Pass:** 1 · **Depends:** 0052 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0052.
- **WHY:** components.md §2.15 EmailField (`type=email dir=ltr`); DESIGN.md §2.8; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** An email field (label, help, error, `autocomplete=email`, `dir="ltr"`, inline error + `aria-invalid`) exists.
- **SCOPE:** `apps/web/components/auth/EmailField.tsx` (+ `apps/web/components/auth/EmailField.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `EmailField({ id, label, help, error? })`; 3) validate against a Zod email schema shared with the backend; 4) `aria-describedby`, `aria-invalid`, inline error with icon; 5) render test + Playwright via the sign-in/sign-up specs.
- **DONE:** `bun test apps/web/components/auth/EmailField.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-field` + `tp-input[type=email][autocomplete=email][inputmode=email][dir=ltr][spellcheck=false]`. Label `EN: "Email" / HE: "מייל"`; help `EN: "Use the email you asked to join with." / HE: "המייל שאיתו ביקשת להצטרף."`; error `EN: "Enter your email, like name@example.com" / HE: "כתבו את המייל שלכם, למשל name@example.com"`; placeholder `name@example.com`. Invalid → `aria-invalid="true"` + visible error.
- **TESTS:** Given empty submit / Then error shows and `aria-invalid`. Given `"maya@"` / Then error. Given valid email / Then no error. Given `lang=he` / Then the input stays `dir="ltr"` while the label is Hebrew.
- **NUMBERS:** contrast ≥4.5:1; input outline ≥3:1 (`--tp-line-control` 3.89:1 light); target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0054 — GuestButton
- **Stage:** A · **Pass:** 1 · **Depends:** 0052 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0052.
- **WHY:** components.md §2.15 GuestButton (secondary, never accent; preview only); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "Continue as guest" button is a secondary block button shown only on preview, never live.
- **SCOPE:** `apps/web/components/auth/GuestButton.tsx` (+ `apps/web/components/auth/GuestButton.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `GuestButton({ onContinue })`; 3) secondary block (`tp-btn--secondary.tp-btn--block`), label `EN: "Continue as guest" / HE: "המשך כאורח/ת"` + help `EN: "Try it without an account. Guest notes stay on this preview." / HE: "לנסות בלי חשבון. פתקי אורח נשארים בגרסת התצוגה הזו."`; 4) render only when the preview flag is set; 5) render test + Playwright via the sign-in spec.
- **DONE:** `bun test apps/web/components/auth/GuestButton.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not use accent; do not render on live; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Secondary (never accent), full-width block. Preview-only: gated by a `NEXT_PUBLIC_` preview flag (name only, no value here).
- **TESTS:** Given preview / Then the button renders. Given live / Then it does not render. Given click / Then `auth.continueAsGuest` is called. Given `lang=he` / Then Hebrew label.
- **NUMBERS:** target ≥24px; contrast ≥4.5:1.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0055 — DividerText
- **Stage:** A · **Pass:** 1 · **Depends:** 0052 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0052.
- **WHY:** components.md §2.15 DividerText ("or"); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** An "or" separator with hairline dividers and an accessible label exists.
- **SCOPE:** `apps/web/components/auth/DividerText.tsx` (+ `apps/web/components/auth/DividerText.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `DividerText({ label? })`; 3) default label `EN: "or" / HE: "או"`; 4) hairline dividers `--tp-line` either side; 5) render test + Playwright via the sign-in spec.
- **DONE:** `bun test apps/web/components/auth/DividerText.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-divider-text` with `--tp-line` hairlines and a `--tp-muted` `--tp-xs` label; decorative lines `aria-hidden`. The word carries the meaning.
- **TESTS:** Given default / Then "or" renders between two hairlines. Given `lang=he` / Then "או". Given a screen reader / Then the label is announced once.
- **NUMBERS:** contrast ≥4.5:1 for the label.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0056 — StatusPanel
- **Stage:** A · **Pass:** 1 · **Depends:** 0052 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0052.
- **WHY:** components.md §2.15 StatusPanel (link sent / approval pending; no illustration); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** A status panel (tone, icon, title, body, meta, actions: resend/back) exists with no illustration.
- **SCOPE:** `apps/web/components/auth/StatusPanel.tsx` (+ `apps/web/components/auth/StatusPanel.test.tsx`).
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map check (MISSING); 2) implement `StatusPanel({ tone, title, body, meta?, actions? })`; 3) map tone to `--tp-info`/`--tp-done` wash; 4) no illustration (icon only); 5) render test + Playwright via the link-sent/approval-pending specs.
- **DONE:** `bun test apps/web/components/auth/StatusPanel.test.tsx` → all pass.
- **EVIDENCE:** paste the test pass count.
- **DO NOT:** do not add an illustration; do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `tp-status-panel[data-tone]` with `__icon`, `__title`, `__body`, `__meta`, `__actions`. Tones: info (link sent), done/caution (pending). Icon + word always. Title `--tp-text-xl`, body `--tp-ink-muted`.
- **TESTS:** Given tone=info + title/body / Then icon + title + body render, no illustration. Given actions / Then Resend/Back render. Given `lang=he` / Then Hebrew + RTL. Given 390 and 1280 / Then it centres in both.
- **NUMBERS:** contrast ≥4.5:1; text ≥13px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0057 — Sign-in screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0012, 0052, 0053, 0054, 0055 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0012, TFV2-0052, TFV2-0053, TFV2-0054, TFV2-0055.
- **WHY:** PRD §4.1 F-01 (magic link only); `screens/web/sign-in.html`; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The sign-in screen (email → magic link, sending/error/offline states, preview-only guest) matches the v3 spec in EN and HE at 390 and 1280.
- **SCOPE:** `apps/web/app/sign-in/page.tsx` + `apps/web/components/auth/SignInForm.tsx` (+ `tests/e2e/screens/sign-in.spec.ts`).
- **MUTATES:** none (screen + form; calls `auth.sendMagicLink`).
- **STEPS:** 1) Graphify code-map check (EXISTS: `sign-in/page.tsx` + `SignInForm.tsx`; route is `/sign-in`, the v3 target is `(auth)/sign-in` — keep the existing route); 2) verify one email field, "Send magic link" primary, error summary, sending/offline states; 3) verify `getPostAuthDestination` returns `/today` for `/dashboard` and self-redirects; 4) add the Playwright spec below asserting each state at 390 and 1280, EN and HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/sign-in.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add passkeys/password; do not touch `convex/auth*`, `.github/**`, `.env` or workflows; do not restyle with new colours.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Auth layout (no shell). One `EmailField`; primary `EN: "Send magic link" / HE: "שליחת קישור כניסה"`; note `EN: "The link works for 30 minutes." / HE: "הקישור עובד במשך 30 דקות."`. States: default, loading (`EN: "Sending…" / HE: "שולחים…"`, button disabled + `aria-busy`), empty (error summary), error (`EN: "Couldn't send the link. Nothing was lost." / HE: "לא הצלחנו לשלוח את הקישור. שום דבר לא אבד."`), offline (banner + disabled button with reason), invalid (inline email error), plus preview-only DividerText + GuestButton. On success → `/link-sent?email=&next=`.
- **TESTS:** Given 390 / When empty submit / Then the error summary focuses and shows the email error. Given valid email / When submit / Then "Sending…" then navigation to `/link-sent`. Given `?state=error` / Then the error alert shows and the email stays in the field. Given offline / Then the banner shows and the button is disabled. Given `lang=he` / Then all copy Hebrew, `dir=rtl`, input `dir=ltr`. Repeat at 1280. Assert no passkey/password field.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** route group `(auth)/sign-in` vs existing `/sign-in` (UNKNOWN — Amit).

### TFV2-0058 — Sign-up screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0012, 0052, 0053, 0056 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0012, TFV2-0052, TFV2-0053, TFV2-0056.
- **WHY:** PRD §4.1 F-01a (approval-gated sign-up); `screens/web/sign-up.html`; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "Ask to join" screen (email + human check → pending request) matches the v3 spec in EN/HE at 390/1280.
- **SCOPE:** `apps/web/app/sign-up/page.tsx` + `apps/web/components/auth/SignUpForm.tsx` (+ `tests/e2e/screens/sign-up.spec.ts`).
- **MUTATES:** none (screen + form; calls `access.request`).
- **STEPS:** 1) Graphify code-map check (EXISTS: `sign-up/page.tsx` + `SignUpForm.tsx`); 2) verify email field + human check (Turnstile placeholder) + "Ask to join" primary; 3) verify same-answer-on-already-listed email (never reveal existence); 4) add the Playwright spec below asserting each state at 390/1280, EN/HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/sign-up.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not reveal whether an email exists; do not touch `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Auth layout. EmailField (help `EN: "We only use it to let you in. No newsletters." / HE: "נשתמש בו רק כדי להכניס אותך. בלי ניוזלטרים."`); human check label `EN: "Quick check that you're a person" / HE: "בדיקה קצרה שאת/ה אדם"`; primary `EN: "Ask to join" / HE: "בקשה להצטרף"`; note `EN: "You'll get one email when you're in." / HE: "תקבלו מייל אחד כשתיכנסו."`. States: default, sending, invalid (email + check errors), error (`EN: "Couldn't send your request. Nothing was lost." / HE: "לא הצלחנו לשלוח את הבקשה. שום דבר לא אבד."`), offline. Success → `/approval-pending?email=`.
- **TESTS:** Given 390 / When submit without the check / Then the check error shows in the summary. Given valid email + check / When submit / Then "Sending…" then `/approval-pending`. Given `lang=he` / Then Hebrew + RTL. Given error / Then the typed email is kept. Repeat at 1280.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** sign-up policy (cap vs unlimited, approval order/location — UNKNOWN, Amit; REWRITE-PLAN-v2 §4 conflict 4).

### TFV2-0059 — Link-sent screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0056, 0057 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0056, TFV2-0057.
- **WHY:** `screens/web/sign-in.html` @flow (link-sent); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "link sent" status screen (resend + back, email shown, 30-minute note) exists in EN/HE at 390/1280.
- **SCOPE:** `apps/web/app/(auth)/link-sent/page.tsx` (+ `tests/e2e/screens/link-sent.spec.ts`).
- **MUTATES:** none (screen).
- **STEPS:** 1) Graphify code-map check (MISSING — no `link-sent` route exists); 2) build the screen on `StatusPanel`; 3) show the email, a 30-minute note, Resend (→ `auth.sendMagicLink`) and Back (→ `/sign-in`); 4) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/link-sent.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not reveal whether the email has access; do not touch `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Auth layout + StatusPanel (tone info). Copy (EN/HE): title `EN: "Check your email" / HE: "בדקו את המייל"`; body `EN: "We sent a sign-in link to {email}. It works for 30 minutes." / HE: "שלחנו קישור כניסה אל {email}. הוא עובד 30 דקות."`; meta `EN: "Didn't get it? Check spam, or resend." / HE: "לא קיבלתם? בדקו ספאם, או שלחו שוב."`; actions Resend `EN: "Resend link" / HE: "שליחה חוזרת"` and Back `EN: "Back to sign in" / HE: "חזרה לכניסה"`. Email shown LTR (`tp-num`).
- **TESTS:** Given `?email=` / Then the email shows and the 30-minute note. Given Resend / Then `auth.sendMagicLink` fires. Given Back / Then it returns to `/sign-in`. Given `lang=he` / Then Hebrew + RTL, email LTR. At 390 and 1280.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0060 — Approval-pending screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0056, 0058 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0056, TFV2-0058.
- **WHY:** PRD §4.1 F-01a; `screens/web/sign-up.html` @flow (approval-pending); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The "You're on the list" status screen exists in EN/HE at 390/1280, without revealing existence or sending email before approval.
- **SCOPE:** `apps/web/app/(auth)/approval-pending/page.tsx` (+ `tests/e2e/screens/approval-pending.spec.ts`).
- **MUTATES:** none (screen).
- **STEPS:** 1) Graphify code-map check (MISSING); 2) build the screen on `StatusPanel`; 3) show the email and a "we'll write when you're in" note; 4) no email is sent to the person until Amit approves; 5) add the Playwright spec below.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/approval-pending.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not send email before approval; do not reveal list membership; do not touch `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Auth layout + StatusPanel (tone done). Copy (EN/HE): title `EN: "You're on the list" / HE: "אתה ברשימה"`; body `EN: "We let people in a few at a time. We'll email {email} when you're in." / HE: "אנחנו מכניסים אנשים בהדרגה. נשלח מייל אל {email} כשתיכנס."`; meta `EN: "No email has been sent yet." / HE: "עדיין לא נשלח מייל."`; action Back `EN: "Back to sign in" / HE: "חזרה לכניסה"`.
- **TESTS:** Given `?email=` / Then the email and note render. Given Back / Then `/sign-in`. Given `lang=he` / Then Hebrew + RTL. At 390 and 1280. Assert no sign-in link is sent (the screen only displays).
- **NUMBERS:** contrast ≥4.5:1; target ≥24px.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** where Amit approves (admin screen vs Convex dashboard vs email link) — UNKNOWN, Amit (PRD F-01a).

### TFV2-0061 — Onboarding screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0020 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0020.
- **WHY:** PRD §4.7 (language first); `screens/web/onboarding.html`; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The 5-step onboarding (language/font, name, dial, brain dump, privacy) is verified in EN/HE at 390/1280 with resume and save states.
- **SCOPE:** `apps/web/components/onboarding/OnboardingFlow.tsx` + `apps/web/app/(auth)/onboarding/page.tsx` (+ `tests/e2e/wiring/templates-onboarding.spec.ts`).
- **MUTATES:** none (calls `profiles.*`; no schema change).
- **STEPS:** 1) Graphify code-map check (EXISTS: `onboarding/OnboardingFlow.tsx`, `onboarding/NameStep.tsx`, `OnboardingFlow.test.tsx`); 2) verify the 5 steps, per-step save, "Step n of 5", Back/Skip, and Finish → `/today`; 3) verify language choice flips RTL/LTR at once; 4) refresh the Playwright spec below to assert each state at 390/1280, EN/HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/wiring/templates-onboarding.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours; do not touch `convex/**`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Auth layout; progress `EN: "Step {n} of 5" / HE: "שלב {n} מתוך 5"`. Step 1 language/font, Step 2 name (optional), Step 3 dial 0–10 (quiet/steady/push, starts 4), Step 4 brain dump (optional), Step 5 privacy + analytics (default Off). Primary `EN: "Continue" / HE: "המשך"`; final `EN: "Start using Tempo" / HE: "להתחיל להשתמש ב-Tempo"`. Saving `EN: "Saving…" / HE: "שומרים…"`; error `EN: "Couldn't save this step. What you entered is still here." / HE: "לא הצלחנו לשמור את השלב הזה. מה שכתבת עדיין כאן."`; offline keeps choices.
- **TESTS:** Given step 1 / When Hebrew chosen / Then `dir=rtl` at once and copy flips. Given step 3 / Then the dial shows a number and word. Given Finish / Then it navigates to `/today`. Given refresh mid-flow / Then it resumes on the saved step. Given error / Then the entered text stays. At 390 and 1280, EN and HE.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms; dial words: quiet 0–3, steady 4–7, push 8–10.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0062 — Page-editor screen (`notes/[id]`)
- **Stage:** A · **Pass:** 1 · **Depends:** 0021, 0027, 0035, 0036, 0044 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0021, TFV2-0027, TFV2-0035, TFV2-0036, TFV2-0044.
- **WHY:** PRD §4.1 F-02/F-03 (markdown editor, blocks drawn as elements); DESIGN.md §8/§9 (TempoShell layout, PageEditor); `screens/web/page-editor.html`; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The full page-editor screen (rail, topbar, paper editor, slash menu, backlinks, coach button, states) is verified end-to-end in EN/HE at 390/1280.
- **SCOPE:** `apps/web/app/(tempo)/notes/[id]/page.tsx` + `apps/web/components/notes/PageEditorView.tsx` (+ `tests/e2e/screens/notes-save.spec.ts`).
- **MUTATES:** none (screen wiring; calls `notes.save`, `notes.backlinks`, `tasks.complete`).
- **STEPS:** 1) Graphify code-map check (EXISTS: `notes/[id]/page.tsx` + `PageEditorView.tsx`); 2) verify the screen composes TempoShell + Topbar + PageEditor + Backlinks + CoachButton + TabBar; 3) verify every state (default/empty/loading/error/offline) via `?state=`; 4) refresh the Playwright spec below to assert each state at 390/1280, EN/HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/notes-save.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not surface JSON; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `@route apps/web/app/(tempo)/notes/[id]/page.tsx`, `@layout TempoShell`. Data: `page = notes.get({ id })`, `backlinks = notes.backlinks({ pageId })`. States: default (editor + blocks), empty (`EN: "This page is empty. Just start writing…"` + template CTA), loading (skeleton rows), error (`EN: "Couldn't open this page. Your data is safe."` + Retry), offline (banner + keep editing). Backlinks "Linked here". Coach button bottom-right (Ctrl J).
- **TESTS:** Given a page / When a block is edited / Then "Saved" shows and `notes.save` is called. Given `/` / Then the slash menu opens. Given `[[page]]` / Then a Wikilink renders and backlinks update. Given `?state=error` / Then the error state with Retry. Given `?state=empty` / Then the empty state. Given offline / Then the banner and editing still works. At 390 and 1280, EN and HE. Assert no JSON visible.
- **NUMBERS:** contrast ≥4.5:1; paper max 760px; text min 13px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** block-model authority (UNKNOWN — Amit).

### TFV2-0063 — Notes list screen
- **Stage:** A · **Pass:** 1 · **Depends:** 0021, 0022 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0021, TFV2-0022.
- **WHY:** PRD §4.1 (notes/pages list); `screens/web/notes.html`; REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The Notes screen (folder tree + paginated page list, search/sort, pinned, states) is verified in EN/HE at 390/1280.
- **SCOPE:** `apps/web/app/(tempo)/notes/page.tsx` + `apps/web/components/notes/NotesScreen.tsx` (+ `tests/e2e/screens/notes.spec.ts`).
- **MUTATES:** none (screen wiring; calls `pages.tree`, `pages.list`).
- **STEPS:** 1) Graphify code-map check (EXISTS: `notes/page.tsx`, `notes/NotesScreen.tsx`, `notes-pages/NotesList.tsx`); 2) verify folder filter, search, sort (recent/title), pinned section, count status; 3) verify empty/loading/error/offline states; 4) refresh the Playwright spec below at 390/1280, EN/HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/notes.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not add colours; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `@route apps/web/app/(tempo)/notes/page.tsx`, `@layout TempoShell`. Header title `EN: "Notes" / HE: "פתקים"` + New page primary. Folder tree (`All pages`, folders), list rows (icon, title `dir="auto"`, edited time, folder, tags), pinned first. Status `EN: "Showing {n} pages" / HE: "מוצגים {n} דפים"`. Empty `EN: "No pages yet. Your first one can be tiny." / HE: "עוד אין דפים. הראשון יכול להיות קטנטן."` + template CTA. Error `EN: "Couldn't load your pages." / HE: "לא הצלחנו לטעון את הדפים."` + Retry.
- **TESTS:** Given a folder pick / Then the list narrows and the count updates. Given search / Then rows filter. Given sort=title / Then A–Z (Hebrew too). Given no pages / Then the empty state. Given `?state=error` / Then error + Retry. At 390 and 1280, EN and HE.
- **NUMBERS:** row min height 56px; contrast ≥4.5:1; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0064 — New-page screen + States (empty/loading/error/offline/switch)
- **Stage:** A · **Pass:** 1 · **Depends:** 0047, 0062 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0047, TFV2-0062.
- **WHY:** PRD §4.1 F-06 (propose template, one tap); `screens/web/new-page.html`; components.md §4 (state switch contract); REWRITE-PLAN-v2 §6 chunk 1.
- **GOAL:** The new-page screen (one proposed template, full picker, plain-note, make-a-template) renders with the full state contract (default/empty/loading/error/offline) in EN/HE at 390/1280.
- **SCOPE:** `apps/web/app/(tempo)/notes/new/page.tsx` (+ `tests/e2e/screens/new-page.spec.ts`).
- **MUTATES:** none (screen wiring; calls `templates.suggest`, `templates.list`, `templates.apply`, `pages.create`, `templates.createFromPage`).
- **STEPS:** 1) Graphify code-map check (MISSING — no `notes/new` route); 2) build the screen composing TempoShell + PageEditor (empty) + TemplateBlock (offer) + TemplatePicker + "Start a plain note" + "Make this page a template"; 3) implement the `?state=` StateSwitch contract from components.md §4 (default/empty/loading/error/offline); 4) add the Playwright spec below at 390/1280, EN/HE.
- **DONE:** `CI=1 bunx playwright test tests/e2e/screens/new-page.spec.ts --reporter=line` → all pass.
- **EVIDENCE:** paste the Playwright pass count.
- **DO NOT:** do not surface JSON; do not touch `convex/schema.ts`, `convex/auth*`, `.github/**`, `.env` or workflows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `@route apps/web/app/(tempo)/notes/new/page.tsx`, `@layout TempoShell`. Offer `EN: "Use the Daily template?" / HE: "להשתמש בתבנית היומית?"` + adds + Use (primary) / Not now. Picker `EN: "Or pick another" / HE: "או לבחור תבנית אחרת"` (Daily/Weekly/Project/own/Plain note). Buttons `EN: "Use this one" / HE: "להשתמש בזו"`, `EN: "Start a plain note" / HE: "להתחיל פתק פשוט"`, `EN: "Make this page a template" / HE: "להפוך את הדף הזה לתבנית"`. States via `?state=`: empty (no own templates — built-ins + hint), loading (skeleton), error (`EN: "Couldn't load templates. Your data is safe." / HE: "לא הצלחנו לטעון את התבניות. המידע שלך שמור."` + Retry), offline (write works, templates load later).
- **TESTS:** Given `?state=empty` / Then built-ins show plus the kind hint. Given Use / Then `templates.apply` + Undo toast. Given Not now / Then the offer dismisses, picker stays. Given plain note / Then `pages.create({ templateId:null })` then `/notes/[id]`. Given `?state=error` / Then error + Retry. Given `?state=loading` / Then skeletons. Given `lang=he` / Then RTL. At 390 and 1280.
- **NUMBERS:** contrast ≥4.5:1; target ≥24px; motion ≤250ms.
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

