> Superseded by BACKLOG-v2.md (ticket standard v2, 1 Nov 2026)

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

## Rewrite — Chunk 2 (MVP · Planning surface), tickets TRW-1065 … TRW-1148

Added 1 Nov 2026 per `docs/backlog/REWRITE-PLAN.md`. All 84 tickets, in dependency order.
Format per ticket: WHY / SCOPE / MUTATES / STEPS / DONE / EVIDENCE / Numbers / Pass + Depends + Size.
STEPS step 1 is always the Graphify code-map check (the unit may already exist on `integration` — then
verify and add the missing test, don't rebuild).

Chunk 2 model (reconciles conflict #7): `notes.body` stays the content authority from chunk 1; the
planning surface reads and writes `task` / `event` / `habit` / `nag` blocks. The typed tables are
**disposable derived indexes with stable IDs** (21 Oct "Stable task indexes and lifecycle"; 12 Oct
contracts lean to `notes.body`): a `task` block links to a stable-ID `tasks` row; `calendarEvents`
gains `endsAtMs` (additive); `dayPlans`, `timeBlocks`, `habitCheckIns` and `focusBlocks` are per-day
derived index tables (B01–B02 contracts). "Ordinary unlinked tasks" (quick-add on `/tasks`) stay
typed-only. Folds open factory issues #446 (Journal), #447 (Routines), #457 (Goals), #537 (Today
plan + energy), #1341 (calendar `endsAtMs`). Open conflicts that touch chunk 2 and must NOT be
guessed: week start Sunday/Monday (TRW-1148), nag delivery channel beyond in-app (TRW-1128), where
the user's IANA time zone is stored (TRW-1065).

### TRW-1065 — `dayPlans` derived table + getForDate/upsert/commit (backend)
- WHY: BACKEND-SCHEMA §3 (proposed planner tables); contracts/B01.md; PRD F-05 "Today is today's daily page"; folds #537's plan-panel backend intent.
- SCOPE: `convex/schema.ts` (additive `dayPlans` table), `convex/dayPlans.ts` (new), `convex/dayPlans.test.ts` (new).
- MUTATES: new `dayPlans` table (userId, localDate "YYYY-MM-DD", timezone?, intention?, topTaskIds? max 3, energy? low|medium|high, status draft|committed, committedAt?, reflection?); no existing table field changed.
- STEPS: 1) code-map `convex/schema.ts` and any `convex/dayPlans.ts`; 2) add the table with indexes `by_userId`, `by_userId_deletedAt`, `by_userId_deletedAt_localDate`; 3) `getForDate({localDate})` → `DayPlan|null`; 4) `upsert({localDate, timezone?, intention?, topTaskIds?, energy?})` creates a `draft` or patches an existing plan (never un-commits); 5) `commit({localDate})` idempotent, sets `committedAt`; 6) test create/patch/commit/idempotence and that `topTaskIds` > 3 is rejected.
- DONE: `bun test convex/dayPlans.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: top-3 cap (product rule, BACKEND-SCHEMA §3); `localDate` = ISO 8601 `YYYY-MM-DD` (https://www.iso.org/iso-8601-date-and-time-format.html). Time zone storage (`users` vs `preferences`): UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1025 · Size: ~2.5 h

### TRW-1066 — DayPlanPanel (intention + energy pick + top-3 + commit) on Today
- WHY: APP-FLOW §5 "Plan for today" panel; PRD F-05/F-07; folds #537.
- SCOPE: `apps/web/components/today/DayPlanPanel.tsx`, `apps/web/components/today/` , `apps/web/components/today/day-plan-panel.test.tsx`.
- MUTATES: none (calls `api.dayPlans.*`).
- STEPS: 1) code-map `apps/web/app/(tempo)/today/page.tsx`; 2) render intention input, energy pick (low/medium/high), top-3 list, and the "This is my day" commit button; 3) wire reads to `getForDate` and writes to `upsert`/`commit`; 4) test empty state ("Plan for today") and the three controls render EN/HE.
- DONE: `bun test apps/web/components/today/day-plan-panel.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 3 controls (intention/energy/top-3) from APP-FLOW §5 (product rule); 44×44 px targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: TRW-1065 · Size: ~2 h

### TRW-1067 — Today aggregates all tasks due today (block + linked rows)
- WHY: APP-FLOW §5 step 5 "every task due today"; PRD F-05; folds factory issue #537 (T-PLAN-07).
- SCOPE: `convex/notes.ts` (Today read path), `convex/tasks.ts`, `convex/notes_period.test.ts`.
- MUTATES: none; a Today query merges due-today `task` blocks (via `noteBlocks`) with unlinked typed tasks (via `tasks.listDueInRange`).
- STEPS: 1) code-map `convex/tasks.ts` `listDueInRange` and the `noteBlocks` lift; 2) return a merged, deduped list of tasks due on the local day (block tasks + unlinked typed tasks) ordered by `order`/energy; 3) test dedupe (a task block already linked to a typed row appears once).
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 duplicate tasks shown (product rule); Convex read bound 32,000 docs (https://docs.convex.dev/production/state/limits).
- Pass: 1 · Depends: TRW-1065, TRW-1079 · Size: ~2 h

### TRW-1068 — Energy pick ordering (low/medium/high on Today)
- WHY: APP-FLOW §5 "energy pick"; PRD F-07; folds #537.
- SCOPE: `apps/web/components/today/`, `apps/web/components/today/energy-order.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the Today task list; 2) sort/filter Today's tasks by `energy` (low/medium/high) with a one-tap toggle; 3) test the three orderings.
- DONE: `bun test apps/web/components/today/energy-order.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 3 energy buckets (product rule). No industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: TRW-1067 · Size: ~1.5 h

### TRW-1069 — Top-3 selection (choose ≤3 task ids)
- WHY: BACKEND-SCHEMA §3 `topTaskIds` (max 3); APP-FLOW §5 "top 3 tasks".
- SCOPE: `apps/web/components/today/DayPlanPanel.tsx`, `convex/dayPlans.ts`, `apps/web/components/today/top3.test.tsx`.
- MUTATES: `dayPlans.topTaskIds` (validated ≤3, owned by caller).
- STEPS: 1) code-map; 2) let the user pick up to 3 due-today tasks as "top"; 3) write the ids via `upsert`; 4) test selecting a 4th is refused and the ids persist.
- DONE: `bun test apps/web/components/today/top3.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: max 3 top tasks (BACKEND-SCHEMA §3; product rule).
- Pass: 1 · Depends: TRW-1066 · Size: ~1.5 h

### TRW-1070 — Commit day plan ("This is my day") + reflection
- WHY: APP-FLOW §5 step 1 "This is my day commits the day plan".
- SCOPE: `convex/dayPlans.ts`, `apps/web/components/today/DayPlanPanel.tsx`, `convex/dayPlans.test.ts`.
- MUTATES: `dayPlans.status` draft→committed and `committedAt`; a later edit keeps it committed.
- STEPS: 1) code-map; 2) wire the commit button to `commit({localDate})`; 3) after commit, the plan panel shows the committed summary (intention + top-3) instead of the editor; 4) test commit is idempotent and later `upsert` never un-commits.
- DONE: `bun test convex/dayPlans.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1 committed plan per user per local day (product rule).
- Pass: 1 · Depends: TRW-1065, TRW-1066 · Size: ~1.5 h

### TRW-1071 — Brain-dump capture (inbox rows, raw lines)
- WHY: PRD F-09 "Brain dump → ordered plan → add to Today"; BACKEND-SCHEMA §3 `inboxItems`; APP-FLOW §7 brain-dump empty state.
- SCOPE: `convex/schema.ts` (additive `inboxItems`), `convex/inbox.ts` (new), `convex/inbox.test.ts` (new).
- MUTATES: new `inboxItems` table (userId, rawText, source, status unsorted|sorted|dismissed, urgency?, sortedInto?); captures raw lines, nothing else.
- STEPS: 1) code-map; 2) add the table + `capture({rawText})` splitting on newlines into rows; 3) test split and that nothing else is written.
- DONE: `bun test convex/inbox.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: capture is line-based (product rule); no industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: TRW-1065 · Size: ~2 h

### TRW-1072 — Brain-dump prioritize (rule-based fallback + runtime model path)
- WHY: PRD F-09; APP-FLOW §7 proposal row "turns lines into tasks with duration and reason"; B03 brain dump.
- SCOPE: `convex/brain_dump.ts` (exists), `convex/lib/mockModel.ts`, `convex/brain_dump.test.ts` (exists — extend).
- MUTATES: none (preview only — returns proposal rows, writes nothing).
- STEPS: 1) code-map `convex/brain_dump.ts` `prioritize`; 2) keep the runtime-model path (returns `{summary, priorities[]}` with title/reason/urgency); 3) add a deterministic rule-based fallback (splits by line, urgency now/soon/later) used when the model is unavailable or in tests; 4) test both paths return the same shape and neither writes.
- DONE: `bun test convex/brain_dump.test.ts` exits 0.
- EVIDENCE: test output; no model call in the fallback path.
- Numbers: urgency ∈ {now, soon, later} (B03 contract); runtime model is DeepSeek V4.1 Flash (https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash) — runtime model, never a code model.
- Pass: 1 · Depends: TRW-1071, TRW-1055 · Size: ~2.5 h

### TRW-1073 — Proposal card UI (accept/edit/reject rows)
- WHY: PRD F-09 + "accept / edit / reject"; APP-FLOW §7 proposal screen; 21 Oct "Capture and plan".
- SCOPE: `apps/web/components/brain-dump/`, `apps/web/components/brain-dump/proposal.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map `/brain-dump` route; 2) render proposal rows (title, duration, reason) each with Accept/Edit/Reject; 3) nothing is written until the tap; 4) test accept/edit/reject controls render.
- DONE: `bun test apps/web/components/brain-dump/proposal.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: reject changes nothing (21 Oct acceptance boundary; product rule).
- Pass: 1 · Depends: TRW-1072 · Size: ~2 h

### TRW-1074 — acceptPlan: accepted rows → task blocks on Today (5-min undo)
- WHY: PRD F-09 "add to Today"; B03 `acceptPlan`; APP-FLOW §4 "Add N to Today".
- SCOPE: `convex/brain_dump.ts`, `convex/notes.ts`, `convex/brain_dump.test.ts`.
- MUTATES: writes accepted rows as `task` blocks appended to today's daily page and upserts their linked `tasks` rows; carries a 5-minute undo.
- STEPS: 1) code-map; 2) `acceptPlan({items[]})` (1–6 items) writes each as a task block (fresh ULID) into today's `notes.body` via `notes.save` and upserts a linked `tasks` row; 3) each write records undo; 4) test: accepted rows survive reload, rejected rows are never written.
- DONE: `bun test convex/brain_dump.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1–6 accepted items (B03 contract); every write carries a 5-minute Undo (PRD F-22; product rule).
- Pass: 1 · Depends: TRW-1072, TRW-1079 · Size: ~2.5 h

### TRW-1075 — Edit a proposal row (duration/reason) before accept
- WHY: PRD F-09 + "edit" step; APP-FLOW §7 "edit, reject rows".
- SCOPE: `apps/web/components/brain-dump/`, `apps/web/components/brain-dump/proposal.test.tsx`.
- MUTATES: none (edits the in-memory row only; writes happen on accept).
- STEPS: 1) code-map; 2) allow editing a row's duration and reason inline before accept; 3) test the edited values flow into `acceptPlan`.
- DONE: `bun test apps/web/components/brain-dump/proposal.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: `durationMin` default 15 (BACKEND-SCHEMA §4.4; product rule).
- Pass: 1 · Depends: TRW-1073 · Size: ~1.5 h

### TRW-1076 — Reject / all-rejected leaves nothing written; Add button disabled
- WHY: 21 Oct "Reject changes nothing"; APP-FLOW §7 "All rejected: button off".
- SCOPE: `apps/web/components/brain-dump/`, `apps/web/components/brain-dump/proposal.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) disable "Add to Today" when no row is accepted; 3) reject writes nothing; 4) test all-rejected → button disabled, nothing persisted.
- DONE: `bun test apps/web/components/brain-dump/proposal.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 0 writes on a full reject (21 Oct; product rule).
- Pass: 1 · Depends: TRW-1073 · Size: ~1 h

### TRW-1077 — Sort a dump item into a task, a note, or let go
- WHY: APP-FLOW §5 step 6 "capture, sort into a task or note, or let go"; PRD F-09.
- SCOPE: `apps/web/components/brain-dump/`, `convex/inbox.ts`, `apps/web/components/brain-dump/sort.test.tsx`.
- MUTATES: `inboxItems.status` → sorted (into task/note) or dismissed; may create a task block or a note.
- STEPS: 1) code-map; 2) per item offer: make a task, save as a note, or dismiss ("let go"); 3) dismissed is neutral, never "failed"; 4) test each outcome.
- DONE: `bun test apps/web/components/brain-dump/sort.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 3 outcomes (task/note/let-go) from APP-FLOW §5 (product rule).
- Pass: 1 · Depends: TRW-1071, TRW-1079 · Size: ~2 h

### TRW-1078 — Brain dump is not kept as a page (Q6); no persistent dump page
- WHY: APP-FLOW §9 open question "whether a brain dump is kept as a page"; B03 "the dump is NOT kept as a page (Q6 stays UNKNOWN)".
- SCOPE: `convex/brain_dump.ts`, `convex/inbox.ts`, `convex/brain_dump.test.ts`.
- MUTATES: none; verifies the dump leaves no `notes` row with `pageType: "dump"`.
- STEPS: 1) code-map; 2) assert the capture/prioritize/accept path never creates a persistent dump page; 3) keep `inboxItems` transient (status dismissed after sort); 4) test no dump page is created and note the OPEN Q6 in REPORT.
- DONE: `bun test convex/brain_dump.test.ts` exits 0.
- EVIDENCE: test output; Q6 UNKNOWN noted.
- Numbers: 0 dump pages persisted (B03; product rule). Whether a dump should ever be kept: UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1074, TRW-1077 · Size: ~1 h

### TRW-1079 — Task block quick-add to Today (block + linked task row)
- WHY: PRD F-05 "its tasks are task blocks"; APP-FLOW §3 "Quick-add a task for today"; 21 Oct "Task blocks are authoritative".
- SCOPE: `convex/notes.ts`, `convex/tasks.ts`, `convex/notes_period.test.ts`.
- MUTATES: appends a `task` block to today's daily page `notes.body` (via `notes.save`) and upserts a linked `tasks` row with a stable id; no schema change.
- STEPS: 1) code-map `notes.save` and `tasks.create`; 2) `addTaskToToday({title, durationMin?, energy?, dueAt})` writes the task block and a linked typed row, keeping `block.taskId` = the typed row id; 3) test both the block and the linked row exist and carry the same title.
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: stable id preserved across removal/return (21 Oct; product rule); ULID ids (https://github.com/ulid/spec).
- Pass: 1 · Depends: TRW-1020, TRW-1026 · Size: ~2.5 h

### TRW-1080 — Tick/untick a task block (status now/later/done + linked row sync)
- WHY: APP-FLOW §4 "tap task → tick"; BACKEND-SCHEMA §4.4 task block `status`.
- SCOPE: `convex/notes.ts`, `convex/tasks.ts`, `convex/notes_period.test.ts`.
- MUTATES: `task` block `status` (now/later/done) via `patchBlock`; syncs the linked `tasks` row's `status`.
- STEPS: 1) code-map `notes.patchBlock` and `tasks.toggleCompletion`; 2) implement tick/untick that patches the block and the linked row in one transaction; 3) test done→todo→done and that an unlinked typed task still ticks via the existing function.
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: status ∈ {now, later, done} (BACKEND-SCHEMA §4.4; product rule).
- Pass: 1 · Depends: TRW-1079 · Size: ~2 h

