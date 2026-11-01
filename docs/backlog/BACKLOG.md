# Tempo Flow — Loop Backlog (next batches only)

Updated 1 Nov 2026. This file holds only the next loop batches (file 12 §2.5 ladder: 3 → 5 → 15 → 10).
The full 550-ticket backlog stays local with the factory and is not committed.
Every 5 loops the remaining tickets are re-checked against the code before the next batch opens.

## Rules for every ticket here
- Runtime is bun 1.3.9; the unit runner is `bun test` (root `test` script).
- No ticket here touches a protected path (`convex/schema.ts`, `convex/auth*`, `.github/**`, `.env`).
- No config work while Amit's config pause stands (set 1 Nov; lifted only by Amit). Archive, never delete.
- Every ticket is filed with all 11 fields from `AGENTS.md` (FOR, WHEN, WHY, GOAL, SCOPE, MUTATES, STEPS, DONE, EVIDENCE, DO NOT, REPORT), at least one test in EVIDENCE, and its numbers with a source. The summaries below carry the core fields; the issue adds the rest.

## Staleness finding (1 Nov code check)
The generated backlog was written from the docs, not the code. Much of it is already built on `integration`:
| Generated ticket | Status in code |
|---|---|
| TM-0001 DeepInfra seam | Done — `convex/lib/ai_router.ts` (tracked #412, #1333) |
| TM-0086 context-length guard | Done — `ai_router.ts` handles `context_length_exceeded` |
| TM-0048 panic button | Done — `coach.pressPanic` / `CoachControls.tsx` |
| TM-0101/0102 block parser + schemas | Done — `@tempo/utils` (`convex/lib/blocks.ts` re-export) |
| TM-0024 entitlement helper | Exists — `convex/lib/entitlements.ts` (near #1340) |
| TM-0008 soft delete | Exists — `convex/lib/softDelete.ts` |
| TM-0037 coach prompt | Exists — `convex/lib/coachPrompt.ts` |
| TM-0051–0100 chat tickets | Overlap TEMPO-KA / KB / N2 issues; re-map before use |
Memory-by-meaning tickets stay out (issue #1112 is excluded). Config tickets TM-0007, TM-0021, TM-0022, TM-0029 stay out.
Protected tickets (TM-0005, TM-0006, TM-0009–TM-0015) are held for Amit.

---

## Loop 1 (3 tickets, verified absent from code)

### TM-0032 — Bounded query helper (row and byte caps)
- Why: TRD §7.6 "Bounded queries"; no shared pagination or byte-cap helper exists (`.paginate(` is unused in `convex/`).
- SCOPE: `convex/lib/`
- MUTATES: `convex/lib/bounded.ts`, `convex/lib/bounded.test.ts`. No call sites changed in this ticket.
- Steps:
  1. Export `clampPageSize(n, {min:1, max:100, default:25})`.
  2. Export `readBudget({maxBytes})` that callers feed each document's approximate size (`JSON.stringify` length) as they iterate, stopping before the running total passes `maxBytes` (default 4 MiB) and returning a continuation cursor.
  3. Export `byteCap(text, maxBytes)` that truncates on a UTF-8 code-point boundary (never splits a Hebrew or emoji character) and reports `truncated: boolean`.
  4. Tests: clamp below/above/NaN; readBudget stops at the budget with 1 MiB fixtures; byteCap on ASCII, Hebrew, emoji, exact-boundary.
- DONE: `bun test convex/lib/bounded.test.ts` exits 0 with ≥8 cases.
- EVIDENCE: `bounded.ts`, `bounded.test.ts`, one TRD §7.6 reference in the PR body.
- Numbers: Convex transaction limits — 16 MiB data read / 32,000 documents scanned; document size 1 MiB (docs.convex.dev/production/state/limits); page max 100 bounds the scan count; the 4 MiB `readBudget` bounds bytes read, since 100 docs × 1 MiB could exceed 16 MiB.
- Size: ~1.5 h

### TM-0050 — Mock language model for deterministic coach tests
- Why: include.md §7.8 — tests make no real model calls. No shared mock exists today.
- SCOPE: `convex/lib/`
- MUTATES: `convex/lib/mockModel.ts`, `convex/lib/mockModel.test.ts`.
- Steps:
  1. Export `createMockModel(script)` returning canned completions in order and recording each call (messages, model id).
  2. Export `installFetchGuard()` that makes any real `fetch` to a model host throw inside tests.
  3. Tests: scripted replies return in order; call log is recorded; a real fetch under the guard throws.
- DONE: `bun test convex/lib/mockModel.test.ts` exits 0.
- EVIDENCE: `mockModel.ts`, `mockModel.test.ts`, `ai_router.test.ts` unchanged and still green.
- Numbers: 0 network calls in unit tests (include.md §7.8).
- Size: ~1 h

### TM-0049 — Anti-shaming copy check for coach output
- Why: PRD tone rule "never shame"; there is no shared shame-word check (only local copy in `nags.ts` and `energyRecommendations.ts`).
- SCOPE: `convex/lib/`
- MUTATES: `convex/lib/shameWords.ts`, `convex/lib/shameWords.test.ts`.
- Steps:
  1. Export `SHAME_PATTERNS` (e.g. "you failed", "lazy", "should have", "again?!") and `findShame(text)` returning matched pattern ids.
  2. Test every string in `coachPrompt.ts` fixed copy and the nag phrase defaults returns no match.
- DONE: `bun test convex/lib/shameWords.test.ts` exits 0.
- EVIDENCE: `shameWords.ts`, `shameWords.test.ts`, `coachPrompt.test.ts` still green.
- Numbers: 0 matches across fixed coach and nag copy (PRD tone rule).
- Size: ~1.5 h

---

## Loop 2 (opens after Loop 1 merges; only 1 verified so far)

### TM-0075 — Proposal confidence scoring helper (pure, no wiring)
- Why: first step toward a confidence on every proposal (PRD proposal rules). This ticket adds only the scoring helper; carrying it on `CoachProposal` / `readProposal` is a later ticket.
- Context: PRD proposal rules; no `confidence` field or helper exists in `convex/` or `apps/web`.
- SCOPE: `convex/lib/`
- MUTATES: `convex/lib/confidence.ts`, `convex/lib/confidence.test.ts` (pure scoring; storing it would need `convex/schema.ts` and is held for Amit).
- Steps: `scoreProposal({fieldsFilled, fieldsRequired, ambiguousDates})` = `clamp01(min(fieldsFilled, fieldsRequired) / fieldsRequired − 0.2 × ambiguousDates)`; `fieldsRequired == 0` → 1; negative inputs throw. Band `low < 0.6 ≤ medium < 0.85 ≤ high`. Examples: (5,5,0)=1.0 high; (4,5,0)=0.8 medium; (5,5,1)=0.8 medium; (3,5,0)=0.6 medium; (2,5,0)=0.4 low; (6,5,0)=1.0.
- DONE: `bun test convex/lib/confidence.test.ts` exits 0 with band-edge cases (0.59, 0.6, 0.849, 0.85), every example above, and the zero/negative/over-full rules.
- EVIDENCE: `confidence.ts`, `confidence.test.ts`, `proposalView.test.ts` still green.
- Numbers: band edges 0.6 / 0.85 are product choices from PRD proposal rules — mark for Amit to confirm.
- Size: ~1.5 h

The other 4 Loop 2 slots are filled only after the staleness re-check maps the chat tickets (TM-0051–0100) to existing TEMPO-KA / KB / N2 issues.


---

## Rewrite — Chunk 1 (MVP · Core), tickets TRW-1001 … TRW-1064

Added 1 Nov 2026 per `docs/backlog/REWRITE-PLAN.md`. All 64 tickets, in dependency order.
Format per ticket: WHY / SCOPE / MUTATES / STEPS / DONE / EVIDENCE / Numbers / Pass + Depends + Size.
STEPS step 1 is always the Graphify code-map check (the unit may already exist on `integration` — then
verify and add the missing test, don't rebuild). Folds in open factory issues #1340, #1342, #1348,
#1349, #1350, #743, #744.

### TRW-1001 — Approval-gated sign-up (refuse unapproved emails)
- WHY: PRD §4.1 F-01a; TRD §7.10. No unapproved email may ever sign in.
- SCOPE: `convex/auth.ts`, `convex/schema.ts` (additive `signupRequests` table), `convex/lib/signInEmail.ts`, `convex/auth.test.ts`.
- MUTATES: `signupRequests` table (new, additive); `createOrUpdateUser` refuses emails with no live `signupRequests` row; no existing table field changed.
- STEPS: 1) Graphify check of `convex/auth.ts`, `convex/lib/signInEmail.ts`; 2) add `signupRequests` (userId?, email, status pending|approved|rejected, createdAt, updatedAt, indexes `by_email`, `by_email_status`); 3) in `createOrUpdateUser`, if no approved row for the email, refuse the sign-in (Convex Auth documented hook) and return the "You're on the list" state; 4) keep existing approvals valid; 5) test: approved email signs in, unapproved is refused, no row is created for the refused email.
- DONE: `bun test convex/auth.test.ts` exits 0; the refused path asserts no `users` row is created.
- EVIDENCE: `auth.ts`, `auth.test.ts`, `signInEmail.ts`, the PR body noting the sign-in refusal.
- Numbers: 1 `signupRequests` row required per approved email (product rule, PRD F-01a); no industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: none · Size: ~2 h

