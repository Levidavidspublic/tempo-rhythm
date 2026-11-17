# Factory references — rule lists

Built 2 Oct 2026 (IDT). Short rules and links only. No transcript text.
Goes into each repo as `docs/factory/REFERENCES.md`.

**Local policy:** docs/HARD_RULES.md REPO RULES is authoritative. The source notes below are references, not permission to use another reviewer or a longer fix loop.

**Historical source order:**
1. Amit's 1–2 Oct decisions + WEEKEND-PLAN v3 (§2.4 and the 15:24 overrides)
2. Basic Memory `Main/factory`: Factory merge and deploy policy (30 Sep) > Factory Decisions 18 Sep > Session 17–19 Sep > Doc index 30 Sep
3. factory-v2 (20 Sep)
4. factory kit (18 Sep)
5. Ras Mic's skills repo

A rule marked ⚠ is overruled by a higher source. See `PLAN-VS-RULES.md`.

---

## 1. Greg Isenberg × Ras Mic — "Building a Software Factory that actually works (Full Course)"
Link: https://www.youtube.com/watch?v=_LCeJZFIsd4 (Startup Ideas Podcast, 14 Sep 2026)
1. A factory is a few markdown files (AGENTS.md + skills). It works with any model and any harness. Don't buy a product for it.
2. AGENTS.md holds the workflow, not facts the agent can read from the code.
3. Four beats for every task: isolate → build → prove → ship.
4. Isolate: one fresh branch/worktree per feature per agent. Never build on the base branch.
5. Build: follow a code-structure guide (service layer). Working code isn't enough if it's sloppy.
6. Prove: the agent shows before/after evidence (screenshots, video, or measured numbers). "Agents can't pinky promise."
7. Ship: a third-party code-review agent scores the PR in the source lesson. Locally, CodeRabbit is the only reviewer and REPO RULES 9 defines the gates and maximum rounds.
8. The human reviews the proof and the score, not the raw diff, then merges.
9. ⚠ "Up to 15 features in parallel." Plan v3 caps it at 3 agents per repo.

## 2. Corbin — "Cursor Projects Just Killed ChatGPT Codex, Claude Code"
Link: https://www.youtube.com/watch?v=XXDiW6m8Go0 (12 Sep 2026)
1. One long-running Project chat acts as the orchestrator/PM and launches sub-agents in cloud VMs.
2. Set up the Cursor cloud environment for the repo first (install, run, test), then save it.
3. Give the Project its context once (what it is, the Projects article). Don't re-explain per chat.
4. Cloud agents can use computer use to test UI and record a demo. Ask for that proof.
5. Parallel work = duplicated repo per agent (branch/worktree in the cloud).
6. Learn the Cursor CLI; it starts agents in other contexts.
7. ⚠ "Set the default agent to a high-level reasoning model." Plan v3 allows mid-tier code models only.

## 3. Corbin — "Every AI App Builder Is Trash Except Cursor and ChatGPT Codex"
Link: https://www.youtube.com/watch?v=vfjJHbLUcfc (14 Sep 2026)
1. Cursor = cloud and parallel agents (many agents, run from the phone). Codex = strong local/native desktop loop and finishing a goal.
2. Pick the tool for the use case. Replit/Lovable are for demos, not production SaaS.
3. Models get siloed by vendor. Don't tie the factory to one model. The harness/process is what lasts.
4. Native computer use for testing UI is a deciding feature. Require proof, not claims.
5. One orchestrator chat starts the agents and brings the results back together.

## 4. Theo (t3.gg) — "Did AI Kill React Native?"
Link: https://www.youtube.com/watch?v=oPZLPUtmROo (14 Sep 2026)
1. If you use React Native, use Expo. Without it you end up rebuilding Expo.
2. Over-the-air (OTA) updates are the main reason to stay on RN. A bad release can be pulled back within the hour.
3. Let agents iterate on web/simulator builds (Expo). A native build isn't needed for most UI loops.
4. Agents now make native ports cheaper, but one-shotting a port from a spec gives unmaintainable code. Use small, reviewable checkpoints.
5. Keep business logic out of the UI so it can run headless (shared core).
6. Test mobile apps on both iOS and Android before you ship.
7. Big RN/Expo version bumps break things. Treat them as their own ticket.

## 5. Dave Plummer — TMOG task manager, and Amit's DAVE LOOP
Link: UNKNOWN for the exact video Amit used. Candidate: https://www.youtube.com/watch?v=c3EEs-O3bGE ("Windows Task Manager's Creator Rebuilt It 30 Years Later | Shop Talk #91"). Project: https://www.tmog.org/
No transcript on the PC. Rules taken from public write-ups and Amit's own docs (01-MONOREPO-TEMPLATE-SPEC, 16 Sep).
1. Write the spec first and freeze it (TMOG: 107 pages). "Write a task manager" with no spec gives "hot garbage".
2. Architecture: the UI talks to one shared core, which calls platform-specific helpers. No Electron, no web view.
3. DAVE LOOP step 1: one frozen spec covering purpose and non-goals, the one click-path that means "it works", the screens, the data, and the architecture the builder may not invent.
4. First pass: one builder, locked to the spec, on a mock adapter.
5. Correct with one screenshot and one note per wrong surface: "when I click X it does Y, it should do Z, here is Z".
6. The builder changes only the files it owns. Run again, then keep or revert.
7. No new features until the click-path is true. Split work only after that.