### TRW-1081 — Task edit sheet (title, durationMin, energy, reason)
- WHY: APP-FLOW §4 "Task sheet: edit, delete with undo"; BACKEND-SCHEMA §4.4.
- SCOPE: `apps/web/components/today/`, `convex/notes.ts`, `apps/web/components/today/task-sheet.test.tsx`.
- MUTATES: `task` block `data` via `patchBlock` and the linked `tasks` row fields.
- STEPS: 1) code-map; 2) render a task sheet for title/durationMin/energy/reason; 3) save patches the block and the linked row; 4) test edit persists and reload shows it.
- DONE: `bun test apps/web/components/today/task-sheet.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: `durationMin` default 15, no manual time entry demanded (BACKEND-SCHEMA §4.4; product rule).
- Pass: 1 · Depends: TRW-1079, TRW-1080 · Size: ~2 h

### TRW-1082 — Task soft-delete + 5-min Undo (block + linked row, stable id kept)
- WHY: BACKEND-SCHEMA §2 hard-delete defect `tasks.remove`; PRD F-131 soft delete + undo; folds #530's intent.
- SCOPE: `convex/tasks.ts`, `convex/notes.ts`, `convex/tasks.test.ts` (exists — extend).
- MUTATES: `tasks.remove` becomes soft delete (sets `deletedAt`); removing a task block also soft-deletes its linked row; `restore` clears `deletedAt` within 30 days.
- STEPS: 1) code-map `convex/tasks.ts` `remove` and `convex/lib/softDelete.ts`; 2) `remove` → soft delete returning `{success, undoUntilMs}`; 3) add `restore`; 4) test undo within 5 min restores, restore after 30 days is refused, and the block's linked id survives removal/return.
- DONE: `bun test convex/tasks.test.ts` exits 0.
- EVIDENCE: test output; the remaining `ctx.db.delete` list in REPORT.
- Numbers: 5-min undo, 30-day grace (PRD F-131; product rule).
- Pass: 1 · Depends: TRW-1079 · Size: ~2 h

### TRW-1083 — Unlinked quick-add tasks stay typed (no block)
- WHY: 21 Oct "Ordinary unlinked tasks remain separate"; BACKEND-SCHEMA §2 `tasks` table.
- SCOPE: `convex/tasks.ts`, `apps/web/app/(tempo)/tasks/`, `convex/tasks.test.ts`.
- MUTATES: none; verifies the `/tasks` quick-add path keeps working on the typed table without requiring a block.
- STEPS: 1) code-map `tasks.create`/`listToday`; 2) confirm a quick-add task has no `blockId`/page link and appears on `/tasks`; 3) test create/list/toggle without any `notes` row.
- DONE: `bun test convex/tasks.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: unlinked tasks are first-class (21 Oct; product rule).
- Pass: 1 · Depends: TRW-1082 · Size: ~1.5 h

### TRW-1084 — Carry-over query + strip (open tasks due before today)
- WHY: APP-FLOW §5 step 3 "Still open from earlier days"; B01 `listCarryOver`; folds #530's intent.
- SCOPE: `convex/dayPlans.ts` (or `convex/tasks.ts`), `apps/web/components/today/CarryOverStrip.tsx`, `convex/tasks.test.ts`.
- MUTATES: none; a query returns non-deleted tasks with `status` todo/in_progress and `dueAt <` start of today (max 50, sorted by `dueAt`).
- STEPS: 1) code-map `tasks.listDueInRange`; 2) add `listCarryOver({beforeMs})`; 3) render a "Still open from earlier days" strip with one-tap "move to today"; 4) test the query and the strip.
- DONE: `bun test convex/tasks.test.ts` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: max 50 returned (B01 contract; product rule). No shame copy ("overdue" never shown) — PRD tone rule.
- Pass: 1 · Depends: TRW-1082 · Size: ~2 h

### TRW-1085 — moveTaskToDay (patch dueAt + ensure block on target day)
- WHY: APP-FLOW §5 step 3 "move tasks to today with one tap"; B01 `moveTaskToDay`.
- SCOPE: `convex/dayPlans.ts`, `convex/notes.ts`, `convex/dayPlans.test.ts`.
- MUTATES: patches the task's `dueAt` (and `updatedAt`) and ensures a task block on the target day's page.
- STEPS: 1) code-map; 2) `moveTaskToDay({taskId, dueAt})` patches `dueAt` only and (re)creates the block on the target day; 3) test the move and that the source day no longer shows it as carry-over.
- DONE: `bun test convex/dayPlans.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: patches `dueAt` + `updatedAt` only (B01; product rule).
- Pass: 1 · Depends: TRW-1084 · Size: ~2 h

### TRW-1086 — Task flexibility (fixed vs elastic) on blocks + linked rows
- WHY: PRD F-07 "elastic vs inelastic events"; B02 `tasks.flexibility`.
- SCOPE: `convex/schema.ts` (additive `tasks.flexibility`), `packages/utils/src/blocks.ts`, `convex/tasks.test.ts`.
- MUTATES: adds `flexibility?: "fixed"|"elastic"` (absent = elastic) to the task block schema and the `tasks` row; no existing field changed.
- STEPS: 1) code-map the task block schema (TRW-1017) and `convex/tasks.ts`; 2) add the optional field to both; 3) list returns include it; 4) test round-trip and default (absent = elastic).
- DONE: `bun test convex/tasks.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: default elastic (B02; product rule).
- Pass: 1 · Depends: TRW-1079 · Size: ~1.5 h

### TRW-1087 — Task block ↔ linked task row sync invariant (audit + test)
- WHY: 21 Oct "Canonical body writer re-derives indexes atomically"; keep the block and the typed row from drifting.
- SCOPE: `convex/notes.ts`, `convex/tasks.ts`, `convex/notes_period.test.ts`.
- MUTATES: none; a shared write helper keeps a block and its linked row in one transaction; an audit test asserts they agree.
- STEPS: 1) code-map; 2) extract one `syncTaskBlockAndRow` helper used by quick-add/tick/edit/move; 3) add a test that, after each op, the block `status`/`title` equals the linked row's; 4) test a torn write is rejected (transaction).
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1 transaction per sync (Convex mutations are atomic; https://docs.convex.dev/database/introduction).
- Pass: 1 · Depends: TRW-1080 · Size: ~2 h

### TRW-1088 — Late tasks slide to "Later" without comment (no-shame pacing)
- WHY: APP-FLOW §7 Today screen "late tasks slide to Later without comment"; PRD tone rule "never shame".
- SCOPE: `apps/web/components/today/`, `apps/web/components/today/pacing.test.tsx`.
- MUTATES: none (display only).
- STEPS: 1) code-map the Today list; 2) tasks past their time move to the "Later" section with no "overdue"/"failed" label; 3) test a late task renders in "Later" with neutral copy.
- DONE: `bun test apps/web/components/today/pacing.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 0 shaming strings ("overdue", "failed", "streak lost") — PRD tone rule.
- Pass: 1 · Depends: TRW-1067 · Size: ~1.5 h

### TRW-1089 — `calendarEvents.endsAtMs` additive + event block `endAt` (folds #1341)
- WHY: BACKEND-SCHEMA §3 "calendarEvents.endsAtMs? optional end time"; folds factory issue #1341 (TEMPO-BL-0003).
- SCOPE: `convex/schema.ts` (additive), `convex/calendar_events.ts`, `convex/calendar_events.test.ts`.
- MUTATES: adds optional `endsAtMs` to `calendarEvents` (additive); the strict return validator must change in the same PR; event blocks already carry `endAt` (TRW-1017).
- STEPS: 1) code-map `convex/calendar_events.ts`; 2) add `endsAtMs?: v.number()` and update the return validator; 3) keep `startsAtMs` required; 4) test create with/without `endsAtMs` round-trips.
- DONE: `bun test convex/calendar_events.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: ms timestamps (BACKEND-SCHEMA §4.2); end ≥ start enforced (product rule). No industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: TRW-1025 · Size: ~2 h

### TRW-1090 — `calendar_events.update` (title/start/end) + event block sync
- WHY: B02 contract; BACKEND-SCHEMA §2 "no edit or delete functions"; folds #533's intent.
- SCOPE: `convex/calendar_events.ts`, `convex/notes.ts`, `convex/calendar_events.test.ts`.
- MUTATES: adds `update({eventId, title?, startsAtMs?, endsAtMs?})`; syncs a linked event block's `startAt`/`endAt`.
- STEPS: 1) code-map; 2) implement `update`; 3) sync the event block via `patchBlock`; 4) test edit persists and range queries reflect it.
- DONE: `bun test convex/calendar_events.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: `endsAtMs ≥ startsAtMs` (product rule).
- Pass: 1 · Depends: TRW-1089 · Size: ~2 h

### TRW-1091 — `calendar_events.remove` soft-delete + `restore`
- WHY: B02 contract; BACKEND-SCHEMA §2 "no edit or delete"; PRD F-131 soft delete.
- SCOPE: `convex/calendar_events.ts`, `convex/lib/softDelete.ts`, `convex/calendar_events.test.ts`.
- MUTATES: `remove` soft-deletes (sets `deletedAt`) returning `{success, undoUntilMs}`; `restore` clears `deletedAt` (refused after 30 days).
- STEPS: 1) code-map; 2) `remove` → soft delete; 3) `restore` within 30 days; 4) test undo and expiry.
- DONE: `bun test convex/calendar_events.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-min undo, 30-day grace (PRD F-131).
- Pass: 1 · Depends: TRW-1089 · Size: ~1.5 h

### TRW-1092 — Calendar "add event never appears" fix + time display (folds #527 intent)
- WHY: APP-FLOW §3 "add event never appears (live)"; folds #527's intent.
- SCOPE: `apps/web/app/(tempo)/calendar/`, `convex/calendar_events.ts`, `apps/web/app/(tempo)/calendar/render.test.tsx`.
- MUTATES: none; fixes the list-in-range read so a just-created event appears, and renders start (and end when present) times.
- STEPS: 1) code-map the calendar route and `listInRange`; 2) find why a new event is missing (query window / cache) and fix it; 3) show the time, not date-only; 4) test a created event appears in range.
- DONE: `bun test apps/web/app/(tempo)/calendar/render.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: event shown with its local time (product rule); time range ≤ 32 days (B02 contract).
- Pass: 1 · Depends: TRW-1089 · Size: ~2 h

### TRW-1093 — Event edit dialog (start + end time entry)
- WHY: APP-FLOW §5 step 7 "events get a start and end time, edit"; B02 contract.
- SCOPE: `apps/web/components/calendar/`, `apps/web/components/calendar/event-dialog.test.tsx`.
- MUTATES: none (calls `update`/`create`).
- STEPS: 1) code-map; 2) render an event dialog with start and end time fields; 3) wire to `calendar_events.update`; 4) test edit saves and shows the new times.
- DONE: `bun test apps/web/components/calendar/event-dialog.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: time pickers in the user's local timezone (product rule); 44×44 targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: TRW-1090 · Size: ~2 h

### TRW-1094 — Elastic vs inelastic events (fixed class stays put)
- WHY: PRD F-07 "elastic vs inelastic events (a fixed class stays put)"; BACKEND-SCHEMA §4.4 `event.inelastic: true`.
- SCOPE: `packages/utils/src/blocks.ts`, `convex/notes.ts`, `convex/calendar_events.test.ts`.
- MUTATES: none; `event` blocks are `inelastic: true`; tasks default `inelastic: false` (elastic) so the reflow can move them.
- STEPS: 1) code-map the block schemas; 2) enforce `event.inelastic === true` and default task `inelastic: false`; 3) test the flags.
- DONE: `bun test convex/calendar_events.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: inelastic events never move during reflow (PRD F-07; product rule).
- Pass: 1 · Depends: TRW-1086 · Size: ~1 h

### TRW-1095 — Calendar day/week/month event render (event blocks on views)
- WHY: PRD F-07 "daily, weekly and monthly views"; APP-FLOW §4.
- SCOPE: `apps/web/components/calendar/`, `apps/web/components/calendar/views.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) render events as EventBlocks across day/week/month; 3) inelastic events stay at their time; 4) test each view shows the same event once.
- DONE: `bun test apps/web/components/calendar/views.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 3 views from the same data (PRD F-07; product rule).
- Pass: 1 · Depends: TRW-1094 · Size: ~2.5 h

### TRW-1096 — Habit blocks as the habit authority (name/cadence/window, no streak field)
- WHY: BACKEND-SCHEMA §4.4 `habit` block ("No streak field"); PRD F-10 "events and habits as blocks".
- SCOPE: `packages/utils/src/blocks.ts`, `convex/notes.ts`, `convex/habits.test.ts` (exists — extend).
- MUTATES: none to schema; `habit` blocks carry name/cadence(daily|weekly)/window? and are drawn by HabitBlock (TRW-1023).
- STEPS: 1) code-map the habit block schema and `convex/habits.ts`; 2) confirm the block has no streak field (streaks are derived, informational); 3) link each habit block to a `habits` row; 4) test the block validates and links.
- DONE: `bun test convex/habits.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 streak fields in the block (BACKEND-SCHEMA §4.4; product rule).
- Pass: 1 · Depends: TRW-1017 · Size: ~1.5 h

### TRW-1097 — `habitCheckIns` derived table (per habit per local day)
- WHY: BACKEND-SCHEMA §3 `habitCheckIns`; B01 contract; folds #532's intent.
- SCOPE: `convex/schema.ts` (additive `habitCheckIns`), `convex/habitCheckIns.ts` (new), `convex/habitCheckIns.test.ts` (new).
- MUTATES: new `habitCheckIns` table (userId, habitId, localDate, checkedAt, source, note?); joins `USER_OWNED_TABLES`.
- STEPS: 1) code-map `convex/schema.ts` and `convex/lib/accountDeletion.ts`; 2) add the table + `by_userId_deletedAt_localDate` and `by_habitId_deletedAt_localDate`; 3) `listForDate`, `listForHabit`; 4) test listing and owner isolation.
- DONE: `bun test convex/habitCheckIns.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: one row per habit per local day (uniqueness enforced in the upsert; B01).
- Pass: 1 · Depends: TRW-1096 · Size: ~2 h

### TRW-1098 — Habit check-in by local calendar day (fix rolling 24h window)
- WHY: BACKEND-SCHEMA §2 habits "rolling 24 h window, not a calendar day"; B01 `check`; folds factory issue #532's intent.
- SCOPE: `convex/habitCheckIns.ts`, `convex/habits.ts`, `convex/habitCheckIns.test.ts`.
- MUTATES: `check({habitId, localDate, source, note?})` upserts one check-in per local day and recomputes the `habits` cache; undo = soft delete.
- STEPS: 1) code-map `convex/lib/habitStreak.ts` and `completeToday`; 2) implement `check` keyed by `localDate` (not a rolling UTC window); 3) `undo` soft-deletes and recomputes; 4) test check/undo and that two checks on one day are one row.
- DONE: `bun test convex/habitCheckIns.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: local day = browser-computed `localDate` (B01; product rule); streak fields recomputed, informational only.
- Pass: 1 · Depends: TRW-1097 · Size: ~2.5 h

### TRW-1099 — Habit check-in undo + streak recompute
- WHY: B01 `undo`; PRD F-10 "no streak counters as pressure"; folds #540's intent.
- SCOPE: `convex/habitCheckIns.ts`, `convex/habits.ts`, `convex/habitCheckIns.test.ts`.
- MUTATES: `undo({habitId, localDate})` soft-deletes the check-in and recomputes `currentStreak`/`longestStreak` (informational).
- STEPS: 1) code-map; 2) implement undo + recompute; 3) test undo removes the check-in and the cache reflects it; 4) assert no shaming copy is produced.
- DONE: `bun test convex/habitCheckIns.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: streaks are informational, never "pressure" (PRD F-10; product rule).
- Pass: 1 · Depends: TRW-1098 · Size: ~1.5 h

### TRW-1100 — Habit strip on Today (check/undo from the strip)
- WHY: APP-FLOW §5 step 4 "Habit strip: check and undo by local calendar day"; folds #538's intent.
- SCOPE: `apps/web/components/today/HabitCheckInStrip.tsx`, `apps/web/components/today/`, `apps/web/components/today/habit-strip.test.tsx`.
- MUTATES: none (calls `check`/`undo`).
- STEPS: 1) code-map `TodayHabitStrip`; 2) replace it with a strip that checks/undoes by local day; 3) test check toggles and undo reverts.
- DONE: `bun test apps/web/components/today/habit-strip.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: strip reflects the local calendar day (B01; product rule).
- Pass: 1 · Depends: TRW-1098 · Size: ~2 h

### TRW-1101 — Habit 6-week detail grid
- WHY: APP-FLOW §5 step 4 "/habits/[id] shows a 6-week grid"; folds #541's intent.
- SCOPE: `apps/web/components/habits/HabitDetail.tsx`, `apps/web/components/habits/habit-grid.test.tsx`.
- MUTATES: none (reads `listForHabit`).
- STEPS: 1) code-map the habits detail route; 2) render a 6-week grid from `listForHabit`; 3) test the grid renders checked/unchecked days for a date range.
- DONE: `bun test apps/web/components/habits/habit-grid.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 6-week grid (APP-FLOW §5; product rule).
- Pass: 1 · Depends: TRW-1097 · Size: ~2 h

### TRW-1102 — Habit streak cache recompute helper (informational)
- WHY: BACKEND-SCHEMA §3 "habits cache fields stay and are recomputed"; PRD F-10 no pressure.
- SCOPE: `convex/habits.ts`, `convex/lib/habitStreak.ts` (exists), `convex/habits.test.ts`.
- MUTATES: recomputes `currentStreak`/`longestStreak` from `habitCheckIns` (not a rolling window).
- STEPS: 1) code-map `convex/lib/habitStreak.ts`; 2) recompute from check-ins keyed by local day; 3) keep the values informational (never shown as "streak lost"); 4) test recompute correctness.
- DONE: `bun test convex/habits.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: streak is a count of consecutive local-day check-ins (product rule); no external standard.
- Pass: 1 · Depends: TRW-1098 · Size: ~1.5 h

