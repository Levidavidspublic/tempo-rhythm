# Codex handoff: Tempo alpha run (11 Oct 2026)

Written by the Claude Code cloud run that was paused at 13:50 UTC so it would stop using cloud session credits. Resume checkpoint on GitHub: issue #444, comment 6109545806.

## For Amit: how to use this

**Verdict:** Codex can carry on the coding in the cloud on your ChatGPT plan. It can't merge, label or run workflows. Those few clicks are yours (see "Your clicks").

1. Open Codex cloud on repo `Levidavidspublic/tempo-rhythm`.
2. Do the tasks in "Task queue" in order, one Codex task each.
3. For each task, pick the **Start branch** shown and paste the **Prompt** shown.
4. T1 is different: you just comment on the PR.
5. When Codex opens a PR, do the matching step in "Your clicks".

If the Codex UI has no branch picker, start the task on `integration` and add this first line to the prompt: `First run: git fetch origin <start branch> && git checkout <start branch>`. That needs agent internet access turned on for the environment.

## The goal (unchanged)

Make Tempo a usable alpha on preview.tempoflow.dev. Preview runs the latest `integration` commit against TEST Convex (`ceaseless-dog-617`). A clean synthetic test account must be able to:

- edit Today as Markdown and keep it after a reload;
- add and tick tasks with no duplicates;
- use notes, tags, search, and pin, archive, trash and restore;
- get real model replies from the coach;
- accept a coach proposal that creates exactly one Today task, then Undo it within 5 minutes, even after a reload;
- import a ChatGPT or Claude history, review it, and save only the selected items to memory;
- talk to the coach by voice and hear a reply, with a text fallback;
- never see raw JSON or internal IDs.

## Where things stand (11 Oct, 13:50 UTC)

- **Integration head:** `e150542`. The Vercel integration preview is READY on it.
- **TEST Convex:** deploys by itself (`convex-deploy-test.yml`) when a merge to `integration` touches `convex/`.
- **Merged today:** #869, #870, #872, #875, #876, #877, #834, #879, #880, #881, #882, #886, #889, #885.

### Open PRs

| PR | What | Head | Next step | Who |
|---|---|---|---|---|
| #895 | #809 chat compatibility (soft-delete chat removal; old writes refuse Agent threads) | `39de971` | Codex review, then auto-merge | you |
| #760 | #743 chat backend (`chat.send`, retry identity, crisis turn) | `d54d2a3` | Codex review, then auto-merge **after #895** | you |
| #887 | #883 page cleanup cron | `eb66a85` | Codex review, then auto-merge | you |
| #891 | #831 page ledger helper (`convex/lib/pageLedger.ts`) | `4315f3a` | Codex review, then auto-merge | you |
| #893 | #841 note kinds, archive, preview fields, task link index | `94b1c8f` | Codex review, then auto-merge | you |
| #896 | #894 UI deps (react-dom dev dep, `@tempo/ui/blocks/*` exports) | `dfb2233` | Codex review, then auto-merge | you |
| #892 | config: TEST approval dispatch (`convex-test-admin.yml`) | `b38e2ed` | Codex review, then auto-merge | you |
| #897 | config: preview acceptance run (`preview-acceptance.yml`) | `2cc72c8` (draft) | Label `config`, mark ready, Codex review, merge | you |
| #878 | #837 notes contract (doc) | `502ddb3` | Re-add `config` label after CI, then Codex review | you |
| #874 | #840 editor-modes contract (doc) | `0f3438f` | Re-add `config` label after CI, then Codex review | you |
| #884 | #803 safe page projection | `e32f4a3` | 4 open Codex threads: task T1 | Codex |

### Merge order that matters

- #895 before #760.
- #891 and #887 before the #787 PR (T4).
- #760 before the #744 PR (T2).
- #896 before #789.
- #893 before #842.

## Rules for Codex (every task)

1. **Repo rules:** follow `AGENTS.md`. It's on every branch. Also read `factory/SLOTS.md` and `docs/HARD_RULES.md`.
2. **One PR per ticket:** one ticket = one branch = one **draft** PR into `integration`. The PR body must start with `Closes #<issue>`, because scope-guard finds the ticket from that line. Name the branch `t/<issue>-<slug>` if you can.
3. **Scope:** touch only the ticket's SCOPE files. Never edit `.github/**`, `scripts/factory/**`, `AGENTS.md`, `docs/tickets/**`, `docs/contracts/**`, lockfiles or package.json scripts, unless the ticket's scope names them.
4. **Never:**
   - deploy, touch `master` or the live branch, or run "Release to production";
   - run `convex dev`, `convex deploy` or any `convex:*` script;
   - touch live Convex `precious-wildcat-890`;
   - set `PLAYWRIGHT_BASE_URL`, or test against a preview or live URL;
   - print a secret, add a credential or call a paid service;
   - use real personal data;
   - re-enable a disabled scheduled workflow.
