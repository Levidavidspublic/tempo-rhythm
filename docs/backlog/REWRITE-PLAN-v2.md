# Tempo Flow — Backlog rewrite plan v2 (ticket standard v2)

Written 1 Nov 2026 · Branch `docs/source-2026-11-01` · Draft PR #1352 into `integration`.

This file plans the **v2** rewrite of the Tempo Flow backlog into buildable tickets under
`docs/backlog/TICKET-STANDARD.md` (v2, 1 Nov 2026). It supersedes the earlier thin-format rewrite
(`docs/backlog/REWRITE-PLAN.md`, tickets TRW-1001…TRW-1232), which stays on disk for history and is
marked superseded. The new ticket text lands in `docs/backlog/BACKLOG-v2.md`, chunk by chunk.

## 0. Summary (filled at the end of the run — see Step 4)
Ticket counts by stage, OPEN count, page estimate, chunks done, and the old-ticket supersession map
are added here once every chunk is written.

## 1. Ticket ID scheme
- Fresh IDs, `TFV2-0001` upward, one per ticket, in build order. No reuse of `TM-####` or `TRW-####`.
- One ticket = ONE screen, OR ONE component, OR ONE backend function/table/endpoint (the standard's
  sizing rule). A screen that is only a shell over existing components may still be one ticket when
  it owns its route, data wiring and states.
- `Pass` (1|2) and `Depends` are kept per ticket; `Pass` 1 is "clunky, every state works", `Pass` 2
  is "matches v3 tokens/motion exactly".

## 2. Conflict rule (the decision rule for every ticket)
1. **The newer dated document wins.** The later-dated source wins; the older line moves under
   "Supersedes", never deleted.
2. **GitHub (code, issues, PRs) is the truth for what exists.** It wins over every document.
3. **Unclear which is newer → OPEN.** Marked `OPEN` with what would settle it; no side picked silently.
4. "Repo says X and the 21 Oct set says Y" is distinct from "the 21 Oct set adds what the repo lacks".
   Additions are not conflicts.

## 3. Sources consulted
`TICKET-STANDARD.md` · `include.md` (spec-writing skill) · `AGENTS.md` · `docs/PRD.md` ·
`docs/TRD.md` · `docs/APP-FLOW.md` · `docs/UI-BRIEF.md` · `docs/BACKEND-SCHEMA.md` ·
`docs/ROADMAP.md` · `docs/design/v3/` (DESIGN.md, components.md, screen-map.md, OVERNIGHT-RUN.md,
58 web + 13 mobile HTML screens) · `docs/design/claude-export/design-system/` (tokens, brand-voice) ·
`docs/source/2026-10-21/` (COMPARISON.md, DECISIONS.md and the 10-doc set) · `docs/graph/GRAPH_REPORT.md` ·
`docs/contracts/` (CORE-WEB-NOTES, CORE-WEB-EDITOR-MODES, CORE-WEB-RESOURCES) · code on
`integration` at `f9b17d7` (`convex/`, `apps/web/`, `apps/mobile/`, `packages/`) · open GitHub issues
labelled `factory` (read 1 Nov 2026).

## 4. Open conflicts (carried verbatim; every ticket that touches one marks the value UNKNOWN)
Carried from `docs/backlog/REWRITE-PLAN.md` and `docs/source/2026-10-21/COMPARISON.md`. Each names
"Amit" as the answerer; no ticket invents a choice.

1. **Voice stage.** Repo PRD says live voice is NW / "the number-one feature" (`F-30`); repo ROADMAP
   §5 puts it at P4; the 21 Oct set puts it in Gen 1. Settle: Amit. → chunk E (Gen 1) is assumed.
2. **Prices / billing tiers.** Repo: $1 trial (3 weeks) → Basic $10 → Pro $20 → Max $40, annual =
   two months free. 21 Oct has no prices and describes a "free manually approved beta". A later note
   says "paid plans $20 and $50". Settle: Amit. → chunk D.