### TRW-1002 — Approve/reject admin action + send magic link after approval
- WHY: PRD F-01a "Where Amit approves … UNKNOWN"; TRD §7.10 "the magic link is sent only after approval".
- SCOPE: `convex/auth.ts` (add `approveSignup`/`rejectSignup`), `convex/lib/signInEmail.ts`, `convex/auth.test.ts`.
- MUTATES: `signupRequests.status`; sends a Resend magic link only on the approve path.
- STEPS: 1) code-map check; 2) add `approveSignup({ email })` that sets `status: approved` then triggers the Resend magic-link send; 3) add `rejectSignup({ email })` that sets `status: rejected`; 4) only `role: "admin"` (or the documented hook) may call these — enforce `requireUser` + role check; 5) test approve sends-link flag and reject never sends.
- DONE: `bun test convex/auth.test.ts` exits 0 with approve/reject and role-guard cases.
- EVIDENCE: test output; `auth.ts` diff.
- Numbers: magic link valid 30 min, session 30 days (docs/APP-FLOW.md §2; product rule). Where Amit approves (admin screen vs Convex dashboard vs email link): UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1001 · Size: ~2 h

### TRW-1003 — Magic-link-only sign-in/sign-out parity (remove passkeys)
- WHY: TRD §7.9 "Remove the passkeys flag and `/settings/passkeys` page"; PRD F-01.
- SCOPE: `apps/web/app/sign-in/`, `apps/web/app/settings/passkeys/` (removed), `apps/web/lib/` (nav entry), `apps/web/app/layout.tsx`.
- MUTATES: removes `NEXT_PUBLIC_ENABLE_PASSKEYS` reads and the passkeys page/nav; no backend table changed.
- STEPS: 1) code-map; 2) delete the passkeys route and its nav entry; 3) strip `NEXT_PUBLIC_ENABLE_PASSKEYS` conditionals; 4) keep sign-out working; 5) build + a route render test asserting `/settings/passkeys` returns 404 and no passkey control is on sign-in.
- DONE: `bun run typecheck && bun run build` exits 0; no `NEXT_PUBLIC_ENABLE_PASSKEYS` or `passkeys` reference remains under `apps/web`.
- EVIDENCE: grep output (0 matches), build output.
- Numbers: 0 password/passkey fields on web (PRD F-01; product rule).
- Pass: 1 · Depends: TRW-1001 · Size: ~1.5 h

### TRW-1004 — Entitlement grant on approval (approved user → premium tier)
- WHY: PRD F-01a "every approved user gets the premium tier"; folds factory issue #1340 (entitlements table).
- SCOPE: `convex/auth.ts`, `convex/lib/entitlements.ts`, `convex/schema.ts` (if the entitlements table is still missing), `convex/lib/entitlements.test.ts`.
- MUTATES: on approval (not on the refused path), writes the premium entitlement tier for the user; `entitlements`/`subscriptionStates` rows as the existing helper expects.
- STEPS: 1) code-map `convex/lib/entitlements.ts` (exists per BACKLOG.md staleness table) and `convex/auth.ts`; 2) confirm the provider-grant shape in #1340; 3) wire the premium grant into the approve path only; 4) test: approved sign-in yields premium entitlement; refused sign-in yields none.
- DONE: `bun test convex/lib/entitlements.test.ts convex/auth.test.ts` exits 0; the approved path asserts the premium tier.
- EVIDENCE: test output; entitlement helper diff.
- Numbers: premium tier = the top plan in `users.entitlementTier` (product rule, PRD F-01a). Whether "premium" = Max or Pro: UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1002 · Size: ~1.5 h

### TRW-1005 — Turnstile on sign-up (bot check)
- WHY: docs/APP-FLOW.md §2 "Turnstile on sign-up: next week"; UI-BRIEF §1.
- SCOPE: `apps/web/app/sign-up/`, `apps/web/app/api/` (turnstile verify route), `convex/auth.ts` (accept verified flag).
- MUTATES: adds a Cloudflare Turnstile challenge to the sign-up form and a server-side verify; does not store the token.
- STEPS: 1) code-map the sign-up route; 2) render Turnstile; 3) verify the token server-side before the approval-request write; 4) test with the test keys Turnstile provides (always-passes/always-fails); 5) keep the form usable without JS via a graceful fallback message.
- DONE: `bun run typecheck && bun run build` exits 0; the verify route returns 200 for the test always-pass token and 4xx for always-fail.
- EVIDENCE: build output; route test output.
- Numbers: Turnstile widget/site keys are set by name (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`); values never committed. Provider: Cloudflare (UNKNOWN until Amit confirms the account).
- Pass: 1 · Depends: TRW-1001 · Size: ~2 h

### TRW-1006 — Owner isolation audit (requireUser + userId filter everywhere)
- WHY: TRD §7.4 "every query and mutation checks ctx.auth and filters by userId"; BACKEND-SCHEMA §6.
- SCOPE: `convex/lib/requireUser.ts`, `convex/notes.ts` (read-only audit first), `convex/requireUser.test.ts`.
- MUTATES: none to schema; closes any query/mutation that reads without `requireUser` + `userId` filter, one module at a time (notes first).
- STEPS: 1) code-map; 2) list every `export const` query/mutation missing `requireUser`; 3) fix `notes` module fully; 4) add a test that an unauthenticated call throws and a user only sees their own rows; 5) file the remaining modules as follow-ups in REPORT (they are covered by later chunk-2/3 tickets).
- DONE: `bun test convex/requireUser.test.ts` exits 0; `notes` functions all filter by userId.
- EVIDENCE: test output; the audit list in REPORT.
- Numbers: 0 cross-user reads (TRD §7.4; product rule).
- Pass: 1 · Depends: none · Size: ~2.5 h

### TRW-1007 — CodeMirror 6 live-preview editor (Obsidian-style decorations)
- WHY: 12 Oct contract CORE-WEB-EDITOR-MODES.md + OVERNIGHT-RUN.md decision 2; 21 Oct PRD.
- SCOPE: `apps/web/components/editor/` (editor + live-preview), `apps/web/app/notes/[id]/`, `packages/utils/src/` (decorations helper).
- MUTATES: none to backend; introduces CodeMirror 6 (add dependency in `apps/web/package.json`) with `remark-gfm` preview.
- STEPS: 1) code-map existing `apps/web/components/editor/live-preview.ts` (exists per graph); 2) wire CodeMirror 6 with markdown decorations over the text (no separate rendered copy); 3) `remark-gfm` for the read view; 4) set `dir="auto"` per paragraph; 5) test: type a block and a GFM table, assert decorations + preview render.
- DONE: `bun run typecheck && bun run test` exits 0; a render test types markdown and asserts no separate DOM copy of the source.
- EVIDENCE: render test output; editor diff.
- Numbers: GFM per https://github.github.com/gfm/ (spec); editor must keep source and preview in one view (contract, not a numeric standard).
- Pass: 1 · Depends: TRW-1015 · Size: ~3 h

### TRW-1008 — GFM read rendering (remark-gfm, tables)
- WHY: OVERNIGHT-RUN.md decision 2; CORE-WEB-EDITOR-MODES.md.
- SCOPE: `apps/web/components/markdown/` (renderer), `packages/utils/src/` (fixture), `apps/web/components/markdown/render.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map existing renderer; 2) add `remark-gfm` and render tables, task lists, strikethrough, autolinks; 3) keep fenced `json tempo` blocks opaque (never rendered as raw JSON); 4) test a fixture with a table, a task list and a mixed EN/HE paragraph.
- DONE: `bun test apps/web/components/markdown/render.test.tsx` exits 0.
- EVIDENCE: test output; renderer diff.
- Numbers: GFM spec https://github.github.com/gfm/ ; 0 raw-JSON leaks (product rule).
- Pass: 1 · Depends: TRW-1007 · Size: ~1.5 h