5. **Checks:** use Bun 1.3.9 and run the AGENTS.md "Testing (cloud agents)" list in order: frozen install, lint, typecheck, test, scans + notices, Playwright, build.
   - If you touched `convex/`, also run `bunx tsc --noEmit -p convex/tsconfig.json`. The errors already present are known: `convex/lib/ai_router.test.ts`, plus `Object.hasOwn` in `packages/utils/src/historyImport.ts`, which shows up only if a convex file imports it. Don't import it.
   - A step blocked by the network (Google Fonts, Playwright CDN) is `UNKNOWN`, not a failure.
6. **User-facing output:** users never see raw JSON, internal ids, stack traces or error codes.
7. **Report:** in the PR body, add "Test results (cloud agent sandbox)" with the Bun version and pass/fail/skip counts for every command, plus `UNKNOWN: <what>` for anything you could not check.

### Codex environment setup (only if not already set up)

Setup script:

```bash
curl -fsSL https://bun.sh/install | bash -s bun-v1.3.9
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
```

Each agent shell may need `export PATH="$HOME/.bun/bin:$PATH"` again.

## Task queue

### T1: #884 safe page projection, review round 2 (no Codex task needed)

**Do this:** comment on PR #884 exactly: `@codex address that feedback`

Codex's own review footer says it can update the PR this way. It should then fix the 4 open review threads on the PR branch `t/803-safe-page-summary`. If it opens a separate PR instead, close that one and ask it to push to the PR branch. All four threads are in `packages/utils/src/page-summary.ts`:

1. **P1, line ~162:** match each raw-HTML opener to its own closer. A `<pre>` block ends only at `</pre>`, not at a stray `</script>`.
2. **P1, line ~370:** detect raw-HTML openers after stripping blockquote or list prefixes (`> <pre>`).
3. **P2, line ~510:** keep the query match inside short snippets. Size the leading context from the budget.
4. **P2, line ~70:** never cut between the two regional indicators of a flag emoji.

A partial, unreviewed attempt sits on `wip/884-projection-r2` (`b401616`). It's a reference only.

### T2: #744 coach screen on the real model (`chat.send`)

**Start branch:** `wip/744-coach-chat-send` (`03516f8`). It's stacked on #760's branch `t/743-codex`.

**Prompt:**

```text
Finish ticket #744 [TEMPO-N2-02] "/coach chat uses chat.send: real AI replies with a Thinking state and calm Retry" in Levidavidspublic/tempo-rhythm. Follow AGENTS.md.

You are on branch wip/744-coach-chat-send. It is stacked on PR #760 (branch t/743-codex, the chat.send backend, not merged yet). The last commit (03516f8) is an UNFINISHED, unreviewed rewrite of apps/web/components/coach/CoachChat.tsx and CoachChat.test.tsx. Review it before keeping any of it (`git show HEAD`).

SCOPE: apps/web/components/coach/ only (CoachChat.tsx, CoachChat.test.tsx). Do not edit convex/ or apps/web/app/(tempo)/coach/page.tsx.

Read convex/chat.ts on this branch for the REAL contract:
- whether send is an action or a mutation;
- its args, including the retry identity (retryOf / requestId);
- how a failed turn is recorded;
- the pending and replay windows;
- the crisis turn and its return shape;
- how messages are listed.
The ticket text that says `{conversationId, content} -> {reply, crisis?}` is older than this code.

Build on /coach:
- Every message goes through chat.send.
- While waiting: a small "Thinking…" assistant bubble with aria-live="polite". The input stays enabled; Send is disabled.
- On failure: a calm inline error with a Retry button. Retry reuses the backend's retry identity, so it never duplicates the user message.
- Crisis: the existing crisis guard still shows the resources card and never calls the model. Also render a crisis card that comes back from the server.
- Approval-pending errors (ACCOUNT_PENDING_APPROVAL) get calm copy.
- The user never sees JSON, stack traces, internal ids, error codes or ConvexError data. Check how apps/web shows ConvexError messages elsewhere.

Tests in CoachChat.test.tsx (follow the existing patterns):
- send calls the backend;
- the Thinking state appears and Send is disabled;
- an error shows Retry, and Retry reuses the identity;
- the crisis path never calls the model;
- no JSON or ids are rendered.

DONE:
- the tests pass;
- `rg -n "coach.sendMessage" apps/web/components/coach/CoachChat.tsx` prints nothing;
- lint and typecheck are green;
- the full AGENTS.md check list has run.

Open a DRAFT PR into integration titled "[TEMPO-N2-02] /coach chat uses chat.send". The body starts with "Closes #744". Add a "Base" note: stacked on #760; the diff and scope-guard include #760's files until #760 merges and integration is merged into this branch. Include the "Test results (cloud agent sandbox)" section.
```