### TRW-1103 — Habit list + detail routes
- WHY: APP-FLOW §3 "/habits wired but 24h window bug"; folds #455/#540's intent.
- SCOPE: `apps/web/app/(tempo)/habits/`, `apps/web/app/(tempo)/habits/[id]/`, `apps/web/components/habits/habits-screen.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the routes; 2) wire the list to `habits.list` and detail to `habits.get` + `listForHabit`; 3) link detail from the list; 4) test list and detail render.
- DONE: `bun test apps/web/components/habits/habits-screen.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: detail route reachable from the list (product rule).
- Pass: 1 · Depends: TRW-1097, TRW-1101 · Size: ~2 h

### TRW-1104 — Weekly habit cadence + week-start streak rule (OPEN)
- WHY: BACKEND-SCHEMA §7 open question "(5) weekly habit streak rule"; plan conflict #10 week start.
- SCOPE: `convex/habitCheckIns.ts`, `convex/lib/habitStreak.ts`, `convex/habitCheckIns.test.ts`.
- MUTATES: none; implements weekly check-ins against a configurable week anchor, with the anchor marked UNKNOWN.
- STEPS: 1) code-map; 2) weekly cadence counts a check-in once per local week; 3) the week anchor is read from preferences; 4) test weekly cadence and REPORT the OPEN week-start ruling (Amit).
- DONE: `bun test convex/habitCheckIns.test.ts` exits 0.
- EVIDENCE: test output; the OPEN ruling named in REPORT.
- Numbers: week start Sunday vs Monday: UNKNOWN — Amit to answer (plan conflict #10). Weekly streak rule: UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1098 · Size: ~1.5 h

### TRW-1105 — Day view timeline (blocks mounted on a timeline)
- WHY: APP-FLOW §5 "Time blocks on a timeline for the local day"; PRD F-07.
- SCOPE: `apps/web/components/plan/DayTimeline.tsx`, `apps/web/components/plan/day-timeline.test.tsx`.
- MUTATES: none (reads time blocks + task/event blocks).
- STEPS: 1) code-map `/plan` route; 2) render a day timeline with fixed events and flexible tasks; 3) test blocks render at their `startMinute`.
- DONE: `bun test apps/web/components/plan/day-timeline.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: timeline starts at 06:00 by default (product rule; wake-time start: UNKNOWN — Amit to answer).
- Pass: 1 · Depends: TRW-1113 · Size: ~2.5 h

### TRW-1106 — Week grid view
- WHY: PRD F-07 "weekly views"; APP-FLOW §4 "/plan day / week / month".
- SCOPE: `apps/web/components/plan/WeekGrid.tsx`, `apps/web/components/plan/week-grid.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) render 7 columns (one per local day) from the same task/event blocks; 3) test a task appears on its `dueAt` day.
- DONE: `bun test apps/web/components/plan/week-grid.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 7 columns (product rule); week anchor from preferences (week start OPEN — Amit).
- Pass: 1 · Depends: TRW-1105 · Size: ~2 h

### TRW-1107 — Month grid view
- WHY: PRD F-07 "monthly views"; APP-FLOW §4 "/plan month".
- SCOPE: `apps/web/components/plan/MonthGrid.tsx`, `apps/web/components/plan/month-grid.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) render a month grid from the same task/event/time blocks; 3) test a block appears on its local date.
- DONE: `bun test apps/web/components/plan/month-grid.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: month grid keys by `localDate` (product rule).
- Pass: 1 · Depends: TRW-1106 · Size: ~2 h

### TRW-1108 — Reflow scheduler (elastic tasks bend around fixed events)
- WHY: PRD F-07 "a fixed class stays put while a flexible walk bends around it"; ROADMAP P2 `schedule.ts` reflow.
- SCOPE: `packages/utils/src/schedule.ts`, `packages/utils/src/schedule.test.ts`.
- MUTATES: none (pure scheduling; the result is written only on accept).
- STEPS: 1) code-map; 2) implement a deterministic `reflow(blocks)` that keeps inelastic events fixed and packs elastic tasks into the free slots (no overlaps, never moves a fixed item); 3) report unplaced work rather than dropping it; 4) test fixed-stays / elastic-moves / conflict-unplaced.
- DONE: `bun test packages/utils/src/schedule.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 overlaps and 0 fixed-items moved (PRD F-07; product rule). No model call (deterministic) — APP-FLOW §7.
- Pass: 1 · Depends: TRW-1094 · Size: ~2.5 h

### TRW-1109 — Day/week/month derived from the same pages (no separate data)
- WHY: PRD F-07 "daily, weekly and monthly views from the same markdown"; ROADMAP P2 "from the same pages".
- SCOPE: `convex/notes.ts`, `convex/notes_period.test.ts`.
- MUTATES: none; a single read path serves all three views (pageType daily/weekly/monthly + derived indexes).
- STEPS: 1) code-map; 2) confirm the three views read the same `notes.body` + `noteBlocks`, differing only in the date window; 3) test one mutation is reflected in all three views.
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1 source of truth (21 Oct "Markdown is page truth"; product rule).
- Pass: 1 · Depends: TRW-1105, TRW-1107 · Size: ~2 h

### TRW-1110 — Calendar tokens in pages (`{{next_monday}}`, `{{today}}`, `{{tomorrow}}`)
- WHY: PRD F-08 "calendar tokens ({{next_monday}})"; APP-FLOW §6 template flow "resolves tokens like {{next_monday}}".
- SCOPE: `convex/templates.ts`, `convex/lib/templateCatalog.ts`, `convex/templates.test.ts` (exists — extend).
- MUTATES: none; token resolution using the user's local date.
- STEPS: 1) code-map the token set (TRW-1027); 2) implement `{{today}}`, `{{tomorrow}}`, `{{next_monday}}`, `{{next_week}}`, `{{next_month}}`; 3) test each token resolves to the correct local date.
- DONE: `bun test convex/templates.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: ISO 8601 `YYYY-MM-DD` output (https://www.iso.org/iso-8601-date-and-time-format.html); week anchor from preferences (week start OPEN — Amit).
- Pass: 1 · Depends: TRW-1027 · Size: ~1.5 h

### TRW-1111 — View switch UI (day/week/month) + persistence
- WHY: APP-FLOW §4 "/plan day / week / month"; PRD F-07.
- SCOPE: `apps/web/components/plan/`, `apps/web/components/plan/view-switch.test.tsx`.
- MUTATES: none; the chosen view persists per user (preferences).
- STEPS: 1) code-map; 2) render a day/week/month switch; 3) persist the last view; 4) test switching and persistence.
- DONE: `bun test apps/web/components/plan/view-switch.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 3 views (product rule).
- Pass: 1 · Depends: TRW-1106 · Size: ~1.5 h

### TRW-1112 — Reflow determinism test (fixed stays, elastic reflows, no model call)
- WHY: APP-FLOW §7 Plan screen "No model; elastic items reflow around fixed ones".
- SCOPE: `packages/utils/src/schedule.ts`, `apps/web/components/plan/`, `apps/web/components/plan/reflow.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) assert reflow is deterministic (same input → same output) and makes no model call; 3) test an inelastic event never moves while an elastic task reflows around it.
- DONE: `bun test apps/web/components/plan/reflow.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 0 model calls in the Plan screen (APP-FLOW §7; product rule).
- Pass: 1 · Depends: TRW-1108 · Size: ~1.5 h

### TRW-1113 — `timeBlocks` derived table (planned slots)
- WHY: BACKEND-SCHEMA §3 `timeBlocks`; B01 contract.
- SCOPE: `convex/schema.ts` (additive `timeBlocks`), `convex/timeBlocks.ts` (new), `convex/timeBlocks.test.ts` (new).
- MUTATES: new `timeBlocks` table (userId, localDate, dayPlanId?, title, startMinute 0–1439, durationMinutes 5–720, startsAtMs, endsAtMs, kind, taskId?, habitId?, status, source); joins `USER_OWNED_TABLES`.
- STEPS: 1) code-map; 2) add the table + `by_userId_deletedAt_startsAtMs` and `by_taskId`; 3) `listForDate`, `create`, `update`, `setStatus`, `remove` (soft delete); 4) test create/list/soft-delete and the 5–720 minute clamp.
- DONE: `bun test convex/timeBlocks.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: startMinute 0–1439, duration 5–720 min (B01; product rule).
- Pass: 1 · Depends: TRW-1065 · Size: ~2.5 h

### TRW-1114 — Time block create/edit on the timeline
- WHY: APP-FLOW §5 step 2 "Time blocks on a timeline"; B01 contract.
- SCOPE: `apps/web/components/plan/TimeBlockDialog.tsx`, `apps/web/components/plan/`, `apps/web/components/plan/time-block-dialog.test.tsx`.
- MUTATES: none (calls `timeBlocks.create`/`update`).
- STEPS: 1) code-map; 2) drag/create a block on the timeline with title + duration; 3) edit moves/resizes it; 4) test create and edit.
- DONE: `bun test apps/web/components/plan/time-block-dialog.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: duration clamps to 5–720 min (B01).
- Pass: 1 · Depends: TRW-1113 · Size: ~2.5 h

### TRW-1115 — Time block status (planned/done/skipped; "skipped" is neutral)
- WHY: APP-FLOW §5 "tick a block done or let it go ('skipped' is neutral)"; B01 `setStatus`.
- SCOPE: `convex/timeBlocks.ts`, `apps/web/components/plan/`, `convex/timeBlocks.test.ts`.
- MUTATES: `timeBlocks.status` planned|done|skipped; skipped is neutral, never "failed".
- STEPS: 1) code-map; 2) `setStatus` transitions; 3) render done/skipped with neutral copy; 4) test transitions and no-shame copy.
- DONE: `bun test convex/timeBlocks.test.ts` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 3 statuses (B01); 0 shaming strings (PRD tone rule).
- Pass: 1 · Depends: TRW-1113 · Size: ~1.5 h

### TRW-1116 — Time block soft-delete + undo
- WHY: B01 `timeBlocks.remove` (soft delete); PRD F-131.
- SCOPE: `convex/timeBlocks.ts`, `convex/lib/softDelete.ts`, `convex/timeBlocks.test.ts`.
- MUTATES: `remove` soft-deletes (5-min undo window).
- STEPS: 1) code-map; 2) `remove` → soft delete with `{success, undoUntilMs}`; 3) test undo and that a removed block stays restorable 30 days.
- DONE: `bun test convex/timeBlocks.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-min undo, 30-day grace (PRD F-131).
- Pass: 1 · Depends: TRW-1113 · Size: ~1 h

### TRW-1117 — Focus block timer on "Next up" → `focusBlocks` row
- WHY: APP-FLOW §4 "Start → Timer on Next up"; B02 `focusBlocks.create`.
- SCOPE: `convex/schema.ts` (additive `focusBlocks`), `convex/focusBlocks.ts` (new), `convex/focusBlocks.test.ts` (new).
- MUTATES: new `focusBlocks` table (userId, startedAtMs, durationMs, label?, taskId?); a timer start writes a row.
- STEPS: 1) code-map; 2) add the table + `by_userId_deletedAt_startedAtMs`; 3) `create`, `listInRange` (max 93 days), `remove` (soft), `restore`; 4) test start→log→list.
- DONE: `bun test convex/focusBlocks.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: 93-day max range (B02; product rule); 5-min undo (PRD F-131).
- Pass: 1 · Depends: TRW-1113 · Size: ~2.5 h

### TRW-1118 — Focus blocks survive reload
- WHY: APP-FLOW §3 "/tracking focus blocks lost on reload"; folds #534/#544's intent.
- SCOPE: `apps/web/components/tracking/`, `convex/focusBlocks.ts`, `apps/web/components/tracking/focus-persist.test.tsx`.
- MUTATES: none (fixes persistence; the rows come from `focusBlocks`).
- STEPS: 1) code-map `/tracking`; 2) read logged focus blocks from `focusBlocks.listInRange` instead of React state; 3) test a logged block survives reload.
- DONE: `bun test apps/web/components/tracking/focus-persist.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 0 lost focus blocks on reload (APP-FLOW §3; product rule).
- Pass: 1 · Depends: TRW-1117 · Size: ~2 h

### TRW-1119 — Focus tracking list + remove/restore
- WHY: B02 `focusBlocks.remove`/`restore`; APP-FLOW §5 step 5 "logged focus blocks are saved".
- SCOPE: `convex/focusBlocks.ts`, `apps/web/components/tracking/`, `convex/focusBlocks.test.ts`.
- MUTATES: soft-delete/restore of focus blocks.
- STEPS: 1) code-map; 2) list logged blocks with label + duration; 3) remove/restore; 4) test list/remove/restore.
- DONE: `bun test convex/focusBlocks.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: duration shown in minutes (product rule).
- Pass: 1 · Depends: TRW-1117 · Size: ~1.5 h

### TRW-1120 — Timeline start (06:00 or wake time) — UNKNOWN, default 06:00
- WHY: APP-FLOW §9 open question "timeline start (06:00 or wake time)".
- SCOPE: `apps/web/components/plan/`, `apps/web/components/plan/timeline-start.test.tsx`.
- MUTATES: none; the timeline start is a constant with an override hook, defaulted to 06:00.
- STEPS: 1) code-map; 2) default the timeline to 06:00; 3) leave a named hook for a wake-time value; 4) test the default and REPORT the OPEN ruling (Amit).
- DONE: `bun test apps/web/components/plan/timeline-start.test.tsx` exits 0.
- EVIDENCE: test output; the OPEN ruling named in REPORT.
- Numbers: timeline start 06:00 (default) vs wake time: UNKNOWN — Amit to answer.
- Pass: 1 · Depends: TRW-1105 · Size: ~1 h

### TRW-1121 — `nags` table + nag blocks
- WHY: PRD F-60/F-61 "nags in the user's own words"; B03 nag shapes.
- SCOPE: `convex/schema.ts` (additive `nags`), `convex/nags.ts` (new), `convex/nags.test.ts` (new).
- MUTATES: new `nags` table (userId, label, enabled, phrases[] of {id, text, source, status}, createdAt, updatedAt, deletedAt?); nag blocks drawn by NagBlock.
- STEPS: 1) code-map; 2) add the table + `by_userId_deletedAt`; 3) `list`, `create`, `addPhrase`, `decidePhrase`, `setEnabled`, `remove` (soft); 4) test create/list.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: label 1–60 chars, phrase 1–140 chars (B03; product rule).
- Pass: 1 · Depends: TRW-1017 · Size: ~2 h

### TRW-1122 — Nag phrase editor (user's own words; emoji rejected)
- WHY: PRD F-60 "nags are in the user's own words"; BACKEND-SCHEMA §4.4 "emoji rejected".
- SCOPE: `convex/nags.ts`, `apps/web/components/nags/NagPhraseEditor.tsx`, `convex/nags.test.ts`.
- MUTATES: none; `addPhrase` rejects emoji (Zod).
- STEPS: 1) code-map; 2) render a phrase editor accepting only the user's own words (1–140 chars); 3) reject emoji and empty phrases; 4) test emoji rejection and length caps.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 emoji in nag phrases (PRD §6; product rule).
- Pass: 1 · Depends: TRW-1121 · Size: ~1.5 h

### TRW-1123 — Derived nag phrases (propose from the user's own words; show source)
- WHY: PRD F-60 "may offer phrases derived from the user's own words; each shows where it came from"; B03 `proposePhrases`.
- SCOPE: `convex/nags.ts`, `convex/lib/mockModel.ts`, `convex/nags.test.ts`.
- MUTATES: none; `proposePhrases` returns ≤3 derived candidates, writes nothing; each carries `sourceRef`.
- STEPS: 1) code-map; 2) `proposePhrases` derives ≤3 phrases from the accepted user phrases + label (runtime model via the seam; empty when no accepted phrase); 3) test candidates are marked `derived` with a source, and nothing is written.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: ≤3 proposals (B03); 0 writes on propose (product rule).
- Pass: 1 · Depends: TRW-1121, TRW-1055 · Size: ~2 h