## 6. "agent-loop.en.srt" — The agent loop (lesson)
Link: YouTube UNKNOWN. Likely source (EXTRAPOLATED): https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/01-the-agent-loop
1. An agent observes the state, picks an allowed action, reads the result, and stops under a rule.
2. Five parts every loop needs: a message buffer (history), a named tool registry, an observation formatter, a stop condition, and a turn budget.
3. Errors go back into the loop as readable observations. They aren't crashes or silent failures.
4. Tool output is data, not instructions to obey.
5. An unknown tool returns an "unknown tool" result. The agent never invents a tool.
6. When the budget runs out, say "budget exhausted". Never pretend the task finished.
7. Set an explicit policy for each failure: retry, wait for a human, or stop.
8. Add one capability at a time (validation, approval, cancellation) and test each new boundary. Every run leaves a trace.

## 7. Factory kit (18 Sep) — factory-kit.zip
Source: `C:\Users\User\Downloads\factory-kit.zip` → box `/workspace/factory-weekend/factory-kit/`. Ignore 12-GROKBOT-OPERATING-DOC and 14-TIMELINE (out of date).
1. One ticket schema for code and config. The plan v3 fields are FOR, WHEN, WHY, GOAL, SCOPE, MUTATES, STEPS, DONE, EVIDENCE, DO NOT, REPORT.
2. DONE must be checkable by a machine (command + expected output, a failing→passing test, a URL returning 200, a review score). If a human has to judge it, the ticket is written wrong.
3. Scope: 3 files + 1 test (code) or one system (config). Anything bigger is two tickets (SCOPE_OVERFLOW).
4. MUTATES is the full list of what may change. Anything else is out of scope.
5. AGENTS.md carries workflow, invariants, the real check commands with their passing output, what's untestable locally, and what needs Amit. No stack facts.
6. Queue = GitHub Issues. Label `ready`. One assignee per ticket. No work without a ticket.
7. Read a file before you edit it. Regenerate lockfiles, never hand-merge them. Use `--force-with-lease` on your own branch only.
8. Stop codes: BLOCKED_DEPENDENCY, PATH_DRIFT, SCOPE_OVERFLOW, USER_CHANGES, VERIFICATION. A conflict you can't resolve is a stop, not a guess.
9. Cursor environment.json: `install` must be idempotent. Use `disableAllMcpServers` plus `mcpServerAllowlist` (deny by default) and an egress allowlist. Secrets are injected only when an agent starts.
10. No OpenRouter for products; the Jev judge is the sole exception under REPO RULES 4. Never print secret values. Report NAME = SET/UNSET.
⚠ Overruled in the kit: the 18:00 Sun–Thu merge window, "nothing runs Fri/Sat", "two products only", "agents never touch keys / credential document", `npx convex env list` as a DONE check, the Opus example, and the Grok 4.5/4.6-only tier.

## 8. Ras Mic's skills repo — github.com/michaelshimeles/skills
Link: https://github.com/michaelshimeles/skills (read live 2 Oct 2026). Install: `npx skills add michaelshimeles/skills`
1. Isolate (`new-feature`): a fresh worktree/branch per task per agent, plus a scope check against open PRs' changed files. If they overlap, stop and ask.
2. Build (`code-structure`): actions/boundaries decide why and when. A service layer owns the reusable how. Avoid god services, leaky services and over-abstraction.
3. Prove (`evidence-driven-testing`): capture BEFORE while you reproduce the problem, and AFTER once it works. In headless runs, use Playwright screenshots. For non-UI changes, give numbers or output pairs.
4. Ship (`before-and-after` + `greploop`): put the proof in the PR body. Locally, use CodeRabbit and REPO RULES 9; the source lesson's review tooling and ten-round loop do not apply.
5. Multi-agent: no direct commits to the base branch. Never plain `--force`. Never touch another agent's branch. Regenerate lockfiles. Don't run schema experiments on a shared database.
6. Rebase onto the latest base, rerun the checks, then push.
7. Run `unslop` on anything a human reads (commits, PR text, docs).
8. ⚠ "Don't merge unless explicitly told to." Plan v3 lets the orchestrator or tester merge into integration under rule 1.4.
9. ⚠ The base branch is `origin/main` in the repo. For us it is `integration`.
10. Watch out: `before-and-after` uploads to public 0x0.st by default. Use `--upload-url` (or GitHub attachments) for signed-in screens.
11. Licence: no LICENSE at the repo root (404 on 2 Oct). `new-feature`, `code-structure` and `evidence-driven-testing` have no licence grant. `before-and-after` is PolyForm Shield. greploop, greploop-apps and unslop are MIT.
