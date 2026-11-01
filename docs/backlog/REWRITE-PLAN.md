# Tempo Flow — Backlog rewrite plan

Updated 1 Nov 2026 · Branch `docs/source-2026-11-01`. This file plans the full rewrite of the
Tempo Flow backlog into buildable tickets. It is the plan only: ticket text lands in
`docs/backlog/BACKLOG.md` chunk by chunk. This run writes ONE chunk and stops.

## How this plan works
- The whole product is split into **chunks of 60–100 tickets**, in build order: **MVP first, then
  Gen 1, then Gen 2**. Total 456 tickets across 6 chunks.
- Each chunk lists: chunk number, stage, feature areas, ticket ID range, and status (`todo` / `done`).
- `todo` means the tickets are not yet written into `BACKLOG.md`; `done` means they are written.
- Every ticket obeys include.md §7.6 + the 11 fields from `AGENTS.md`, a `Pass` (1|2), a `Depends`
  list, a Bun-only `DONE` command, and an industry-standard number with its source (or `UNKNOWN`).
- Ticket IDs are fresh (`TRW-####`) to avoid colliding with the old generated `TM-####` backlog,
  which `docs/backlog/BACKLOG.md` already shows is partly built on `integration`.

## Conflict rule (the decision rule for every ticket)
1. **The newer dated document wins.** Where two sources conflict, the later-dated one wins; the older
   line is moved under "Supersedes", never deleted.
2. **GitHub is the truth for the code as built.** If the code, an issue or a PR says otherwise, it
   wins over both documents.
3. **Unclear which is newer → OPEN.** The item is marked `OPEN` with what would settle it; no side
   is picked silently.
4. A statement that "repo says X and the 21 Oct set says Y" is kept distinct from "the 21 Oct set
   adds something the repo lacks". Additions are not conflicts.

## Sources consulted
`include.md` (spec-writing skill) · `AGENTS.md` · `docs/PRD.md` · `docs/TRD.md` ·
`docs/APP-FLOW.md` · `docs/UI-BRIEF.md` · `docs/BACKEND-SCHEMA.md` · `docs/ROADMAP.md` ·
`docs/graph/GRAPH_REPORT.md` · `docs/source/2026-10-21/` (PRD, TRD, ROADMAP, DECISIONS, DESIGN,
TECH-STACK, SYSTEMS, TICKETS, COMPARISON) · `docs/design/v3/` (DESIGN.md, OVERNIGHT-RUN.md) ·
`docs/contracts/` (CORE-WEB-*.md) · `factory/SLOTS.md` · `docs/tickets/` (B01–B05 format) ·
open GitHub issues labelled `factory` (read 1 Nov 2026).

## Open conflicts (every OPEN item this rewrite must not guess at)
These are carried verbatim from `docs/source/2026-10-21/COMPARISON.md` and `DECISIONS.md`, plus the
code check in `docs/backlog/BACKLOG.md`. Each ticket touching one marks the value `UNKNOWN` and names
"Amit" as the answerer; no ticket invents a choice.

1. **Voice stage.** Repo PRD says live voice is NW / "the number-one feature" (`F-30`); repo ROADMAP
   §5 puts it at P4; the 21 Oct set puts it in Gen 1. Settle: one Amit ruling on whether live voice
   is in the MVP batch. → affects chunk 5.
2. **Prices / billing tiers.** Repo: $1 trial (3 weeks) → Basic $10 → Pro $20 → Max $40, annual =
   two months free. The 21 Oct set has no prices and describes a "free manually approved beta". A
   later note says "paid plans $20 and $50". Three positions. Settle: Amit. → chunk 4.
3. **Interim text model.** Repo: `deepseek-ai/DeepSeek-V4.1-Flash` on DeepInfra (1M context). A later
   note says "GLM 5.3 Flash on DeepInfra"; that string appears nowhere in the repo. Settle: Amit, and
   the seam code (`convex/lib/ai_router.ts`) is the source of truth until then. → chunk 3.
4. **Sign-up policy.** Repo ROADMAP §4 says "unlimited sign-ups, each approved by Amit"; PRD `F-01a`
   and the weekend goal say "sign-up cap 30"; the 21 Oct set says the approval order is undecided.
   Settle: Amit. → chunk 1.
5. **Body typeface.** `docs/HARD_RULES.md` §7.2 says "Body: Inter"; `docs/design/v3/DESIGN.md`
   (13 Oct) says Source Sans 3 (Hebrew Frank Ruhl Libre + Assistant); `docs/UI-BRIEF.md` says Inter.
   Settle: one edit to HARD_RULES §7.2 or an explicit override line in v3. → chunk 4.