### TRW-1124 — Accept/reject phrases; no accepted phrase → cannot enable
- WHY: PRD F-60 "a nag with no accepted phrase cannot be switched on"; B03 `decidePhrase`.
- SCOPE: `convex/nags.ts`, `apps/web/components/nags/`, `convex/nags.test.ts`.
- MUTATES: `decidePhrase` marks a phrase accepted/rejected; enabling is gated on ≥1 accepted phrase.
- STEPS: 1) code-map; 2) accept/reject each derived phrase; 3) test enabling a nag with no accepted phrase throws "Add a phrase you accept first."
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 1 accepted phrase minimum before enable (PRD F-60; product rule).
- Pass: 1 · Depends: TRW-1122, TRW-1123 · Size: ~1.5 h

### TRW-1125 — Nag `setEnabled` guard + soft-delete
- WHY: B03 `setEnabled` / `remove`; PRD F-43 "turn one off".
- SCOPE: `convex/nags.ts`, `convex/lib/softDelete.ts`, `convex/nags.test.ts`.
- MUTATES: `setEnabled` toggles `enabled` (throws when no accepted phrase); `remove` soft-deletes.
- STEPS: 1) code-map; 2) implement the enable guard; 3) soft-delete a nag; 4) test guard + soft delete.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-min undo on delete (PRD F-131).
- Pass: 1 · Depends: TRW-1124 · Size: ~1.5 h

### TRW-1126 — Nag delivery cron (in-app; do-it-now / snooze / not-today)
- WHY: PRD F-60 delivery; APP-FLOW §6 nag flow; B03 delivery.
- SCOPE: `convex/nags.ts`, `convex/crons.ts` (exists), `convex/nags.test.ts`.
- MUTATES: a cron fires the due nag in-app; the answer is logged, never shown as a streak.
- STEPS: 1) code-map `convex/crons.ts`; 2) deliver one nag with one accepted phrase in-app at the due time; 3) answers: "Do it now" (opens Today with the task as Next up), "Snooze", "Not today"; 4) test the answer logging.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: in-app delivery only for now (PRD F-60); channel beyond in-app: UNKNOWN (TRW-1128).
- Pass: 1 · Depends: TRW-1125 · Size: ~2.5 h

### TRW-1127 — Nag answer logging (dosing data, partial credit, never a streak)
- WHY: APP-FLOW §6 "the answer is logged as dosing data, never shown as a streak"; PRD tone rule.
- SCOPE: `convex/nags.ts`, `convex/schema.ts` (additive `nagEvents`), `convex/nags.test.ts`.
- MUTATES: new `nagEvents` (or a `nags.logAnswer`) rows record `firedAt` + `answer` now|snooze|notToday; never a streak.
- STEPS: 1) code-map; 2) log each answer as dosing data (now/snooze/notToday); 3) "Not today" is never failure and earns partial credit; 4) test logging and that no streak is computed.
- DONE: `bun test convex/nags.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: answer ∈ {now, snooze, notToday} (B03); 0 streaks shown (PRD tone rule).
- Pass: 1 · Depends: TRW-1126 · Size: ~1.5 h

### TRW-1128 — Nag delivery channel beyond in-app (OPEN)
- WHY: PRD F-61 "Nag delivery beyond in-app. Channel: UNKNOWN"; plan conflict #11.
- SCOPE: `docs/backlog/REWRITE-PLAN.md` (no code); the OPEN decision is recorded, not built.
- MUTATES: none (this ticket is a decision gate, not an implementation).
- STEPS: 1) confirm in-app delivery (TRW-1126) is the only channel; 2) leave the channel selector stubbed; 3) test nothing outside in-app fires; 4) REPORT the OPEN ruling needed (Amit: which channel — push, email, SMS, WhatsApp?).
- DONE: `bun test convex/nags.test.ts` exits 0 (the in-app path only).
- EVIDENCE: test output; the OPEN channel ruling named.
- Numbers: nag delivery channel beyond in-app: UNKNOWN — Amit to answer (plan conflict #11).
- Pass: 1 · Depends: TRW-1126 · Size: ~1 h

### TRW-1129 — Goal blocks + linked `goals` rows
- WHY: PRD F-08/F-10 goals in the planner surface; BACKEND-SCHEMA §2 `goals` table; folds factory issue #457 (T-SCR-09).
- SCOPE: `convex/goals.ts`, `convex/notes.ts`, `convex/goals.test.ts` (exists — extend).
- MUTATES: links a `goal` block (in a Goals page) to a stable-ID `goals` row; no new table.
- STEPS: 1) code-map `convex/goals.ts` and the `goals` table; 2) confirm/verify `list`/`create`/`update` exist; 3) link goal blocks to `goals` rows and surface them in Today/views via `[[links]]`; 4) test a goal block links to its row.
- DONE: `bun test convex/goals.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1 goal row per goal block (product rule); no industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: TRW-1020 · Size: ~2 h

### TRW-1130 — Goals soft-delete (fix hard-delete defect)
- WHY: BACKEND-SCHEMA §2 hard-delete defect `goals.remove`; PRD F-131.
- SCOPE: `convex/goals.ts`, `convex/lib/softDelete.ts`, `convex/goals.test.ts`.
- MUTATES: `goals.remove` becomes soft delete; add `restore` (30-day grace).
- STEPS: 1) code-map; 2) `remove` → soft delete with undo window; 3) `restore`; 4) test undo + expiry.
- DONE: `bun test convex/goals.test.ts` exits 0.
- EVIDENCE: test output; the remaining `ctx.db.delete` list in REPORT.
- Numbers: 5-min undo, 30-day grace (PRD F-131).
- Pass: 1 · Depends: TRW-1129 · Size: ~1.5 h

### TRW-1131 — Goal progress UI (progressPercent, no pressure)
- WHY: PRD F-08 goals; APP-FLOW §3 "/goals placeholder".
- SCOPE: `apps/web/components/goals/`, `apps/web/app/(tempo)/goals/`, `apps/web/components/goals/goal-progress.test.tsx`.
- MUTATES: none (reads `goals.list` + `progressPercent`).
- STEPS: 1) code-map; 2) render goal cards with a progress bar and status; 3) progress is informational, never shaming; 4) test render and no-shame copy.
- DONE: `bun test apps/web/components/goals/goal-progress.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: progressPercent 0–100 (BACKEND-SCHEMA §2); 0 shaming strings (PRD tone rule).
- Pass: 1 · Depends: TRW-1129 · Size: ~2 h

### TRW-1132 — Goal ↔ task/event links via `[[links]]` and tags
- WHY: PRD F-54 life-graph links; F-08 structured tags.
- SCOPE: `convex/notes.ts`, `convex/goals.ts`, `convex/notes_links.test.ts` (exists — extend).
- MUTATES: none; a goal page's `[[task]]`/tag links resolve to the linked rows via `noteLinks`.
- STEPS: 1) code-map `noteLinks`; 2) link goals to tasks/events by `[[title]]`; 3) test a goal's linked tasks appear in its backlinks.
- DONE: `bun test convex/notes_links.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: explicit `[[links]]` stay apart from AI-guessed links (PRD F-54; product rule).
- Pass: 1 · Depends: TRW-1129, TRW-1019 · Size: ~1.5 h

### TRW-1133 — Goals list/detail/progress routes
- WHY: APP-FLOW §3 "/goals, /goals/[id], /goals/progress placeholder"; folds #458's intent.
- SCOPE: `apps/web/app/(tempo)/goals/`, `apps/web/app/(tempo)/goals/[id]/`, `apps/web/components/goals/goals-screen.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) wire list/detail/progress routes to `goals.list`/`update`; 3) test list and detail render.
- DONE: `bun test apps/web/components/goals/goals-screen.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 3 routes (product rule).
- Pass: 1 · Depends: TRW-1131 · Size: ~2 h

### TRW-1134 — Journal page type + daily-note backend
- WHY: PRD F-04 Daily page; APP-FLOW §3 "/journal placeholder"; folds factory issue #446 (T-SCR-BE-JOURNAL).
- SCOPE: `convex/notes.ts`, `convex/schema.ts` (additive `notes.pageType: "journal"` is already covered by TRW-1025), `convex/notes_period.test.ts`.
- MUTATES: a `pageType: "journal"` page (one per local day) created from the Journal template on first open; no new table.
- STEPS: 1) code-map `pageType` derivation (TRW-1025/1026); 2) journal open creates/loads the journal page for the local date; 3) test idempotence (one journal page per day).
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1 journal page per user per local day (product rule).
- Pass: 1 · Depends: TRW-1026 · Size: ~2 h

### TRW-1135 — Journal editor (markdown, RTL per paragraph)
- WHY: PRD F-72 "mixed Hebrew/English inside one note renders each paragraph in its own direction"; APP-FLOW §4 note page.
- SCOPE: `apps/web/components/journal/`, `apps/web/app/(tempo)/journal/`, `apps/web/components/journal/journal-editor.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the editor (TRW-1007); 2) render the journal page in the markdown editor with `dir="auto"` per paragraph; 3) test a mixed EN/HE paragraph renders each direction.
- DONE: `bun test apps/web/components/journal/journal-editor.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: `dir="auto"` per paragraph (TRD §5b; product rule).
- Pass: 1 · Depends: TRW-1134, TRW-1007 · Size: ~2 h

### TRW-1136 — Journal prompts from the Daily template (gratitude/reflection)
- WHY: PRD F-04 built-in templates; APP-FLOW §6 template flow.
- SCOPE: `convex/templates.ts`, `apps/web/components/journal/`, `convex/templates.test.ts` (exists — extend).
- MUTATES: none; the Journal template body carries gratitude/reflection headings with fresh block ids.
- STEPS: 1) code-map the Daily/Journal template; 2) confirm the journal template includes the prompt sections; 3) test instantiation assigns fresh ULIDs.
- DONE: `bun test convex/templates.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: fresh ULID per instantiated block (https://github.com/ulid/spec).
- Pass: 1 · Depends: TRW-1134, TRW-1027 · Size: ~1.5 h

### TRW-1137 — Journal list + date navigation
- WHY: APP-FLOW §3 "/journal placeholder"; PRD F-04.
- SCOPE: `apps/web/components/journal/`, `apps/web/components/journal/journal-list.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) list past journal pages by date; 3) navigate to a past date's page; 4) test list + navigation.
- DONE: `bun test apps/web/components/journal/journal-list.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: pages ordered by `date` descending (product rule).
- Pass: 1 · Depends: TRW-1134 · Size: ~1.5 h

### TRW-1138 — Journal soft-delete + 30-day grace (amendment to #446)
- WHY: BACKEND-SCHEMA §3 "journalEntries amendment to #446 (add deletedAt)"; PRD F-131.
- SCOPE: `convex/notes.ts`, `convex/lib/softDelete.ts`, `convex/notes_period.test.ts`.
- MUTATES: journal pages soft-delete (30-day grace) like every other note.
- STEPS: 1) code-map notes soft-delete (TRW-1030); 2) confirm journal pages share the same soft-delete; 3) test delete + restore.
- DONE: `bun test convex/notes_period.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 30-day grace (PRD F-131).
- Pass: 1 · Depends: TRW-1134, TRW-1030 · Size: ~1 h

### TRW-1139 — Routine page type + routine blocks
- WHY: PRD F-04/F-08 routines; APP-FLOW §3 "/routines placeholder"; folds factory issue #447 (T-SCR-BE-ROUTINES).
- SCOPE: `convex/notes.ts`, `convex/schema.ts` (additive `routineSteps` or a `routine` block schema), `convex/routines.test.ts` (new).
- MUTATES: a `routine` block type (or a `notes` page with ordered step blocks) backed by a stable-ID row; no existing field changed.
- STEPS: 1) code-map `docs/HARD_RULES.md:108` (routines as `libraryItems`) vs #447; 2) model a routine as a page (`pageType: "routine"`) with ordered step blocks + a linked row; 3) test the model validates.
- DONE: `bun test convex/routines.test.ts` exits 0.
- EVIDENCE: test output; the HARD_RULES-vs-#447 naming conflict noted in REPORT.
- Numbers: routine steps are ordered (product rule); no industry number — UNKNOWN beyond the rule.
- Pass: 1 · Depends: TRW-1025 · Size: ~2 h

### TRW-1140 — Routine definition (ordered steps, cadence)
- WHY: #447 routines backend; PRD F-04.
- SCOPE: `convex/routines.ts` (new), `convex/schema.ts` (additive), `convex/routines.test.ts`.
- MUTATES: a routine's ordered steps and cadence (daily/weekly/adhoc) stored on its row.
- STEPS: 1) code-map; 2) define `create`/`update`/`list` for routines with ordered steps; 3) test ordering and cadence.
- DONE: `bun test convex/routines.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: cadence ∈ {daily, weekly, adhoc} (product rule).
- Pass: 1 · Depends: TRW-1139 · Size: ~2 h

### TRW-1141 — Routine run flow (check off steps)
- WHY: APP-FLOW §3 routines placeholder; PRD F-04.
- SCOPE: `convex/routines.ts`, `apps/web/components/routines/`, `apps/web/components/routines/run-flow.test.tsx`.
- MUTATES: none; a run checks steps off (done/not-done), "not-done" is neutral.
- STEPS: 1) code-map; 2) render a routine with checkable steps; 3) test checking a step off and no-shame copy for skipped steps.
- DONE: `bun test apps/web/components/routines/run-flow.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: skipped steps neutral (PRD tone rule).
- Pass: 1 · Depends: TRW-1140 · Size: ~2 h

### TRW-1142 — Routine list + detail routes
- WHY: APP-FLOW §3 "/routines, /routines/[id] placeholder"; folds #456's intent.
- SCOPE: `apps/web/app/(tempo)/routines/`, `apps/web/app/(tempo)/routines/[id]/`, `apps/web/components/routines/routines-screen.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) wire list/detail to `routines.list`/`get`; 3) test routes render.
- DONE: `bun test apps/web/components/routines/routines-screen.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: detail reachable from the list (product rule).
- Pass: 1 · Depends: TRW-1140 · Size: ~2 h

### TRW-1143 — Routine soft-delete (fix hard-delete defect)
- WHY: BACKEND-SCHEMA §2 hard-delete defects; PRD F-131.
- SCOPE: `convex/routines.ts`, `convex/lib/softDelete.ts`, `convex/routines.test.ts`.
- MUTATES: `remove` soft-deletes + `restore` (30-day grace).
- STEPS: 1) code-map; 2) soft-delete + restore; 3) test undo + expiry.
- DONE: `bun test convex/routines.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-min undo, 30-day grace (PRD F-131).
- Pass: 1 · Depends: TRW-1140 · Size: ~1 h

### TRW-1144 — FD-01 extension e2e (brain dump → proposal → Add N → reload → tick on blocks)
- WHY: PRD §3.1 exit check 2/4; APP-FLOW §4 FD-01 click-path; ROADMAP MVP order 4 "prove reload".
- SCOPE: `tests/e2e/fd01-planning.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map the FD-01 spec (TRW-1057); 2) extend it: brain dump → proposal → Add N to Today → reload (same order) → tick one → habit check → plan commit; 3) assert no JSON anywhere; 4) run it.
- DONE: `bunx playwright test tests/e2e/fd01-planning.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: accepted rows survive reload; 0 raw JSON visible (PRD F-02; 21 Oct acceptance boundary).
- Pass: 2 · Depends: TRW-1074, TRW-1080, TRW-1070 · Size: ~2.5 h

### TRW-1145 — Planning-surface EN/HE strings
- WHY: PRD F-70 English/Hebrew copy; TRD §5b typed message files.
- SCOPE: `apps/web/messages/en.json`, `apps/web/messages/he.json`, `apps/web/lib/locale.test.ts`.
- MUTATES: none; every planning-surface visible string (Today, plan, brain dump, habits, calendar, nags, goals, journal, routines) keyed EN+HE.
- STEPS: 1) code-map the planning-surface components; 2) move their visible copy into `en.json`/`he.json`; 3) missing Hebrew key falls back to English; 4) test switch + fallback.
- DONE: `bun test apps/web/lib/locale.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 100% of visible strings keyed EN+HE (product rule).
- Pass: 2 · Depends: TRW-1058 · Size: ~2.5 h

