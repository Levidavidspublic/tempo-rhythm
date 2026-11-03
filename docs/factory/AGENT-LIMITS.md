# Agent usage limits and routing preference

Amit's rule (6 Oct 2026): when an agent runs out of usage, the factory routes around it. It never falls back to a
pay-per-use API agent. Code: `scripts/factory/lane-limits.mjs` (one module, unit tests in `scripts/factory/test-factory.mjs`).

## Repo variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Default | Meaning |
|---|---|---|
| `FACTORY_CLAUDE_AT_LIMIT` | `false` | `true` = Claude (subscription OAuth lane) gets no new tickets |
| `FACTORY_CODEX_AT_LIMIT` | `false` | `true` = Codex (ChatGPT plan) gets no new tickets |
| `FACTORY_CURSOR_AT_LIMIT` | `false` | `true` = the Cursor lane gets no new tickets. **Bugbot and the Cursor automations keep running**; they are not lanes and never read this variable |
| `FACTORY_FREEBUFF_AT_LIMIT` | unset (false) | `true` = skip the Freebuff manual fallback (its daily free allowance is used up), so the next fallback is OpenCode |
| `FACTORY_OPENCODE_AT_LIMIT` | unset (false) | `true` = skip the OpenCode manual fallback too, so the ticket goes to `blocked:amit` ("usage limits") |
| `FACTORY_AGENT_PREFERENCE` | `claude,codex,cursor` | Comma-separated order of the 3 lanes. Unknown names are ignored. Lanes left out are appended in the default order (use `*_AT_LIMIT` to switch a lane off). freebuff/opencode can't be listed here: they are always the manual fallbacks after the 3 lanes |

Flip with `gh variable set FACTORY_CURSOR_AT_LIMIT -R Levidavidspublic/tempo-rhythm -b true`. Takes effect on the next router run. No PR is needed.

## Rules (first match wins per ticket)