### T3: #821 part A, save only the history items the user confirmed

**Start branch:** `integration`

**Prompt:**

```text
Build ticket #821 PART A ONLY [TEMPO-MEM-STUDY-WIRE-01] in Levidavidspublic/tempo-rhythm: the confirmed-memory save boundary. Follow AGENTS.md. Part B (lecture questions in convex/chat.ts) stays held: do not touch convex/chat.ts.

SCOPE: convex/memoryImport.ts, convex/memory.ts, test convex/lib/memoryStudy.test.ts. Branch t/821-memory-confirmed-save.

Read first:
- the history parser in packages/utils/src/historyImport.ts and its tests. It runs in the BROWSER. Do NOT import it into convex/, because its Object.hasOwn use breaks convex/tsconfig.json;
- convex/memoryImport.ts (importMemories);
- convex/memory.ts;
- the memories table in convex/schema.ts, including the index by_userId_deletedAt_salience_updatedAt;
- convex/lib/accountDeletion.ts and its tests;
- docs/ops/APPROVAL-GATE.md;
- how apps/web /settings/memory lists memories. Keep that API backward compatible.

Build:
- A public mutation, for example memoryImport.saveConfirmed, that takes an array of user-confirmed candidates.
  - Validation: strict validators with bounded count and lengths. Fields: content; source kind (allowlist: chatgpt, claude); role (user or assistant); an optional conversation title; an optional ISO date; a dedup key that the SERVER recomputes, never trusting the client's.
  - Access: owner-scoped through auth, with the approval-status check other AI or memory writes use.
  - Dedup: per-user, so a repeat import adds nothing new.
  - Provenance: stored in memories.metadata, allowlisted fields only.
  - Assistant-role candidates are stored as attributed context, never as facts about the user.
- The memory list returns that allowlisted provenance.
- Update and forget keep working. Soft-deleted rows are excluded from every retrieval path you own, and the live-memory read stays bounded.
- Keep the legacy export API.

DONE: `bun test convex/lib/memoryStudy.test.ts` passes. Use synthetic data and convex-test with the explicit module-map pattern from convex/lib/agentComponent.test.ts. Cover:
- cross-user and soft-deleted access;
- forged candidate metadata;
- saving only on an explicit call;
- repeat-import dedup;
- edit or delete excluding the row from retrieval;
- input limits.
Account lifecycle tests stay green, and `bunx tsc --noEmit -p convex/tsconfig.json` shows NO new errors.

Open a DRAFT PR into integration. The body starts with "Closes #821", then the line "Part A only; #821 is reopened for part B after merge". Write down the exact API signatures the history UI (#750) should call. Include the "Test results (cloud agent sandbox)" section.
```

### T4: #787 page API: save, Today, block tick and Undo

**Start branch:** `wip/787-page-api` (`4e10810`). That's #891's head `4315f3a` plus an unfinished draft of `convex/lib/builtin_templates.ts`.

**Prompt:**