### TRW-1146 — Planning-surface accessibility (timeline/grid keyboard, contrast, touch)
- WHY: UI-BRIEF §6; include.md §7.2 accessibility baseline.
- SCOPE: `apps/web/components/plan/`, `apps/web/components/calendar/`, `apps/web/components/plan/a11y.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) timeline/grid fully keyboard-navigable, visible focus, labelled controls, 44×44 targets; 3) test focus order and contrast on the plan/calendar components.
- DONE: `bun test apps/web/components/plan/a11y.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: WCAG AA 4.5:1 (3:1 large) contrast (https://www.w3.org/TR/WCAG21/#contrast-minimum); 44×44 targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 2 · Depends: TRW-1111 · Size: ~2.5 h

### TRW-1147 — Planning-surface empty/error/offline states
- WHY: APP-FLOW §7 screen states; 21 Oct "Honest empty/loading/error/offline states".
- SCOPE: `apps/web/components/plan/`, `apps/web/components/brain-dump/`, `apps/web/components/plan/empty-states.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map; 2) implement the exact copy from APP-FLOW §7 (Today "Nothing on today yet…", Plan "Fixed events only", Brain dump "Everything. Any order."); 3) loading + offline states; 4) test each state.
- DONE: `bun test apps/web/components/plan/empty-states.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: no false queued-save promise (21 Oct DESIGN; product rule).
- Pass: 2 · Depends: TRW-1063 · Size: ~2 h

### TRW-1148 — Week start Sunday/Monday + timezone storage (OPEN)
- WHY: BACKEND-SCHEMA §7 open question "(3) week starts Sunday or Monday (code: Monday)"; plan conflicts #10 and #13.
- SCOPE: `convex/preferences.ts` (exists), `apps/web/components/plan/`, `convex/preferences.test.ts`.
- MUTATES: reads `preferences.weekStartsOn` (0|1|6) and `preferences.timeZone`; no schema field is invented.
- STEPS: 1) code-map `convex/preferences.ts` (B04 Preferences shape); 2) wire week/month views and weekly habits to `weekStartsOn`; 3) default stays Monday (code today); 4) test Sunday/Monday rendering and REPORT the OPEN rulings (Amit) for the final anchor and timezone location.
- DONE: `bun test convex/preferences.test.ts` exits 0.
- EVIDENCE: test output; the two OPEN rulings named in REPORT.
- Numbers: week start Sunday vs Monday: UNKNOWN — Amit to answer (plan conflict #10); user's IANA time zone location (`users` vs `preferences`): UNKNOWN — Amit to answer (plan conflict #13).
- Pass: 2 · Depends: TRW-1111 · Size: ~1.5 h


## Rewrite — Chunk 3 (MVP · Coach & memory), tickets TRW-1149 … TRW-1232

Added 1 Nov 2026 per `docs/backlog/REWRITE-PLAN.md`. All 84 tickets, in dependency order.
Format per ticket: WHY / SCOPE / MUTATES / STEPS / DONE / EVIDENCE / Numbers / Pass + Depends + Size.
STEPS step 1 is always the Graphify code-map check (the unit may already exist on `integration` — then
verify and add the missing test, don't rebuild).

Chunk 3 deepens the chunk 1 foundation rather than re-laying it. Chunk 1 built the memory adapter
skeleton (remember / recall / context / forget / export / import + vector index + embedding pick,
TRW-1039–1046) and the coach Agent skeleton (tools, crisis card, mock model, entitlement gate,
TRW-1047–1056). Chunk 3 wires the four-way semantic recall (meaning + keyword + links + time), the
forget lifecycle, nightly reflect → observations, the life graph (`entities` + `edges`), the Hebrew
embedding eval, and the adaptive coach (dial injection, bad-day, panic 10-second action, realism,
forgiveness, graduated load 2→4, late-task slide). It folds the chunk-3 wiring of open factory
issues #743 (real AI replies via the seam) and #744 (Thinking state + Retry). Open conflicts that
touch chunk 3 and must NOT be guessed: forget hard vs soft (TRW-1155/1156), accept-reject vs
auto-apply + confidence threshold (TRW-1199), interim text model GLM vs DeepSeek (TRW-1202/1203),
HARD_RULES §2 AI SDK vs TRD §3 (TRW-1203).

### TRW-1149 — Recall four-way merge (meaning + keyword + links + time)
- WHY: PRD F-54 "Search by meaning + keyword + links + time"; TRD §5c "Recall, four ways".
- SCOPE: `convex/memory.ts`, `convex/memory.test.ts` (extend), `convex/lib/recall.ts` (new).
- MUTATES: none; `recall` returns a merged, deduped list from four legs.
- STEPS: 1) code-map `convex/memory.ts` `recall` (exists, keyword-only today) and `convex/memories.ts`; 2) add `convex/lib/recall.ts` with `mergeResults(legs, limit)` that dedupes by memory id, keeps the highest leg score, and caps at `limit`; 3) make `recall` call the four legs and merge; 4) test each leg alone and the merge (dedupe + cap + rank order).
- DONE: `bun test convex/memory.test.ts` exits 0 with a four-leg merge case.
- EVIDENCE: test output; `recall.ts` diff.
- Numbers: cap 256 results per vector leg (https://docs.convex.dev/search/vector-search); merged cap `limit` (product rule).
- Pass: 1 · Depends: TRW-1041 · Size: ~2.5 h

### TRW-1150 — Memories full-text search index (keyword leg)
- WHY: PRD F-50 "recall searches by meaning and by keyword"; TRD §5 "the existing search index (keyword)".
- SCOPE: `convex/schema.ts` (additive search index on `memories.content`), `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: a `searchIndex` on `memories.content` (filter field `userId`); no existing field changed.
- STEPS: 1) code-map `convex/schema.ts` `memories` (has no search index today); 2) add `searchIndex: "content"` with `searchField: "content"` and `filterFields: ["userId"]`; 3) confirm `recall`'s keyword leg uses it; 4) test a keyword hit returns the memory and a miss returns nothing.
- DONE: `bun test convex/memory.test.ts` exits 0 with a keyword-leg case.
- EVIDENCE: test output; schema diff.
- Numbers: Convex search index is per-table and filtered by `userId` (https://docs.convex.dev/search/text-search).
- Pass: 1 · Depends: TRW-1149 · Size: ~2 h

### TRW-1151 — Memories vector index + embedding write path (meaning leg)
- WHY: TRD §5 "`memories` gains an `embedding` field and a vector index (1024 dims, filter field `userId`)"; PRD F-50.
- SCOPE: `convex/schema.ts` (additive `embedding` + `vectorIndex`), `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: `memories.embedding` (float32 array) + a 1,024-dim `vectorIndex`; `remember` writes the embedding.
- STEPS: 1) code-map chunk 1 TRW-1039/1040 (`embedding` + `remember`) — if present, verify and add the missing test; 2) confirm `remember` runs the embedding model in an action and stores the 1,024-dim vector; 3) test remember stores a vector and recall's meaning leg hits it.
- DONE: `bun test convex/memory.test.ts` exits 0 with a meaning-leg case.
- EVIDENCE: test output.
- Numbers: 1,024 dims (Matryoshka truncation of Qwen3-Embedding-8B's native 4,096), Convex vector range 2–2,048 dims (https://docs.convex.dev/search/vector-search).
- Pass: 1 · Depends: TRW-1039, TRW-1150 · Size: ~2.5 h

### TRW-1152 — Links leg: recall across `edges` (life-graph links)
- WHY: PRD F-54 "Search by … links"; TRD §5c `edges` table with `origin` extracted|inferred.
- SCOPE: `convex/schema.ts` (additive `edges` table), `convex/lib/recall.ts`, `convex/memory.test.ts`.
- MUTATES: new `edges` table (userId, from, to, relation, origin, confidence, sourceRef); the links leg reads it.
- STEPS: 1) code-map `convex/schema.ts` for any `edges`/`entities`; 2) add the `edges` table with `by_userId`, `by_userId_origin`, `by_userId_deletedAt` indexes; 3) the links leg returns memories reachable from the query's entities; 4) test a linked memory surfaces in recall.
- DONE: `bun test convex/memory.test.ts` exits 0 with a links-leg case.
- EVIDENCE: test output; schema diff.
- Numbers: `origin` ∈ {extracted, inferred} (TRD §5c; product rule). Link rank weight: UNKNOWN — Amit to confirm.
- Pass: 1 · Depends: TRW-1164, TRW-1165 · Size: ~2.5 h

### TRW-1153 — Time leg: recall by `createdAt` range (recent first)
- WHY: PRD F-54 "Search by … time"; TRD §5c "time (`createdAt` index)".
- SCOPE: `convex/memory.ts`, `convex/lib/recall.ts`, `convex/memory.test.ts`.
- MUTATES: none; the time leg reads `memories` ordered by `createdAt`.
- STEPS: 1) code-map `convex/memory.ts` and `memories.by_userId` index; 2) add `by_userId_createdAt` index; 3) the time leg returns the most recent `k` memories for the user; 4) test ordering and a `since`/`until` bound.
- DONE: `bun test convex/memory.test.ts` exits 0 with a time-leg case.
- EVIDENCE: test output.
- Numbers: `createdAt` ms ordering (repo convention); ISO 8601 for any date argument (https://www.iso.org/iso-8601-date-and-time-format.html).
- Pass: 1 · Depends: TRW-1149 · Size: ~1.5 h

### TRW-1154 — Recall merge dedupe + rank (unify the four legs)
- WHY: PRD F-54; the four legs must never surface a duplicate or cross users.
- SCOPE: `convex/lib/recall.ts`, `convex/memory.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `recall.ts` from TRW-1149; 2) rank merged results by a weighted score (meaning > keyword > links > time; weights UNKNOWN — default 4/3/2/1, mark for Amit); 3) dedupe by id keeping the best score; 4) test duplicate suppression, rank stability, and that no other user's memory ever appears.
- DONE: `bun test convex/memory.test.ts` exits 0 with cross-user isolation + rank cases.
- EVIDENCE: test output.
- Numbers: 0 cross-user leakage (PRD F-130; security rule). Leg weights: UNKNOWN — Amit to confirm.
- Pass: 1 · Depends: TRW-1151, TRW-1152, TRW-1153 · Size: ~2 h

### TRW-1155 — Forget semantics: hard vs soft (OPEN #8 carried)
- WHY: PRD "soft delete everywhere" vs memory spec "forget must be complete"; plan conflict #8.
- SCOPE: `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: none (verification only); `forget` keeps today's behaviour (soft delete + `restore`).
- STEPS: 1) code-map `convex/memory.ts` `forget`/`restore` (both exist, soft-delete); 2) confirm `forget` soft-deletes with 30-day grace and `restore` revives; 3) test forget → recall-excluded → restore → recall-included; 4) REPORT the OPEN ruling (Amit) for hard vs soft in the PR body.
- DONE: `bun test convex/memory.test.ts` exits 0 with a forget/restore round-trip.
- EVIDENCE: test output; the OPEN ruling named in REPORT.
- Numbers: 30-day grace (PRD F-131). Hard vs soft delete for `forget`: UNKNOWN — Amit to answer (plan conflict #8).
- Pass: 1 · Depends: TRW-1043 · Size: ~1.5 h

### TRW-1156 — Forget one memory (soft-delete parity, note OPEN)
- WHY: PRD F-52 "forget memories"; TRD §5 `forget(userId, memoryId | all)`.
- SCOPE: `convex/memory.ts`, `convex/lib/softDelete.ts`, `convex/memory.test.ts`.
- MUTATES: `forget({memoryId})` soft-deletes one memory; `forgetAll` soft-deletes all.
- STEPS: 1) code-map `forget`/`forgetAll` (exist); 2) ensure `forget` rejects a memory owned by another user; 3) test single forget, cross-user refusal, and that a forgotten memory is excluded from `recall` and `context`.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 cross-user forget allowed (PRD F-130).
- Pass: 1 · Depends: TRW-1155 · Size: ~1.5 h

### TRW-1157 — Forget-all + restore-all verification
- WHY: TRD §5 `forget(userId, all)`; PRD F-52.
- SCOPE: `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: none (verify `forgetAll`/`restoreAll`).
- STEPS: 1) code-map `forgetAll`/`restoreAll` (exist); 2) test forget-all clears recall/context, restore-all revives, and neither touches another user; 3) add the missing edge-case test (empty set, idempotence).
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: forget-all is scoped to `userId` (PRD F-130).
- Pass: 1 · Depends: TRW-1156 · Size: ~1 h

### TRW-1158 — Export all memories as markdown (verify + test)
- WHY: PRD F-52 "export all memories as markdown"; TRD §5 `export(userId)`.
- SCOPE: `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: none (verify `exportAll`).
- STEPS: 1) code-map `exportAll` (exists); 2) confirm it returns every live memory as plain markdown with metadata; 3) test shape (one block per memory, no JSON leak) and that it excludes forgotten rows.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: every live memory included (PRD F-52); 0 forgotten rows (product rule).
- Pass: 1 · Depends: TRW-1044 · Size: ~1 h

### TRW-1159 — Memory import format handling (ChatGPT / Claude / paste)
- WHY: PRD F-51 "upload or paste your ChatGPT or Claude memory"; TRD §5 `importPreview(..., source)`.
- SCOPE: `convex/memoryImport.ts`, `convex/lib/memoryImport.ts`, `convex/memoryImport.test.ts`.
- MUTATES: none (preview only); recognises `.txt`, `.md`, `.json` and pasted text.
- STEPS: 1) code-map `convex/memoryImport.ts` + `convex/lib/memoryImport.ts` (exist); 2) ensure the parser accepts `.txt`, `.md`, `.json` and pasted text and tags `source` chatgpt|claude|paste; 3) test each source and a malformed file fails cleanly with a message, never a crash; 4) REPORT the exact ChatGPT/Claude export formats as UNKNOWN where they are not pinned.
- DONE: `bun test convex/memoryImport.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: exact ChatGPT/Claude memory export formats: UNKNOWN — Amit to confirm (TRD open question 6).
- Pass: 1 · Depends: TRW-1045 · Size: ~2.5 h

### TRW-1160 — importPreview split candidates (verify + test)
- WHY: PRD F-51 "shows each item to keep, edit or drop"; TRD §5 "Split pasted or uploaded text into candidate items; nothing is saved".
- SCOPE: `convex/memoryImport.ts`, `convex/memoryImport.test.ts`.
- MUTATES: none (preview returns candidate items, writes nothing).
- STEPS: 1) code-map `importPreview`; 2) confirm it splits into candidate items with no write; 3) test split on newlines/records and that nothing is persisted.
- DONE: `bun test convex/memoryImport.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 rows written by preview (PRD F-51).
- Pass: 1 · Depends: TRW-1159 · Size: ~1.5 h

### TRW-1161 — importCommit with `metadata.source`
- WHY: PRD F-51 "saves the kept items"; TRD §5 "`remember` for each kept item, with `metadata.source`".
- SCOPE: `convex/memoryImport.ts`, `convex/memoryImport.test.ts`.
- MUTATES: writes a `memories` row per kept item (via `remember`), each with `metadata.source`.
- STEPS: 1) code-map `importCommit`; 2) confirm it calls `remember` per kept item and carries `metadata.source`; 3) test kept items persist with the right source and dropped items never persist.
- DONE: `bun test convex/memoryImport.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: kept items saved, dropped items not saved (PRD F-51).
- Pass: 1 · Depends: TRW-1160 · Size: ~1.5 h

### TRW-1162 — Salience decay + access tracking (verify)
- WHY: `memories` schema has `salience`, `decayRate`, `lastAccessed`, `accessCount`; PRD F-50 memory adapter sits on it.
- SCOPE: `convex/memories.ts`, `convex/memories.test.ts`.
- MUTATES: none (verify `decayMemories` + access tracking).
- STEPS: 1) code-map `convex/memories.ts` `decayMemories`/`updateSalience`/`extractMemories` (exist); 2) confirm recall bumps `accessCount`/`lastAccessed`; 3) test a decay pass lowers salience without deleting, and access tracking increments.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: decay never hard-deletes (PRD F-131 soft-delete rule).
- Pass: 1 · Depends: TRW-1040 · Size: ~1.5 h

### TRW-1163 — Memory stats by sector (verify)
- WHY: `memories` has `sector` (semantic/episodic/procedural/emotional/general); insights reference it.
- SCOPE: `convex/memories.ts`, `convex/memories.test.ts`.
- MUTATES: none (verify `getMemoryStats`).
- STEPS: 1) code-map `getMemoryStats` (exists); 2) confirm it counts live memories per sector and ignores forgotten rows; 3) test counts and empty-state.
- DONE: `bun test convex/memories.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: counts reflect live (non-deleted) rows only (product rule).
- Pass: 1 · Depends: TRW-1162 · Size: ~1 h

