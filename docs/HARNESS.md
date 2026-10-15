# Factory HARNESS

Canonical agent harness for Amit Levin’s software factory.  
**Landed on:** `Division6066/tempo-rhythm` (`docs/HARNESS.md`). Source copy lives on `Division6066/monorepo-template`.  
**This repo:** base branch **`integration`**. Documentation is **`docs/` only** — `tempo-rhythm` has no GitHub Wiki tab.  
**Authority:** GitHub Issues is the only queue. Agents open **draft** PRs; **Amit merges**. Never apply `agent:ready`. Never merge. Never print secrets.

---

## 1. Roles (Scout / Builder / Janitor / Checker)

| Role | Who | Does | Does not |
|------|-----|------|----------|
| **Scout** | Squad (Grok) + Grok Bot routines | Read the queue; confirm seven fields; propose the next ready set; comment/label for triage | Merge; flip `agent:ready` without Amit’s Gate 1; invent product decisions |
| **Builder** | Claude Code lane (Squad) **or** Cursor Cloud Agent | Implement the ticket on a feature branch; open a **draft** PR | Merge; touch secrets/ENV dashboards; use forbidden models |
| **Janitor** | Squad (Grok) + Grok Bot | Hygiene: close/rewrite stale issues, ledger lines, evidence packs, Graphify regen notes after Amit merges | Ship product code as primary path; merge |
| **Checker** | Squad (Grok) + Grok Bot | Preflight on PRs (`PREFLIGHT: checks=… \| files=… \| secret-scan=…`); escalate stop-codes | Merge; approve Gate 2 |

**Lane split (locked):**

- **Claude Code lane** — Builder work that needs Anthropic’s first-party binary / `claude-code-action`. OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`) lives in **GitHub Actions secrets only** — never Squad, never Cursor Secrets.
- **Squad Grok lanes** — Scout / Janitor / Checker (and research). Grok via OAuth subscription.
- **OpenCode Zen (Squad)** — free models only: **Big Pickle**, **Union Alpha**. **No OpenRouter.** OpenCode provider keys (HF / Venice / Abliteration when configured) are lane config, not chat paste.

Cursor Cloud Agents execute `exec:cursor-cloud` tickets. Astra (Codex on the PC) is PC-only (`claude setup-token`, local `check-env`, CLI logins) — not a merge authority.

---

## 2. Seven-field tickets (GOAL first)

Every issue body **starts** with `GOAL:` and includes all seven fields in order:

```text
GOAL:
<one sentence: done looks like>

CONTEXT:
<paths, PRD refs, Graphify artefact pointer, prior PRs — no secrets>

ACCEPTANCE:
- <observable checks>
- <commands that must pass>

CONSTRAINTS:
Draft PR; files ≤ N; no secrets; base branch = integration|main|master as repo rules say.

BUDGET:
budget: $<cap> · model: <allowlisted mid-tier id>

STOP:
<stop-code if blocked; else “none — Checker owns verification”>

