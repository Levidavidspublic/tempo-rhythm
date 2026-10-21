# Tempo Flow: Roadmap

> **Last updated 2026-10-03** (IDT) · Written by Grok Bot from the sources below · Decisions are Amit's.
> **Sources:** factory-v2 product docs v2 (20 Sep 2026): `06-ROADMAP.md` with its 30 Sep decision update · Basic Memory notes `Factory Decisions — 2026-09-18`, `Factory merge and deploy policy` (30 Sep), `Weekend factory plan 2026-10-02`, `Weekend goals 2026-10-02`, `Next week — factory decisions and research 2026-10-03` (updates 15:25, 15:32, 15:38) · plan-v4 `PLAN-FINAL.md` (3 Oct 15:44 IDT) · plan-v3 `WEEKEND-PLAN.md` · umbrella [#546](https://github.com/Division6066/tempo-rhythm/issues/546) and the 3 Oct run log.
> **Markers:** UNKNOWN = not known or not decided. (EXTRAPOLATED) = Grok Bot's own fill, not a decision. Newer Amit decisions win over older sources; conflicts are listed in §7.
> **Companion docs:** [PRD](./PRD.md) · [TRD](./TRD.md) · [App flow](./APP-FLOW.md) · [UI brief](./UI-BRIEF.md) · [Backend schema](./BACKEND-SCHEMA.md)

A roadmap of phases, not a ticket list. Calendar dates are not set (UNKNOWN), except where a date is stated.

## 1. Ground rules for every phase

- Stages inside each phase: **isolate → build → prove → ship**.
- Tickets: 11 fields (FOR, WHEN, WHY, GOAL, SCOPE, MUTATES, STEPS, DONE, EVIDENCE, DO NOT, REPORT); scope 3 files + 1 test; DONE is a command with its expected output. From PLAN-FINAL step 4, STEPS start with a Graphify query of the MUTATES files and their dependents.
- Lanes: **Cursor** (front end, most building) · **Claude Code** (backend, sign-in, tests) · **Codex** (CI, docs, refactors) · Grok Bot (settings and CI via config-lane PRs; never product code) · **Amit** (decisions, secrets, spend, logins, deletions, live releases).
- PRs go into `integration`. Merge only when every machine check passes, including the merge-blocking reviewer (see [TRD](./TRD.md) §8.3). Only Amit merges to `master` and runs live Convex deploys.
- Cadence ("Shabbat light", 3 Oct): autonomous build work runs 7 days a week; no configuration, patching or Grok Bot config runs Friday–Saturday. If something major breaks, work pauses until Sunday.
- A ticket that fails more than 3 times stops (`blocked:amit` with reason and run links); its dependents pause; everything else continues.
- Tooling is Bun + Turborepo. A ticket isn't done until its diagrams in `docs/diagrams/` are true.

## 2. Now: weekend of 2–4 Oct 2026

### 2.1 State at 3 Oct ~16:00 IDT
- **Ticket releases and automations are paused** (Amit, 3 Oct 14:40 / PLAN-FINAL). No `ready` labels are being added.
- #546 children run so far: [#526](https://github.com/Division6066/tempo-rhythm/issues/526) → PR [#547](https://github.com/Division6066/tempo-rhythm/pull/547) open, CI green including E2E, **held**: no Greptile review. [#527](https://github.com/Division6066/tempo-rhythm/issues/527): the Claude lane ran but opened no PR (failed; cause UNKNOWN). #528–#545: triaged, not released.
- No merges and no Convex deploys from the #546 run.

### 2.2 Factory plan (PLAN-FINAL, 3 Oct)
1. Move all repos to org **Levidavidspublic** (tempo-rhythm last); re-check CI, Vercel preview from `integration`, rulesets after each move.
2. Org secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `CURSOR_API_KEY`; per-repo stays: `CONVEX_DEPLOY_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
3. **Docs: these six documents in `docs/` and the wiki.**
4. Rewrite every open ticket to the 11-field standard with Graphify context.
5. Build (don't switch on) the Copilot dispatcher.
6. Disconnect Greptile; Bugbot becomes the reviewer with blocking findings; remove "no runs Fri/Sat" from `AGENTS.md` and the dispatcher.
7. **Automations go ON only when:** (1) all repos moved and checks pass; (2) docs and wikis complete; (3) tickets rewritten with Graphify. Then lane tests (Cursor: tempo #497; Codex: #498), a proof test per repo (a failing PR is blocked, a passing one merges), then dispatcher, Bugbot as required reviewer, auto-merge into `integration`.
8. Saturday-evening batch list for Amit: logins, approvals, app installs, payments, deletions.

### 2.3 Tempo weekend goals (Amit, 2 Oct)
A1 magic link only on www · A2 sign-up cap 30 with a cap test · A3 legal pages EN + HE · A4 every signed-in control works · A5 greeting shows the name · A6 AI actions answer · A7 live release by Amit (#327 + live Convex deploy). Status on Sunday: filled in by evidence (Weekend goals note).

## 3. Sunday daily planner (#546), order when releases resume

| Step | Issue | Ticket |
|---|---|---|
| 1 | [#526](https://github.com/Division6066/tempo-rhythm/issues/526) | Notes detail: bad link shows "not found" (PR #547) |
| 2 | [#527](https://github.com/Division6066/tempo-rhythm/issues/527) | Calendar: added event never shows up |
| 3 | [#528](https://github.com/Division6066/tempo-rhythm/issues/528) | Insights: skeleton never resolves |
| 4 | [#529](https://github.com/Division6066/tempo-rhythm/issues/529) | Schema: planner tables, additive only |
| 5 | [#530](https://github.com/Division6066/tempo-rhythm/issues/530) | Tasks soft delete, carry-over query, move to today |
| 6 | [#531](https://github.com/Division6066/tempo-rhythm/issues/531) | `convex/dayPlans.ts` |
| 7 | [#532](https://github.com/Division6066/tempo-rhythm/issues/532) | Habit check-ins by local day |
| 8 | [#533](https://github.com/Division6066/tempo-rhythm/issues/533) | Calendar events: end time, edit, soft delete |
| 9 | [#534](https://github.com/Division6066/tempo-rhythm/issues/534) | `convex/focusSessions.ts` |
| 10 | [#535](https://github.com/Division6066/tempo-rhythm/issues/535) | `convex/inbox.ts` (brain dump) |
| 11–13 | [#536](https://github.com/Division6066/tempo-rhythm/issues/536), [#537](https://github.com/Division6066/tempo-rhythm/issues/537), [#538](https://github.com/Division6066/tempo-rhythm/issues/538) | Today: plan panel; all tasks + energy; habit strip + carry-over |
| 14–16 | [#539](https://github.com/Division6066/tempo-rhythm/issues/539), [#540](https://github.com/Division6066/tempo-rhythm/issues/540), [#541](https://github.com/Division6066/tempo-rhythm/issues/541) | Tasks edit/delete; habits by local day; habit detail grid |
| 17–20 | [#542](https://github.com/Division6066/tempo-rhythm/issues/542), [#543](https://github.com/Division6066/tempo-rhythm/issues/543), [#544](https://github.com/Division6066/tempo-rhythm/issues/544), [#545](https://github.com/Division6066/tempo-rhythm/issues/545) | Plan day view; calendar times; tracking saved; brain dump |

Steps 1–3 and 4–5 can run in parallel. Steps that touch the schema (#529 on) wait for Amit's answers to #546 questions 1–5 where they apply. Each step that adds Convex functions is deployed to `ceaseless-dog-617` after merge.
Whether the Sunday-morning target still holds after the pause: UNKNOWN.

## 4. Next week (from Sun 4 Oct)

| Area | Items |
|---|---|
| Sign-up | Approval flow: unlimited sign-ups, each approved by Amit by email; earlier approvals kept. Turnstile on sign-up. |
| UX | **Taby UX work starts**: chat button at the bottom right of every signed-in screen; avatar in the header; animations (one ticket per component family). |
| Mobile | Phone app sign-in, OTP or magic link (#425). |
| Review | Cursor Bugbot as merge-blocking reviewer ("fail on unresolved issues"); Greptile removed. Research: CodeRabbit (Advanced) as the long-term reviewer. |
| Factory | Copilot dispatcher (gh-aw if it fits); `factory/models.yml` with the mid-tier code model, updated weekly by Amit; Codex lane on the ChatGPT subscription only; Cursor cloud-agent environments per repo after the move; Twin (twin.so) for configuration work under research. |
| Weekly | Amit pushes an updated ticket list; tickets are regenerated and the Graphify graph kept current. |

Amit's Bagrut maths studies start Sunday 11 Oct; the factory should be set up before then.

## 5. Product phases (20 Sep, updated)

| Phase | Goal | Exit check (short) | First tickets |
|---|---|---|---|
| **P-1** AI layer back, factory on | A coach turn answers from DeepInfra | `grep -r MISTRAL_API_KEY convex/` returns nothing; on preview, then live, a coach turn returns a schema-valid completion | #412 provider seam · `.env.example` tells the truth · stale PRs labelled for Amit |
| **P0** Conformance and soft delete | CI enforces the rules; soft delete is real | `bun install && bun run build` green from a clean clone; no `ctx.db.delete` left (or only what Amit allows for `forget`); a forbidden import fails CI; FD-01 passes on preview | soft delete in `tasks`, `habits`, `goals`, `memories`, `messages`, `conversations` · forbidden-tech list per TRD §10 · `auto-arm-merge.yml` can never target `master` |
| **P0-DOC** Block layer and json-render | Pages are markdown with JSON blocks | `bun run test` passes parse → validate → serialise for all six block types; a page with one broken block still saves and draws, no JSON visible; an emoji nag phrase is rejected | block parser + Zod schemas · `noteBlocks` / `noteLinks` with `notes.save` / `patchBlock` · json-render catalog, web registry, `toSpec` |
| **P0-FE** Front end on the note port | FD-01 runs with tasks as blocks | FD-01 passes on mock and on Convex dev; tokens match the UI brief | mock adapter · Today / brain dump / proposal on blocks · migrate rows into blocks |
| **P1** Expo shell | The click-path runs on an Android APK | `eas build -p android --profile preview` yields an APK; FD-01 passes on the phone; no diff in core/convex for the phase | Expo shell (newest stable SDK) · native block registry · EAS `preview` profile |
| **P2** Unified surface | Day / week / month from the same pages | inelastic event stays fixed while elastic tasks reflow; Lighthouse 90+ | `schedule.ts` reflow · day timeline · starting template set |
| **P3a** Coach, memory, pacing, nags | The coach answers at the dial, remembers, paces, nags in the user's words | memory contract test passes; recall works across sessions but never across users; crisis words return the fixed card with no model call | memory port · nag authoring + validator · nag cron (in-app) |
| **P3b** Connectors | A commitment verified from real data via Executor | partial credit shown, never "failed"; every external write asks first | Executor adapter (read-only) · partial-credit check · one confirmed calendar write |
| **P4** Voice | A Hebrew voice turn end to end | per PRD ticket #7 | Deepgram STT · Chatterbox TTS · `voiceTurn` |
| **P5** Study track | Lecture → notes → deck → test, separate mode | per PRD ticket #8 | `sm2.ts` · `lectureToDeck` · study screens |
| **P6** Billing visible, consent, polish | Per PRD ticket #9 | sign-up policy settled first; DeepInfra Service Order before any paid tier | RevenueCat webhook (`REVENUECAT_WEBHOOK_SECRET`) · billing screen with live prices · layered consent |
| **P7** V1 ship | Web PWA, Android APK, iOS TestFlight | FD-01 and every earlier exit check pass on all three | PWA manifest + service worker · TestFlight build · APK download page |
| **P8–P9** V1.5 | Store-grade native | approved on both stores | push, camera, store assets |

How the #546 planner work and the weekend goals fit these phases: they are V0 fixes on the current typed tables, ahead of P0-DOC (EXTRAPOLATED placement). Whether P0-DOC still comes before more typed-table work is Amit's call ([Backend schema](./BACKEND-SCHEMA.md) §5).

## 6. Parked

An outside memory engine (EverOS, Mega Memory; the port allows it later) · Jev ideas · the PRD's LATER list · closing the 46 stale PRs (Amit decides) · payments this weekend · store submissions this weekend.

## 7. Conflicts resolved by newer decisions

| Older source | Newer decision (wins) |
|---|---|
| 18 Sep: factory runs Sun–Thu, nothing Fri–Sat, one 18:00 merge window | 30 Sep: agents merge into `integration` when checks pass. 3 Oct: build runs 7 days; no config Fri–Sat. Weekend 2–4 Oct is a deliberate working exception. |
| 20 Sep roadmap: "Grok Build = front ends; Cursor = deployment" | 1–2 Oct lanes: Cursor / Claude Code / Codex; product code only from tickets; only Amit deploys live. |
| 20 Sep: "Agents merge to PREVIEW only … three loops a day" | 30 Sep: merge into `integration` → preview site. The loop limit: UNKNOWN. |
| 20 Sep: review gate not chosen; "factory on" waits for it | 1–2 Oct: Greptile. 3 Oct 15:25: Bugbot replaces Greptile, set up after the org move. Automations wait for PLAN-FINAL step 7 gates. |
| 20 Sep P-1: deploy in the 18:00 window | Live deploys are Amit's, no fixed window stated. |
| 1–2 Oct: router dispatches on the `ready` label | 3 Oct: router = GitHub-side automation using GitHub's own inference (Copilot plan); built but off until step 7. |