### TRW-1009 — Byte-exact save round-trip (all block types + EN/HE + GFM table)
- WHY: OVERNIGHT-RUN.md decision 2 "saving is byte-exact"; CORE-WEB-NOTES.md.
- SCOPE: `convex/notes.ts` (save path), `packages/utils/src/blocks.ts` (round-trip), `convex/notes.test.ts`.
- MUTATES: none; verifies save is byte-exact.
- STEPS: 1) code-map; 2) build a fixture holding every block type, mixed Hebrew/English paragraphs and a GFM table; 3) load→save→load and assert byte-identical `body`; 4) test with a page that was never touched (no diff).
- DONE: `bun test convex/notes.test.ts` exits 0 with the byte-exact fixture.
- EVIDENCE: fixture + test output.
- Numbers: 0-byte diff on untouched save (contract, not an external standard).
- Pass: 1 · Depends: TRW-1016, TRW-1020 · Size: ~2 h

### TRW-1010 — Slash menu (Heading 1-3, Bullet, Numbered, Checklist, Quote, Code, Divider, Table)
- WHY: OVERNIGHT-RUN.md decision 7; 21 Oct DESIGN.
- SCOPE: `apps/web/components/editor/slash-menu.tsx`, `apps/web/components/editor/`, `apps/web/components/editor/slash-menu.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map editor; 2) open on `/` at line start with the exact menu (Heading 1-3, Bullet, Numbered, Checklist, Quote, Code, Divider, Table); 3) keyboard-navigate + Enter inserts the block; 4) test each item inserts the right markdown prefix.
- DONE: `bun test apps/web/components/editor/slash-menu.test.tsx` exits 0 with all 10 items.
- EVIDENCE: test output; component diff.
- Numbers: 10 menu items (OVERNIGHT-RUN.md decision 7; product rule).
- Pass: 1 · Depends: TRW-1007 · Size: ~2 h

### TRW-1011 — Page menu: Copy as Markdown / Export .md
- WHY: OVERNIGHT-RUN.md decision 7; APP-FLOW §4.
- SCOPE: `apps/web/components/editor/page-menu.tsx`, `apps/web/app/notes/[id]/`, `apps/web/components/editor/page-menu.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) add a page menu with "Copy as Markdown" (clipboard) and "Export .md" (download with the page title as filename); 3) test copy writes the raw markdown and export triggers a download of the exact body.
- DONE: `bun test apps/web/components/editor/page-menu.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: exported bytes == `notes.body` bytes (contract).
- Pass: 1 · Depends: TRW-1007 · Size: ~1 h

### TRW-1012 — Paste markdown parses; copy gives markdown
- WHY: OVERNIGHT-RUN.md decision 7.
- SCOPE: `apps/web/components/editor/`, `packages/utils/src/blocks.ts` (parse), `apps/web/components/editor/paste.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) paste into the editor parses markdown (fenced `json tempo` becomes a block, the rest stays markdown); 3) copying out yields plain markdown, never rendered HTML or JSON; 4) test paste and copy round-trip.
- DONE: `bun test apps/web/components/editor/paste.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: copy output == source markdown (contract).
- Pass: 1 · Depends: TRW-1007 · Size: ~1.5 h

### TRW-1013 — Live `[[links]]` picker + "Linked here" backlinks
- WHY: OVERNIGHT-RUN.md decision 3; CORE-WEB-NOTES.md "stable linked task ids".
- SCOPE: `apps/web/components/editor/wiki-link.tsx`, `packages/utils/src/wiki-links.ts` (exists), `apps/web/components/editor/wiki-link.test.tsx`.
- MUTATES: none (reads existing pages for the picker).
- STEPS: 1) code-map `packages/utils/src/wiki-links.ts`; 2) on `[[`, open a picker of existing page titles; 3) render "Linked here" backlinks from `noteLinks`; 4) test picker and backlink rendering.
- DONE: `bun test apps/web/components/editor/wiki-link.test.tsx` exits 0.
- EVIDENCE: test output; component diff.
- Numbers: link ids stable across removal/revival (CORE-WEB-NOTES.md; product rule).
- Pass: 1 · Depends: TRW-1019 · Size: ~2 h

### TRW-1014 — RTL: dir="auto" per paragraph; numbers/code LTR
- WHY: TRD §5b; PRD §4.7 F-72; OVERNIGHT-RUN.md decision 7.
- SCOPE: `apps/web/components/markdown/`, `apps/web/app/globals.css`, `apps/web/components/markdown/rtl.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map renderer; 2) set `dir="auto"` on each paragraph; 3) force numbers and code spans `dir="ltr"`; 4) test mixed Hebrew+English paragraphs and a code span with a number.
- DONE: `bun test apps/web/components/markdown/rtl.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: none — behaviour rule (TRD §5b); no external number. Bidi per UAX #9 (https://www.unicode.org/reports/tr9/) is the reference.
- Pass: 1 · Depends: TRW-1008 · Size: ~1.5 h

### TRW-1015 — Single page route `/notes/[id]` + `/p/[pageId]` redirect
- WHY: OVERNIGHT-RUN.md decision 6; APP-FLOW §4.
- SCOPE: `apps/web/app/notes/[id]/`, `apps/web/app/p/[pageId]/` (redirect), `apps/web/app/notes/[id]/route.test.tsx`.
- MUTATES: route only; removes alternate page routes after parity.
- STEPS: 1) code-map routes; 2) ensure `/notes/[id]` is the canonical page route; 3) `/p/[pageId]` 301→`/notes/[pageId]`; 4) test redirect and a bad id shows "not found" (folds #526's intent).
- DONE: `bun run typecheck && bun run test` exits 0 with the redirect + bad-id cases.
- EVIDENCE: test output.
- Numbers: 301 permanent redirect (RFC 9110; https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently).
- Pass: 1 · Depends: none · Size: ~1.5 h

### TRW-1016 — Block codec (fence `json tempo`, envelope type/id/v/data, ULID ids)
- WHY: BACKEND-SCHEMA §4.2 (decided 20 Sep); TRD §4.
- SCOPE: `packages/utils/src/blocks.ts` (exists), `convex/lib/blocks.ts`, `packages/utils/src/blocks.test.ts`.
- MUTATES: none (pure codec).
- STEPS: 1) code-map `packages/utils/src/blocks.ts`; 2) confirm envelope is exactly `type`/`id`/`v`/`data`; 3) ids are `blk_` + ULID (128-bit, monotonic within a process); 4) test parse/serialise for all six block types and a broken fence.
- DONE: `bun test packages/utils/src/blocks.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: ULID 128-bit, 1.21e24 ids/ms, sortable (https://github.com/ulid/spec).
- Pass: 1 · Depends: none · Size: ~1.5 h

### TRW-1017 — Block Zod schemas (page-meta/task/event/habit/nag/template)
- WHY: BACKEND-SCHEMA §4.4; TRD §4.
- SCOPE: `packages/utils/src/blocks.ts`, `convex/lib/blocks.ts`, `packages/utils/src/blocks.test.ts`.
- MUTATES: none (validation only).
- STEPS: 1) code-map; 2) implement/verify Zod for every field in §4.4 (task: title/durationMin default 15/status/order/reason?/scheduledAt?/inelastic/doneAt?; nag: enabled false with no phrase; emoji rejected); 3) test valid and invalid cases, including emoji nag phrase rejected.
- DONE: `bun test packages/utils/src/blocks.test.ts` exits 0 with emoji-rejection and no-phrase-nag cases.
- EVIDENCE: test output.
- Numbers: `durationMin` default 15 (BACKEND-SCHEMA §4.4; product rule); no industry number.
- Pass: 1 · Depends: TRW-1016 · Size: ~2 h

