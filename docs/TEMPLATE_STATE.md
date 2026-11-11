# Template state — knowledge graph

Registry of committed vs live knowledge-graph artefacts for this repo.
Update this file in the same PR that regenerates a graph.

Generated: 2026-09-17  
Graphify CLI: `graphifyy==0.9.74` (`graphify update . --no-cluster`)  
Graphify snapshot: **9870 nodes**, **11882 edges** (committed 2026-09-17; not regenerated here)

## Knowledge graph

| Item | Path | Status |
|---|---|---|
| Graphify artefact | `docs/graphs/tempo-rhythm.json` | generated |
| Graphify live graph | `graphify-out/graph.json` | generated locally (gitignored) |
| Graphify CI artifact | Actions artifact `graphify-graph` | rebuilt on every push to `integration` by `.github/workflows/graphify.yml` (`graphifyy==0.9.74`, kept 14 days, not committed) |
| Understand Anything | `.ua/knowledge-graph.json` | not generated |
| Skills | `.agents/skills/graphify`, `.agents/skills/understand-anything` | present |

## What each path is

- **`docs/graphs/tempo-rhythm.json`** — durable, committed snapshot of the Graphify AST graph. Absolute machine paths (`/workspace/...`) are stripped to repo-relative paths. Rebuild after merge; a stale snapshot is a hint, not ground truth.
- **`graphify-out/graph.json`** — live graph. Gitignored. Rebuild on demand (`~8s`, deterministic AST, no API key). This is the file `graphify query` / `explain` / `affected` read. CI uploads the same file as the Actions artifact `graphify-graph` (`.github/workflows/graphify.yml`, `graphifyy==0.9.74`, retention 14 days). It is not committed.
- **Actions artifact `graphify-graph`** — the CI copy of `graphify-out/graph.json` from the latest push to `integration`.
- **`.ua/knowledge-graph.json`** — Understand Anything semantic dashboard graph. **Not generated** in W0: the Cursor plugin `understand-anything` / `/understand` writes it. Do not invent this file.

## Regenerate on merge

After any merge that changes source layout (or the next W0 / S8 pass):

1. From repo root, no LLM and no secrets:

   ```bash
   pip install 'graphifyy==0.9.74'   # package name is graphifyy (double-y)
   graphify update . --no-cluster
   ```

2. Copy `graphify-out/graph.json` → `docs/graphs/tempo-rhythm.json`. Strip absolute machine paths. If the file exceeds ~15 MB, commit a compact summary (node/edge counts + sha of the full graph) instead and note that the full live graph is `graphify-out/graph.json`.

3. Run `/understand` (Cursor plugin **understand-anything**) to write `.ua/knowledge-graph.json`. Do **not** invent semantic graph content.

4. Update the table in this file (paths + status + node/edge counts).

5. Open a **draft** PR. Do not merge from a code agent.

## Commit hook

`graphify hook install` is **not** enabled on this repo. Parallel agents commit frequently; a local post-commit rebuild is not checked in and would surprise other sessions. Use the regenerate-on-merge steps above. See `.agents/skills/graphify/references/hooks.md`.

## Graphify snapshot notes

- First W0 build processed 972 code files.
- 17 sources produced zero nodes (mostly `metadata.json` / settings JSON). Listed under `failed_sources` with repo-relative paths.
- Clustering was skipped (`--no-cluster`) so the snapshot is deterministic AST only.
- `graphify-out/` stays gitignored. AGENTS.md is correct that the live graph must be rebuilt; this committed file is a portable snapshot for agents who cannot run Graphify yet.

## Block A verify — 2026-09-17

Factory pack (docs only; no product feature code). Wiki surface is `docs/` —
`tempo-rhythm` has no GitHub Wiki tab.

| Doc | Path | Status |
|---|---|---|
| Tech stack | [`docs/TECH_STACK.md`](./TECH_STACK.md) | adapted to this repo from factory shared draft |
| How to add a feature | [`docs/HOW_TO_ADD_A_FEATURE.md`](./HOW_TO_ADD_A_FEATURE.md) | canonical (repo notes: `integration`, no `.ua/`) |
| Harness | [`docs/HARNESS.md`](./HARNESS.md) | canonical factory HARNESS, landed here |

Graph registry re-checked the same day (no regenerate, no invented `.ua/`):

