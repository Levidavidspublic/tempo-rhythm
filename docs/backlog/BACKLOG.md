# Tempo Flow — Loop Backlog (next batches only)

Updated 1 Nov 2026. This file holds only the next loop batches (file 12 §2.5 ladder: 3 → 5 → 15 → 10).
The full 550-ticket backlog stays local with the factory and is not committed.
Every 5 loops the remaining tickets are re-checked against the code before the next batch opens.

## Rules for every ticket here
- Runtime is bun 1.3.9; the unit runner is `bun test` (root `test` script).
- No ticket here touches a protected path (`convex/schema.ts`, `convex/auth*`, `.github/**`, `.env`).
- No config work (Tempo config work is paused). Archive, never delete.
- Every ticket names SCOPE, MUTATES, DONE, EVIDENCE (at least one test) and its numbers with a source.

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
  2. Export `byteCap(text, maxBytes)` that truncates on a UTF-8 code-point boundary (never splits a Hebrew or emoji character) and reports `truncated: boolean`.
  3. Tests: clamp below/above/NaN; byteCap on ASCII, Hebrew, emoji, exact-boundary.
- DONE: `bun test convex/lib/bounded.test.ts` exits 0 with ≥8 cases.
- EVIDENCE: `bounded.ts`, `bounded.test.ts`, one TRD §7.6 reference in the PR body.
- Numbers: Convex transaction limits — 16 MiB data read / 32,000 documents scanned; document size 1 MiB (docs.convex.dev/production/state/limits); page max 100 keeps far below both.
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

### TM-0075 — Coach confidence score on every proposal
- Why: PRD proposal rules; no `confidence` field or helper exists in `convex/` or `apps/web`.
- SCOPE: `convex/lib/`
- MUTATES: `convex/lib/confidence.ts`, `convex/lib/confidence.test.ts` (pure scoring; storing it would need `convex/schema.ts` and is held for Amit).
- Steps: `scoreProposal({fieldsFilled, fieldsRequired, ambiguousDates})` → 0–1; band `low < 0.6 ≤ medium < 0.85 ≤ high`.
- DONE: `bun test convex/lib/confidence.test.ts` exits 0 with band-edge cases (0.59, 0.6, 0.849, 0.85).
- EVIDENCE: `confidence.ts`, `confidence.test.ts`, `proposalView.test.ts` still green.
- Numbers: band edges 0.6 / 0.85 are product choices from PRD proposal rules — mark for Amit to confirm.
- Size: ~1.5 h

The other 4 Loop 2 slots are filled only after the staleness re-check maps the chat tickets (TM-0051–0100) to existing TEMPO-KA / KB / N2 issues.