3. **Interim text model.** Repo: `deepseek-ai/DeepSeek-V4.1-Flash` on DeepInfra. A later note says
   "GLM 5.3 Flash on DeepInfra" (that string appears nowhere in the repo). Settle: Amit; the seam
   code (`convex/lib/ai_router.ts`) is the source of truth until then. → chunk C.
4. **Sign-up policy.** Repo ROADMAP §4 says "unlimited sign-ups, each approved by Amit"; PRD `F-01a`
   and the weekend goal say "sign-up cap 30"; the 21 Oct set says the approval order is undecided.
   Settle: Amit. → chunk A.
5. **Body typeface.** `docs/HARD_RULES.md` §7.2 says "Body: Inter"; `docs/design/v3/DESIGN.md`
   (13 Oct) says Source Sans 3 (Hebrew Frank Ruhl Libre + Assistant); `docs/UI-BRIEF.md` says Inter.
   Settle: one edit to HARD_RULES §7.2 or an explicit override line in v3. → chunk D.
6. **Accept-reject vs auto-apply.** `docs/HARD_RULES.md` §6.2 says every AI mutation goes through
   `convex/proposals.ts` (confirm/edit/reject); §6.3 says `confidence ≥ 0.8` auto-applies with a
   5-minute undo toast. Settle: edit §6.3 or §6.2. → chunks B–C.
7. **Block model.** 20 Sep: pages with JSON blocks (typed tables migrate into blocks and retire);
   #546: additive typed tables (`dayPlans`, `timeBlocks`, `habitCheckIns`, …); 12 Oct contracts + 21
   Oct: `notes.body` is the single page-content authority with disposable derived indexes. Settle:
   Amit (the 12 Oct contracts are newest and lean toward `notes.body`). → chunk A.
8. **`forget` semantics.** PRD "soft delete everywhere, 30-day grace" vs memory spec "forget must be
   complete" (`deleteMemory` hard-deletes today). Settle: Amit. → chunk C.
9. **Confidence auto-apply threshold.** `.cursorrules` / HARD_RULES §6.3: auto-apply `≥ 0.8`,
   confirm 0.5–0.8, dialog below 0.5. Where the number lives and whether it is user-tunable:
   UNKNOWN. → chunk C.