EVIDENCE:
PR URL · CI names+states · Checker PREFLIGHT line · Cursor/Squad run id
```

Header line (labels / product / generation) may sit above `GOAL:` but **must not** replace it. A body without leading `GOAL:` is invalid — Scout rejects before any `agent:*` flip.

Labels (exactly one `agent:*` at a time): `agent:ready` · `agent:working` · `agent:review` · `agent:blocked` · `agent:done`, plus lane / executor / product / stage / version / control (`needs-amit`, `backend-change`, `template-change`, `stop-test`, …).

---

## 3. MT-STOP and stop-codes

### 3.1 Stop tickets (per repo)

Seed and keep a **stop** ticket that must stay **red** (verifier health):

| Repo | Stop ticket | Intent |
|------|-------------|--------|
| `monorepo-template` | `MT-STOP` | If this ever goes green / `agent:done`, **halt the factory** and fix the verifier |
| `tempo-rhythm` | `TF-W0-STOP` (or product STOP) | Same pattern |
| `omniagent` | `OA-STOP` | Same |
| `agentwright` | `AW-STOP` | Same |
| `mega-memory` | `MM-STOP` (when seeded) | Same |

Stop tickets carry `agent:blocked` + `stop-test` (or repo equivalent) + `needs-amit`. **Do not** implement features on them. **Do not** mark them ready. Loop-proof day treats a green STOP as “stop everything.”

### 3.2 Stop-codes (write exactly; continue with independent work)

| Code | Meaning | Typical handoff |
|------|---------|-----------------|
| `BLOCKED_DEPENDENCY` | Missing key, missing brief, blocked upstream ticket | `needs-amit` or wait for intake |
| `BLOCKED_VERIFICATION` | Stop ticket went green, secret-scan hit, proof false-positive | Halt lane; fix verifier |
| `BLOCKED_PATH_DRIFT` | Renamed CI checks, wrong base branch, template path rewrite | `needs-amit` |
| `BLOCKED_SECRETS` | Masked field, value in log/chat, dashboard paste risk | Rotate; abandon that step |
| `BLOCKED_BUDGET` | Cap exceeded or 3× timeout | Report; do not retry hot |
| `BLOCKED_MODEL` | Non-allowlisted model requested | Re-pin mid-tier; do not run |
| `BLOCKED_MERGE` | Agent attempted merge / push to protected base | Revert intent; draft PR only |

Agents stop on masked fields, missing keys, or product decisions — emit a stop-code, then continue **independent** steps. Never invent a decision.

---

## 4. Graphify regenerate on merge

Knowledge graph is the map (Blitzy pattern). Ticket `CONTEXT` points at live artefact paths in `docs/TEMPLATE_STATE.md`.

**After Amit merges** (agents never merge):

1. Regenerate Graphify (AST, deterministic): e.g. `graphify update . --no-cluster` / repo `scripts/regenerate-graphs.sh`.
2. Copy sanitized artefact to the committed path (e.g. `docs/graphs/<repo>.json`). Strip absolute machine paths.
3. If Understand Anything / `/understand` is available, refresh `.ua/knowledge-graph.json`; else leave status **not generated** — do not invent semantics.
4. Update `docs/TEMPLATE_STATE.md` paths + status in a **follow-up draft PR**.

Do **not** treat regenerate-on-merge as a silent CI job unless plugins exist in CI (they usually do not). No unrelated corpora. No secrets in graphs.

**This repo:** committed snapshot is `docs/graphs/tempo-rhythm.json`. Understand Anything `.ua/knowledge-graph.json` is **not generated** — do not invent `.ua/`. `graphify hook install` is not enabled.

---

## 5. Mid-tier MODEL allowlist

Pin the runner model. Default factory compute is **mid-tier only**:

| Allowed | Notes |
|---------|--------|
| **GPT 5.6 Terra** | Cursor / cloud mid-tier |
| **GLM 5.3 Flash** | Fast mid-tier |
| **DeepSeek V4.1 Flash** | Fast mid-tier |
| **Claude Sonnet 5** | Mid-tier; Claude Code lane when Builder needs Anthropic binary |
| **Grok 4.5 / Grok 4.6** | Squad Grok lanes / Grok Bot |

**Never use (hard deny):** Fable · Astra · Opus · Soul (any spelling / vendor alias).

OpenCode Zen free (Squad only): **Big Pickle**, **Union Alpha**. Not via OpenRouter. Not a substitute for the mid-tier allowlist on Cursor Cloud tickets unless the ticket `BUDGET`/`model` line explicitly says Zen free.

If a tool offers a higher tier by default, **omit model** only when the platform default is already mid-tier; otherwise pin an allowlisted id. `BLOCKED_MODEL` if forced off-list.

---

## 6. Secrets and chat

- **No secrets in chat**, issues, PR bodies, screenshots, ledgers, or graphs.
- Names only (`DEEPINFRA_API_KEY = SET|UNSET`). Use `--names-only`, masked `vercel env ls`, `gh auth status`.
- Never click reveal toggles. Never screenshot masked fields.
- Intake values go through secret-request cards / provider CLIs / Actions secrets — not transcripts.
- Retired names stay retired (`OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, etc.). Do not reintroduce OpenRouter for OpenCode.

---

## 7. Draft PRs; Amit merges

1. Scout confirms seven fields → Amit Gate 1 (“go”) → only then may automation apply `agent:ready`.
2. Builder / Cloud Agent opens a **draft** PR against the repo base (`integration` / `main` / `master` per repo).
3. Checker posts `PREFLIGHT:`. Janitor comments evidence.
4. **Amit merges** (Gate 2). Agents set `agent:done` only after merge is observed — they do not press merge.
5. Graphify regenerate follow-up (draft PR) after merge.

**This repo’s base is `integration`.** Never push to `master`. Never `agent:ready` from an agent’s own initiative on this harness doc’s authority.

---

## 8. Copy checklist (template → products)

When landing from `monorepo-template`:

- [x] `docs/HARNESS.md` (this file) — landed on `tempo-rhythm`
- [ ] Issue template still renders `GOAL:` first
- [ ] Stop ticket seeded and red (`TF-W0-STOP` on this repo)
- [x] `docs/TEMPLATE_STATE.md` lists Graphify paths
- [ ] Squad docs 00–04 agree: Claude Code lane vs Grok lanes; OpenCode = Big Pickle / Union Alpha only
- [ ] Cursor Automations still require Amit’s Gate 1 before `agent:ready`

---

## 9. Related docs

- Week-0 factory plan (`software-factory-week0-v2.md` handoff)
- [`docs/TEMPLATE_STATE.md`](./TEMPLATE_STATE.md) — actual vs intended; Graphify paths
- [`docs/HARD_RULES.md`](./HARD_RULES.md) / `AGENTS.md` — product constraints
- [`docs/TECH_STACK.md`](./TECH_STACK.md) — this repo’s observed stack
- [`docs/HOW_TO_ADD_A_FEATURE.md`](./HOW_TO_ADD_A_FEATURE.md) — operator checklist
- [`docs/CI.md`](./CI.md) — blocking jobs
- `GROK-BUILD.md` — Grok Build export notes (sibling handoff)

Last synced: 2026-09-17
