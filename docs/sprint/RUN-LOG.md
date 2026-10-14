# Weekend alpha run: log

Branch `run/weekend-alpha` (tracking PR #934, never merged). Started 2026-10-14 18:20 UTC by Claude Code (cloud session, unattended). Reviewer: Codex.

If this session restarts: read this file and continue from the first unchecked item under **Plan**.

**Now working on:** stopped (20:30 UTC). #935, #936 and #938 are merged. Every loop is blocked on a preview sign-in only Amit can provide (see Needs Amit). The final report is on #934.

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
| 19:40 | #938 merged | — | squash into `integration` by auto-merge: green required CI, Codex "no major issues" on `fb8823d` | [#938](https://github.com/Levidavidspublic/tempo-rhythm/pull/938) |
| 19:39 | after #935 (`integration` `36bf34d`, preview still `8d5b55d`: #935 has no app change) | L1-L5 | BLOCKED_VERIFICATION, 0/1 each: no guest or test sign-in on preview | — |

## Blocked

| loop | stop code | why | who can unblock |
|---|---|---|---|
| L1-L5, crisis | BLOCKED_VERIFICATION | No guest or test sign-in on preview; a new account would also wait for approval | Amit (AT) |
| L5 / Phase 3 CopilotKit | BLOCKED_USER_CHANGES | CopilotKit's runtime brings forbidden AI SDKs (HARD_RULES §2, §6.1) | Amit (AT) |

## Needs Amit (AT), in order

1. **Pick a preview sign-in for the loops.** Either (a) review and merge #892 and #897 (TEST-only approval dispatch and the synthetic mail.tm acceptance run; they touch `.github/workflows`, so they need your `config` label), or (b) approve a synthetic test account by hand and give its Playwright storage state to the run as `ALPHA_STORAGE_STATE` (a 1Password item name), or (c) decide on a preview-only guest sign-in (a Convex Auth change plus an approval rule for guests; it opens AI spend on TEST to anyone who finds preview, so it's your call).
2. **CopilotKit:** allow its runtime's SDK dependencies, or drop CopilotKit and build the chat layer on the existing coach (`convex/coach.ts` + `callLLM`).
3. `DEEPINFRA_API_KEY` on the TEST Convex deployment: still UNKNOWN (L4 and L5 need the model).
4. Optional: install the Claude GitHub App on the repo so PR events wake the session.

## Not mine

- #937 "chore: CodeRabbit advisory config" was opened at 18:47 UTC by the Division6066 account from another session or by hand. Left alone.

## UNKNOWN

- Signed-in behaviour of every loop on preview (no session).
- The loop scripts' selectors past sign-in (taken from source, never run signed in).
- Whether `DEEPINFRA_API_KEY` is set on TEST.
- Whether the known v3 issues exist in signed-in states (they don't render with mock Convex).
