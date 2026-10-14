# Weekend alpha run: log

Branch `run/weekend-alpha` (tracking PR, never merged). Started 2026-10-14 18:20 UTC by Claude Code (cloud session, unattended). Reviewer: Codex.

If this session restarts: read this file and continue from the first unchecked item under **Plan**.

**Now working on:** Phase 0, setting up this log and the tracking PR.

## Loops (EXTRAPOLATED)

`docs/sprint/SPRINT-BRIEF.md` does not exist on `integration` (checked 2026-10-14 18:20 UTC), so these are the run prompt's five fallback loops. A loop counts as done after 5 passes in a row on preview.tempoflow.dev, each with screenshots.

- [ ] L1 Sign in on preview with the preview-only guest/test sign-in → Today loads as the daily page.
- [ ] L2 On Today, add a task by typing → reload → the task is still there.
- [ ] L3 Create a page from a template → edit it with the slash menu → reload → the edit persisted.
- [ ] L4 Ask the coach to plan the afternoon → proposal card shows the exact change → Accept → the change appears → Undo within 5 minutes restores it.
- [ ] L5 Chat-first decision ("what order should I do these in?") → a decision card renders from the json-render catalog → saving it writes to today's page.
- [ ] Every loop run also sends one crisis-style message and sees the fixed crisis card, with no model call.

## Plan

- [ ] Phase 0: this log and the tracking PR.
- [ ] Phase 1: one headless-browser script per loop under `e2e/alpha/` (own PR).
- [ ] Phase 2: fix what breaks the loops, smallest first.
- [ ] Phase 3: build what's missing (chat on Today, decision card from the json-render catalog).
- [ ] Phase 4: 5 passes in a row per loop on preview.

## Findings at start (WALK)

- Preview is up: `https://preview.tempoflow.dev/api/health` reports commit `51d9fef` (#933). `integration` head is `887355a` (#930, mobile only).
- **Sign-in on preview is magic link only** (`convex/auth.ts`: one Resend provider). There is no guest or test sign-in. The E2E auth bypass needs `NODE_ENV !== "production"` (`apps/web/proxy.ts`, `components/approval/ApprovalGate.tsx`), so it is off on preview.
- A new account starts `pending` and sees only "Waiting for approval" on every app route (`docs/ops/APPROVAL-GATE.md`). Only an admin (`/admin/approvals`) or the TEST deploy key can approve it.
- 1Password is not reachable from this session (its MCP server failed to start: executable not found). No AWAY step can run.

## Results

| time (UTC) | PR | loop | result | evidence link |
|---|---|---|---|---|

## Blocked

| loop | stop code | why | who can unblock |
|---|---|---|---|

## Needs Amit (AT), in order

(filled in as the run goes)

## UNKNOWN

(filled in as the run goes)
