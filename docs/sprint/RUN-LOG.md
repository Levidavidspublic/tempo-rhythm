# Weekend alpha run: log

Branch `run/weekend-alpha` (tracking PR #934, never merged). Started 2026-10-14 18:20 UTC by Claude Code (cloud session, unattended). Reviewer: Codex.

If this session restarts: read this file and continue from the first unchecked item under **Plan**.

**Now working on:** (2026-10-15 08:30 UTC)
- **Proven on preview `67bca63` (after #947):** L1, L2, L3 and L4 5/5 each; the sweep is clean (432/0 on `fdbe92e`).
- **L5 waits on #950.**
- **In Codex review after fixes:**
  - #945: voice backend, round 3;
  - #948: voice web, round 1;
  - #949: L4 script, round 1;
  - #950: Today chat, round 1;
  - #951: propose-now, round 1.

## Target 2 (from 2026-10-15, owner message)

**Usable BETA on preview by Sunday 18 October:** every loop below proven 5 times in a row, plus every signed-in screen clicked through with no page errors at 390 and 1280 px, light and dark, en and he. Run `node e2e/alpha/run.mjs --times 5` after each merge. Same merge gate, stop codes and final report.

Owner answers (2026-10-15):
1. Sign-in: the synthetic approved account through #892 (approval) and #897 (preview acceptance). No guest sign-in on preview.
2. CopilotKit: not added. Chat is built on the existing coach. HARD_RULES unchanged.
3. `DEEPINFRA_API_KEY` is set on the Convex deployment (owner checked by name).
4. Claude GitHub App: skipped for now.
5. Also asked: "merge all of the tickets and PRs", add the chat features, "the stuff from Deep Infra", and Deepgram voice mode and voice chat. Read as: merge #892, #897 and this run's PRs through the gate (not the "DO NOT MERGE" PRs, not PRs into `master`, not other tickets' PRs); build chat on the coach; build voice per the voice contract (#871): Deepgram STT, DeepInfra Chatterbox TTS.
6. Chat-first designs from Open Design will land in `docs/design/`; follow them for the chat screens, keep the v3 identity.

Found at 06:25 UTC: #892 and #897 were still **open**, not merged; neither workflow was on `integration`. With the owner's go-ahead:
- #892 had an open Codex P1: anyone with write access could dispatch it. I added an owner-only guard (actor and triggering actor = Division6066) to #892 and #897, merged `integration` into both and re-added the `config` label. #897 is marked ready. Codex review requested on both.
- A disposable `tempo-accept-…` mail.tm account is signed in on preview from this session. The session is in a private scratch file, never committed or printed. It waits for approval through #892.

### Plan (target 2)

- [x] Merge #892 (merged 07:00 UTC as `8345b4a`) and dispatch it: the synthetic account is **approved** (run 38695751179, 06:59 UTC, success). #897 merged (`101b060`), #941 merged (`780414c`), #943 merged (`dd96d4e`).
- [ ] Run L1-L4 5x; fix what fails. On preview `dd96d4e` (07:31-07:37): **L1 5/5, L2 5/5, L3 5/5 PASS**. On `481d1e6`: L1 5/5, L2 5/5, L3 2/5 (sandbox timeout), L4 fixed by #944 (card height) and #949 (script picked an old card): first pass 08:03. Rerunning ×5 on `fdbe92e`.
- [ ] Signed-in sweep: every app route at 390/1280, light/dark, en/he, no page errors; fix what fails. Script: #939, open, in Codex review. Seeded run: 432 renders of 54 routes with 4 failing, all on the project kanban at 390 px (page scrolls sideways, fix `v3/kanban-sr-only`).
- [ ] Chat on Today + decision card (L5) on the coach; follow the chat-first designs when they land. Backend #940 and editor #941 open; UI on `v3/today-chat`. No chat-first designs in `docs/design/` yet (checked 06:58 UTC).
- [ ] Voice mode (Deepgram STT, Chatterbox TTS) per `docs/contracts/VOICE.md` (#871).
- [ ] Prove: every loop 5x in a row after the last merge; sweep clean.

## Loops (EXTRAPOLATED)

`docs/sprint/SPRINT-BRIEF.md` does not exist on `integration` (checked 2026-10-14 18:20 UTC), so these are the run prompt's five fallback loops. A loop counts as done after 5 passes in a row on preview.tempoflow.dev, each with screenshots.

- [ ] L1 Sign in on preview with the preview-only guest/test sign-in → Today loads as the daily page. **BLOCKED_VERIFICATION**
- [ ] L2 On Today, add a task by typing → reload → the task is still there. **BLOCKED_VERIFICATION**
- [ ] L3 Create a page from a template → edit it with the slash menu → reload → the edit persisted. **BLOCKED_VERIFICATION**
- [ ] L4 Ask the coach to plan the afternoon → proposal card shows the exact change → Accept → the change appears → Undo within 5 minutes restores it. **BLOCKED_VERIFICATION**
- [ ] L5 Chat-first decision ("what order should I do these in?") → a decision card renders from the json-render catalog → saving it writes to today's page. **BLOCKED_VERIFICATION**, and the feature is not built (Phase 3).
- [ ] Every loop run also sends one crisis-style message and sees the fixed crisis card, with no model call. **BLOCKED_VERIFICATION** (needs a session on /coach).

## Plan

- [x] Phase 0: this log and the tracking PR (#934).
- [x] Phase 1: one headless-browser script per loop under `e2e/alpha/` (#935 **merged** 19:12 UTC, after two Codex rounds).
- [x] Phase 2: fix what breaks the loops, smallest first. Landing contrast fix #936 **merged** 18:53 UTC and checked on preview. No other known issue reproduces on the loop screens (details below).
- [ ] Phase 3: build what's missing. Decision steps through json-render: #938 **merged** 19:40 UTC. Backend and wiring: designed, not built (see "Phase 3" below).
- [ ] Phase 4: 5 passes in a row per loop on preview. Blocked on sign-in.

## Findings at start (WALK)

- Preview is up: `https://preview.tempoflow.dev/api/health` reports commit `51d9fef` (#933). `integration` head is `887355a` (#930, mobile only).
- **Sign-in on preview is magic link only** (`convex/auth.ts`: one Resend provider). There is no guest or test sign-in. The E2E auth bypass needs `NODE_ENV !== "production"` (`apps/web/proxy.ts`, `components/approval/ApprovalGate.tsx`), so it is off on preview.
- A new account starts `pending` and sees only "Waiting for approval" on every app route (`docs/ops/APPROVAL-GATE.md`). Only an admin (`/admin/approvals`) or the TEST deploy key can approve it.
- 1Password is not reachable from this session (its MCP server failed to start: executable not found). No AWAY step can run.
- This sandbox's Chromium opens a WebSocket to the TEST Convex deployment through the proxy (checked 18:24 UTC), so the loop scripts can run from here once a session exists.
- The Claude GitHub App isn't installed on the repo, so PR events don't wake this session; PRs are checked by hand and by a scheduled check-in.

## Phase 2: the known v3 issues

I ran the design checker's probes (overflow incl. `::before`/`::after`, forbidden words incl. "Sample data", control overlap incl. the tab bar, axe-core contrast and labels, same-origin links) against the app, at 390 and 1280 px, light and dark, en and he.

| Where | Routes | Result |
|---|---|---|
| preview, signed out | `/`, `/sign-in`, `/sign-up`, `/privacy`, `/terms`, `/contact` (48 renders) | **Contrast fails on `/` only**: 17 nodes per light variant (pre-v3 accent `#d97757`, 2.69:1), 4 per dark variant (cream on the dark accent, 1.96:1). No overflow, no forbidden words, no overlaps. One `/contact` load and one link probe timed out on the sandbox network. |
| local dev, E2E bypass, mock Convex | `/today`, `/coach`, `/templates`, `/notes`, `/tasks`, `/brain-dump`, `/journal`, `/search`, `/sign-in`, `/` (80 renders) | Same `/` contrast failure. No overflow, no "Sample data" or other forbidden words, no broken links. The only overlaps are the Next.js dev overlay (mock Convex URL error), not app UI. |

- RTL `::before` overflow, "Sample data", the input under the tab bar and broken links: **not reproduced** on these routes. The app CSS uses logical offsets (`inset-inline-*`) and mirrors its transforms in RTL. These look like findings of the design-file check (`docs/design/v3/*.html`), not of the app. With mock Convex the signed-in states (Today's page, the coach thread, quick add) don't render, so those states are UNKNOWN.
- Fixed: the `/` contrast failure (#936). After: 0 contrast findings in all 8 variants.

## Phase 3

- **CopilotKit layer: BLOCKED_USER_CHANGES.** `@copilotkit/runtime` 1.79.0 (npm, checked 18:47 UTC) depends on `openai`, `@ai-sdk/openai`, `@ai-sdk/anthropic` and `@ai-sdk/google`. HARD_RULES §2 forbids those SDKs and §6.1 routes every model call through `convex/lib/ai_router.ts`. Its React side needs that runtime (or the paid Copilot Cloud). Only Amit can decide this.
- **Decision card, piece 1 (#938, merged).** `@tempo/ui/blocks/decision-steps` draws an ordered decision as catalog `TaskBlock`s through json-render (the existing `tempoBlockToSpec` bridge, display only, a narrow read-only registry). Render-tested, not mounted. The shared registry stays with ticket TEMPO-B06-03 (#789, on hold); its files are untouched.
- **Decision card, pieces 2-3 (designed, not built):**
  - Backend: a `decision` proposal kind in `convex/lib/coachPrompt.ts` and `convex/coach.ts` (2-7 steps), with today's open tasks added to the coach's context so "these" means something.
  - Wiring: the card in the coach thread (`ChatProposal`), "Save to today" through Accept with the 5-minute Undo, and the coach composer on Today.
  - **Why not built tonight:** the page editor loads a page's body once per page and then saves its own copy (`NotePage` in `components/notes/NotesScreen.tsx`). A server-side write to today's page while Today is open would be erased by the next keystroke. A safe save must go through the open editor, or the editor must take outside changes when it isn't dirty. Either way it touches the editor, and only a signed-in run can prove it doesn't lose page text.
- **Chat as the front door on Today:** not started (same verification gap).

## Results

| time (UTC) | PR | loop | result | evidence link |
|---|---|---|---|---|
| 18:28 | #935 (scripts) | L1-L5 | BLOCKED_VERIFICATION, 0/1 each: "no guest or test sign-in on /sign-in (magic link only), and ALPHA_STORAGE_STATE is not set" | [sign-in screenshot](evidence/l1-blocked-sign-in.png) |
| 18:52 | #936 | (Phase 2, no loop) | `/` contrast: 17/4 axe nodes per variant before, 0 after, 8 variants | [before dark](evidence/landing-before-1280-dark.png), [after dark](evidence/landing-after-1280-dark.png), [before light](evidence/landing-before-1280-light.png), [after light](evidence/landing-after-1280-light.png) |

| 18:53 | #936 merged | — | squash into `integration` (`8d5b55d`): green required CI, Codex review of `4a42716` with no findings, CodeRabbit "no actionable comments" | [#936](https://github.com/Levidavidspublic/tempo-rhythm/pull/936) |
| 18:58 | after #936 on preview `8d5b55d` | `/` check | 0 contrast findings in 8 variants on live preview | — |
| 18:58 | after #936 on preview `8d5b55d` | L1-L5 | BLOCKED_VERIFICATION, 0/1 each (same reason) | — |
| 18:50, 18:57 | #935 | — | Codex P1 (Today shows 3 open tasks; repeats would fail) fixed in `6c59ea6`. CodeRabbit (L5 seeded titles; bypass header scope) fixed in `6c59ea6`. Codex P2 / CodeRabbit (`run.mjs` dropped the first loop name) fixed in `1a35042` | [#935](https://github.com/Levidavidspublic/tempo-rhythm/pull/935) |
| 18:58 | #938 | L5 (piece 1) | opened: decision steps, 2164 tests pass, build 62/62 | [#938](https://github.com/Levidavidspublic/tempo-rhythm/pull/938) |

| 19:12 | #935 merged | — | squash into `integration` (`36bf34d`): green required CI, Codex "no major issues" on `1a35042`, CodeRabbit no actionable comments | [#935](https://github.com/Levidavidspublic/tempo-rhythm/pull/935) |
| 19:09 | #938 | — | Codex P2 (each row was its own `<li>`, so `:last-child` dropped every divider) fixed in `fb8823d`; computed borders `1px, 1px, 0` with `tempo.css` in Chromium | [light](evidence/decision-steps-light.png), [dark](evidence/decision-steps-dark.png) |
| 19:22 | #938 | — | Codex "no major issues" on `fb8823d`; required CI green; auto-merge on at 19:39 | [#938](https://github.com/Levidavidspublic/tempo-rhythm/pull/938) |
| 20:31 | after #938 (preview `4d7be6a`) | L1-L5 | L1-L4 BLOCKED_VERIFICATION. L5 first FAILED on a 30 s timeout loading `/sign-in` (sandbox network: two checker loads timed out at the same minute, and `/contact` and `/terms` link probes dropped). The three `curl` checks right after returned 200 in under 0.6 s. L5 re-run: BLOCKED_VERIFICATION. `/` and `/sign-in` at 1280, light/dark, en/he: 0 findings on the re-run; the one remaining "broken link" (`/terms`, socket disconnected) returns 200 to `curl` | — |
| 19:40 | #938 merged | — | squash into `integration` by auto-merge: green required CI, Codex "no major issues" on `fb8823d` | [#938](https://github.com/Levidavidspublic/tempo-rhythm/pull/938) |
| 19:39 | after #935 (`integration` `36bf34d`, preview still `8d5b55d`: #935 has no app change) | L1-L5 | BLOCKED_VERIFICATION, 0/1 each: no guest or test sign-in on preview | — |
| 06:31 | #892, #897 | — | Codex P1 on #892 (any write-access user could dispatch) fixed in `4637632`; the same owner-only guard on #897 (`c03ecfb`) | [#892](https://github.com/Levidavidspublic/tempo-rhythm/pull/892), [#897](https://github.com/Levidavidspublic/tempo-rhythm/pull/897) |
| 06:36-06:56 | #897 | — | Codex P2s: wait for the dispatched commit on preview (`6f5490e`); bound that wait by wall clock (`8e74a0d`, simulated: fails closed before the deadline). CodeRabbit: mail.tm request deadline and GET-only retry (`926ba16`) | [#897](https://github.com/Levidavidspublic/tempo-rhythm/pull/897) |
| 06:44 | #892 | — | Codex P2 (a 3rd dispatch cancelled a queued 2nd one): one concurrency group per email (`a8e1988`) | [#892](https://github.com/Levidavidspublic/tempo-rhythm/pull/892) |
| 06:40 | #939 | sweep | opened: signed-in sweep script, all 7 checks pass locally | [#939](https://github.com/Levidavidspublic/tempo-rhythm/pull/939) |
| 06:54 | #939 | sweep | Codex P2s fixed in `08ea78b`: project Kanban swept; a pending session is BLOCKED_VERIFICATION (reproduced on preview: `/settings/passkeys` renders, `/today` waits, now exit 2); an unreadable state file is BLOCKED_VERIFICATION | [#939](https://github.com/Levidavidspublic/tempo-rhythm/pull/939) |
| 06:46 | #940 | L5 | opened: coach `decision` proposals from today's open tasks; Save writes task blocks to today's page; Undo takes them off. 2178 tests, all 7 checks pass | [#940](https://github.com/Levidavidspublic/tempo-rhythm/pull/940) |
| 07:00 | #941 | L5 | opened: an open page takes in a server-side change when it has no unsaved edits (so Save to today isn't overwritten by the next autosave). 2173 tests, all 7 checks pass | [#941](https://github.com/Levidavidspublic/tempo-rhythm/pull/941) |
| 07:00 | #892 merged | — | merge queue, `8345b4a`: green CI, Codex P1 (owner-only) fixed, P2 (queued request dropped) fixed; last P2 (other actor shares the group) answered and fixed in #942 | [#892](https://github.com/Levidavidspublic/tempo-rhythm/pull/892) |
| 06:59 | dispatch `convex-test-admin.yml` | L1-L5 | the synthetic `tempo-accept-…` account set to **approved** on TEST (job success, 20 s) | run 38695751179 |
| 07:00 | harness | L1-L5 | the 2nd L1 run hit the sign-in form: Convex Auth rotates the refresh token on every load, and each run replayed the saved one. Fix (on #939's branch): each run writes the refreshed session back (`saveState`, 0600); the sweep shares one context. Re-signed in by magic link. | — |
| 07:01-07:05 | after #892 (preview `4d7be6a`) | L1 | **4/5**, then FAIL: `page.goto` timeout 30 s (sandbox network; navigation timeout raised to 60 s on #939's branch) | screenshots in the run's scratch dir |
| 07:02-07:04 | after #892 (preview `4d7be6a`) | L2 | **5/5 PASS** in a row, each with the crisis check (fixed card, no `coach:reply` frame) | screenshots in the run's scratch dir |
| 07:03 | after #892 | L3 | FAIL: "This template was not found". Starter ids reach `templates.get` percent-encoded (`starter%3Adaily-page`; TEST returns the starter for `starter:daily-page`, null for the encoded one) → **#943** | [#943](https://github.com/Levidavidspublic/tempo-rhythm/pull/943) |
| 07:04, 07:10 | after #892 | L4 | the real coach answered (DeepInfra works on TEST). Run 1: a reply without a proposal. Run 2: the task card rendered **2 px tall** (grid row squeezed: `overflow: hidden` in a full thread), so Accept could not be clicked → **#944** (injected on preview: 2 → 196 px, Accept clickable) | [#944](https://github.com/Levidavidspublic/tempo-rhythm/pull/944) |
| 07:15 | #940 | L5 | Codex P2s fixed in `2bb7793`: Save only to today's page; closed tasks never crowd the context | [#940](https://github.com/Levidavidspublic/tempo-rhythm/pull/940) |
| 07:15 | #939 | sweep | Codex P1 (a protected-preview 401/403 would pass) + 3 P2s (module preview route, `dir` per language, worker count) fixed locally with the session fixes; pushed after the first full sweep | [#939](https://github.com/Levidavidspublic/tempo-rhythm/pull/939) |
| 07:19 | after #892 (preview `4d7be6a`) | sweep | first full sweep **PASS**: 384 renders of 48 routes, 0 failing. Six detail routes were not reached (no data yet) | — |
| 07:27 | #941, #943 merged | — | merge queue (`780414c`, `dd96d4e`): green CI, clean Codex review of the latest commit. Preview on `dd96d4e` at 07:27 | [#941](https://github.com/Levidavidspublic/tempo-rhythm/pull/941), [#943](https://github.com/Levidavidspublic/tempo-rhythm/pull/943) |
| 07:31-07:32 | after #943 (preview `dd96d4e`) | L1 | **5/5 PASS** in a row, each with the crisis check | screenshots in the run's scratch dir |
| 07:33-07:34 | after #943 (preview `dd96d4e`) | L3 | **5/5 PASS** in a row (was 0/1: starter template "not found"), each with the crisis check | screenshots in the run's scratch dir |
| 07:32, 07:36-07:37 | after #943 (preview `dd96d4e`) | L2 | 1st batch: 1/5 then `net::ERR_TIMED_OUT` loading `/today` (sandbox network). Re-run: **5/5 PASS** in a row | screenshots in the run's scratch dir |
| 07:34 | after #943 (preview `dd96d4e`) | L4 | FAIL 0/1: the coach answered, and the proposal card collapsed to a line (the #944 bug, not merged yet) | screenshots in the run's scratch dir |
| 07:25-07:31 | after #943 | sweep | seeded data (goal, project, habit, routine, template): **432 renders of 54 routes, 4 failing**. All four are `/projects/<id>/kanban` at 390 px (light/dark, en/he), where the page scrolls sideways ~600 px. No page errors, no "not found" screens, `dir` right in all 216 Hebrew renders | — |
| 07:40 | kanban | sweep | cause measured on preview: each column count's hidden "cards" label (`.tp-sr-only`, `position: absolute`) has no positioned ancestor, so it sits against the page, outside the board's scroll, at x=994. Reproduced from the app CSS (604 px LTR, 597 px RTL), and `position: relative` on `.tp-kanban` gives 0 in both. Branch `v3/kanban-sr-only` | — |
| 07:30-07:40 | #940, #942, #944, #939 | — | Codex P2s fixed: #940 Undo removes only the heading right above its blocks (`9066db6`, two new tests that fail on the old code); #942 non-owner runs get their own concurrency group (`f34b285`); #944 canonical stylesheet synced (`40e726a`); #939 P1 (unreached routes passed) + 2 P2s (theme check, unsaved session) fixed (`e857c7f`). Codex review requested on each | [#940](https://github.com/Levidavidspublic/tempo-rhythm/pull/940), [#942](https://github.com/Levidavidspublic/tempo-rhythm/pull/942), [#944](https://github.com/Levidavidspublic/tempo-rhythm/pull/944), [#939](https://github.com/Levidavidspublic/tempo-rhythm/pull/939) |
| 07:45 | #945 | voice | Codex round 1 fixed in `a031224`. P1: the daily cap is now the tier's HARD_RULES §9 number held under the 15-minute preview cap; no or an unknown tier gets none. P1: the flaky exhaustion test no longer sits on the 15-minute boundary (10/10). P2: the global ceiling fails closed past 5,000 rows a day, with 40 sessions per person per day. P2: availability returns `resting` when the global minutes are spent. 2199 tests, all 7 checks pass | [#945](https://github.com/Levidavidspublic/tempo-rhythm/pull/945) |
| 07:48 | #946 | sweep | opened: `.tp-kanban { position: relative }` (and the same in the canonical v3 stylesheet). All 7 checks pass | [#946](https://github.com/Levidavidspublic/tempo-rhythm/pull/946) |
| 07:50 | Hebrew renders | sweep | Seen in the 390 px screenshots, not caught by any check. (1) Screen bodies are hard-coded English under a Hebrew shell (e.g. `TodayGreeting.tsx`, Calendar's intro): a translation job, logged under Needs Amit. (2) English page lines on a Hebrew page drew right to left with the full stop on the left: probed on preview, `.cm-line` had no `dir` (the editor's `perLineTextDirection` only reads direction) → #947 | — |
| 07:50 | #947 | L2, L3, sweep | opened: every editor line gets `dir="auto"` (line decoration), 3 new tests; all 7 checks pass | [#947](https://github.com/Levidavidspublic/tempo-rhythm/pull/947) |
| 07:51-07:52 | #944, #942, #939, #940 | — | Codex completed on each latest commit with no findings (#942 `f34b285` 07:42, #944 `40e726a` 07:46, #939 `e857c7f` and #940 `9066db6` 07:47); required CI green; marked ready, auto-merge on (merge queue) | [#939](https://github.com/Levidavidspublic/tempo-rhythm/pull/939), [#940](https://github.com/Levidavidspublic/tempo-rhythm/pull/940), [#942](https://github.com/Levidavidspublic/tempo-rhythm/pull/942), [#944](https://github.com/Levidavidspublic/tempo-rhythm/pull/944) |
| 07:55-07:57 | #944, #942, #940, #939, #946 merged | — | merge queue: `6211739` (#944), `3994c7c` (#942), `aa57845` (#940), `481d1e6` (#939), `fdbe92e` (#946). Codex on #946 `733052f`: "Didn't find any major issues" | [#946](https://github.com/Levidavidspublic/tempo-rhythm/pull/946) |
| 07:57-08:01 | after #939 (preview `481d1e6`) | L1-L4 | **L1 5/5, L2 5/5**. L3 2/5, then `net::ERR_TIMED_OUT` loading `/templates` (sandbox network). L4 0/1: Accept went to an **old pending card** from an earlier run, and Undo to yet another card. The script counted cards before the shared coach thread had loaded → **#949** | screenshots in the run's scratch dir |
| 08:03 | #949 (script) on `481d1e6` | L4 | **first L4 PASS**: proposal "10-minute reset of the nearest surface", Accept (Inbox 18 → 19), Undo (19 → 18, "Undone. Nothing changed."), crisis card with no `coach:reply` | [#949](https://github.com/Levidavidspublic/tempo-rhythm/pull/949) |
| 08:05 | #945 | voice | Codex round 2: P2 availability ignored the 40-sessions limit → fixed `34b2f4d` (test fails on the old code). P2 midnight split: answered, not changed. VOICE.md A-6 charges a session to its start day; the spill-over is bounded by the 15-minute session | [#945](https://github.com/Levidavidspublic/tempo-rhythm/pull/945) |
| 08:00 | #948 | voice | opened, stacked on #945: Talk button, call runtime (Deepgram socket, read-aloud, barge-in, renew/idle/hidden bounds, teardown order). Mic off now mutes the track, so Deepgram doesn't close the socket. All 7 checks pass (2204 tests) | [#948](https://github.com/Levidavidspublic/tempo-rhythm/pull/948) |
| 08:08 | #950 | L5 | opened on `481d1e6`: Today chat, decision card (Save to today, Undo), 2 render tests, L5 acts on its own turn. All 7 checks pass | [#950](https://github.com/Levidavidspublic/tempo-rhythm/pull/950) |
| 08:09 | #951 | L4 | opened: one prompt line, so asked to plan or suggest, the coach proposes instead of asking first (2 of 4 L4 replies today asked a question with no card) | [#951](https://github.com/Levidavidspublic/tempo-rhythm/pull/951) |
| 08:06-08:17 | after #946 (preview `fdbe92e`) | sweep, L1-L4 | **sweep PASS: 432 renders of 54 routes, 0 failing** (kanban fixed). **L1 5/5, L2 5/5, L3 5/5**, and **L4 5/5** with #949's script | screenshots in the run's scratch dir |
| 08:15 | #947 merged | — | `67bca63`. On preview the English template line now has `dir="auto"` and computes `ltr` on a Hebrew page | [#947](https://github.com/Levidavidspublic/tempo-rhythm/pull/947) |
| 08:18-08:25 | after #947 (preview `67bca63`) | L1-L4 | **L1 5/5, L2 5/5, L3 5/5, L4 5/5** (L4 with #949's script) | screenshots in the run's scratch dir |
| 08:12-08:30 | review rounds | — | #949: a note counted twice (sidebar) → count on the list only (`f470133`, L4 1/1 on preview). #950: Open goes to the saved page (`c626b89`); edits during an in-flight Save answered, not built (sub-second window after the person clicks away; a page lock is a contained follow-up). #951: propose only with enough to go on, otherwise one short question; "schedule" removed (`06e95e5`). #948: 3 P1 + 1 P2 fixed (`54ce705`): one spoken turn at a time, no wait without a written reply, replies matched by id not clock, a late lease stopped. The chat test also lacked a voice mock (`241f6ac`). #945 round 3 (`acf5d7c`): paid accounts only, stale leases charged to their last renewal, `ConvexError` refusals | [#948](https://github.com/Levidavidspublic/tempo-rhythm/pull/948), [#949](https://github.com/Levidavidspublic/tempo-rhythm/pull/949), [#950](https://github.com/Levidavidspublic/tempo-rhythm/pull/950), [#951](https://github.com/Levidavidspublic/tempo-rhythm/pull/951), [#945](https://github.com/Levidavidspublic/tempo-rhythm/pull/945) |
| 07:22 | #945 | voice | opened: voice-mode backend (Deepgram token grant, Chatterbox sentences, leases, per-user and global caps). Off until `DEEPGRAM_API_KEY` is set. CI green; Codex review running | [#945](https://github.com/Levidavidspublic/tempo-rhythm/pull/945) |

## Blocked

| loop | stop code | why | who can unblock |
|---|---|---|---|
| (none open) | — | Sign-in unblocked 07:00 (synthetic approved account, #892/#897). CopilotKit: owner said don't add it; chat is built on the coach | — |

## Needs Amit (AT), in order

1. **Voice keys and caps (AT):** set provider-side spend limits on Deepgram and DeepInfra first. Then, if you want voice on preview, set `DEEPGRAM_API_KEY` on the TEST Convex deployment. Until then voice stays off (the Talk button doesn't show).
2. **Voice preview cap:** live minutes are the tier's HARD_RULES §9 number (Basic 30, Pro 90, Max 180) held under a 15-minute preview cap (VOICE.md A-7's recommended default). Every approved account is `max`, so testers get 15 a day. Raise or keep it (one line in `convex/lib/voicePolicy.ts`).
3. **Hebrew copy:** most screen bodies are hard-coded English, so a Hebrew session shows English text under a Hebrew shell. Translating them is a larger job that needs native review. Say if you want it in this run.
4. **Decision Save vs. typing (minor):** if someone clicks Save to today on a decision card, then clicks back into today's page and types within the sub-second save round trip, their next autosave can drop the decision's steps (#950 thread). A page lock during coach writes would close it. Say if you want it.
5. **Voice midnight rule:** a voice session that runs past midnight counts against the day it started (VOICE.md A-6), so up to 15 minutes can spill over. Keep it, or split sessions at midnight?
6. Optional: install the Claude GitHub App on the repo so PR events wake the session (you said skip for now).

## Not mine

- #937 "chore: CodeRabbit advisory config" was opened at 18:47 UTC by the Division6066 account from another session or by hand. Left alone.

## UNKNOWN

- Voice: the contract (#871) is still a proposal with owner decisions open (region, retention, caps, a provider-side spend limit). Whether `DEEPGRAM_API_KEY` is set on TEST is UNKNOWN; voice is built to stay off without it.

- Whether `DEEPGRAM_API_KEY` is set on TEST (voice stays off without it).
- DeepInfra Chatterbox's exact response shape: the backend accepts both `audio/*` and JSON base64.