6. **Accept-reject vs auto-apply.** `docs/HARD_RULES.md` §6.2 says every AI mutation goes through
   `convex/proposals.ts` (confirm/edit/reject); §6.3 says `confidence ≥ 0.8` auto-applies with a
   5-minute undo toast. Two policies. Settle: edit §6.3 or §6.2. → chunks 2–3.
7. **Block model.** 20 Sep: pages with JSON blocks (typed tables migrate into blocks and retire);
   #546: additive typed tables (`dayPlans`, `timeBlocks`, `habitCheckIns`, …); 12 Oct contracts + 21
   Oct: `notes.body` is the single page-content authority with disposable derived indexes. Settle:
   Amit (the 12 Oct contracts are the newest and lean toward notes.body). → chunk 1.
8. **`forget` semantics.** PRD "soft delete everywhere, 30-day grace" vs memory spec "forget must be
   complete" (`deleteMemory` hard-deletes today). Settle: Amit. → chunk 3.
9. **Confidence auto-apply threshold.** Repo `.cursorrules` says auto-apply `≥ 0.8`, confirm
   0.5–0.8, dialog below 0.5; HARD_RULES §6.3 says the same. Where the number lives and whether it
   is user-tunable: UNKNOWN. → chunk 3.
10. **Week start.** Sunday vs Monday (code uses Monday; #546 question 3 open). Settle: Amit. → chunk 2.
11. **Nag delivery channel** beyond in-app (PRD `F-61`). Settle: Amit. → chunk 2.
12. **HARD_RULES §2 (AI SDK forbidden) vs TRD §3 (Vercel AI SDK + Convex Agent permitted, 5 Oct).**
    Settle: update HARD_RULES §2 and delete the dead Mistral row from TRD §3. → chunk 3.
13. **Where the user's IANA time zone is stored** (`users` vs `preferences`). UNKNOWN. → chunk 2.

## Staleness note (what the rewrite must reconcile)
`docs/backlog/BACKLOG.md` records that much of the earlier generated backlog is **already built on
`integration`**: the DeepInfra seam (`convex/lib/ai_router.ts`), context-length guard, panic button
(`coach.pressPanic`), block parser + Zod schemas (`packages/utils/src/blocks.ts` re-exported via
`convex/lib/blocks.ts`), entitlements helper (`convex/lib/entitlements.ts`), soft delete
(`convex/lib/softDelete.ts`), and the coach prompt (`convex/lib/coachPrompt.ts`). The repo also
already has `convex/approval.ts`, `convex/memory.ts` + `memoryImport.ts`, `convex/templates.ts`,
`convex/pageLedger.ts`, `convex/voice.ts`, `convex/mcp.ts`, `convex/crons.ts`, `convex/search.ts`,
`convex/preferences.ts`, `convex/revenuecat.ts`, and `packages/utils/src/wiki-links.ts`. **Every
ticket's STEPS therefore starts with a code-map check** (Graphify query of its MUTATES files); if the
unit already exists, the ticket verifies it and adds the missing test rather than rebuilding.

## Chunks (build order)

| Chunk | Stage | Feature areas | Ticket IDs | Count | Status |
|---|---|---|---|---|---|
| 1 | MVP · Core | Approval-gated sign-in & owner isolation · markdown-first editor (CodeMirror live preview + GFM) · block codec + Zod schemas + derived indexes · notes/pages port (`notes.body` authority, save/patchBlock) · operation ledger + 5-minute Undo + concurrency · bounded queries + resource quotas · memory adapter foundation (remember/recall/context/export/import) · coach Agent foundation (tools, crisis, mock model, entitlement gate) · EN/HE + RTL baseline · smoke + accessibility + perf budget | TRW-1001 … TRW-1064 | 64 | done |
| 2 | MVP · Planning surface | Today (daily page) · brain dump → proposal (accept/edit/reject) · tasks as blocks · calendar events (end time, edit, soft delete) · habits + check-ins by local day · day/week/month views · time blocks & reflow · nags · carry-over · Goals, Journal, Routines | TRW-1065 … TRW-1148 | 84 | done |
| 3 | MVP · Coach & memory | Coach Agent tools (createNote/addTaskToToday/fillTemplate/draftModule/searchMemory/scheduleJob) · adaptive coach (dial, panic, bad-day, realism) · memory port (recall by meaning+keyword+links+time, forget, reflect, life graph) · embeddings + Hebrew eval · anti-shaming · mock model · entitlement/quota ordering | TRW-1149 … TRW-1232 | 84 | done |
| 4 | MVP · Modules, jobs, billing, language, polish | Template/view/code modules + validation + Plain mode · sandboxed code (iframe + Vercel Sandbox) · scheduled jobs (crons) · coach artifacts (flashcard/quiz/checklist/tracker) · billing (Polar/RevenueCat) + entitlements/quota · EN/HE strings + RTL + a11y · landing EN/HE · PWA polish · ask-founder | TRW-1233 … TRW-1316 | 84 | todo |
| 5 | Gen 1 | Expo native shell (Android APK / iOS TestFlight) · study track (SM-2, flashcards, test, RAG) · connectors (Executor) · MCP server + CLI + REST · BYOK key vault · live voice (Deepgram STT, Chatterbox TTS, barge-in) | TRW-1317 … TRW-1396 | 80 | todo |
| 6 | Gen 2 | Plugin SDK + marketplace · Tauri desktop + VPS `claude` · store-grade native (push, camera, App Store / Play) · later features (calendar sync, WhatsApp/Telegram, offline inference, family plans) | TRW-1397 … TRW-1456 | 60 | todo |

## Open `factory` issues folded in (read 1 Nov 2026)
Each open factory issue is folded into exactly one chunk (its ticket notes the issue number so the
promotion step dedupes instead of filing a duplicate).

| Issue | Title | Folds into |
|---|---|---|
| #1348 | TM-0032 — Bounded query helper | chunk 1 |
| #1349 | TM-0050 — Mock language model | chunk 1 |
| #1350 | TM-0049 — Anti-shaming copy check | chunk 1 |
| #1340 | TEMPO-BL-0001 — Entitlements table (provider grants) | chunk 1 |
| #1342 | TEMPO-BL-0004 — Lighthouse performance budget in CI | chunk 1 |
| #743 | TEMPO-N2-01 — Chat backend: real AI replies (DeepSeek via the seam) | chunk 1 (chunk 3 wiring) |
| #744 | TEMPO-N2-02 — /coach chat uses chat.send, Thinking state + Retry | chunk 1 (chunk 3 wiring) |
| #446 | T-SCR-BE-JOURNAL — Journal + Daily note backend | chunk 2 |
| #447 | T-SCR-BE-ROUTINES — Routines backend | chunk 2 |
| #537 | T-PLAN-07 — Today: every task due today + energy pick | chunk 2 |
| #457 | T-SCR-09 — Goals | chunk 2 |
| #475 | T-SCR-25 — Ask the founder | chunk 4 |
| #751 | TEMPO-N2-09 — Landing copy → en/he dictionaries | chunk 4 |
| #752 | TEMPO-N2-10 — Landing EN/HE switcher + RTL | chunk 4 |
| #1341 | TEMPO-BL-0003 — Calendar event end time (additive endsAtMs) | chunk 2 |
| #747 | TEMPO-N2-05 — MCP today_plan_set tool | chunk 5 |
| #748 | TEMPO-N2-06 — Executor connector setup | chunk 5 |
| #746 | TEMPO-N2-04 — /coach voice in/out (Web Speech API, no keys) | chunk 5 |

## Grok Bot's overnight drafts folded in (with duplicates noted)
"Overnight drafts" = the two overnight-generated doc sets, folded in as *requirements*, never as
already-built facts:

- **`docs/source/2026-10-21/` (draft PR #1201, still open).** Supplies the markdown-first reframing
  (user-owned pages, proposals with Accept/Edit/Reject, 5-minute Undo, bounded queries), the 13 issue
  amendments, and the named open-conflict list. It names no models, prices or env vars — those come
  from `docs/PRD.md` / `docs/TRD.md`. **Duplicate:** its MVP five-loop preview pattern and
  five-step order are folded into chunk 1's smoke tickets and the chunk order, not filed as new tickets.
- **`docs/design/v3/` + `OVERNIGHT-RUN.md` (markdown-first redesign).** Supplies the settled editor
  decisions: `notes.body` as the only source of truth, CodeMirror 6 live preview + `remark-gfm`,
  byte-exact save round-trip, live `[[links]]` with backlinks, `- [ ]` stays plain markdown, one page
  route `/notes/[id]`, v3 tokens (Source Sans 3 etc.), `dir="auto"` per paragraph. **Duplicate:** its
  screen inventory and component map are design references, not tickets; only the buildable editor /
  block / route units become tickets (chunk 1).

## DO NOT (this rewrite)
- Do not relabel, comment on, open or close any GitHub issue, or edit PR #1352's description — a
  final run does that after all chunks are done.
- Never touch workflows, secrets, or protected paths (`convex/schema.ts`, `convex/auth*`,
  `.github/**`, any `.env` file); never weaken a check; never merge.
- Tickets never invent a number: industry-standard numbers carry their source URL, everything else is
  `UNKNOWN` with the answerer named.
