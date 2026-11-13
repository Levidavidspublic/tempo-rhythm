# Tempo Flow / Tempo Rhythm — 21 Oct 2026 doc set vs the repo's own docs

**Product:** Tempo Flow (mobile app package: Tempo Rhythm).
**Source set:** `docs/source/2026-10-21/` — ten docs dated 2026-10-21, pinned to `integration` at `542f2cf3…`, then `c7447ad9…`. The set is an unmerged draft: PR **#1201** `docs-sync/2026-10-21` → `integration` is still **open and draft** (last updated 2026-10-21T18:00:07Z).
**Repo:** `Levidavidspublic/tempo-rhythm`, default branch `integration`.
**Living docs:** `docs/` (this comparison reads only the files listed in its scope; `research/` is ignored).

## Decision rule

1. **The newer document wins.** Where the repo file is newer than 21 Oct, the repo wins; where 21 Oct is newer, 21 Oct wins. File dates are the UTC last-commit dates in the table.
2. **GitHub is the truth for anything about the repo as built.** If the code, issues or PRs say otherwise, they win over both documents.
3. **Where the two conflict and it is not clear which is newer, the item is marked OPEN**, with what would settle it. No side is picked silently.
4. A statement that **the repo says X and 21 Oct says Y** is kept distinct from **the 21 Oct doc adds something the repo lacks**. Additions are not conflicts.

## Summary table

| Type | Repo doc | Last commit (UTC, `integration`) | Verdict |
|---|---|---|---|
| PRD | `docs/PRD.md` (+ `docs/APP-FLOW.md` for journeys) | 2026-10-05T22:14:06Z (APP-FLOW 2026-10-05T12:42:44Z) | Repo has it |
| TRD | `docs/TRD.md` | 2026-10-05T22:14:06Z | Repo has it |
| DESIGN / UI brief | `docs/UI-BRIEF.md` **and** `docs/design/v3/DESIGN.md` | 2026-10-05T12:42:44Z; v3 file 2026-10-13T08:53:43Z (dir `docs/design/` 2026-10-15T07:59:37Z) | Repo has it — twice, and they disagree |
| DECISIONS | no `docs/DECISIONS.md`. Nearest: `docs/contracts/*.md` + `docs/HARD_RULES.md` | contracts 2026-10-12T21:50:51Z; HARD_RULES 2026-10-06T08:07:22Z | Repo has **no** such doc |
| ROADMAP | `docs/ROADMAP.md` | 2026-10-05T12:42:44Z | Repo has it |
| TECH-STACK | no `docs/TECH-STACK.md`. Nearest: `docs/TRD.md` §1–3 + `docs/HARD_RULES.md` §2 | 2026-10-05T22:14:06Z; 2026-10-06T08:07:22Z | Repo has **no** such doc |
| SYSTEMS | no `docs/SYSTEMS.md`. Nearest: `AGENTS.md`, `docs/HARD_RULES.md`, `docs/SESSION_WORKFLOW.md`, `docs/factory/`, `docs/architecture/` | AGENTS.md 2026-10-06T11:21:22Z; architecture 2026-10-06T16:45:39Z | Repo has **no** such doc |
| TICKETS | `docs/tickets/` (B01–B05, 44 files) + `docs/backlog/BACKLOG.md` | 2026-10-06T09:51:48Z; backlog 2026-11-01T09:23:59Z | Repo has it |

Also present but not a doc type here: `docs/wiki/` (2026-09-17T05:46:23Z), `docs/knowledge/` (2026-08-31T04:34:36Z), `docs/TASKS.md` (2026-06-06T11:29:55Z). All three are stale enough that neither side should be rewritten from them.

---

## 1. PRD

**Repo says (5 Oct, `docs/PRD.md`):** horizons are **NW / MVP / END**, with features numbered `F-01`…`F-131`. Positioning: "an agent-first, modifiable markdown note taker with a coach chat beside it"; "markdown + built-in templates + a chat with memory that can modify the app itself". Live voice is `F-30`, tagged `[NW]`, and called "the **number-one feature**". Billing is `F-110`: "$1 / 3 weeks → Basic $10 → Pro $20 → Max $40", Polar on web, RevenueCat on mobile. Sign-up is `F-01a`, approval-gated, and "**every approved user gets the premium tier**".