- Graphify snapshot `docs/graphs/tempo-rhythm.json`: **generated** — **9870 nodes**, **11882 edges**, `graphifyy==0.9.40`, `--no-cluster`.
- Understand Anything `.ua/knowledge-graph.json`: **not generated**. `.ua/` is absent. Do not invent it.
- Skills `.agents/skills/graphify` and `.agents/skills/understand-anything`: present.
- Live `graphify-out/` was absent in this verify session (gitignored; rebuild on demand).

Constraints honored this pass: no secrets / ENV values; no `agent:ready` label
applied by the agent; no product feature code; mid-tier MODEL allowlist only
(GPT 5.6 Terra, GLM 5.3 Flash, DeepSeek V4.1 Flash, Claude Sonnet 5, Grok
4.5/4.6 — never Fable/Astra/Opus/Soul); Bolt Forge shells (bolt-01…03) are
reference specs only.

Draft PR only. Do not merge from a code agent.

## Verify 2026-09-17

Last synced: 2026-09-17 (Scout Orchestrator Block A verify, merged into this file)

Scout sampled GitHub / dashboard **names only**. This draft PR also lands
`docs/TECH_STACK.md`, `docs/HOW_TO_ADD_A_FEATURE.md`, and `docs/HARNESS.md`
(see Block A verify above). Scout’s “factory set absent on GitHub” line is
kept as the pre-PR observation.

### Identity

| Field | Value |
|---|---|
| Repo | `Division6066/tempo-rhythm` |
| Visibility | public |
| Default branch | `integration` |
| Wiki tab | **OFF** (`has_wiki=false`) — docs/ only |
| Homepage | `https://tempo-web-delta.vercel.app` (name/URL from API + dashboard report) |

### Graphify / Understand Anything (truth)

| Item | Path | Status |
|---|---|---|
| Skills | `.agents/skills/graphify`, `.agents/skills/understand-anything` | present |
| Graphify artefact | `docs/graphs/tempo-rhythm.json` | **generated** (PR **#395**; this file: 9870 nodes / 11882 edges) |
| Understand Anything | `.ua/knowledge-graph.json` | **not generated** — do not invent |
| taste-skill | — | **not installed** |

### CI (known)

| Item | Value |
|---|---|
| Workflows | `ci.yml`, `security.yml`, `claude.yml`, `agent-router.yml`, `auto-arm-merge.yml`, … |
| Tip sample | Security secret-scan jobs **success** after W0 push |
| Full tip CI green | **UNKNOWN** (not fully re-run sampled) |

### `.cursor/` (observed — not Session B spine)

Present: tempo-* rules/agents/commands, `hooks.json`, `environment.json`.  
**Missing** factory spine files: `template.mdc`, `backend.mdc`, `shell.mdc`, `ticket.mdc`, `/graft` `/reshell` `/prove`, builder·prover·janitor agents.

### Bolt

No Bolt prototypes as product code. Forge pack `/workspace/scout-bolt/forge-packs/tempo/` is **reference spec only**.

### Grok Build

Export path **UNKNOWN / needs-amit** (not Tempo’s primary V0 path).

### Dashboard names only (not touched)

| Kind | Name |
|---|---|
| Vercel project | `tempo-web` |
| Convex | existing team project `tempo` (not re-provisioned in dashboard report) |
| ENV names (matrix) | names only (e.g. `DEEPINFRA_API_KEY`, RevenueCat / Polar / PostHog) — values never recorded here |

### Docs gap vs W4

Present: `AGENTS.md`, `docs/HARD_RULES.md`, `docs/TEMPLATE_STATE.md`, rich ops docs (CI, CURSOR_*, ENVIRONMENTS, …).  
**Missing factory set:** docs/VISION, ROADMAP, PROVIDERS, BILLING, CONFORMANCE, UNKNOWNS, LEDGER.  
TECH_STACK / HOW_TO_ADD / HARNESS: **absent on GitHub at Scout sample**; **present on this draft PR**.  
Issue template: **absent** (no `.github/ISSUE_TEMPLATE/`).

### Tickets (W5 echo)

- Legacy TF-* / OSS tickets still open; open_issues_count **116** (includes PRs)
- PRD §10 GOAL tickets / MT-STOP: **not found**
- #337 / #338 / #345 still **open** (Week-0 plan: close)
- Open PRs still many (incl. **#327** Integration → master)
- `agent:ready`: **0** (this pass did not apply that label)

### Gaps

- W4 factory docs; W5 rewrite; W1 spine alignment; UA graph; ticket hygiene