### TRW-1164 — `entities` table (additive) + schema
- WHY: PRD F-54 "people, projects, goals, places and habits, linked"; TRD §5c `entities` table.
- SCOPE: `convex/schema.ts` (additive `entities` table), `convex/entities.ts` (new), `convex/entities.test.ts` (new).
- MUTATES: new `entities` table (userId, kind person|project|goal|place|habit, name, aliases, embedding); no existing field changed.
- STEPS: 1) code-map `convex/schema.ts` for `entities`; 2) add the table with `by_userId`, `by_userId_kind`, `by_userId_deletedAt`; 3) add `convex/entities.ts` `upsert`/`list`/`remove` (soft-delete); 4) test upsert dedupes on (name, kind), remove soft-deletes.
- DONE: `bun test convex/entities.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: `kind` ∈ {person, project, goal, place, habit} (TRD §5c; product rule).
- Pass: 1 · Depends: TRW-1030 · Size: ~2.5 h

### TRW-1165 — `edges` table (additive) + origin extracted|inferred
- WHY: TRD §5c `edges` table with `origin` extracted|inferred and `confidence`.
- SCOPE: `convex/schema.ts` (additive `edges` table), `convex/edges.ts` (new), `convex/edges.test.ts` (new).
- MUTATES: new `edges` table (userId, from, to, relation, origin, confidence, sourceRef); no existing field changed.
- STEPS: 1) code-map for `edges`; 2) add the table (indexes `by_userId`, `by_userId_origin`, `by_userId_deletedAt`); 3) `convex/edges.ts` `upsert`/`listByEntity`/`remove`; 4) test origin enum, confidence bounds [0,1], soft delete.
- DONE: `bun test convex/edges.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: `origin` ∈ {extracted, inferred} (TRD §5c); `confidence` ∈ [0,1] (product rule).
- Pass: 1 · Depends: TRW-1164 · Size: ~2 h

### TRW-1166 — Retain action: extract entities + claims after chat turn / page save
- WHY: TRD §5c "after each chat turn and each page save, a scheduled action extracts entities and claims into memories + entities + edges".
- SCOPE: `convex/retain.ts` (new), `convex/retain.test.ts` (new).
- MUTATES: writes `memories` (claims) + `entities` + `edges` (extracted origin).
- STEPS: 1) code-map for any retain/extract action; 2) add `retain({sourceText, sourceRef})` that extracts entities and claims and upserts them with `origin: extracted`; 3) wire it to run after a coach turn and after `notes.save` (post-write, best-effort); 4) test extraction writes extracted-origin rows and never inferred rows.
- DONE: `bun test convex/retain.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: extraction origin = `extracted` only (TRD §5c); retention is best-effort and never blocks a save (product rule).
- Pass: 1 · Depends: TRW-1164, TRW-1165 · Size: ~3 h

### TRW-1167 — Inferred links marked as guesses (distinct from user `[[links]]`)
- WHY: PRD F-54 "links the user wrote (`[[links]]`, blocks) are kept apart from links the AI guessed, which are marked as guesses"; TRD §5c `origin`.
- SCOPE: `convex/retain.ts`, `convex/edges.ts`, `convex/retain.test.ts`.
- MUTATES: `edges.origin` — user-written links stay `extracted`; model-guessed links are `inferred`.
- STEPS: 1) code-map wiki-links extraction (`packages/utils/src/wiki-links.ts`); 2) ensure `[[links]]` from a page → `origin: extracted` with `sourceRef`; 3) ensure model-guessed links → `origin: inferred` with `confidence`; 4) test the two never merge and inferred links render a "guess" marker.
- DONE: `bun test convex/retain.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: `origin` distinguishes extracted vs inferred (TRD §5c; product rule).
- Pass: 1 · Depends: TRW-1166 · Size: ~2 h

### TRW-1168 — Life-graph query: by meaning + keyword + links + time
- WHY: PRD F-54 "Search by meaning + keyword + links + time" over the life graph.
- SCOPE: `convex/lib/recall.ts`, `convex/entities.ts`, `convex/memory.test.ts`.
- MUTATES: none; a query returns entities + edges + supporting memories.
- STEPS: 1) code-map `recall` (TRW-1154); 2) add `lifeGraph({query})` returning matched entities, their edges, and the memories that support them; 3) test each of the four ways and a merged result.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: merged result deduped and owner-scoped (PRD F-130).
- Pass: 1 · Depends: TRW-1154, TRW-1165 · Size: ~2.5 h

### TRW-1169 — Life-graph basic view (explorable list + map)
- WHY: PRD F-54 "a Graphify / Understand Anything-style graph, but for life projects"; TRD §5c "Graph view … END".
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/life-graph.test.tsx`.
- MUTATES: none (reads `lifeGraph`).
- STEPS: 1) code-map the memory screens; 2) render a basic explorable list of entities + their edges (tap an entity to expand); 3) mark inferred edges with a "guess" badge; 4) test the list and the guess badge render EN/HE.
- DONE: `bun test apps/web/components/memory/life-graph.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: inferred edges visibly marked (PRD F-54); 44×44 px targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: TRW-1168 · Size: ~2.5 h

### TRW-1170 — Reflect cron → observations (nightly, `crons.ts`)
- WHY: PRD F-55 "a scheduled pass turns many memories into observations"; TRD §5c "Reflect: a Convex cron consolidates memories into `observations`"; §5d "nightly reflect (MVP)".
- SCOPE: `convex/crons.ts` (add a cron), `convex/reflect.ts` (new), `convex/reflect.test.ts` (new).
- MUTATES: writes `observations` rows (new additive table) + a nightly `crons` entry.
- STEPS: 1) code-map `convex/crons.ts` (empty today); 2) add the `observations` table (userId, text, memoryIds, createdAt, deletedAt); 3) add `convex/reflect.ts` `runReflect` consolidating memories into observations, each storing its supporting `memoryIds`; 4) register a nightly cron; 5) test `runReflect` produces observations with correct `memoryIds` and is idempotent per day.
- DONE: `bun test convex/reflect.test.ts` exits 0.
- EVIDENCE: test output; schema diff.
- Numbers: observations carry their supporting memory ids (TRD §5c); cron runs once nightly (product rule).
- Pass: 1 · Depends: TRW-1040 · Size: ~3 h

### TRW-1171 — Observations rows + delete (schema + mutation)
- WHY: PRD F-55 "Observations are shown to the user and can be deleted"; TRD §5c.
- SCOPE: `convex/reflect.ts`, `convex/schema.ts` (additive `observations`), `convex/reflect.test.ts`.
- MUTATES: `observations.remove` soft-deletes one observation.
- STEPS: 1) code-map `observations` from TRW-1170; 2) add `remove({observationId})` soft-delete; 3) test delete + 30-day grace and cross-user refusal.
- DONE: `bun test convex/reflect.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 30-day grace (PRD F-131); 0 cross-user delete (PRD F-130).
- Pass: 1 · Depends: TRW-1170 · Size: ~1.5 h

### TRW-1172 — Reflect show observations to user (UI)
- WHY: PRD F-55 "Observations are shown to the user"; APP-FLOW §6 memory flow.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/observations.test.tsx`.
- MUTATES: none (reads observations; delete calls `observations.remove`).
- STEPS: 1) code-map the memory screens; 2) render the observations list with the exact "gym slips after late nights"-style copy and a delete affordance; 3) test list + delete render EN/HE.
- DONE: `bun test apps/web/components/memory/observations.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: observations deletable, never a streak (PRD F-55 tone rule).
- Pass: 1 · Depends: TRW-1171 · Size: ~2 h

### TRW-1173 — Hebrew embedding eval run (Qwen3 vs bge-m3 vs e5, top-3 hit rate)
- WHY: TRD §5 "Before locking one, run a check on 20 Hebrew + 20 English questions against about 200 of Amit's own notes. Compare Qwen3-Embedding-8B, bge-m3 and multilingual-e5-large-instruct on top-3 hit rate."
- SCOPE: `scripts/embedding-eval/` (new), `scripts/embedding-eval/run.ts`, `scripts/embedding-eval/README.md`.
- MUTATES: none (read-only eval; writes a report file).
- STEPS: 1) code-map for an existing eval harness (chunk 1 TRW-1046 may have seeded one); 2) implement a runner that embeds 20 Hebrew + 20 English questions and about 200 notes, then scores each model's top-3 hit rate; 3) run it and write `top3HitRate` per model to the report; 4) if the eval cannot run (no key/no corpus), write `UNKNOWN` with the reason.
- DONE: `bun run scripts/embedding-eval/run.ts` prints a per-model top-3 hit rate table.
- EVIDENCE: report file + console output.
- Numbers: Qwen3-Embedding-8B multilingual MTEB 70.58 (DeepInfra catalogue); top-3 hit rate target: UNKNOWN — Amit to set the acceptance bar.
- Pass: 1 · Depends: TRW-1046 · Size: ~3 h

### TRW-1174 — Embedding model lock + record winner
- WHY: TRD §5 "Changing the model later means re-embedding everything" — lock once the eval (TRW-1173) has numbers.
- SCOPE: `convex/memory.ts`, `convex/lib/embedding.ts` (new), `convex/memory.test.ts`.
- MUTATES: none; the chosen model id + dims live in one place.
- STEPS: 1) code-map where the embedding model id is referenced; 2) centralise it in `convex/lib/embedding.ts` (`EMBEDDING_MODEL`, `EMBEDDING_DIMS`); 3) default stays `Qwen/Qwen3-Embedding-8B` at 1,024 dims until the eval says otherwise; 4) test the constants drive the write path.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 1,024 dims (Matryoshka truncation, TRD §5). Final model: UNKNOWN — Amit to confirm from the eval.
- Pass: 1 · Depends: TRW-1173 · Size: ~1.5 h

### TRW-1175 — Re-embed migration path (model change → re-embed all)
- WHY: TRD §5 "Changing the model later means re-embedding everything."
- SCOPE: `convex/lib/embedding.ts`, `convex/memory.ts`, `convex/memory.test.ts`.
- MUTATES: none (a migration action re-embeds `memories` without deleting rows).
- STEPS: 1) code-map `remember`'s embedding write; 2) add `reEmbedAll()` (action) that re-embeds every live memory with the current model, in bounded batches; 3) test it re-writes vectors and leaves content untouched.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: bounded batches ≤ 100 docs/read to stay under Convex limits (https://docs.convex.dev/production/state/limits).
- Pass: 1 · Depends: TRW-1174 · Size: ~2 h

### TRW-1176 — Past-chat hybrid search (Agent `contextOptions`, `searchOtherThreads`)
- WHY: PRD F-50 "the coach can also search the user's past chats"; TRD §5 "Past chats come from the Agent's `contextOptions.searchOptions` with textSearch and vectorSearch on, and searchOtherThreads: true".
- SCOPE: `convex/coach.ts`, `convex/lib/agentComponent.ts`, `convex/coach.test.ts`.
- MUTATES: none (Agent context configuration).
- STEPS: 1) code-map `convex/coach.ts` Agent definition and `convex/lib/agentComponent.ts`; 2) enable `contextOptions.searchOptions` with `textSearch` + `vectorSearch` and `searchOtherThreads: true` for the same user; 3) test past-thread content is surfaced to the model context and other users' threads are not.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: search scoped to `userId` (PRD F-130); 0 cross-user thread leakage.
- Pass: 1 · Depends: TRW-1047 · Size: ~2 h

### TRW-1177 — Pages searchable via `@convex-dev/rag` (per-user namespace)
- WHY: TRD §5 "Pages are searchable through `@convex-dev/rag`, one namespace per user, as the coach's `searchMemory` tool".
- SCOPE: `convex/rag.ts` (new), `convex/search.ts`, `convex/search.test.ts` (extend).
- MUTATES: none; page content is indexed into a per-user RAG namespace.
- STEPS: 1) code-map `convex/search.ts` (has `all`); 2) add a per-user RAG namespace with the `notes` pages as sources; 3) expose `searchPages({query})`; 4) test a page query returns the right page and never another user's page.
- DONE: `bun test convex/search.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: one namespace per user (TRD §5); 0 cross-user results (PRD F-130).
- Pass: 1 · Depends: TRW-1050 · Size: ~2.5 h

### TRW-1178 — `searchMemory` tool reads pages + memories (wiring)
- WHY: PRD F-21 "the coach reads the user's pages and memory for context"; TRD §1 `searchMemory` tool.
- SCOPE: `convex/coach.ts`, `convex/mcpTools.ts`, `convex/coach.test.ts`.
- MUTATES: none; `searchMemory` returns merged page + memory results.
- STEPS: 1) code-map `searchMemory` (chunk 1 TRW-1050); 2) make it call `recall` (memory) + `searchPages` (RAG); 3) test the tool returns both and a mock-model turn uses it; 4) no real model call in the test.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 network calls in tests (include.md §7.8); merged results owner-scoped (PRD F-130).
- Pass: 1 · Depends: TRW-1154, TRW-1177 · Size: ~2 h

### TRW-1179 — Dial 0–10 injection into the system prompt
- WHY: PRD F-25 "dial 0–10"; `.cursorrules` "inject the current value into the system prompt".
- SCOPE: `convex/coach.ts`, `convex/lib/coachPrompt.ts`, `convex/lib/coachPrompt.test.ts`.
- MUTATES: none; the dial value is injected into the coach system prompt per turn.
- STEPS: 1) code-map `coach.setDial` (exists) and `convex/lib/coachPrompt.ts` (exists); 2) confirm the stored dial is read and injected as a numbered instruction (0 = gentle, 10 = firm); 3) test each dial value (0, 5, 10) changes the prompt deterministically.
- DONE: `bun test convex/lib/coachPrompt.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: dial range 0–10 inclusive (product rule).
- Pass: 1 · Depends: TRW-1047 · Size: ~2 h

### TRW-1180 — Coach chat opens at the current dial
- WHY: APP-FLOW §6 "Coach: opens at the current dial (0–10)".
- SCOPE: `apps/web/components/coach/`, `apps/web/components/coach-controls/`, `apps/web/components/coach/dial.test.tsx`.
- MUTATES: none (reads `coach.getSettings`).
- STEPS: 1) code-map `coach-controls` (dial control exists); 2) render the dial at the stored value on open; 3) test the initial value loads and a change persists via `setDial`.
- DONE: `bun test apps/web/components/coach/dial.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: dial 0–10 (product rule); 44×44 px targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: TRW-1179 · Size: ~1.5 h

### TRW-1181 — Bad-day detection: words lower the dial by two + say so
- WHY: APP-FLOW §6 "Bad-day words lower the dial by two and say so"; PRD F-25.
- SCOPE: `convex/coach.ts`, `convex/lib/coachLoad.ts`, `convex/lib/coachLoad.test.ts`.
- MUTATES: none (the effective dial for the turn is lowered; the stored dial is unchanged unless the user moves it).
- STEPS: 1) code-map `convex/lib/coachLoad.ts` (exists); 2) detect bad-day words in the user's message and lower the *effective* dial by 2 (floor 0), and make the coach say it adjusted; 3) test a bad-day message lowers the effective dial and a neutral one leaves it.
- DONE: `bun test convex/lib/coachLoad.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: lower by 2, floor 0 (APP-FLOW §6; product rule).
- Pass: 1 · Depends: TRW-1179 · Size: ~2 h

### TRW-1182 — Bad-day phrase list + neutral copy (no shame)
- WHY: PRD F-25 "bad-day detection"; tone rule "never shame".
- SCOPE: `convex/lib/coachLoad.ts`, `convex/lib/shameWords.ts`, `convex/lib/coachLoad.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map the bad-day phrase list; 2) maintain an explicit phrase list (e.g. "can't", "too much", "exhausted") and a neutral "adjusted" message; 3) test every phrase triggers detection and the reply copy contains no shame word.
- DONE: `bun test convex/lib/coachLoad.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 shame words in bad-day copy (PRD tone rule).
- Pass: 1 · Depends: TRW-1181 · Size: ~1.5 h

### TRW-1183 — Panic button: grounding card + one 10-second action
- WHY: PRD F-25 "panic button"; APP-FLOW §4 "Panic → Grounding card, 10-second action".
- SCOPE: `convex/coach.ts`, `convex/crisis.ts`, `apps/web/components/coach-controls/`, `apps/web/components/coach-controls/panic.test.tsx`.
- MUTATES: none (verify `pressPanic`; the action button adds one tiny task).
- STEPS: 1) code-map `coach.pressPanic` (exists) and `convex/crisis.ts`; 2) render the grounding card + a single "10-second action" button; 3) test the button adds one tiny task to Today (or the action is a no-model, fixed flow).
- DONE: `bun test apps/web/components/coach-controls/panic.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 1 grounding card + 1 ten-second action (APP-FLOW §4; product rule).
- Pass: 1 · Depends: TRW-1053 · Size: ~2 h

### TRW-1184 — 10-second action adds a tiny task
- WHY: PRD F-25 "10-second action"; APP-FLOW §4 "adds a tiny task".
- SCOPE: `convex/coach.ts`, `convex/tasks.ts`, `convex/coach.test.ts`.
- MUTATES: writes one small task (via `tasks.create`), with 5-minute undo.
- STEPS: 1) code-map `pressPanic` + `tasks.create`; 2) the 10-second action creates a tiny task (short title, no time entry demanded); 3) test the task lands on Today and undo removes it.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-minute undo (PRD F-131); no manual time entry demanded (BACKEND-SCHEMA §4.4 task rule).
- Pass: 1 · Depends: TRW-1183 · Size: ~1.5 h