**21 Oct adds and changes:**
- Reframes the core as "a planner built around user-owned Markdown pages", with the assistant as "chat beside the page produces inspectable proposals", Accept/Edit/Reject plus a five-minute Undo. Journeys are a six-row table (enter, capture, write, plan the day, ask for help, resume later); there are no `F-` ids.
- Absorbs the **12 Oct contracts**, which are newer than the PRD: `notes.body` as sole page truth, CodeMirror live preview + GFM, stable linked task ids, resource defaults "4 MiB per file, 50 MiB and 100 ready files per user". The PRD never mentions any of these (`F-02` still describes blocks inside a page; no CodeMirror; no quotas).
- Demotes voice: it sits under "Additional product requirements" ("Voice is an alternative input/output mode and must preserve the same explicit action approval…"), and ROADMAP puts "voice and native parity" in Gen 1. This contradicts the repo PRD's `[NW]` "number-one feature".
- Has **no billing or pricing at all**, and describes the beta as "Free manually approved beta". Conflicts in kind with `F-110` and `F-01a`'s premium-tier grant, not by contradiction: 21 Oct simply drops the commercial layer.
- Adds package detail the PRD lacks: the 291-open-issue snapshot, and KB-61/64/67/70/73/74 behaviour with author-reported counts ("27 hydrated fixture passes and 3,328 unit passes, with two unrelated local E2E failures and 89 credential-gated skips").

**OPEN — voice stage.** Repo PRD says NW / "number-one feature"; repo ROADMAP §5 says P4 (after coach, memory, nags and connectors); 21 Oct says Gen 1. Settled by one Amit decision on whether live voice is in the next-week batch. The repo is also internally inconsistent here, so "GitHub is truth" does not resolve it.

**Gap to fix in the rewrite:** 21 Oct cannot be used as the PRD of record while it has no prices, no `F-` ids and no feature-to-horizon mapping for billing.

## 2. TRD

**Repo says (5 Oct, `docs/TRD.md`):** names everything.
- Text interim `deepseek-ai/DeepSeek-V4.1-Flash` (1M context) on DeepInfra; ladder `NVIDIA-Nemotron-3.5-Lightning`, `NVIDIA-Nemotron-3-Super-120B-A12B`, `thinkingmachines/Inkling`; Together as failover.
- Voice: Deepgram Flux `flux-general-en` streaming for English, Deepgram Nova-3 `he` for Hebrew, `ResembleAI/chatterbox-multilingual` for TTS, NVIDIA Nemotron 3 Voicechat for English S2S.
- Embeddings `Qwen/Qwen3-Embedding-8B` at 1,024 dims. Env var names, Convex deployment ids (`ceaseless-dog-617`, `precious-wildcat-890`), Vercel Sandbox, FullCalendar + Kibo UI, `crons.ts`.
- Also: pages are `notes` rows with fenced JSON (`json tempo`) and a derived `noteBlocks` index rebuilt on save.

**21 Oct says (13.5 KB):** the same persistence story (one canonical body, disposable derived indexes, revision + request identity, five-minute Undo, bounded queries, owner scoping) with **zero** provider, model, env-var or deployment names. It states that explicitly: "Provider/model selection is not changed by this packet."

**So the difference is scope, not conflict.** 21 Oct is narrower and is a strict subset on stack. It does *add* things the repo TRD lacks:
- Formal concurrency rules: "a bounded queue and generation epoch", "queued future prompts must not leak into an earlier request's context", "a cancelled or replaced request cannot later overwrite the accepted state".
- Tempo's own MCP server as Gen 1 with "eleven planner tools" (source exists at `docs/ops/MCP.md`), and the Executor client as Gen 1 (source `docs/research/EXECUTOR-IN-TEMPO.md`).
- A required-evidence list that names browser and native proof separately ("HTML prototypes do not satisfy it").

**Net:** for any stack ticket, `docs/TRD.md` is the document of record. 21 Oct's TRD is the safer requirements layer over it.

## 3. DESIGN / UI brief

The repo has **two** design docs and they disagree with each other; 21 Oct's DESIGN.md agrees with the newer one.