```text
Build ticket #787 [TEMPO-B06-01] "Save indexed pages, create Today once and provide block Undo" in Levidavidspublic/tempo-rhythm. Follow AGENTS.md. This is a type:data, convex-arch ticket.

You are on branch wip/787-page-api. It is stacked on PR #891 (branch t/831-page-inverses-v2, not merged yet), which adds the pure helper convex/lib/pageLedger.ts. The last commit is an unfinished draft of convex/lib/builtin_templates.ts; review it before keeping it. Do NOT edit convex/lib/pageLedger.ts. If you need a helper change, stop and report it.

SCOPE: convex/notes.ts, convex/templates.ts, convex/lib/builtin_templates.ts, test convex/notes.test.ts.

The adopted page-ledger design (D1-D5) is implemented in:
- convex/schema.ts: pageOperations, pageOperationPayloads, pageProposals, notes.revision;
- convex/lib/pageLedger.ts and its test;
- the page-ledger section of convex/MIGRATIONS.md.
Privacy guards are in convex/lib/pagePrivacy.ts. The block codec is packages/utils/src/blocks.ts, re-exported by convex/lib/blocks.ts. If you need the D1-D5 prose, it is GitHub issue #828: stop and ask Amit to paste it rather than guessing.

Build these owner-scoped, atomic functions:
- notes.save({ noteId, body, expectedRevision, requestId })
- notes.getOrCreateToday({ localDate }): validates a real YYYY-MM-DD and creates from a Daily built-in template. There is one live page per user per date, even with duplicate or concurrent calls.
- notes.patchBlock({ noteId, blockId, patch, expectedRevision, requestId }): the task tick, done or not done.
- notes.undo({ operationId }): only inside the server-owned 5-minute window.

How they behave:
- Every write records ledger rows through the pageLedger helpers: request-id idempotency with a digest, an expected-revision precondition and a bounded surgical inverse.
- An Undo never erases newer unrelated edits. A conflict is returned explicitly, never overwritten silently.
- A write returns noteId and revision, plus operationId and undoUntilMs when something was written.
- Body-write parsing and noteBlocks index reconciliation live in one place. Call it from the existing create and update writers and from templates.applyToNote.
- Use the pagePrivacy guards on every read and write.
- Existing note APIs and MCP consumers keep working.
- If PR #893 (optional notes.preview, isTemplate, kind, archivedAt) has merged into integration by the time you start, merge integration into your branch and set preview/isTemplate in every writer you touch. Otherwise note it for ticket sync.

DONE: `bun test convex/notes.test.ts` passes. Use convex-test with the explicit module-map pattern from convex/lib/agentComponent.test.ts and synthetic data only. Prove:
- one Today for duplicate and concurrent requests;
- no foreign or deleted access;
- body and index stay consistent across save, create, update and template apply;
- a task tick followed by Undo works;
- a repeated Undo;
- an expired Undo;
- a stale revision;
- an unrelated edit in between (Undo returns an explicit conflict and erases nothing);
- no duplicate task row and no task-table migration.

Also run the full AGENTS.md check list and `bunx tsc --noEmit -p convex/tsconfig.json`, which must show no new errors in your files.

Open a DRAFT PR into integration. The body starts with "Closes #787", then add a "Base" note: stacked on #891; the diff includes #891's commit until #891 merges. List the exact API signatures and include the "Test results (cloud agent sandbox)" section.
```

### Later, after the merges above

These come later, one Codex task each:

- #804: search uses the safe projection. After #884.
- #789: block registry. After #896 and #787.
- #790–#792 and #805: Today page.
- #793 and #794: coach proposals and Undo.
- #842–#850: notes, tags, search.
- #750: history import UI. After #821 part A.
- #745 and #746: chat list and the Web Speech voice stopgap. #746 must be split first; its scope is 4 files + 1 test.

Codex usually can't read GitHub issues from inside the task, so paste the issue text into the prompt.

## Your clicks (Codex can't do these)

1. **Merge clean PRs.** Once a PR's Codex review is clean (👍 or "Didn't find any major issues") and CI is green, press **Enable auto-merge**. The merge queue does the rest. A direct merge is refused.
2. **Config PRs (#878, #874, #897).** config-guard only accepts the `config` label if it was added after CI ran on the latest commit. Once CI has finished, remove the label and add it again. #897 is a draft: mark it ready.
3. **Run the preview check.** After #892 and #897 merge, go to Actions → `preview-acceptance` → Run workflow on `integration` (defaults). It makes a throwaway mail.tm account, signs in to preview, approves the account on TEST, runs the checks and uploads screenshots.
4. **Reopen #821.** After the #821 part A PR merges, reopen #821 for part B.
5. **Re-request reviews.** If Codex doesn't re-review a PR after a new push, comment `@codex review`.

## Facts and gotchas

- **Preview in a browser:** the Claude cloud sandbox couldn't open preview pages, because its proxy blocks WebSockets and Convex needs one. GitHub runners can, which is why `preview-acceptance.yml` exists.
- **New accounts:** they start `pending`, and AI functions refuse them until approved (docs/ops/APPROVAL-GATE.md). Use synthetic accounts only.
- **#760 and #895 together:** #895's author noted that `chat.send` (#760) ignores `agentThreadId`, and that its `retryOf` could bring back a message the user removed. Check this once both are merged.
- **Model and keys:** the coach model on TEST is `deepseek-ai/DeepSeek-V4.1-Flash` via `DEEPINFRA_API_KEY`. That name is probably SET on TEST. (EXTRAPOLATED from brain-dump working on 6 Oct; not checked today.) Voice from a provider (Deepgram) is held on your decisions in #868/#871.
- **Codex accounts:** Codex runs on the ChatGPT plan only, never a metered API key.