### TRW-1185 — Crisis card per-country resources (verify; MVP per-country)
- WHY: PRD F-24 "per-country data MVP"; "show real resources for the user's country".
- SCOPE: `convex/crisis.ts`, `convex/lib/crisisWords.ts`, `convex/crisis.test.ts` (extend).
- MUTATES: none (reads a static resources map; card text is fixed, never model-written).
- STEPS: 1) code-map `convex/crisis.ts` `resourcesCard` (exists); 2) confirm the card returns fixed, per-country resource lines and no model is called; 3) test the crisis path returns fixed text for a known country and a generic fallback otherwise.
- DONE: `bun test convex/crisis.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: crisis text is fixed content (PRD F-24; TRD security rule 7); 0 model calls on crisis (product rule).
- Pass: 1 · Depends: TRW-1053 · Size: ~1.5 h

### TRW-1186 — Crisis words → fixed card, no model call (verify)
- WHY: PRD F-24 "when a user signals crisis, the coach stops coaching"; APP-FLOW §7 "Crisis words: fixed card, no model call".
- SCOPE: `convex/lib/crisisWords.ts`, `convex/coach.ts`, `convex/lib/crisisWords.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `convex/lib/crisisWords.ts` (exists); 2) confirm a crisis-word message short-circuits the turn to the fixed card with no model call; 3) test the short-circuit and that a non-crisis message still reaches the model.
- DONE: `bun test convex/lib/crisisWords.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 model calls on a crisis message (PRD F-24).
- Pass: 1 · Depends: TRW-1185 · Size: ~1.5 h

### TRW-1187 — Realism checker (reject over-optimistic plans)
- WHY: PRD F-25 "realism checker"; F-26 "anti-slop verification".
- SCOPE: `convex/lib/coachProposalGuard.ts`, `convex/coach.ts`, `convex/lib/coachProposalGuard.test.ts`.
- MUTATES: none (a proposal whose plan is unrealistic is flagged for the user before it writes).
- STEPS: 1) code-map `convex/lib/coachProposalGuard.ts` (exists); 2) add a realism check that flags a proposal packing more than a reasonable day's load (e.g. > 8 h of `durationMin`) and asks the user to confirm; 3) test an over-packed proposal is flagged and a normal one passes.
- DONE: `bun test convex/lib/coachProposalGuard.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: over-packed threshold 8 h/day: UNKNOWN — Amit to confirm (product choice).
- Pass: 1 · Depends: TRW-1199 · Size: ~2 h

### TRW-1188 — Forgiveness contract (missed plan → neutral reset)
- WHY: PRD F-25 "forgiveness contract"; tone rule "never shame".
- SCOPE: `convex/coach.ts`, `convex/lib/coachPrompt.ts`, `convex/lib/coachPrompt.test.ts`.
- MUTATES: none (system-prompt rule).
- STEPS: 1) code-map `coachPrompt.ts`; 2) add a forgiveness-contract line: a missed plan resets neutrally, never counts against the user; 3) test the prompt contains the rule and no shame wording.
- DONE: `bun test convex/lib/coachPrompt.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 shame wording in the forgiveness contract (PRD tone rule).
- Pass: 1 · Depends: TRW-1179 · Size: ~1 h

### TRW-1189 — Graduated load 2→4 pacing (Now shows 2, then up to 4)
- WHY: PRD F-25 "graduated load 2→4"; APP-FLOW §7 "Pacing 2→4 tasks in Now".
- SCOPE: `apps/web/components/today/`, `apps/web/components/today/pacing.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the Today "Now" list; 2) show 2 tasks in "Now" first, then expand to 4 on the user's action; 3) test 2 shown initially and up to 4 after expansion.
- DONE: `bun test apps/web/components/today/pacing.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 2 → 4 pacing (APP-FLOW §7; product rule).
- Pass: 1 · Depends: TRW-1067 · Size: ~1.5 h

### TRW-1190 — Late tasks slide to Later without comment
- WHY: APP-FLOW §7 "late tasks slide to Later without comment"; PRD F-25 no-shame pacing.
- SCOPE: `apps/web/components/today/`, `apps/web/components/today/late-slide.test.tsx`.
- MUTATES: none (display only).
- STEPS: 1) code-map the Today list; 2) tasks past due slide to "Later" with no comment or badge; 3) test a late task renders under Later with no shame copy.
- DONE: `bun test apps/web/components/today/late-slide.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 0 shame copy on late tasks (PRD tone rule).
- Pass: 1 · Depends: TRW-1067 · Size: ~1 h

### TRW-1191 — Anti-slop verification (basic heuristics)
- WHY: PRD F-26 "anti-slop verification" (END; MVP ships the heuristic subset).
- SCOPE: `convex/lib/shameWords.ts`, `convex/lib/coachProposalGuard.ts`, `convex/lib/coachProposalGuard.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `coachProposalGuard.ts`; 2) add a heuristic that flags proposal rows with no `reason` or a duplicated title; 3) test a sloppy row is flagged and a complete one passes.
- DONE: `bun test convex/lib/coachProposalGuard.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: every proposal row needs a `reason` (B03 contract); full Socratic pass: UNKNOWN — Amit (END scope).
- Pass: 1 · Depends: TRW-1199 · Size: ~1.5 h

### TRW-1192 — Coach reads pages + memory for context (F-21 wiring)
- WHY: PRD F-21 "the coach reads the user's pages and memory for context".
- SCOPE: `convex/coach.ts`, `convex/lib/coachLoad.ts`, `convex/coach.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `runCoachReply` + `coachLoad.ts` (exists); 2) confirm the turn loads `context` (memory) + recent pages before composing the prompt; 3) test the loaded context reaches the prompt and is owner-scoped.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: context is owner-scoped (PRD F-130); token cap trim applied (TRD §5 `context`).
- Pass: 1 · Depends: TRW-1178, TRW-1042 · Size: ~2 h

### TRW-1193 — `createNote` tool wiring (accept/undo, writes a real note)
- WHY: PRD F-22 "Coach actions: create a note"; each action shows 5-minute Undo.
- SCOPE: `convex/coach.ts`, `convex/notes.ts`, `convex/coach.test.ts`.
- MUTATES: writes a `notes` row (via the tool) with 5-minute undo.
- STEPS: 1) code-map the `createNote` tool (chunk 1 TRW-1048); 2) confirm the tool writes a real note and the chat shows an Undo affordance; 3) test create → undo removes the note.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-minute undo (PRD F-131).
- Pass: 1 · Depends: TRW-1048, TRW-1020 · Size: ~2 h

### TRW-1194 — `addTaskToToday` tool wiring (accept/undo)
- WHY: PRD F-22 "add a task to Today"; NW exit check 4.
- SCOPE: `convex/coach.ts`, `convex/tasks.ts`, `convex/coach.test.ts`.
- MUTATES: writes a task block/linked row on Today with 5-minute undo.
- STEPS: 1) code-map `addTaskToToday` (chunk 1 TRW-1048); 2) confirm it writes a `task` block to today's daily page and links the stable row; 3) test add → undo.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 5-minute undo (PRD F-131); 0 JSON visible (PRD F-02).
- Pass: 1 · Depends: TRW-1048, TRW-1079 · Size: ~2 h

### TRW-1195 — `fillTemplate` tool wiring (accept/undo)
- WHY: PRD F-22 "fill a template"; NW exit check 5.
- SCOPE: `convex/coach.ts`, `convex/templates.ts`, `convex/coach.test.ts`.
- MUTATES: none (writes a note from the template with token resolution + undo).
- STEPS: 1) code-map `fillTemplate` (chunk 1 TRW-1048) and `convex/templates.ts`; 2) confirm it copies the template body, resolves tokens, fresh block ids, and shows undo; 3) test fill → undo.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: token resolution + fresh block ids (TRD §4a); 5-minute undo (PRD F-131).
- Pass: 1 · Depends: TRW-1048, TRW-1027 · Size: ~2 h

### TRW-1196 — `draftModule` approval → live + fallback
- WHY: PRD F-41/F-42 "preview + Approve/Discard before a module goes live"; TRD §4a "draft → live only on the user's tap" and "a module that fails at render falls back to the built-in layout".
- SCOPE: `convex/templates.ts`, `convex/coach.ts`, `convex/templates.test.ts`.
- MUTATES: `template.data.status` draft→live; `enabled: false` on failure.
- STEPS: 1) code-map `draftModule` (chunk 1 TRW-1049); 2) confirm approval is the only path to `live` and a failing module stays `draft` and falls back to the built-in layout; 3) test approve and fallback.
- DONE: `bun test convex/templates.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: one bad module never breaks a page (PRD module RULE).
- Pass: 1 · Depends: TRW-1049 · Size: ~2 h

### TRW-1197 — `scheduleJob` tool needs approval (F-47 wiring)
- WHY: PRD F-47 "the coach registers a recurring job, after approval"; TRD §5d "needs approval".
- SCOPE: `convex/coach.ts`, `convex/coach.test.ts`.
- MUTATES: none (a schedule proposal is created; approval registers it — the `crons` system is chunk 4).
- STEPS: 1) code-map `scheduleJob` (chunk 1 TRW-1051); 2) confirm a job is only registered after the user's approval, and a rejected one never registers; 3) test approve/reject gating with a mock model.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 jobs registered without approval (PRD F-47).
- Pass: 1 · Depends: TRW-1051 · Size: ~2 h

### TRW-1198 — Every coach action shows 5-minute Undo (F-22)
- WHY: PRD F-22 "Each action shows in the chat with a 5-minute Undo".
- SCOPE: `convex/coach.ts`, `apps/web/components/coach/`, `apps/web/components/coach/action-undo.test.tsx`.
- MUTATES: none (undo affordance on every coach action).
- STEPS: 1) code-map `undoProposal` (exists) and the chat action cards; 2) confirm every coach action (createNote/addTaskToToday/fillTemplate/draftModule) renders an Undo with the remaining window; 3) test undo removes the change.
- DONE: `bun test apps/web/components/coach/action-undo.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: 5-minute undo window (PRD F-131); undo survives a newer operation (21 Oct DESIGN).
- Pass: 1 · Depends: TRW-1193, TRW-1194 · Size: ~2 h

### TRW-1199 — Coach proposal accept/edit/reject + confidence threshold (OPEN #6/#9)
- WHY: PRD "accept / edit / reject is law"; HARD_RULES §6.2 confirm/edit/reject vs §6.3 auto-apply ≥ 0.8 — plan conflicts #6 and #9.
- SCOPE: `convex/lib/coachProposalGuard.ts`, `convex/coach.ts`, `convex/lib/coachProposalGuard.test.ts`.
- MUTATES: none (proposal decisions gate writes).
- STEPS: 1) code-map `coachProposalGuard.ts` + `acceptProposal`/`rejectProposal` (exist); 2) ensure every AI mutation surfaces accept/edit/reject, and auto-apply only at `confidence ≥ 0.8` with a 5-minute undo (the current code path); 3) test the ≥ 0.8 auto-apply and sub-0.8 confirm paths; 4) REPORT the two policies + the tunable-threshold location as OPEN (Amit).
- DONE: `bun test convex/lib/coachProposalGuard.test.ts` exits 0.
- EVIDENCE: test output; the two OPEN rulings named in REPORT.
- Numbers: auto-apply ≥ 0.8, confirm 0.5–0.8, dialog < 0.5 (`.cursorrules`); whether it is user-tunable and where the number lives: UNKNOWN — Amit to answer (plan conflict #9).
- Pass: 1 · Depends: TRW-1049 · Size: ~2.5 h

### TRW-1200 — Anti-shaming on adaptive coach output (dial-varied + bad-day replies)
- WHY: PRD tone rule "never shame"; the adaptive coach must stay shame-free at every dial and on bad days.
- SCOPE: `convex/lib/shameWords.ts`, `convex/coach.ts`, `convex/lib/shameWords.test.ts` (extend).
- MUTATES: none.
- STEPS: 1) code-map `shameWords.ts` (chunk 1 TRW-1054); 2) run the check over adaptive coach outputs (dial 0/5/10 + bad-day + forgiveness copy); 3) test 0 matches.
- DONE: `bun test convex/lib/shameWords.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 shame-word matches across adaptive copy (PRD tone rule).
- Pass: 1 · Depends: TRW-1054, TRW-1181 · Size: ~1.5 h

### TRW-1201 — Mock model extension for dial/bad-day/panic deterministic tests
- WHY: include.md §7.8 "tests make no real model calls"; the adaptive behaviours need a scripted mock.
- SCOPE: `convex/lib/mockModel.ts`, `convex/coach.test.ts`, `convex/lib/mockModel.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `convex/lib/mockModel.ts` (chunk 1 TRW-1055); 2) extend the script to vary output by the injected dial and to record the dial/bad-day flags it received; 3) test a dial-10 script differs from a dial-0 script and a bad-day flag is recorded.
- DONE: `bun test convex/lib/mockModel.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 network calls in tests (include.md §7.8).
- Pass: 1 · Depends: TRW-1055 · Size: ~2 h

### TRW-1202 — Entitlement/quota ordering before model calls + interim model OPEN (#3)
- WHY: TRD security rule 3 "auth → entitlement → quota" before any model call; plan conflict #3.
- SCOPE: `convex/lib/aiGate.ts`, `convex/lib/subscriptionGuards.ts`, `convex/coach.ts`, `convex/lib/aiGate.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `aiGate.ts` + `subscriptionGuards.ts` (exist); 2) confirm every model call is gated auth → entitlement → quota, and an unentitled user gets no model call; 3) test the gate order and that the runtime model id is `deepseek-ai/DeepSeek-V4.1-Flash`; 4) REPORT the interim text model OPEN (GLM 5.3 Flash appears nowhere in the repo; `convex/lib/ai_router.ts` is the source of truth) for Amit.
- DONE: `bun test convex/lib/aiGate.test.ts` exits 0.
- EVIDENCE: test output; the OPEN ruling named in REPORT.
- Numbers: runtime text model `deepseek-ai/DeepSeek-V4.1-Flash` 1M context (https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash). "GLM 5.3 Flash": UNKNOWN — Amit to answer (plan conflict #3).
- Pass: 1 · Depends: TRW-1056 · Size: ~2 h

### TRW-1203 — Text seam source of truth (verify `ai_router` + AI SDK OPEN #12)
- WHY: TRD §3 ticket one "`convex/lib/ai_router.ts` is replaced by the Agent definition"; HARD_RULES §2 AI SDK forbidden vs TRD §3 permitted — plan conflict #12.
- SCOPE: `convex/lib/ai_router.ts`, `convex/coach.ts`, `convex/lib/ai_router.test.ts`.
- MUTATES: none (verification only).
- STEPS: 1) code-map `convex/lib/ai_router.ts` (exists) and the Agent `languageModel`; 2) confirm nothing still calls `api.mistral.ai` and the Agent uses the DeepInfra seam; 3) test the seam resolves to DeepSeek V4.1 Flash; 4) REPORT the HARD_RULES §2 vs TRD §3 reconciliation (Amit) in the PR body.
- DONE: `bun test convex/lib/ai_router.test.ts` exits 0.
- EVIDENCE: test output; `grep -r MISTRAL_API_KEY convex/` returns nothing.
- Numbers: 0 Mistral references (ROADMAP P-1 exit check). AI SDK reconciliation: UNKNOWN — Amit to answer (plan conflict #12).
- Pass: 1 · Depends: TRW-1047 · Size: ~1.5 h

### TRW-1204 — Coach turn claim / concurrency (cancelled request can't overwrite)
- WHY: 21 Oct TRD "a cancelled or replaced request cannot later overwrite the accepted state"; plan chunk-1 concurrency carried forward.
- SCOPE: `convex/coach.ts`, `convex/coach.test.ts`.
- MUTATES: none (verify `claimTurn`/`releaseTurn`).
- STEPS: 1) code-map `claimTurn`/`releaseTurn` (exist); 2) confirm a stale turn cannot overwrite a newer accepted reply; 3) test the claim guard rejects a late write.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: `TURN_CLAIM_MS` 10 min (coach.ts); generation-epoch guard (21 Oct TRD).
- Pass: 1 · Depends: TRW-1047 · Size: ~1.5 h

### TRW-1205 — Coach streaming deltas + read-back (verify)
- WHY: PRD F-20 "replying live"; NW exit check 3 "a typed message gets a reply from the live runtime model".
- SCOPE: `convex/coach.ts`, `apps/web/components/coach/`, `convex/coach.test.ts`.
- MUTATES: none (verify `saveStreamDeltas` + read-back).
- STEPS: 1) code-map `runCoachReply` + the chat UI streaming; 2) confirm replies stream via `saveStreamDeltas: true` and every spoken/text reply shows as text; 3) test a mock stream renders deltas.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: streaming via Convex deltas (TRD §1); no real model call in the test (include.md §7.8).
- Pass: 1 · Depends: TRW-1052 · Size: ~1.5 h

### TRW-1206 — Coach Thinking state + calm Retry (verify; folds #744)
- WHY: PRD F-20; issue #744 "Thinking state + Retry"; APP-FLOW §7 coach error copy.
- SCOPE: `apps/web/components/coach/`, `apps/web/components/coach/thinking-retry.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the coach chat UI; 2) confirm a visible Thinking state while a reply streams and a calm Retry on failure ("The coach is offline. Your list still works."); 3) test Thinking + Retry render EN/HE.
- DONE: `bun test apps/web/components/coach/thinking-retry.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: offline copy exact (APP-FLOW §7); 44×44 px Retry target (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 1 · Depends: TRW-1052 · Size: ~1.5 h

### TRW-1207 — Coach answers in the user's locale (F-73)
- WHY: PRD F-73 "The coach and voice answer in the user's chosen language"; TRD §5b "The coach and TTS answer in `users.locale`".
- SCOPE: `convex/coach.ts`, `convex/lib/coachPrompt.ts`, `convex/coach.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map where `users.locale` is read; 2) inject the locale into the system prompt so the coach replies in EN or HE; 3) test a `he` user's prompt instructs Hebrew and an `en` user's instructs English.
- DONE: `bun test convex/coach.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: locale ∈ {en, he} (TRD §5b); RTL for he (TRD §5b).
- Pass: 1 · Depends: TRW-1179 · Size: ~1.5 h

### TRW-1208 — Coach/memory EN/HE strings
- WHY: PRD F-70; TRD §5b typed message files.
- SCOPE: `apps/web/messages/en.json`, `apps/web/messages/he.json`, `apps/web/lib/locale.test.ts`.
- MUTATES: none; every coach + memory visible string keyed EN+HE.
- STEPS: 1) code-map the coach + memory components; 2) move their visible copy into `en.json`/`he.json`; 3) test switch + Hebrew fallback to English.
- DONE: `bun test apps/web/lib/locale.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 100% of visible coach/memory strings keyed EN+HE (product rule).
- Pass: 2 · Depends: TRW-1058 · Size: ~2 h

