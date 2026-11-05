# FACTORY-LOOP.md

Source file: `Downloads/FACTORY-LOOP.md`, copied 2026-11-05. The words below are that file.

The development loop for every product in this repo. Any agent, harness or orchestrator follows it. It names **roles**, not tools. The table at the end maps the roles to today's tools, and you can swap a tool without changing the loop.

**Core rule: a change is accepted only if every check passes. One failed check rejects it. Rejecting good work by mistake is better than letting bad work through.**

---

## 1. Inputs (the plan)

Agents build only from these documents, in `docs/product/`:

| Document | What it answers |
| --- | --- |
| PRD | What the app does and for whom |
| Product doc / SPEC | The features, screen by screen |
| TRD | What the technology must do: speed, security, limits |
| Tech spec / TECH-STACK | How each part will be built |
| ARCHITECTURE | How the parts connect |
| DESIGN / UX-GUIDELINES | How it looks and feels |
| ROADMAP | What gets built first, next and later (MVP, then Gen 1) |

Plus a code map of the repo, refreshed after every merge.

The docs are the source of truth. A wiki copy is only a mirror.

---

## 2. The ticket loop

```
Docs ready → ~20 fresh tickets → Build (1 ticket = 1 agent = 1 branch) → Machine checks → Judgement score
                                      ▲                                                   │
                                      └──────────── fail (max 3 tries) ───────────────────┤
                                                                                          ▼ pass
                       Live for users ← Release checks (every ~5 loops) ← Batch review ← Merge into loop branch
```

| Step | What happens | Role | Pass condition |
| --- | --- | --- | --- |
| 1. Docs ready | PRD, TRD, architecture, roadmap and a fresh code map. | Planner (human + planning model) | A second model, not the author, reviews them for gaps and contradictions. |
| 2. Write ~20 tickets | Written fresh just before each loop, from the docs and the code map. Never months ahead. | Ticket writer | The judge model scores every ticket. A fresh model reads a random sample. A ticket must be specific enough for a mid-tier model to close it. |
| 3. Build | One mid-tier model per ticket, each on its own branch. | Builder agent | The agent's report lists every step with evidence (commands run, results, screenshots). |
| 4. Machine checks | Build, own tests, numbers in range, style, secret scan, banned tech, scope, config guard, tests not weakened. | CI | All 9 pass. |
| 5. Judgement score | Instruction-following, formatting, naming, clean code. | Judge model | Each score 85% or more. |
| 6. Retry | A failed change goes back to step 3, with the failing check and its log. | Same builder agent | After 3 fails it stops and is flagged. Everything else keeps running. |
| 7. Merge | Passing changes merge into the loop branch. Never into main or production. | Orchestrator, automatic | No person needed. |
| 8. Batch review | The whole batch is reviewed together, then clicked through in a real browser. | Batch reviewer + browser test agent | Findings fixed in at most 3 rounds. |

**User reports:** a glitch, or something that works but feels wrong, automatically becomes the top-priority ticket in the next loop.

---

## 3. Verification: what "done" means

Every feature gets a target from a published standard, then a stress test that deliberately pushes past it. Example: if chat must handle 15 things at once, test 20, then 25, and record what broke and how.

Each ticket's checks come from one shared rulebook (`verification.md`), in four layers:

1. **Code:** tests written before the build, as Given / When / Then.
2. **Screen:** a browser test clicks through, compares screenshots, checks accessibility and measures speed. Real click-through tests count more than unit tests that only prove the code compiles.
3. **Feel:** a target from HCI research, then a stress test past it.
4. **Risk of feeling off:** low for a "done" button (well researched, numbers are enough). High for chat, voice and animation, which also go to the weekly human review and to user feedback.

| What | Target | Source |
| --- | --- | --- |
| Tap or button response | Visible change within 0.1 s | Nielsen, response-time limits |
| Any wait | Under 1 s, or show progress; past 10 s attention drifts | Nielsen |
| Interaction response | Under 200 ms | Core Web Vitals (INP) |
| Scrolling | A frame every 16 ms at 60 Hz, 8 ms at 120 Hz | Apple and Android guidelines |
| Drag lag people notice | About 11 ms | Deber et al., CHI 2015 |
| Human turn-taking gap | About 100 to 200 ms | Stivers et al., PNAS 2009 |
| Voice agent reply | Under 0.5 s typical, 0.8 s worst | EXTRAPOLATED: vendor figures only |
| AI answers that come too fast | Rated less thoughtful | CHI 2026 (n=240); labour illusion, HBS |
| Notifications | Raise inattention and hyperactivity scores | Kushlev et al., CHI 2016 |
| Contrast and touch targets | 4.5:1; 44 pt / 48 dp | WCAG 2.2; Apple and Google |