1. **Pinned lane:** front-matter `lane_pin: true` (factory), or an explicit `agent:<x>` label or `area:` rule (label routers). The lane is kept unless that agent is at its limit. Then the next available lane in the ticket's order takes it.
2. **Data tickets** (`type: data`, Convex): Claude, then the preference order.
3. **Browser-test tickets** (`browser_test: true`): the preference order with Claude moved last. The default is **Codex** (Playwright is in its environment), then Cursor, then Claude.
4. **Build tickets** (everything else): balanced over the available lanes **except the last one in the preference**. The last lane is a fallback only. The default is Claude + Codex sharing the work, and Cursor only when both are at their limit.
5. **All three at their limit → manual fallbacks, in this order:**
   1. **Freebuff** (free, ad-supported coding agent built on Codebuff, https://freebuff.com). Labels **`agent:freebuff` + `needs:manual-run`**.
   2. **OpenCode** (https://opencode.ai; Amit has OpenCode Go and Zen, plus its free models). Used when `FACTORY_FREEBUFF_AT_LIMIT=true`. Labels **`agent:opencode` + `needs:manual-run`**.
   3. Both at their limit → **`blocked:amit`** ("usage limits").

   Neither fallback has a GitHub trigger wired yet, so the router only adds the labels and one comment, and starts nothing. This replaces `blocked:amit` while a fallback is available. The factory skips `needs:manual-run` tickets until a person removes the label.

What that means with the default preference:

| At limit | Build ticket | Browser-test ticket | Data ticket |
|---|---|---|---|
| none | Claude / Codex (balanced) | Codex | Claude |
| Cursor | Claude / Codex | Codex | Claude |
| Codex | Claude (then Cursor) | Cursor | Claude |
| Claude | Codex (then Cursor) | Codex | Codex |
| Claude + Codex | Cursor | Cursor | Cursor |
| all three | Freebuff (manual) | Freebuff (manual) | Freebuff (manual) |
| all three + `FACTORY_FREEBUFF_AT_LIMIT` | OpenCode (manual) | OpenCode (manual) | OpenCode (manual) |
| all five | `blocked:amit` | `blocked:amit` | `blocked:amit` |

**Never pay-per-use.** The lanes are Claude (subscription OAuth, `CLAUDE_CODE_OAUTH_TOKEN`), Codex (ChatGPT plan), Cursor (plan, `CURSOR_API_KEY`), then the free Freebuff, then OpenCode with **free models or the Go plan** only. OpenCode **Zen bills per request** from prepaid credit, so don't pick a Zen paid model for factory work unless Amit says so. No metered API key is ever used as a fallback. The only paid extras are **Bugbot** and the **Cursor automations**. **Copilot** is not a lane. It stays a last resort that a person starts.

## Where it is enforced

| Router | Trigger | What it does |
|---|---|---|
| `factory-dispatch` (gh-aw) | cron / `status:ready` / manual | `next-tickets.mjs` writes the final `lane` and `lane_reason` per ticket into `ready.json`. The Copilot dispatcher must use it unchanged. `manual_fallback[]` tickets get their `labels` (`agent:freebuff` or `agent:opencode` + `needs:manual-run`, or `blocked:amit`) and one comment. They use no capacity slot |
| `dispatch-router.yml` | label `ready` | The `area:`/MUTATES rule picks a lane. `lane-limits.mjs --want <lane>` replaces it if that agent is at its limit. Freebuff/OpenCode → labels + comment, no start |
| `agent-router.yml` | label `agent:claude/codex/cursor`, manual | Same re-check on the requested agent. A reroute is explained in a comment. Freebuff/OpenCode → labels + comment, no start. (`agent:freebuff` and `agent:opencode` are not startable agents; the router ignores them) |

## Running a `needs:manual-run` ticket by hand (Dots or Amit)

### Freebuff (`agent:freebuff`)

Only the free tier, with no paid plan and no API key. Freebuff sends code to its hosted models. tempo-rhythm is public; check before using it on a private repo.

1. Branch: `git fetch origin && git checkout -B t/<issue>-<ticket-id-lowercase> origin/integration`. This is the factory ticket branch name, e.g. `t/712-b04-03` (`ticketBranch()` in `scripts/factory/factory-lib.mjs`). If the branch already exists, check it out instead.
2. Run it:
   - **CLI:** `npm i -g freebuff`, then run `freebuff` in the repo root. Give it the issue body (FOR / GOAL / SCOPE / DONE) plus "Follow AGENTS.md and RULES.md. Only touch the SCOPE folders. Run the DONE commands."
   - **Freebuff Cloud** (https://freebuff.com, Cloud): open the GitHub repo, pick the branch, paste the same prompt, and let it push to that branch.
   - **Desktop:** same as the CLI, in its own workspace.
3. Open a **draft** PR into `integration` as Division6066 with `Closes #<issue>` in the body. Normal CI and guards apply. Then remove `needs:manual-run` and `agent:freebuff` and add `status:in-pr`.

### OpenCode (`agent:opencode`)

1. Use the same branch as step 1 above (`t/<issue>-<ticket-id-lowercase>` from `origin/integration`).
2. Install: `npm i -g opencode-ai` (or `curl -fsSL https://opencode.ai/install | bash`). Run `opencode auth login` once with Amit's OpenCode account. Pick a **free model or an OpenCode Go model** (`/models`), not a paid Zen model.
3. Run `opencode` in the repo root with the same prompt as for Freebuff: the issue body plus "Follow AGENTS.md and RULES.md. Only touch the SCOPE folders. Run the DONE commands." For one non-interactive run: `opencode run "<prompt>"`.
4. Open a draft PR exactly as for Freebuff. Then remove `needs:manual-run` and `agent:opencode` and add `status:in-pr`.
5. **Wiring OpenCode into the router** (automatic start from a workflow, like the Claude lane) **needs an OpenCode API key from Amit.** None is in 1Password today (the "OpenCode API Credentials" item has not been checked for Zen/Go scope). Store it as repo secret `OPENCODE_API_KEY`, add a `factory-lane-opencode` workflow in a config PR, and move `opencode` from manual fallback to a lane in `lane-limits.mjs`.

### After a reset

When a usage limit resets, set the matching `*_AT_LIMIT` back to `false`. To send a waiting ticket back to the factory instead, remove `needs:manual-run` and the `agent:freebuff`/`agent:opencode` label.