### TRW-1209 — Coach chat RTL (Hebrew)
- WHY: PRD F-71/F-72; TRD §5b `dir` from locale, logical CSS.
- SCOPE: `apps/web/components/coach/`, `apps/web/components/coach/rtl.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the coach chat layout; 2) confirm Hebrew flips the chat to RTL with logical CSS and `dir="auto"` on message text; 3) test RTL direction and mixed-line rendering.
- DONE: `bun test apps/web/components/coach/rtl.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: `dir` from locale; logical CSS only (TRD §5b).
- Pass: 2 · Depends: TRW-1208 · Size: ~1.5 h

### TRW-1210 — Memory screen EN/HE strings
- WHY: PRD F-70; "What Tempo remembers" is user-facing.
- SCOPE: `apps/web/messages/en.json`, `apps/web/messages/he.json`, `apps/web/lib/locale.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map the memory screens; 2) key every visible string EN+HE; 3) test switch + fallback.
- DONE: `bun test apps/web/lib/locale.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 100% keyed EN+HE (product rule).
- Pass: 2 · Depends: TRW-1208 · Size: ~1.5 h

### TRW-1211 — Memory screen RTL
- WHY: PRD F-71/F-72.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/rtl.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the memory screens; 2) confirm Hebrew RTL + `dir="auto"` per paragraph; 3) test RTL.
- DONE: `bun test apps/web/components/memory/rtl.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: `dir` from locale (TRD §5b).
- Pass: 2 · Depends: TRW-1210 · Size: ~1 h

### TRW-1212 — Coach accessibility (keyboard, focus, labels, contrast)
- WHY: UI-BRIEF §6; include.md §7.2 accessibility baseline.
- SCOPE: `apps/web/components/coach/`, `apps/web/components/coach/a11y.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the coach chat; 2) full keyboard use, visible focus, labelled controls, 44×44 targets, AA contrast; 3) test focus order and contrast.
- DONE: `bun test apps/web/components/coach/a11y.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: WCAG AA 4.5:1 (3:1 large) contrast (https://www.w3.org/TR/WCAG21/#contrast-minimum); 44×44 targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 2 · Depends: TRW-1206 · Size: ~2 h

### TRW-1213 — Memory accessibility
- WHY: UI-BRIEF §6; include.md §7.2.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/a11y.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the memory screens; 2) keyboard, focus, labels, 44×44, contrast; 3) test.
- DONE: `bun test apps/web/components/memory/a11y.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: WCAG AA 4.5:1 (https://www.w3.org/TR/WCAG21/#contrast-minimum); 44×44 targets (https://www.w3.org/TR/WCAG21/#target-size).
- Pass: 2 · Depends: TRW-1216 · Size: ~2 h

### TRW-1214 — Coach empty/loading/error/offline states
- WHY: APP-FLOW §7 "Coach: opens at the dial; The coach is offline. Your list still works."; 21 Oct "honest states".
- SCOPE: `apps/web/components/coach/`, `apps/web/components/coach/states.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the coach chat states; 2) implement exact copy for empty, loading, error, and offline; 3) test each state.
- DONE: `bun test apps/web/components/coach/states.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: offline copy exact (APP-FLOW §7); no false queued-save promise (21 Oct DESIGN).
- Pass: 2 · Depends: TRW-1206 · Size: ~1.5 h

### TRW-1215 — Memory empty/loading/error states
- WHY: APP-FLOW §7; 21 Oct "honest empty/loading/error/offline states".
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/states.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the memory screens; 2) implement exact empty/loading/error copy; 3) test each state.
- DONE: `bun test apps/web/components/memory/states.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: honest empty/error copy (21 Oct DESIGN).
- Pass: 2 · Depends: TRW-1216 · Size: ~1.5 h

### TRW-1216 — Memory view ("What Tempo remembers") UI
- WHY: PRD F-52 "See and forget memories"; APP-FLOW §6 memory flow.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/memory-view.test.tsx`.
- MUTATES: none (reads `memory.list`/`recall`; forget/export call their mutations).
- STEPS: 1) code-map the memory components; 2) render the list with forget-one / forget-all / export affordances; 3) test list + forget + export buttons render EN/HE.
- DONE: `bun test apps/web/components/memory/memory-view.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: every action reachable from the view (APP-FLOW §6).
- Pass: 1 · Depends: TRW-1156, TRW-1158 · Size: ~2.5 h

### TRW-1217 — Memory forget one / forget all UI + undo
- WHY: PRD F-52; APP-FLOW §6.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/forget.test.tsx`.
- MUTATES: none (calls `memory.forget`/`forgetAll`).
- STEPS: 1) code-map the forget affordances; 2) wire forget-one with 5-minute undo and forget-all with a confirm; 3) test undo + confirm render.
- DONE: `bun test apps/web/components/memory/forget.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: 5-minute undo (PRD F-131); confirmation before forget-all (product rule).
- Pass: 1 · Depends: TRW-1216 · Size: ~1.5 h

### TRW-1218 — Memory export markdown UI (download)
- WHY: PRD F-52 "export all memories as markdown".
- SCOPE: `apps/web/components/memory-export/`, `apps/web/components/memory-export/export.test.tsx`.
- MUTATES: none (downloads the `exportAll` markdown).
- STEPS: 1) code-map `memory-export` components (exist); 2) wire the export button to `exportAll` and trigger a `.md` download; 3) test the download triggers with the expected content.
- DONE: `bun test apps/web/components/memory-export/export.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: export is plain markdown (PRD F-52); 0 JSON in the export (PRD F-02).
- Pass: 1 · Depends: TRW-1158 · Size: ~1.5 h

### TRW-1219 — Memory import UI (review keep/edit/drop)
- WHY: PRD F-51 "Tempo shows each item to keep, edit or drop".
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/import-review.test.tsx`.
- MUTATES: none (calls `importPreview`/`importCommit`).
- STEPS: 1) code-map the import UI; 2) render the review list with keep/edit/drop per item; 3) test keep commits and drop never persists.
- DONE: `bun test apps/web/components/memory/import-review.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: kept items saved, dropped items not saved (PRD F-51).
- Pass: 1 · Depends: TRW-1161 · Size: ~2.5 h

### TRW-1220 — Life-graph basic view UI (wired to `lifeGraph`)
- WHY: PRD F-54.
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/life-graph-view.test.tsx`.
- MUTATES: none.
- STEPS: 1) code-map the life-graph list (TRW-1169); 2) wire it to `lifeGraph`; 3) test entities + edges + guess badges render.
- DONE: `bun test apps/web/components/memory/life-graph-view.test.tsx` exits 0.
- EVIDENCE: test output; EN/HE keys.
- Numbers: inferred links visibly marked (PRD F-54).
- Pass: 1 · Depends: TRW-1168 · Size: ~2 h

### TRW-1221 — Reflect observations UI (show + delete)
- WHY: PRD F-55 "Observations are shown to the user and can be deleted".
- SCOPE: `apps/web/components/memory/`, `apps/web/components/memory/observations-view.test.tsx`.
- MUTATES: none (calls `observations.remove`).
- STEPS: 1) code-map the observations list (TRW-1172); 2) wire show + delete; 3) test.
- DONE: `bun test apps/web/components/memory/observations-view.test.tsx` exits 0.
- EVIDENCE: test output.
- Numbers: observations deletable (PRD F-55).
- Pass: 1 · Depends: TRW-1172 · Size: ~1.5 h

### TRW-1222 — FD-01 coach e2e (chat → addTaskToToday → undo)
- WHY: PRD §3.1 exit checks 3–4; 21 Oct five-loop preview pattern.
- SCOPE: `tests/e2e/fd01-coach.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map the FD-01 spec (TRW-1057) and the coach e2e; 2) drive: sign in → chat "Add 'call the bank' to today" → a task block appears on Today → Undo removes it; 3) assert no JSON anywhere; 4) run it.
- DONE: `bunx playwright test tests/e2e/fd01-coach.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: accepted action survives reload; 0 raw JSON visible (PRD F-02).
- Pass: 2 · Depends: TRW-1194, TRW-1198 · Size: ~2.5 h

### TRW-1223 — Memory e2e (remember → recall → forget → export)
- WHY: PRD §3.1 exit check 6; APP-FLOW §6.
- SCOPE: `tests/e2e/fd01-memory.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map the memory import e2e; 2) drive: paste a memory export → review → keep one → it appears under "What Tempo remembers" → forget it → export shows the rest; 3) run it.
- DONE: `bunx playwright test tests/e2e/fd01-memory.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: kept items persist; forgotten items excluded from export (PRD F-51/F-52).
- Pass: 2 · Depends: TRW-1216, TRW-1219 · Size: ~2.5 h

### TRW-1224 — Coach proposal e2e (accept/edit/reject)
- WHY: PRD "accept / edit / reject is law"; 21 Oct five-loop "accept+Undo a proposal".
- SCOPE: `tests/e2e/fd01-proposal.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map the proposal card e2e; 2) drive: coach proposes a plan → reject one row → accept the rest → undo one accepted row; 3) assert nothing writes before accept; 4) run it.
- DONE: `bunx playwright test tests/e2e/fd01-proposal.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: nothing written until accept (PRD F-09); 5-minute undo (PRD F-131).
- Pass: 2 · Depends: TRW-1199 · Size: ~2.5 h

### TRW-1225 — Anti-shaming regression test (all coach copy + adaptive output)
- WHY: PRD tone rule "never shame" must hold across every adaptive reply.
- SCOPE: `convex/lib/shameWords.test.ts` (extend).
- MUTATES: none (test only).
- STEPS: 1) code-map `shameWords.ts`; 2) add a regression that scans fixed coach copy, nag defaults, bad-day, forgiveness and crisis copy; 3) assert 0 matches.
- DONE: `bun test convex/lib/shameWords.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 shame-word matches (PRD tone rule).
- Pass: 1 · Depends: TRW-1200 · Size: ~1 h

### TRW-1226 — Coach quota/entitlement e2e (unentitled user gets no model call)
- WHY: TRD security rule 3; PRD F-110 billing gating.
- SCOPE: `convex/lib/aiGate.test.ts` (extend).
- MUTATES: none (test only).
- STEPS: 1) code-map `aiGate.ts`; 2) assert auth → entitlement → quota order and that an unentitled/over-quota user gets no model call (mock only); 3) test.
- DONE: `bun test convex/lib/aiGate.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 model calls for an unentitled user (TRD security rule 3).
- Pass: 1 · Depends: TRW-1202 · Size: ~1.5 h

### TRW-1227 — Memory cross-user isolation test (recall never crosses users)
- WHY: PRD F-130; BACKEND-SCHEMA §6 "a user sees only their own rows".
- SCOPE: `convex/memory.test.ts` (extend).
- MUTATES: none (test only).
- STEPS: 1) code-map `recall`/`lifeGraph` owner filters; 2) assert a user's recall/life-graph/export never returns another user's memory/entity/edge; 3) test.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 cross-user leakage (PRD F-130).
- Pass: 1 · Depends: TRW-1154, TRW-1168 · Size: ~1 h

### TRW-1228 — Reflect cron e2e (run reflect once → observations appear)
- WHY: PRD F-55; TRD §5c nightly reflect.
- SCOPE: `convex/reflect.test.ts` (extend).
- MUTATES: none (test only; runs `runReflect` once).
- STEPS: 1) code-map `runReflect`; 2) seed memories → run reflect once → assert observations appear with correct `memoryIds` → run again → no duplicate for the same day; 3) test.
- DONE: `bun test convex/reflect.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: idempotent per day (product rule); observations carry supporting ids (TRD §5c).
- Pass: 1 · Depends: TRW-1170 · Size: ~1.5 h

### TRW-1229 — Coach/memory perf budget (recall bounded + under budget)
- WHY: TRD §7.6 "Bounded queries"; recall and life-graph must stay within Convex read limits.
- SCOPE: `convex/lib/recall.ts`, `convex/lib/bounded.ts`, `convex/memory.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map `bounded.ts` (chunk 1 TRW-1035) and `recall.ts`; 2) bound each leg (page size, byte cap) and merge under a single read budget; 3) test a large corpus stays under the budget and returns a cursor.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: Convex 16 MiB read / 32,000 docs (https://docs.convex.dev/production/state/limits); page max 100.
- Pass: 1 · Depends: TRW-1154, TRW-1035 · Size: ~2 h

### TRW-1230 — Memory bounded queries + quotas (verify)
- WHY: TRD §7.6; BACKEND-SCHEMA resource quotas.
- SCOPE: `convex/memory.ts`, `convex/memories.ts`, `convex/memory.test.ts`.
- MUTATES: none.
- STEPS: 1) code-map the memory read paths; 2) confirm list/recall/export use `clampPageSize` and respect per-user caps; 3) test cap enforcement.
- DONE: `bun test convex/memory.test.ts` exits 0.
- EVIDENCE: test output.
- Numbers: page max 100; 4 MiB read budget (docs.convex.dev limits; product rule).
- Pass: 1 · Depends: TRW-1229 · Size: ~1.5 h

### TRW-1231 — Coach/memory smoke (FD-01 extension: memory + coach)
- WHY: PRD §3.1 exit checks; 21 Oct five-loop preview pattern.
- SCOPE: `tests/e2e/fd01-coach-memory.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map the prior FD-01 specs; 2) drive the combined path: sign in → paste a memory → coach "what do I remember about X" → a reply references the memory → add a task to today; 3) assert no JSON and owner isolation; 4) run it.
- DONE: `bunx playwright test tests/e2e/fd01-coach-memory.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: 0 JSON visible (PRD F-02); reply references the memory (PRD F-21).
- Pass: 2 · Depends: TRW-1222, TRW-1223 · Size: ~3 h

### TRW-1232 — Chunk-3 integration e2e (adaptive coach + semantic recall full path)
- WHY: PRD §3.1; closes chunk 3 by proving the adaptive coach + semantic recall work end to end.
- SCOPE: `tests/e2e/chunk3.spec.ts` (new).
- MUTATES: none (test only).
- STEPS: 1) code-map all chunk-3 units; 2) drive: bad-day message → dial lowers by 2 → coach replies neutrally → panic → 10-second action adds a tiny task → recall by meaning returns the relevant memory; 3) assert every step with mock runtime; 4) run it.
- DONE: `bunx playwright test tests/e2e/chunk3.spec.ts` exits 0.
- EVIDENCE: test output.
- Numbers: dial −2 on bad day (APP-FLOW §6); 10-second action adds 1 task (APP-FLOW §4); 0 real model calls in the test (include.md §7.8).
- Pass: 2 · Depends: TRW-1222, TRW-1223, TRW-1224 · Size: ~3 h