### TRW-1018 — noteBlocks derived index + broken-block indexing
- WHY: TRD §4; BACKEND-SCHEMA §4.3.
- SCOPE: `convex/notes.ts`, `convex/schema.ts` (additive `noteBlocks` table), `convex/notes.test.ts`.
- MUTATES: `noteBlocks` (new, derived); an invalid block indexed as `type: "broken"`, `body` left untouched.
- STEPS: 1) code-map; 2) add `noteBlocks` (noteId, blockId, type, v, data, position, lifted status?/startAtMs?/nextFireAtMs?); 3) on save, rebuild the page's `noteBlocks`; invalid fence → `broken`, body untouched; 4) test broken block still saves and is indexed broken.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: Convex 16 MiB/32,000 docs per transaction bounds a rebuild (https://docs.convex.dev/production/state/limits).
- Pass: 1 · Depends: TRW-1017 · Size: ~2.5 h

### TRW-1019 — noteLinks derived backlinks index
- WHY: BACKEND-SCHEMA §4.3; TRD §4.
- SCOPE: `convex/notes.ts`, `convex/schema.ts` (additive `noteLinks` table), `convex/notes_links.test.ts` (exists — extend).
- MUTATES: `noteLinks` (new, derived: fromNoteId, toNoteId?, toTitle).
- STEPS: 1) code-map `convex/notes_links.test.ts`; 2) add/verify `noteLinks` rebuild on save, extracting `[[title]]` and `[[page]]` targets; 3) test backlinks list and a dangling link (`toNoteId` null).
- DONE: `bun test convex/notes_links.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: none — derived index; no external number.
- Pass: 1 · Depends: TRW-1018 · Size: ~2 h

### TRW-1020 — notes.save write path (validate + rebuild indexes, soft-fail broken)
- WHY: BACKEND-SCHEMA §4.5; TRD §4.
- SCOPE: `convex/notes.ts`, `convex/lib/blocks.ts`, `convex/notes.test.ts`.
- MUTATES: `notes.body` and its `noteBlocks`/`noteLinks` in one mutation; invalid block never fails the save.
- STEPS: 1) code-map; 2) `save(id, body)` parses every `json tempo` fence, validates each, replaces that page's derived rows; 3) invalid block stays in `body`, indexed broken; 4) test: one broken block + valid blocks save together.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: Convex transaction 16 MiB write bound (https://docs.convex.dev/production/state/limits).
- Pass: 1 · Depends: TRW-1018, TRW-1019 · Size: ~2.5 h

### TRW-1021 — notes.patchBlock(noteId, blockId, dataPatch)
- WHY: BACKEND-SCHEMA §4.5 "small edits use patchBlock".
- SCOPE: `convex/notes.ts`, `convex/lib/blocks.ts`, `convex/notes.test.ts`.
- MUTATES: one block's `data` inside `notes.body` (then rebuild derived rows).
- STEPS: 1) code-map; 2) `patchBlock(noteId, blockId, dataPatch)` finds the block by id in `body`, merges the patch, re-validates, rewrites only that fence; 3) test patch and invalid-patch rejection.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: none — behaviour rule; no external number.
- Pass: 1 · Depends: TRW-1020 · Size: ~2 h

### TRW-1022 — Broken block renders as a quiet card + Undo; JSON never shown
- WHY: PRD F-03; BACKEND-SCHEMA §4.5; APP-FLOW §7.
- SCOPE: `apps/web/components/blocks/`, `apps/web/components/blocks/broken.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map block components; 2) `BrokenBlock` draws a quiet "This part has a problem." card with Undo, never the JSON; 3) test the JSON string is not in the DOM for a broken block.
- DONE: `bun test apps/web/components/blocks/broken.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 0 raw JSON visible on any screen (PRD F-02; product rule).
- Pass: 1 · Depends: TRW-1023 · Size: ~1.5 h

### TRW-1023 — Block component registry (TaskBlock…BrokenBlock)
- WHY: TRD §4; UI-BRIEF §5.
- SCOPE: `apps/web/components/blocks/`, `apps/web/components/blocks/registry.tsx`, `apps/web/components/blocks/registry.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) register TaskBlock, EventBlock, HabitBlock, NagBlock, TemplateBlock, PageMetaBlock (renders nothing), BrokenBlock, with adjacent task blocks drawn as one list; 3) test each type maps to its component.
- DONE: `bun test apps/web/components/blocks/registry.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 7 block components (UI-BRIEF §5; product list).
- Pass: 1 · Depends: TRW-1017 · Size: ~2 h

### TRW-1024 — json-render catalog + web registry + toSpec
- WHY: TRD §1 "block rendering @json-render/core, @json-render/react"; PRD F-02.
- SCOPE: `apps/web/components/blocks/`, `packages/utils/src/` (catalog spec), `apps/web/components/blocks/catalog.test.tsx`.
- MUTATES: none (adds `@json-render/*` deps to `apps/web/package.json`).
- STEPS: 1) code-map; 2) install `@json-render/core`, `@json-render/react` (pin the exact pre-1.0 version); 3) build Tempo's catalog from the registry components + `toSpec`; 4) test a spec renders its component.
- DONE: `bun test apps/web/components/blocks/catalog.test.tsx` exits 0.
- EVIDENCE: test output; package diff.
- Numbers: pin exact pre-1.0 version (TRD §1; product rule). json-render version: UNKNOWN until installed (read `package.json` after install).
- Pass: 1 · Depends: TRW-1023 · Size: ~2.5 h

### TRW-1025 — notes schema: pageType/date/folderId (additive) + Today derivation
- WHY: TRD §4 "notes gains pageType and date"; BACKEND-SCHEMA §4.3.
- SCOPE: `convex/schema.ts` (additive), `convex/notes.ts`, `convex/notes_period.test.ts` (exists — extend).
- MUTATES: `notes` gains `pageType`, `date?`, `folderId?` (additive, no existing field changed).
- STEPS: 1) code-map; 2) add the three fields (optional); 3) derive Today = the row with `pageType: "daily"` and `date` = the user's local date; 4) test derivation and backfill of existing notes.
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: date format `YYYY-MM-DD` (BACKEND-SCHEMA §4.2; ISO 8601).
- Pass: 1 · Depends: TRW-1020 · Size: ~2 h

### TRW-1026 — Today = daily page created from Daily template on first open
- WHY: PRD F-05; TRD §4 "created from the default Daily template on first open".
- SCOPE: `convex/notes.ts`, `convex/templates.ts` (exists), `convex/notes_period.test.ts`.
- MUTATES: creates the daily page (and its blocks) on first open when none exists.
- STEPS: 1) code-map `convex/templates.ts`; 2) on Today open with no daily page for the local date, copy the Daily template body, resolve tokens, assign fresh block ids, save; 3) test idempotence (second open does not create a duplicate).
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: exactly 1 daily page per user per local date (product rule).
- Pass: 1 · Depends: TRW-1025 · Size: ~2 h

### TRW-1027 — Template page token resolution + "make this page a template"
- WHY: APP-FLOW §6; PRD F-04/F-23.
- SCOPE: `convex/templates.ts`, `convex/lib/templateCatalog.ts`, `convex/templates.test.ts` (exists — extend).
- MUTATES: `notes` with `pageType: "template"`; resolves tokens like `{{next_monday}}`; fresh `blk_` ULIDs on instantiate.
- STEPS: 1) code-map; 2) implement `{{next_monday}}` (and the documented token set) resolution using the user's local date; 3) "Make this page a template" saves the page as a template with a `template` block; 4) test token resolution and id freshness.
- DONE: `bun test convex/templates.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: every instantiated block gets a fresh ULID (https://github.com/ulid/spec); token set from BACKEND-SCHEMA §4.4.
- Pass: 1 · Depends: TRW-1026 · Size: ~2 h

### TRW-1028 — Propose template on new page (one-tap accept)
- WHY: PRD F-06 "the user never hand-builds a template".
- SCOPE: `apps/web/app/notes/new/`, `apps/web/components/`, `apps/web/app/notes/new/propose.test.tsx`.
- MUTATES: none (proposes; the accept writes via `notes.save`).
- STEPS: 1) code-map; 2) on new page, propose the matching template (daily/weekly/project/note); 3) one tap accepts and instantiates it; 4) test proposal shows and accept creates the page.
- DONE: `bun test apps/web/app/notes/new/propose.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 1 template proposed per page (product rule).
- Pass: 1 · Depends: TRW-1027 · Size: ~1.5 h

### TRW-1029 — Project/folder tree + structured tags
- WHY: PRD F-08.
- SCOPE: `convex/notes.ts`, `apps/web/components/`, `convex/notes_rail.test.ts` (exists — extend).
- MUTATES: `notes.folderId` and tag parsing (no new table if folder tree derives from `folderId`).
- STEPS: 1) code-map `convex/notes_rail.test.ts`; 2) render a folder tree from `folderId` and a tag list; 3) move a page between folders; 4) test tree order and move.
- DONE: `bun test convex/notes_rail.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: none — structure rule; no external number.
- Pass: 1 · Depends: TRW-1025 · Size: ~2 h

### TRW-1030 — Soft delete 30-day grace parity + hard-delete audit
- WHY: PRD F-131; BACKEND-SCHEMA §1/§2 (hard-delete defects list).
- SCOPE: `convex/lib/softDelete.ts` (exists), `convex/notes.ts`, `convex/softDelete.test.ts` (exists — extend).
- MUTATES: none new; confirms notes soft-delete and lists any remaining `ctx.db.delete` in REPORT.
- STEPS: 1) code-map `convex/lib/softDelete.ts`; 2) confirm notes soft-delete with 30-day grace; 3) grep for remaining `ctx.db.delete` and list them (tasks/habits/goals/memories/messages/conversations/users per BACKEND-SCHEMA §2) as follow-ups for chunk 2/3; 4) test soft-delete + grace expiry.
- DONE: `bun test convex/softDelete.test.ts` exits 0.
- EVIDENCE: test output; the `ctx.db.delete` audit list in REPORT.
- Numbers: 30-day grace (PRD F-131; product rule). Hard vs soft for `forget`: UNKNOWN — Amit to answer (OPEN, chunk 3).
- Pass: 1 · Depends: TRW-1025 · Size: ~1.5 h

### TRW-1031 — Operation ledger (revision + request identity, generation epoch)
- WHY: 21 Oct TRD "revision + request identity"; BACKEND-SCHEMA §4.
- SCOPE: `convex/lib/pageLedger.ts` (exists), `convex/notes.ts`, `convex/lib/pageLedger.test.ts` (exists — extend).
- MUTATES: a per-page revision/epoch on each write; request identity recorded.
- STEPS: 1) code-map `convex/lib/pageLedger.ts`; 2) ensure every `notes.save`/`patchBlock` bumps the revision and records request identity; 3) test revision monotonicity.
- DONE: `bun test convex/lib/pageLedger.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: monotonic revision (no external number).
- Pass: 1 · Depends: TRW-1020 · Size: ~1.5 h

### TRW-1032 — 5-minute Undo (reversible mutations carry undo)
- WHY: PRD F-22/F-131; 21 Oct DECISIONS.
- SCOPE: `convex/notes.ts`, `convex/lib/pageLedger.ts`, `convex/memoryUndo.test.ts` (exists — extend).
- MUTATES: reversible mutations (notes save, block patch) carry a 5-minute undo record.
- STEPS: 1) code-map `convex/memoryUndo.test.ts`; 2) add undo for notes save/patchBlock (restore previous body within 5 min); 3) test undo restores and undo after 5 min is refused.
- DONE: `bun test convex/memoryUndo.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-minute window (PRD F-131; product rule).
- Pass: 1 · Depends: TRW-1031 · Size: ~2 h

### TRW-1033 — Concurrency: bounded queue + generation epoch; cancelled request can't overwrite
- WHY: 21 Oct TRD concurrency rules.
- SCOPE: `convex/notes.ts`, `convex/lib/pageLedger.ts`, `convex/notes.test.ts`.
- MUTATES: none; enforces a bounded queue and generation epoch so a cancelled/replaced request never overwrites the accepted state.
- STEPS: 1) code-map; 2) implement a generation epoch per page; a write with a stale epoch is rejected; 3) cancelled/replaced request cannot later commit; 4) test stale-epoch rejection and replaced-request no-op.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: bounded queue size (default 1 in-flight write per page; product rule) — exact cap UNKNOWN.
- Pass: 1 · Depends: TRW-1031 · Size: ~2.5 h

### TRW-1034 — Stale-save guard (optimistic version check)
- WHY: 21 Oct ROADMAP MVP order 4 "stale save".
- SCOPE: `convex/notes.ts`, `apps/web/app/notes/[id]/`, `convex/notes.test.ts`.
- MUTATES: none; rejects a save whose base revision is older than the current.
- STEPS: 1) code-map; 2) surface "This page changed elsewhere — reload." with Retry (no false queued-save promise); 3) test stale save is refused with the exact message.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output; message EN/HE keys.
- Numbers: 1 base revision compared (product rule); no external number.
- Pass: 1 · Depends: TRW-1033 · Size: ~1.5 h

### TRW-1035 — Bounded query helper (clampPageSize / readBudget / byteCap)
- WHY: TRD §7.6 "Bounded queries"; folds factory issue #1348 (TM-0032).
- SCOPE: `convex/lib/bounded.ts`, `convex/lib/bounded.test.ts`.
- MUTATES: none (pure helper; no call sites changed in this ticket).
- STEPS: 1) code-map; 2) `clampPageSize(n, {min:1,max:100,default:25})`; 3) `readBudget({maxBytes})` (default 4 MiB) stops before the running `JSON.stringify` length passes the budget, returning a cursor; 4) `byteCap(text, maxBytes)` truncates on a UTF-8 code-point boundary (never splits Hebrew/emoji) and reports `truncated`; 5) test clamp below/above/NaN, budget stop, and ASCII/Hebrew/emoji boundaries.
- DONE: `bun test convex/lib/bounded.test.ts` exits 0 with ≥8 cases.
- EVIDENCE: `bounded.ts`, `bounded.test.ts`, one TRD §7.6 reference in the PR body.
- Numbers: Convex 16 MiB read / 32,000 docs / 1 MiB doc (https://docs.convex.dev/production/state/limits); page max 100; 4 MiB default budget.
- Pass: 1 · Depends: none · Size: ~1.5 h

### TRW-1036 — Resource quotas enforcement (4 MiB/file, 50 MiB + 100 ready files/user)
- WHY: 12 Oct contract CORE-WEB-RESOURCES.md; 21 Oct TRD.
- SCOPE: `convex/notes.ts`, `convex/lib/bounded.ts`, `convex/notes.test.ts`.
- MUTATES: none to schema; enforces the quotas on save.
- STEPS: 1) code-map; 2) enforce 4 MiB per file body, 50 MiB total, 100 ready files per user; 3) exact error messages EN/HE when a quota is exceeded; 4) test each quota edge.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output; EN/HE error keys.
- Numbers: 4 MiB / 50 MiB / 100 files (CORE-WEB-RESOURCES.md; product contract). Also 3 open uploads and 20 uploads/hour (same contract).
- Pass: 1 · Depends: TRW-1035 · Size: ~2 h

### TRW-1037 — File upload/import size + count caps
- WHY: CORE-WEB-RESOURCES.md (4 MiB per file, 3 open uploads, 20 uploads/hour).
- SCOPE: `apps/web/app/api/` (upload route), `convex/notes.ts`, `convex/notes.test.ts`.
- MUTATES: none; caps uploads.
- STEPS: 1) code-map; 2) enforce 4 MiB/file, 3 open uploads, 20 uploads/hour; 3) test oversize and rate-limit.
- DONE: `bun test convex/notes.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 4 MiB/file, 3 open uploads, 20 uploads/hour (CORE-WEB-RESOURCES.md).
- Pass: 1 · Depends: TRW-1036 · Size: ~1.5 h

### TRW-1038 — Forbidden-tech parity (no new deps, scans green)
- WHY: TRD §9 forbidden list; HARD_RULES §2.
- SCOPE: `package.json`, `apps/*/package.json`, `packages/*/package.json` (read-only), `apps/web/lib/forbidden.test.ts`.
- MUTATES: none; a test asserts none of the forbidden packages is in any manifest.
- STEPS: 1) run `bun run scan:forbidden-tech`; 2) add a unit test listing the forbidden package names and asserting none appears in any `package.json`; 3) fix any doc/reference mention (not code) that slipped in.
- DONE: `bun run scan:forbidden-tech && bun test apps/web/lib/forbidden.test.ts` exits 0.
- EVIDENCE: scan + test output.
- Numbers: 0 forbidden deps (TRD §9; product rule).
- Pass: 1 · Depends: none · Size: ~1 h

### TRW-1039 — memories.embedding + vector index (1024 dims)
- WHY: TRD §5 "memories gains an embedding field and a vector index".
- SCOPE: `convex/schema.ts` (additive), `convex/memories.ts`, `convex/memories.test.ts`.
- MUTATES: `memories.embedding` + `vectorIndex` (1024 dims, filter `userId`).
- STEPS: 1) code-map; 2) add `embedding: v.optional(v.array(v.float64()))` and a `vectorIndex` with 1024 dimensions and filter field `userId`; 3) test search returns nearest with the filter.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: Convex vector 2–2048 dims, ≤256 results, vector search in actions only (https://docs.convex.dev/search/vector-search).
- Pass: 1 · Depends: TRW-1006 · Size: ~2 h

### TRW-1040 — remember(userId, text, meta)
- WHY: TRD §5 memory port table.
- SCOPE: `convex/memory.ts` (exists), `convex/lib/memoryImport.ts`, `convex/memories.test.ts`.
- MUTATES: inserts into `memories`; `meta.kind` → `metadata`.
- STEPS: 1) code-map `convex/memory.ts`; 2) `remember(userId, text, meta)` inserts with `metadata.kind`; 3) test insert and metadata mapping.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: none — behaviour; no external number.
- Pass: 1 · Depends: TRW-1039 · Size: ~1 h

### TRW-1041 — recall = vector + keyword merged
- WHY: TRD §5 "recall = vector search (meaning) + existing search index (keyword), merged".
- SCOPE: `convex/memory.ts`, `convex/memories.ts`, `convex/memories.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) `recall(userId, query, limit)` runs vector search (meaning) and the keyword index, merges, dedupes, returns ≤limit; 3) test merge order and dedupe.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: ≤256 vector results per search (https://docs.convex.dev/search/vector-search).
- Pass: 1 · Depends: TRW-1039 · Size: ~2 h

### TRW-1042 — context(userId, topic) = recall + token cap trim
- WHY: TRD §5 "context(userId, topic) = recall, then trim to a token cap".
- SCOPE: `convex/memory.ts`, `convex/lib/bounded.ts`, `convex/memories.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) `context(userId, topic)` = `recall` then trim to a token cap so the coach prompt stays within budget; 3) test trim order (most relevant kept) and cap.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: token cap for context = the model's context budget minus system prompt (DeepSeek V4.1 Flash 1M context, https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash); exact reserve UNKNOWN.
- Pass: 1 · Depends: TRW-1041, TRW-1035 · Size: ~1.5 h

### TRW-1043 — forget (hard vs soft — OPEN; default soft + flag)
- WHY: TRD §5 memory port; OPEN conflict (BACKEND-SCHEMA §7, DECISIONS §4).
- SCOPE: `convex/memory.ts`, `convex/lib/softDelete.ts`, `convex/memories.test.ts`.
- MUTATES: `memories.deletedAt` (soft) — hard delete only if Amit rules it.
- STEPS: 1) code-map; 2) implement `forget` as soft delete (30-day grace) by default, with the hard/soft choice behind a named flag; 3) test soft-delete hides the memory from recall immediately; 4) REPORT the OPEN ruling needed (Amit).
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 30-day grace (PRD F-131). Hard vs soft: UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1040 · Size: ~1.5 h

### TRW-1044 — export all memories as markdown
- WHY: PRD F-52; TRD §5 "export(userId) = every memory as plain markdown".
- SCOPE: `convex/memory.ts`, `apps/web/app/` (export route), `convex/memories.test.ts`.
- MUTATES: none (read-only export).
- STEPS: 1) code-map; 2) `export(userId)` returns all memories as plain markdown; 3) wire a download; 4) test markdown shape and ordering.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: export = plain markdown (PRD F-52; product rule).
- Pass: 1 · Depends: TRW-1040 · Size: ~1.5 h

### TRW-1045 — importPreview + importCommit (ChatGPT/Claude/paste)
- WHY: PRD F-51; TRD §5 importPreview/importCommit.
- SCOPE: `convex/memoryImport.ts` (exists), `convex/lib/memoryImport.ts`, `convex/memoryImport.test.ts` (exists — extend).
- MUTATES: none on preview; `importCommit` calls `remember` per kept item with `metadata.source`.
- STEPS: 1) code-map; 2) `importPreview(userId, text, source)` splits into candidate items (nothing saved); 3) `importCommit(userId, items)` remembers each kept item with `metadata.source`; 4) test split + commit.
- DONE: `bun test convex/memoryImport.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: accepts `.txt`/`.md`/`.json`/pasted text (TRD §5; product rule). Exact ChatGPT/Claude export formats: UNKNOWN (TRD open question).
- Pass: 1 · Depends: TRW-1040 · Size: ~2 h

### TRW-1046 — Embedding model pick + Hebrew/English eval harness
- WHY: TRD §5 "Hebrew quality is UNKNOWN for all of these; before locking one, run a check".
- SCOPE: `convex/lib/ai_router.ts` (embedding path), `convex/lib/embeddingEval.ts`, `convex/lib/embeddingEval.test.ts`.
- MUTATES: none to schema; the eval is offline (deterministic fixtures, no network).
- STEPS: 1) code-map; 2) build a harness that, given a model's embeddings, scores top-3 hit rate on 20 Hebrew + 20 English questions against ~200 notes; 3) test the harness with fixture embeddings; 4) REPORT the model candidates (Qwen3-Embedding-8B, bge-m3, multilingual-e5-large-instruct) and that the real run needs the DeepInfra key.
- DONE: `bun test convex/lib/embeddingEval.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: top-3 hit rate target ≥ 0.9 on the 40-question set (product bar); Convex 1024-dim limit (https://docs.convex.dev/search/vector-search). Hebrew benchmark: UNKNOWN (none found).
- Pass: 1 · Depends: TRW-1039 · Size: ~2.5 h

### TRW-1047 — Convex Agent coach definition (threads, tools, streaming deltas)
- WHY: PRD F-20; TRD §3 "coach is one Agent"; folds factory issue #743 (chat.send real AI replies via the seam).
- SCOPE: `convex/coach.ts` (exists), `convex/lib/agentComponent.ts` (exists), `convex/coach_chat.test.ts` (exists — extend).
- MUTATES: coach becomes a Convex Agent (persistent threads) over the DeepSeek seam; removes fixed technique replies.
- STEPS: 1) code-map `convex/coach.ts`, `convex/lib/agentComponent.ts`; 2) define one `Agent` with `streamText(..., { saveStreamDeltas: true })`; 3) wire `createNote`, `addTaskToToday`, `fillTemplate`, `draftModule`, `searchMemory`, `scheduleJob` tools (stub calls until their tickets); 4) test a turn streams deltas and returns a schema-valid completion.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output; the seam no longer calls `api.mistral.ai`.
- Numbers: DeepSeek V4.1 Flash 1M context (https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash). Runtime model (never a code model).
- Pass: 1 · Depends: TRW-1055 · Size: ~3 h

### TRW-1048 — createNote / addTaskToToday / fillTemplate tools
- WHY: PRD F-22; TRD §3 tool list.
- SCOPE: `convex/coach.ts`, `convex/notes.ts`, `convex/tasks.ts`, `convex/coach_chat.test.ts`.
- MUTATES: writes via `notes.save` / task creation (each with 5-min undo).
- STEPS: 1) code-map; 2) implement the three tools so the model proposes and code validates/writes; 3) test each tool's write and undo.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: every action carries a 5-minute Undo (PRD F-22; product rule).
- Pass: 1 · Depends: TRW-1047, TRW-1020 · Size: ~2.5 h

### TRW-1049 — draftModule tool + approval-requested state
- WHY: PRD F-23/F-41; TRD §4a/§4b.
- SCOPE: `convex/coach.ts`, `convex/approval.ts` (exists), `convex/coach_chat.test.ts`.
- MUTATES: none direct; a module draft enters "approval-requested"; live only on the user's Approve tap.
- STEPS: 1) code-map `convex/approval.ts`; 2) `draftModule` writes a draft (never live); 3) Approve/Discard transitions; 4) test draft→approve→live and invalid-draft rejection.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: draft never goes live without a tap (PRD F-41; product rule).
- Pass: 1 · Depends: TRW-1047 · Size: ~2.5 h

### TRW-1050 — searchMemory tool
- WHY: PRD F-50; TRD §3 tool list.
- SCOPE: `convex/coach.ts`, `convex/memory.ts`, `convex/coach_chat.test.ts`.
- MUTATES: none (read-only recall).
- STEPS: 1) code-map; 2) expose `searchMemory` as a coach tool calling `recall`; 3) test the tool returns the top memories.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: ≤limit results (product rule); ≤256 vector results (https://docs.convex.dev/search/vector-search).
- Pass: 1 · Depends: TRW-1041, TRW-1047 · Size: ~1.5 h

### TRW-1051 — scheduleJob tool (needs approval)
- WHY: PRD F-47; TRD §5d.
- SCOPE: `convex/coach.ts`, `convex/crons.ts` (exists), `convex/coach_chat.test.ts`.
- MUTATES: registers a runtime job via `@convex-dev/crons` only after approval.
- STEPS: 1) code-map `convex/crons.ts`; 2) `scheduleJob({ cron, task, targetPageType })` needs approval; 3) store UTC, show in user tz; 4) test approval gate and a job write into a page.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: cron stored in UTC (TRD §5d; product rule). `@convex-dev/crons` limits: UNKNOWN.
- Pass: 1 · Depends: TRW-1049 · Size: ~2.5 h

### TRW-1052 — Coach chat UI (chat window, streaming, read-back, calm Retry)
- WHY: MVP is chat-first (PRD §0 "a very strong chat window that remembers"); folds factory issue #744 (Thinking state + Retry).
- SCOPE: `apps/web/components/coach/`, `apps/web/app/(tempo)/coach/`, `apps/web/components/coach/chat.test.tsx`.
- MUTATES: none (reads the coach Agent thread).
- STEPS: 1) code-map the coach route; 2) stream reply deltas; 3) Thinking state, calm Retry on error ("The coach is offline. Your list still works."); 4) read-back (text + TTS hook later); 5) test streaming + retry.
- DONE: `bun test apps/web/components/coach/chat.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: ack < 0.2 s, response ~1 s (TRD §5a latency budget; product rule).
- Pass: 1 · Depends: TRW-1047 · Size: ~3 h

### TRW-1053 — Crisis card (fixed text, no model call)
- WHY: PRD F-24; TRD §7.7.
- SCOPE: `convex/crisis.ts` (exists), `convex/lib/crisisWords.ts` (exists), `convex/crisis.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) on crisis words, return the fixed card (never model-written) and stop coaching; 3) test crisis words → fixed card with no model call.
- DONE: `bun test convex/crisis.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 model calls on a crisis turn (PRD F-24; product rule).
- Pass: 1 · Depends: TRW-1047 · Size: ~1.5 h

### TRW-1054 — Anti-shaming copy check
- WHY: PRD tone rule "never shame"; UI-BRIEF §7; folds factory issue #1350 (TM-0049).
- SCOPE: `convex/lib/shameWords.ts`, `convex/lib/shameWords.test.ts`.
- MUTATES: none (shared check).
- STEPS: 1) code-map; 2) `SHAME_PATTERNS` (e.g. "you failed", "lazy", "should have", "again?!") + `findShame(text)`; 3) test every fixed string in `coachPrompt.ts` and the nag defaults returns no match.
- DONE: `bun test convex/lib/shameWords.test.ts` exits 0.
- EVIDENCE: test output; `coachPrompt.test.ts` still green.
- Numbers: 0 matches across fixed coach/nag copy (PRD tone rule).
- Pass: 1 · Depends: none · Size: ~1.5 h

### TRW-1055 — Mock language model for deterministic coach tests
- WHY: include.md §7.8 (no real model calls); folds factory issue #1349 (TM-0050).
- SCOPE: `convex/lib/mockModel.ts`, `convex/lib/mockModel.test.ts`.
- MUTATES: none (test-only).
- STEPS: 1) code-map; 2) `createMockModel(script)` returns canned completions in order and records calls; 3) `installFetchGuard()` makes any real model fetch throw in tests; 4) test ordering, call log, and guard.
- DONE: `bun test convex/lib/mockModel.test.ts` exits 0.
- EVIDENCE: `mockModel.ts`, `mockModel.test.ts`, `ai_router.test.ts` unchanged and green.
- Numbers: 0 network calls in unit tests (include.md §7.8).
- Pass: 1 · Depends: none · Size: ~1 h

### TRW-1056 — Entitlement + quota ordering before model calls
- WHY: TRD §7.3 "order before any model call: auth → entitlement → quota"; folds #1340's runtime check.
- SCOPE: `convex/lib/aiGate.ts` (exists), `convex/lib/entitlements.ts`, `convex/coach_chat.test.ts`.
- MUTATES: none; enforces the order.
- STEPS: 1) code-map `convex/lib/aiGate.ts`; 2) every model call runs auth → entitlement → quota first; 3) test an unentitled/over-quota user gets no model call.
- DONE: `bun test convex/coach_chat.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: auth → entitlement → quota (TRD §7.3; product rule). Voice caps (30/90/180 min) are chunk 5; text quota value UNKNOWN.
- Pass: 1 · Depends: TRW-1047, TRW-1004 · Size: ~1.5 h

### TRW-1057 — FD-01 smoke (sign in → Today → brain dump → proposal → Add N → reload → tick)
- WHY: PRD §3.1 exit check 2; APP-FLOW §4.
- SCOPE: `tests/e2e/` (new spec), `tests/e2e/fd01.spec.ts`.
- MUTATES: none (test only).
- STEPS: 1) code-map the e2e harness; 2) write the click-path as a Playwright spec; 3) assert no JSON is visible anywhere; 4) run it.
- DONE: `bunx playwright test tests/e2e/fd01.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 raw JSON visible (PRD F-02).
- Pass: 1 · Depends: TRW-1026, TRW-1048 · Size: ~2.5 h

### TRW-1058 — EN/HE string files + locale + fallback
- WHY: TRD §5b "typed message files en and he"; PRD F-70.
- SCOPE: `apps/web/messages/en.json`, `apps/web/messages/he.json`, `apps/web/lib/` (locale), `apps/web/lib/locale.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) move visible copy into `en.json`/`he.json` with typed keys; 3) `users.locale` (default from browser) switches; 4) missing Hebrew key falls back to English; 5) test switch + fallback.
- DONE: `bun test apps/web/lib/locale.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 100% of visible strings keyed EN+HE (product rule); no i18n library (TRD §1).
- Pass: 1 · Depends: none · Size: ~2 h

### TRW-1059 — RTL layout (logical CSS, dir from locale)
- WHY: TRD §5b; PRD F-71.
- SCOPE: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/lib/locale.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) set `<html lang dir>` from locale; RTL list (`he`,`ar`,`fa`,`ur`) → `dir="rtl"`; 3) use logical CSS (`ms/me/ps/pe`, `start/end`) only; 4) mirror direction-sensitive icons; 5) test dir + a mirrored icon.
- DONE: `bun test apps/web/lib/locale.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: no physical `left/right` (TRD §5b; product rule).
- Pass: 1 · Depends: TRW-1058 · Size: ~1.5 h

### TRW-1060 — Accessibility baseline (keyboard, focus, labels, contrast, touch target)
- WHY: UI-BRIEF §6; include.md §7.2 accessibility baseline.
- SCOPE: `apps/web/app/globals.css`, `apps/web/components/` (focus/contrast fixes), `apps/web/components/a11y.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) visible focus ring, full keyboard use, screen-reader labels, min 44×44 touch targets; 3) test contrast and focus on the core components.
- DONE: `bun test apps/web/components/a11y.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: WCAG AA 4.5:1 (3:1 large) contrast (https://www.w3.org/TR/WCAG21/#contrast-minimum); target 44×44 px (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: none · Size: ~2.5 h

### TRW-1061 — Lighthouse performance budget (CI)
- WHY: ROADMAP P2 "Lighthouse 90+"; folds factory issue #1342 (TEMPO-BL-0004).
- SCOPE: `apps/web/` (perf fixes), `tests/` or a `scripts/` lighthouse check, `apps/web/perf.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map; 2) add a Lighthouse check (or the repo's existing perf script) asserting ≥90 Performance; 3) fix the worst offenders (font loading, bundle); 4) test the budget locally.
- DONE: `bun test apps/web/perf.test.ts` exits 0 (or the documented lighthouse command passes ≥90).
- EVIDENCE: lighthouse output.
- Numbers: Lighthouse Performance ≥ 90 (docs/ROADMAP.md P2; product bar).
- Pass: 2 · Depends: TRW-1007 · Size: ~2 h

### TRW-1062 — PWA manifest + service worker + offline states
- WHY: PRD F-120; TRD §1 "Next.js PWA".
- SCOPE: `apps/web/app/manifest.ts`, `apps/web/app/sw.ts` (or public/), `apps/web/app/offline.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) add manifest + service worker; 3) offline/empty/error states explain the actual behaviour without a false queued-save promise; 4) test the offline state render.
- DONE: `bun run build && bun test apps/web/app/offline.test.tsx` exits 0.
- EVIDENCE: build + test output.
- Numbers: PWA installable (manifest + SW); no external number.
- Pass: 1 · Depends: TRW-1058 · Size: ~2 h

### TRW-1063 — Empty/loading/error/offline states (Today + notes)
- WHY: APP-FLOW §7; 21 Oct DESIGN interaction checklist.
- SCOPE: `apps/web/app/(tempo)/today/`, `apps/web/app/notes/[id]/`, `apps/web/app/empty-states.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) implement the exact empty/error copy from APP-FLOW §7 ("Nothing on today yet…", "Couldn't load today. Your list is safe." + Retry); 3) loading and offline states; 4) test each state.
- DONE: `bun test apps/web/app/empty-states.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: no false queued-save promise (21 Oct DESIGN; product rule).
- Pass: 1 · Depends: TRW-1062 · Size: ~2 h

### TRW-1064 — Chat-first shell: coach reachable from every signed-in screen
- WHY: MVP is chat-first (PRD §0; memory: "a very strong chat window that remembers", every feature usable from inside it).
- SCOPE: `apps/web/components/coach/`, `apps/web/app/layout.tsx` (signed-in shell), `apps/web/components/coach/reachable.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the signed-in shell; 2) a chat button at the bottom right of every signed-in screen opens the coach; 3) test the button is present on ≥1 screen per group (Flow/Library/You/Settings).
- DONE: `bun test apps/web/components/coach/reachable.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: chat button on every signed-in screen (UI-BRIEF §1 Taby pattern; product rule).
- Pass: 1 · Depends: TRW-1052 · Size: ~1.5 h

---