| | `docs/UI-BRIEF.md` (5 Oct) | `docs/design/v3/DESIGN.md` (13 Oct) | 21 Oct `DESIGN.md` |
|---|---|---|---|
| Body face | Inter | **Source Sans 3** (v3 §12 overrides "HARD_RULES §7.2 says Inter") | Source Sans 3 |
| Hebrew | — | Frank Ruhl Libre + Assistant | Frank Ruhl Libre + Assistant |
| Accent | `#d97757` tempo-orange | **`#A3461F` / `#EE9468`** (moved off the Claude.ai orange, R-30) | "one primary action per screen"; no hex |
| Ground / paper | cream `#f3ebe2`, cream-raised `#faf6f0` | `#F3EEE4` / `#FBF9F4` | parchment ground + solid paper |
| Screens | 42 web / 12 mobile (`docs/design/screen-inventory.md`, 31 Aug) | screen-map "Web (58)"; `docs/design/v3/screens/web` = **58 files**, `mobile` = **13** | "58 web and 13 mobile HTML screens" |

- **Newer wins:** v3 (13 Oct) is the visual reference, and 21 Oct matches it on typography, parchment, restrained glass with solid fallbacks, and the 58/13 counts (verified against the actual file counts). `UI-BRIEF.md`'s Inter and `#d97757` are stale.
- **OPEN — HARD_RULES §7.2.** The rule file (6 Oct) still says "Body: Inter (sans)" and has not been updated since before v3. v3 claims precedence over it via the owner's brief; HARD_RULES §7.2 says the reverse ("If anything in this file conflicts with a PRD or a prompt, this file wins"). Settled by one edit to `docs/HARD_RULES.md` §7.2 or an explicit line in v3 recording the override.
- **21 Oct adds** an interaction checklist the repo files scatter: proposal cards show the exact change with Accept/Edit/Reject; Undo exposes the remaining window and survives a newer operation; "Loading, empty, error and offline states explain the actual behavior without a false queued-save promise"; lists keep reading position. It also notes the design artifacts are "not a count of running product screens" and that no browser click-through had run — consistent with `docs/APP-FLOW.md` state column.
- **21 Oct drops** the Taby chat-button/avatar next-week items, the token table, the shadcn component map and the px layout grid. The repo keeps all of them.

## 4. DECISIONS

**Repo has no `docs/DECISIONS.md`** (confirmed: file absent, and no `DECISIONS`, `ADR` or equivalent anywhere under `docs/`). Nearest substitutes:
- `docs/contracts/CORE-WEB-NOTES.md`, `CORE-WEB-EDITOR-MODES.md`, `CORE-WEB-RESOURCES.md` — all **2026-10-12T21:50:51Z**; these are where the real decisions live, with `OD-*` ids and "Default adopted 2026-10-12".
- `docs/contracts/B01.md`–`B04.md` (2026-10-05) for batch API contracts.
- `docs/HARD_RULES.md` (2026-10-06) for non-negotiables.
- `docs/design/v3/DESIGN.md` §12 "Owner overrides" for design decisions.

**Agreement, not difference:** the five `2026-10-12` rows in 21 Oct's register match the contracts nearly verbatim — `notes.body` as the single content authority, CodeMirror + GFM, stable linked task ids, "4 MiB per file; 50 MiB and 100 ready files per user" (also 3 open uploads and 20 uploads/hour in the contract, which 21 Oct omits).