10. **Week start.** Sunday vs Monday (code uses Monday; #546 question 3 open). Settle: Amit. → chunk B.
11. **Nag delivery channel** beyond in-app (PRD `F-61`). Settle: Amit. → chunk B.
12. **HARD_RULES §2 (AI SDK forbidden) vs TRD §3 (Vercel AI SDK + Convex Agent permitted, 5 Oct).**
    Settle: update HARD_RULES §2 and delete the dead Mistral row from TRD §3. → chunk C.
13. **Where the user's IANA time zone is stored** (`users` vs `preferences`). UNKNOWN. → chunk B.

## 5. Inventory — every unit the product needs, with stage and code status
Stage key: **A** = MVP core · **B** = MVP planning surface · **C** = MVP coach & memory · **D** = MVP
modules/jobs/billing/language/polish · **E** = Gen 1 · **F** = Gen 2 (later). Code status: **EXISTS** =
file/function present on `integration`; **PARTIAL** = present but not fully wired; **MISSING** = not in
code. Status is a file-presence check; full behavioural wiring is `UNKNOWN` without a live run.

### 5.1 Screens (71 = 58 web + 13 mobile)
Web (58). Route is the v3 target; the source HTML screen is named in parentheses.

| Screen | Route (v3 target) | Stage | Code |
|---|---|---|---|
| Today | `(tempo)/today` (web/today) | B | EXISTS |
| Daily note | `(bare)/daily-note` (web/daily-note) | B | EXISTS |
| Brain dump | `(tempo)/brain-dump` (web/brain-dump) | B | EXISTS |
| Plan (day/week/month) | `(tempo)/plan` (web/plan) | B | EXISTS |
| Coach (panel over Today) | `components/coach/CoachPanel` (web/coach) | C | EXISTS |
| Coach thread | `(tempo)/coach/[threadId]` (web/coach-thread) | C | EXISTS |
| Coach history | `(tempo)/history` (web/coach-history) | C | EXISTS |
| Voice call (web) | `components/voice/VoiceCall` (web/voice-call) | E | EXISTS |
| Page editor | `(tempo)/notes/[id]` (web/page-editor) | A | EXISTS |
| Page blocks (one page route) | `(tempo)/notes/[id]` (web/page-blocks) | A | EXISTS |
| Weekly page | `(tempo)/week/[week]` (web/weekly-page) | B | EXISTS |
| New page | `(tempo)/notes/new` (web/new-page) | A | MISSING |
| Templates | `(tempo)/templates` (web/templates) | D | EXISTS |
| Template builder | `(bare)/templates/builder` (web/template-builder) | D | EXISTS |
| Template run | `(bare)/templates/run/[id]` (web/template-run) | D | EXISTS |
| Template editor | `(tempo)/templates/editor/[id]` (web/template-editor) | D | EXISTS |
| Template sketch | `(tempo)/templates/sketch` (web/template-sketch) | D | EXISTS |
| Tasks | `(tempo)/tasks` (web/tasks) | B | EXISTS |
| Task sheet | `components/tasks/TaskSheet` (web/task-sheet) | B | EXISTS |
| Notes (list/tree) | `(tempo)/notes` (web/notes) | A | EXISTS |
| Journal | `(tempo)/journal` (web/journal) | B | EXISTS |
| Calendar | `(tempo)/calendar` (web/calendar) | B | EXISTS |
| Habits | `(tempo)/habits` (web/habits) | B | EXISTS |
| Habit detail | `(tempo)/habits/[id]` (web/habit-detail) | B | EXISTS |
| Routines | `(tempo)/routines` (web/routines) | B | EXISTS |
| Routine detail | `(tempo)/routines/[id]` (web/routine-detail) | B | EXISTS |
| Goals | `(tempo)/goals` (web/goals) | B | EXISTS |
| Goal detail | `(tempo)/goals/[id]` (web/goal-detail) | B | EXISTS |
| Goals progress | `(tempo)/goals/progress` (web/goals-progress) | B | EXISTS |
| Projects | `(tempo)/projects` (web/projects) | B | EXISTS |
| Project detail | `(tempo)/projects/[id]` (web/project-detail) | B | EXISTS |
| Project kanban | `(tempo)/projects/[id]/kanban` (web/project-kanban) | B | EXISTS |
| Insights | `(tempo)/insights` (web/insights) | B | EXISTS |
| Activity | `(tempo)/activity` (web/activity) | B | EXISTS |
| Search | `(tempo)/search` (web/search) | B | EXISTS |
| Command palette | `(tempo)/command` (web/command) | B | EXISTS |
| Notifications | `(tempo)/notifications` (web/notifications) | B | EXISTS |
| Ask founder | `(tempo)/ask-founder` (web/ask-founder) | D | EXISTS |
| Empty states (gallery) | `(tempo)/empty-states` (web/empty-states) | D | EXISTS |
| Memory | `(tempo)/settings/memory` (web/memory) | C | EXISTS |
| Memory import | `(tempo)/settings/memory/import` (web/memory-import) | C | EXISTS |
| Modules | `(tempo)/modules` (web/modules) | D | EXISTS |
| Module preview | `(tempo)/modules/preview/[draftId]` (web/module-preview) | D | EXISTS |
| Nags | `(tempo)/settings/nags` (web/nags) | B | EXISTS |
| Settings profile | `(tempo)/settings/profile` (web/settings-profile) | D | EXISTS |
| Settings preferences | `(tempo)/settings/preferences` (web/settings-prefs) | D | EXISTS |
| Settings privacy | `(tempo)/settings/privacy` (web/settings-privacy) | D | EXISTS |
| Settings integrations | `(tempo)/settings/integrations` (web/settings-integrations) | E | EXISTS |
| Billing | `(tempo)/billing` (web/billing) | D | EXISTS |
| Trial end | `(bare)/billing/trial-end` (web/trial-end) | D | EXISTS |
| Landing (marketing) | `(marketing)/page` (web/landing) | D | EXISTS |
| About | `(marketing)/about` (web/about) | D | EXISTS |
| Changelog | `(marketing)/changelog` (web/changelog) | D | EXISTS |
| Sign-in | `(auth)/sign-in` (web/sign-in) | A | EXISTS |
| Sign-up | `(auth)/sign-up` (web/sign-up) | A | EXISTS |
| Link sent | `(auth)/sign-in/sent` (web/link-sent) | A | MISSING |
| Approval pending | `(auth)/sign-up/pending` (web/approval-pending) | A | MISSING |
| Onboarding | `(auth)/onboarding` (web/onboarding) | A | EXISTS |

Mobile (13). Route is the v3 target.

| Screen | Route | Stage | Code |
|---|---|---|---|
| Today | `apps/mobile/app/(tempo)/(tabs)/today` | E | PARTIAL |
| Capture | `apps/mobile/app/(tempo)/capture` | E | PARTIAL |
| Coach | `apps/mobile/app/(tempo)/(tabs)/coach` | E | PARTIAL |
| Voice call | `apps/mobile/app/(tempo)/voice-call` | E | MISSING |
| Tasks | `apps/mobile/app/(tempo)/(tabs)/tasks` | E | PARTIAL |
| Notes | `apps/mobile/app/(tempo)/(tabs)/notes` | E | PARTIAL |
| Journal | `apps/mobile/app/(tempo)/journal` | E | PARTIAL |
| Habits | `apps/mobile/app/(tempo)/habits` | E | PARTIAL |
| Calendar | `apps/mobile/app/(tempo)/calendar` | E | PARTIAL |
| Routines | `apps/mobile/app/(tempo)/routines` | E | PARTIAL |
| Templates | `apps/mobile/app/(tempo)/templates` | E | PARTIAL |
| Settings | `apps/mobile/app/(tempo)/settings` | E | PARTIAL |
| Onboarding | `apps/mobile/app/(auth)/onboarding` | E | PARTIAL |

### 5.2 Components (design catalogue: docs/design/v3/components.md)
One ticket per component. Stage 1 (locked) components are shared primitives; Stage 2 components are
feature-specific. Both are listed here; the chunk plan assigns each to its feature chunk.

**Stage 1 (locked) — shared shell & editor primitives (chunk A):** TempoShell, Sidebar/PageTree,
CommandTrigger, Topbar, Avatar, TabBar, Page/PageEditor, PageCover/PageIcon/PageMeta, PageTitle,
Headings, Tag, Wikilink, Chip, Button, Kbd, Card, BlockHandle, SlashMenu, NextUpCard, TaskBlock/TaskRow,
EnergyBlock/Dial, TimeBlock, Backlinks, CoachButton, CoachPanel, CoachMessage/UserMessage, ProposalCard,
ChangePreview, Composer, UndoToast, Skeleton, Empty, Glass, Helpers (tp-num/mono/muted/small/eyebrow/
sr-only/skip/icon--flip).

**Stage 2 — layout/forms/settings (chunks A–D):** PageLayout, Surface, PageHeader, Toolbar, Split,
Section, CardGrid, Notice, Badge, Icon sizes, Utilities, Form, Field, TextInput, Textarea, Select,
Switch, Checkbox, Radio, Dial 0–10, FormErrorSummary, SettingsSection, SettingRow.

**Stage 2 — blocks (chunks A–B):** EventBlock, HabitBlock, NagBlock, TemplateBlock, PageMetaBlock,
BrokenBlock, CoachArtifact, Flashcard, Quiz, Checklist, Tracker.

**Stage 2 — page types & lists (chunks A–B):** PageHead, WeekStrip, ProjectStatus, TemplatePicker,
ListRow, Segmented/Filter, SearchInput, SortMenu, LoadMore.

**Stage 2 — calendar (chunk B):** MonthGrid, Dot, WeekColumns, DayTimeline.

**Stage 2 — kanban (chunk B):** Kanban, KanbanCard.

**Stage 2 — charts (chunk B):** BarChart, LineChart, ChartSummary.

**Stage 2 — coach (chunk C):** ChatHistoryList, ChatSearch, CoachDial, PanicButton, GroundingCard,
CrisisCard, ProposalCard variants, TypingIndicator, ReadAloudButton.

**Stage 2 — live voice (chunk E):** VoiceCall, AudioLevel, LiveTranscript, MicToggle, Interrupt,
EndCall, PushToTalk, CallMinutes, CallActionConfirm, LanguageChip.

**Stage 2 — memory (chunk C):** MemoryItem, ImportReview, ExportArea.

**Stage 2 — modules (chunk D):** ModuleCard, ModuleSummary, PlainModeBanner, ScheduledJobRow.

**Stage 2 — billing (chunk D):** TierCard, BillingNotice.

**Stage 2 — auth (chunk A):** AuthCard, EmailField, GuestButton, DividerText, StatusPanel.

**Stage 2 — marketing (chunk D):** Container, SiteHeader, Hero, FeatureRow, HowItWorks, Quote, Pricing,
FAQ, SiteFooter, LanguageSwitch.

**Stage 2 — mobile shell (chunk E):** MobileTopBar, MobileTabBar, MobileSheet, TouchRow.

**Stage 2 — states (chunks A–D):** StateEmpty, StateLoading, StateError, StateOffline, StateSwitch.

### 5.3 Backend — tables (35, in `convex/schema.ts`)
| Table | Stage | Code |
|---|---|---|
| users, subscriptionStates | A | EXISTS |
| conversations, messages, chatRequests | C | EXISTS |
| voiceSessions | E | EXISTS |
| memories | C | EXISTS |
| tasks, taskRepeatCfgs | B | EXISTS |
| calendarEvents | B | EXISTS |
| focusBlocks | B | EXISTS |
| notes, noteBlocks | A | EXISTS |
| pageOperations, pageOperationPayloads, pageProposals | A | EXISTS |
| habits, habitCheckIns | B | EXISTS |
| goals | B | EXISTS |
| dayPlans, timeBlocks | B | EXISTS |
| templates | D | EXISTS |
| userPreferences | D | EXISTS |
| coachWebSearches, coachSettings, coachProposals | C | EXISTS |
| nags | B | EXISTS |
| notifications | B | EXISTS |
| mcpTokens, connections, connectionLimits, connectionSecrets, oauthClients, oauthPending, connectionCalls | E | EXISTS |

### 5.4 Backend — function modules (in `convex/*.ts`, `convex/lib/*.ts`)
Listed by area; each is the unit a backend ticket targets. All exist on `integration` unless noted.

- **Auth & sign-in (A):** `auth.ts`, `lib/signInEmail.ts`, `lib/approval.ts`, `lib/requireUser.ts`,
  `lib/accountDeletion.ts`.
- **Pages/blocks/editor (A):** `notes.ts`, `lib/blocks.ts`, `lib/pageLedger.ts`, `lib/pagePrivacy.ts`,
  `pageCleanup.ts`, `notes_links.ts`, `notes_period.ts`, `notes_rail.ts`, `templates.ts`,
  `lib/templateCatalog.ts`.
- **Coach & chat (C):** `coach.ts`, `coach_chat.test.ts`, `lib/agentComponent.ts`, `lib/ai_router.ts`,
  `lib/aiGate.ts`, `lib/ai_errors.ts`, `lib/coachPrompt.ts`, `lib/coachLoad.ts`,
  `lib/coachHistory.ts`, `lib/coachProposalGuard.ts`, `lib/webSearch.ts`, `lib/mockModel.ts` (MISSING),
  `lib/bounded.ts` (MISSING), `lib/shameWords.ts` (PARTIAL), `lib/confidence.ts` (MISSING).
- **Memory (C):** `memory.ts`, `memoryImport.ts`, `memories.ts`, `search.ts`, `lib/memoryImport.ts`,
  `lib/crisisWords.ts`, `crisis.ts`.
- **Planning (B):** `tasks.ts`, `lib/taskChecklists.ts`, `lib/taskRepeat.ts`, `lib/task_filters.ts`,
  `calendar_events.ts`, `habits.ts`, `habitCheckIns.ts`, `lib/habitStreak.ts`,
  `lib/habitCheckInStreak.ts`, `goals.ts`, `dayPlans.ts`, `timeBlocks.ts`, `focusBlocks.ts`,
  `brain_dump.ts`, `lib/brainDumpInput.ts`, `lib/brainDumpParse.ts`.
- **Nags & notifications (B):** `nags.ts`, `lib/nagPhrase.ts`, `notifications.ts`.
- **Insights & analytics (B):** `analytics.ts`, `insights.ts` (+`lib/insights_summary.ts`), `activity.ts`,
  `streaks.ts`.
- **Preferences (D):** `preferences.ts`.
- **Billing (D):** `revenuecat.ts`, `lib/revenuecat_events.ts`, `lib/entitlements.ts`,
  `lib/subscriptionGuards.ts`.
- **Voice (E):** `voice.ts`, `lib/voicePolicy.ts`.
- **MCP / connectors (E):** `mcp.ts`, `mcpTools.ts`, `mcpHttp.ts`, `connections.ts`,
  `connectionsHttp.ts`, `lib/connections/*`, `lib/mcp/*`.
- **Cron & HTTP (D/E):** `crons.ts`, `http.ts`.
- **Proposals/approval (A–B):** `approval.ts`, `lib/approval.ts` (accept/reject guard).
- **Misc (A):** `ai_smoke.ts`, `b03.ts` (contract test).

## 6. Chunk plan (build order; 60–100 tickets per chunk)
`todo` = not yet written into `BACKLOG-v2.md`; `done` = written.

| Chunk | Stage | Feature areas | Ticket IDs | Count | Status |
|---|---|---|---|---|---|
| 1 | A · MVP core (chat-first) | Approval-gated sign-in & owner isolation · markdown editor (CodeMirror live preview + GFM) · block codec + Zod schemas + derived indexes · notes/pages port (`notes.body` authority, save/patchBlock) · operation ledger + 5-min Undo · bounded queries + resource quotas · memory adapter foundation · coach Agent foundation (tools, crisis, mock model, entitlement gate) · EN/HE + RTL baseline · shell & editor primitives · smoke + a11y + perf budget | TFV2-0001 … TFV2-0064 | 64 | todo |
| 2 | B · MVP planning surface | Today (daily page) · brain dump → proposal · tasks as blocks · calendar events (end time, edit, soft delete) · habits + check-ins by local day · day/week/month views · time blocks & reflow · nags · carry-over · Goals, Journal, Routines | TFV2-0065 … TFV2-0148 | 84 | todo |
| 3 | C · MVP coach & memory | Coach Agent tools (createNote/addTaskToToday/fillTemplate/draftModule/searchMemory/scheduleJob) · adaptive coach (dial, panic, bad-day, realism) · memory port (recall by meaning+keyword+links+time, forget, reflect, life graph) · embeddings + Hebrew eval · anti-shaming · mock model · entitlement/quota ordering | TFV2-0149 … TFV2-0232 | 84 | todo |
| 4 | D · MVP modules, jobs, billing, language, polish | Template/view/code modules + validation + Plain mode · sandboxed code (iframe + Vercel Sandbox) · scheduled jobs (crons) · coach artifacts (flashcard/quiz/checklist/tracker) · billing (Polar/RevenueCat) + entitlements/quota · EN/HE strings + RTL + a11y · landing EN/HE · PWA polish · ask-founder | TFV2-0233 … TFV2-0316 | 84 | todo |
| 5 | E · Gen 1 | Expo native shell (Android APK / iOS TestFlight) · study track (SM-2, flashcards, test, RAG) · connectors (Executor) · MCP server + CLI + REST · BYOK key vault · live voice (Deepgram STT, Chatterbox TTS, barge-in) | TFV2-0317 … TFV2-0396 | 80 | todo |
| 6 | F · Gen 2 (later) | Plugin SDK + marketplace · Tauri desktop + VPS `claude` · store-grade native (push, camera, App Store / Play) · later features (calendar sync, WhatsApp/Telegram, offline inference, family plans) | TFV2-0397 … TFV2-0456 | 60 | todo |

## 7. Open `factory` issues folded in (read 1 Nov 2026)
Each is folded into exactly one chunk; its ticket notes the issue number so the promotion step dedupes.

| Issue | Title | Folds into |
|---|---|---|
| #1348 | TM-0032 — Bounded query helper | chunk 1 |
| #1349 | TM-0050 — Mock language model | chunk 1 |
| #1350 | TM-0049 — Anti-shaming copy check | chunk 1 |
| #1340 | TEMPO-BL-0001 — Entitlements table | chunk 1 |
| #1342 | TEMPO-BL-0004 — Lighthouse budget in CI | chunk 1 |
| #743 | TEMPO-N2-01 — Chat backend: real AI replies | chunk 1 (wiring chunk 3) |
| #744 | TEMPO-N2-02 — /coach chat uses chat.send, Thinking + Retry | chunk 1 (wiring chunk 3) |
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

## 8. Grok Bot's overnight drafts folded in (as requirements, never as built facts)
- **`docs/source/2026-10-21/`** supplies the markdown-first reframing (user-owned pages, proposals with
  Accept/Edit/Reject, 5-min Undo, bounded queries), the 13 issue amendments, and the open-conflict list.
  It names no models/prices/env vars. Duplicate: its five-loop preview pattern and five-step order fold
  into chunk 1's smoke tickets and the chunk order.
- **`docs/design/v3/` + `OVERNIGHT-RUN.md`** supplies the settled editor decisions: `notes.body` as the
  only source of truth, CodeMirror 6 live preview + `remark-gfm`, byte-exact save round-trip, live
  `[[links]]` with backlinks, `- [ ]` stays plain markdown, one page route `/notes/[id]`, v3 tokens
  (Source Sans 3 etc.), `dir="auto"` per paragraph. Its screen inventory and component map are design
  references; only buildable units become tickets.

## 9. Ticket template (what each ticket in `BACKLOG-v2.md` contains)
Every ticket carries, in this order: `ID`, `Title`, `Stage`, `Pass`, `Depends`, `Folds-in` (issue, or
none), then the 11 `AGENTS.md` fields (`FOR`, `WHEN`, `WHY`, `GOAL`, `SCOPE`, `MUTATES`, `STEPS`,
`DONE`, `EVIDENCE`, `DO NOT`, `REPORT`) plus `SPEC`, `TESTS` (Given/When/Then), `NUMBERS` (range +
source, or UNKNOWN), `GATES` (the standard's gate list), and `OPEN` (or `none`). The standard
(`TICKET-STANDARD.md`) is the authority; this file only plans the units.

## 10. DO NOT (this rewrite)
- Do not delete anything. Old backlog files stay, marked "Superseded by BACKLOG-v2.md (ticket standard
  v2, 1 Nov 2026)".
- Do not relabel, comment on, open or close any GitHub issue, or edit PR #1352's description.
- Never touch workflows, secrets, or protected paths (`convex/schema.ts`, `convex/auth*`,
  `packages/backend/convex/schema.ts`, `packages/backend/convex/auth*`, `.github/**`, any `.env` file);
  never weaken a check; never merge.
- Never write a key value. Names only.