Still UNKNOWN: barge-in stop time for voice, the best AI "thinking time", and ADHD-specific limits on choices and reminders.

**Design check (the council):** three strong models from different providers each score screenshots out of 10, compared against reference apps named in DESIGN. Fix and re-score until every model gives 9 or more. Record the scores for each round. Don't tell the scoring models the target score.

**Agent-behaviour check:** collect the times agents went wrong in this repo (wrong tool, wrong path, ignored rule), turn them into a test set, and adjust the agent instructions until the set passes.

---

## 4. Preview to production

Releasing is automatic, but only after a second, separate round of checks.

1. Each finished loop lands on **preview**.
2. After about 5 loops, if preview is stable, a release starts.
3. The batch reviewer reviews the whole release again: does it work, is it secure?
4. A cloud test agent tests every feature, including the stress tests.
5. All pass: the new version goes live (invite-only for now).
6. A problem after release rolls back to the last good version.

A weekly security scan of the whole app turns anything it finds into new tickets.

---

## 5. How we know what we know

Nothing counts because a model says so. Every claim is one of these:
- measured;
- from a published standard;
- reviewed by a second model that didn't do the work;
- a product decision by the owner.

Also:
- The builder never grades itself.
- Tests can't be loosened to pass.
- Unknowns are written as UNKNOWN.
- When in doubt, reject.

---

## 6. Who decides what

- **Agents do:** write tickets, build, check, fix, set up cloud services, release to preview, and report.
- **Only the owner:**
  - opening accounts and payments;
  - changing these rules or loosening a check;
  - product judgement: does it feel right, is it worth building;
  - going live while the rules file still says only the owner deploys to live;
  - re-setting priorities every 2 weeks.

---

## 7. Mentor's advice applied to the loop (Nir, 5 Nov)

- **Keep it simple.** Tickets live in GitHub, next to the code. There's no separate proprietary ticket system to maintain.
- **A deadline per phase.** Each phase (one or two weeks) has a fixed end date and a usable result. The current one is a usable web alpha by the end of the month.
- **Competition isn't won on technology.** Every loop serves something a user would notice. Pure tech work needs a reason in the ticket.
- **Know the customer.** Copy, onboarding and design tickets use the customer's own words, from real user feedback.
- **Onboarding:** first get the user invested, then ask them to buy. At most 2 questions, each with a reason.
- **Feed the business, not just the code.** A loop that improves nothing a user can see or pay for gets questioned at the 2-week review.

---

## 8. Rules for every agent

- Models that write code are mid-tier in billing, built for long agentic runs. Never the most expensive tier for writing code.
- One ticket, one agent, one branch. Never two agents on one branch.
- Keys only from the secrets vault, injected at run time. Never printed, never committed.
- No spending, plan changes or top-ups.
- Preview only, unless the rules file says otherwise.
- Back up any setting or file before changing it. Change only what the ticket names.
- Every report ends with: Done / Needs owner / UNKNOWN.

---

## Role → today's tool (swap freely)

| Role | Tool today |
| --- | --- |
| Orchestrator (hands out tickets, routes failures back, merges into the loop branch) | Orchestrator (orchestrator.inc) |
| Automations, scheduled jobs, cloud browser | Reason |
| Builder agents (mid-tier) | Claude Sonnet, Codex, Cursor with Grok 4.6/4.7, OpenCode with GLM or DeepSeek |
| Ticket writer | DeepSeek via OpenCode, run as a scheduled job |
| Judge model | Jev |
| Batch reviewer | CodeRabbit |
| Browser test agent / release tests | Cursor cloud agent, or Reason's cloud browser |
| Code map | Graphify |
| CI | GitHub Actions (the 9 checks) |
| Preview and hosting | Vercel |
| Backend | Firebase (Auth + Firestore), with server code as Vercel functions |
| Secrets vault | 1Password dev vault |
| Memory between sessions | Basic Memory |