**What 21 Oct adds and the repo lacks:**
- A dated decision register with a **Supersedes** column, and a **12-row open-conflict table**: approval before link delivery vs after sign-in; explicit acceptance vs high-confidence auto-apply; raw MCP body vs safe projection; five-minute Undo vs thirty-day restore vs account reactivation vs purge; resource retention vs transient imports; informational counts vs pressure-free habit copy; visible memory vs semantic-graph activation; external writes vs universal Undo; Library completeness across message stores; native target size and accessibility thresholds; persona presets vs dial-only tone; validation counts from different branches.
- A `2026-10-18` row: "Reported branch milestone: voice contract adoption" (issue #868, PR #1081), marked as a report, not adopted policy.

**The acceptance-vs-auto-apply conflict is real in the repo, not invented:** `docs/HARD_RULES.md` §6.2 says every AI mutation goes through `convex/proposals.ts` with confirm/edit/reject, while §6.3 says "`confidence ≥ 0.8`: **auto-apply**, but show an inline undo toast for 5 minutes". Two rules, two policies. 21 Oct's register flags it and refuses to pick — correct. **OPEN**, settled by editing §6.3 (or §6.2).

## 5. ROADMAP

**Repo says (5 Oct, content dated 3 Oct):** an engineering phase plan **P-1 → P9** with grep-able exit checks ("`grep -r MISTRAL_API_KEY convex/` returns nothing", "`eas build -p android --profile preview` yields an APK"), factory governance (Cursor / Claude Code / Codex lanes, Bugbot as merge-blocking reviewer, Greptile removed, PLAN-FINAL steps 1–8), the full #546 Sunday-planner order (#526→#545), and a cadence rule ("no configuration Fri–Sat").

**21 Oct says:** a four-row horizon table — **MVP / Gen 1 / Later / Held** — with exit evidence, a five-step MVP order starting "Reconcile the sign-in/approval order", and a five-loop preview pattern (sign in, task create/reload, template page, accept+Undo a proposal, save a decision card).

**Different axes; neither supersedes the other cleanly.**
- Mapping where they meet: repo **P0-DOC** (blocks + json-render) and **P3a** (coach, memory, nags) ≈ 21 Oct MVP; repo **P4** (voice) and **P5** (study) ≈ 21 Oct Gen 1; repo **P1** (Expo shell) ≈ 21 Oct Gen 1 "native parity"; repo **P8–P9** (V1.5 store-grade) ≈ 21 Oct Later "store distribution".
- **21 Oct has no phase for billing.** Repo **P6** ("Billing visible, consent, polish", RevenueCat webhook, live prices) has no counterpart in any 21 Oct horizon, and the 21 Oct PRD has no pricing. Gap in the copy.
- **21 Oct drops** the lane/tooling governance and all issue numbers; it keeps the governance shape but re-expresses roles as FRONTIER/WORKHORSE in SYSTEMS.
- Both agree calendar dates are UNKNOWN.

**OPEN — sign-up policy.** Repo ROADMAP §4 says "Approval flow: **unlimited sign-ups**, each approved by Amit by email", while `docs/PRD.md` F-01a/`#546` weekend goal A2 says "sign-up cap **30**" with a cap test, and 21 Oct says the approval order is undecided. Three positions. Settled by an Amit ruling recorded in the PRD.

## 6. TECH-STACK

**Repo has no `docs/TECH-STACK.md`** (confirmed). Nearest: `docs/TRD.md` §1 Stack / §2 services / §3 provider routing, and `docs/HARD_RULES.md` §2 forbidden tech.

**What 21 Oct's table asserts, and whether the repo agrees:**

| 21 Oct row | Repo agreement |
|---|---|
| "Bun 1.3.9, Turborepo, apps and packages workspaces" | Agrees (`AGENTS.md`, TRD tooling row); also confirms "no `packages/core`" |
| "Next.js PWA, Tailwind v4, shadcn-based primitives" | Agrees — TRD says Next.js **16** App Router; 21 Oct drops the version |
| "Expo, NativeWind, app-local Tailwind v3" | Agrees-ish; TRD adds `~54.0.9` and "no WebView" |
| "Root `convex/` with Convex Auth" | Agrees; 21 Oct drops the deployment ids |
| "CodeMirror live preview and GFM rendering" | Agrees with `CORE-WEB-EDITOR-MODES.md` (12 Oct) |
| "Existing router and approved Convex Agent/RAG components — provider/model selection is not changed" | Deliberate silence: no equivalent to TRD §3 |

**No conflict on models, because 21 Oct names none.** It is a subset. Its one substantive claim about a conflict is accurate: "Older blanket SDK wording and the later specific Agent/RAG allowance need explicit reconciliation." That is `docs/HARD_RULES.md` §2 (AI provider SDKs forbidden; "Mistral API via native `fetch`") against `docs/TRD.md` (5 Oct, "Amit permitted the Vercel AI SDK", `@ai-sdk/deepinfra`, `@convex-dev/agent`). **OPEN**, settled by updating HARD_RULES §2 and deleting the dead Mistral row from TRD §3.

**Checked against the brief's known facts, and not confirmed:**
- "GLM 5.3 Flash on DeepInfra" — appears in **neither** set. The repo's interim text model is DeepSeek V4.1 Flash. **UNKNOWN.**
- "paid plans $20 and $50" — **no $50 anywhere**. Repo: Basic $10 / Pro $20 / Max $40, plus a $1 three-week trial. 21 Oct: no prices.
- "chat-first" — not stated in either set. Repo: "agent-first, modifiable markdown note taker with a coach chat beside it". 21 Oct: "a planner built around user-owned Markdown pages".
- Deepgram Flux (English), Nova-3 (Hebrew dictation), Chatterbox Multilingual (Hebrew read-aloud) — these **are** the repo's stack, in `docs/PRD.md` §7 and `docs/TRD.md` §3. 21 Oct does not carry them forward.

## 7. SYSTEMS

**Repo has no `docs/SYSTEMS.md`** (confirmed). Nearest, in order of authority: `AGENTS.md` (2026-10-06T11:21:22Z), `docs/HARD_RULES.md` (2026-10-06T08:07:22Z), `docs/SESSION_WORKFLOW.md`, `docs/AGENT_AUTOMATION_RUNBOOK.md`, `docs/factory/` (`AGENT-LIMITS.md`, `QUIET-HOURS.md`, `PROOF.md`, `REFERENCES.md`), `docs/ops/APPROVAL-GATE.md`, `docs/merge-runbook.md`, and `docs/architecture/` (2026-10-06) for the factory workflow map.

**Agreement on the load-bearing rules — these are the same rules, restated:**
- Ticket contract: FOR / WHEN / WHY / GOAL / SCOPE / MUTATES / STEPS / DONE / EVIDENCE / DO NOT / REPORT — identical to `docs/ROADMAP.md` §1 and the 44 ticket files.
- Scope "at most three source files plus one test" — identical.
- Evidence ladder `planned → coded → locally-tested → preview-tested → shipped-and-running` — identical to `HARD_RULES.md` §13.5 and `docs/SHIP_STATE.md`.
- "Only Amit deploys to live" — identical; `SHIP_STATE.md` and TRD §2 say the same.

**Where they differ:**
- **Naming vs roles.** Repo names tools and lanes (Cursor / Claude Code / Codex, Bugbot merge-blocking, Greptile removed, `factory/models.yml`); 21 Oct uses roles only (FRONTIER for architecture, WORKHORSE for bounded tickets) and says "Concrete model selection belongs in the repository's slot mapping".
- **Reviewer.** 21 Oct: "For this documentation run, review is CodeRabbit only." That is a run-scoped cost limit, explicitly *not* repo policy, and it does not conflict with the repo's Bugbot rule.
- **21 Oct adds** data boundaries the repo spreads across HARD_RULES §10/§13: no credentials or private source copies in the public repo, names-only config references, user content scoped to its owner, "approval to discover a connector is not approval to execute an external action".
- **21 Oct lacks** the repo's operational specifics: config-guard and scope-guard, the pause switch, `blocked:amit` after three failed fixes, quiet hours, merge queue. Those stay in `AGENTS.md` / `docs/factory/`.

## 8. TICKETS

**Repo says:** 44 ticket files under `docs/tickets/B01`–`B05` (2026-10-06), each with front-matter (`ticket`, `batch`, `type`, `lane`, `scope`, `depends_on`, `contract`, `hold`) plus the 11 fields; `docs/tickets/README.md` describes the factory flow (ticket writer opens ONE `config` PR, then `factory-promote` creates one issue per file); `docs/contracts/<batch>.md` holds the exact API shapes; `docs/backlog/BACKLOG.md` (2026-11-01) holds the next loop batches.

**21 Oct's `TICKETS.md` is not a ticket set** — it is an issue audit: "NEW 0. Proposed EDIT 13. Proposed CLOSE 0", against "291 open issues" refreshed 2026-10-21 10:12 UTC, with amendments to #399, #400, #747, #751, #837, #838, #840, #868, #1101, #1104, #1117, #1118, #1122 and a 291-row KEEP mapping. Publication record: issues **#1194** (proposals) and **#1195** (docs package); "Draft PR: NONE".

**Newer wins, and the repo's backlog is 11 days newer.** `docs/backlog/BACKLOG.md` (1 Nov) supersedes the 21 Oct picture on three points:
- It records that much of the generated backlog is **already built on `integration`**: TM-0001 DeepInfra seam (`convex/lib/ai_router.ts`), TM-0048 panic button (`coach.pressPanic`), TM-0101/0102 block parser and schemas, TM-0024 entitlements, TM-0008 soft delete, TM-0037 coach prompt.
- It states a **config pause set 1 Nov** and a protected-path list (`convex/schema.ts`, `convex/auth*`, `.github/**`, `.env`), neither of which 21 Oct knows about.
- It says the full 550-ticket backlog "stays local with the factory and is not committed".

**Counts, verified just now:** 21 Oct pinned **291** open issues; a `gh issue list --state open` read on 2026-11-01 returns **361** open issues (**537** when open pull requests are counted in). `docs/wiki/Tickets.md` says **60**, last synced 2026-09-16 — stale by an order of magnitude. Both issues #1194 and #1195 are still **open** (last touched 2026-10-27), so the 13 amendments were never applied.

**Net:** the repo's ticket *format* and *batch* structure is the document of record; 21 Oct is the only record of the 13 amendments and is still the right prose for them, but its inventory count and its staleness findings are out of date.

---

## What the 21 Oct set adds that the repo lacks

- A decision register with supersession and a named open-conflict list (section 4).
- The 13 issue amendments as reviewable prose, plus the #1194/#1195 coordination trail.
- Explicit evidence vocabulary applied consistently (`AUTHOR_REPORTED_BRANCH_BUILD`, `OWNER_DECISIONS_RECORDED_IN_DEFAULT_SPEC`, `UNKNOWN`, `EXTRAPOLATED`), and "no runtime test was performed by this packet" stated once per document.
- The KB-61/64/67/70/73/74 behaviour notes with committed fixture and unit counts.
- A five-loop preview acceptance pattern and a five-step MVP order.

## What the 21 Oct set lacks

- Every provider, model, env var and deployment id (DeepSeek V4.1 Flash, Nemotron 3.5 Lightning / 3 Super / Inkling, Deepgram Flux, Nova-3 `he`, Chatterbox Multilingual, Qwen3-Embedding-8B).
- All pricing and billing ($1 trial, $10 / $20 / $40) and the premium-tier grant to approved users.
- The `F-` feature ids and the NW / MVP / END horizon mapping.
- Repo governance specifics: lanes, Bugbot, config-guard, pause switch, quiet hours, merge queue.
- Anything after 21 Oct — notably `docs/backlog/BACKLOG.md` (1 Nov) and its built-already findings.

## UNKNOWN — where I looked and did not find it

| Item | Where I looked | Result |
|---|---|---|
| "GLM 5.3 Flash" | `docs/source/2026-10-21/*.md`; all of `docs/`; repo `*.md`, `*.ts`, `*.json` outside `node_modules` | Not present anywhere. Repo interim text model is DeepSeek V4.1 Flash |
| "$20 and $50" plans | both sets | $50 does not exist; repo says Pro $20 / Max $40 |
| "chat-first" as a stated position | both sets | Not stated; repo says "agent-first", 21 Oct says pages-first |
| Whether the 13 amendments were applied | issues #1194, #1195 via the GitHub API | Both still open as of 2026-10-27; amendments not applied |
| Which of PRD / ROADMAP / 21 Oct governs the voice stage | `docs/PRD.md` F-30, `docs/ROADMAP.md` §5, 21 Oct ROADMAP | Internally inconsistent; needs an Amit ruling (OPEN, section 1) |
| Sign-up cap: unlimited vs 30 | `docs/ROADMAP.md` §4, `docs/PRD.md` F-01a, 21 Oct PRD/ROADMAP | Three answers; needs an Amit ruling (OPEN, section 5) |
| Whether `HARD_RULES.md` §7.2 (Inter) still binds after v3 DESIGN | `docs/HARD_RULES.md` (6 Oct) vs `docs/design/v3/DESIGN.md` (13 Oct) | Unresolved; HARD_RULES was not updated (OPEN, section 3) |
