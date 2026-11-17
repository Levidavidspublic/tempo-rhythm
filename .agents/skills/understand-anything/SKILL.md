---
name: understand-anything
description: >-
  use this when regenerating or querying the Understand Anything knowledge
  graph for this repo (architecture map, dashboard, onboard guide)
---

# Understand Anything (project)

Upstream: https://github.com/Egonex-AI/Understand-Anything (MIT).
The pinned source and runtime are named in `code-map-tools.json`. Do not assume an account-level plugin is installed. Codex may already provide the official plugin; use its reported skill location. Cursor plugin discovery must be verified in that environment before claiming it works.

## Repository runtime

Run `scripts/code-map/setup.ps1` with PowerShell to install/build the official pinned core into the ignored `.code-map-tools/` directory. This does not change user-profile links or open a dashboard. Run `scripts/code-map/refresh.ps1` at the start of a loop for the local Graphify AST graph and the official deterministic Understand-Anything inventory/import map. Preserve `.understand-anything/intermediate/` in `.gitignore`.

The deterministic inventory/import map is not the full semantic knowledge graph. For that graph, follow the official `understand` skill from the installed plugin or `.code-map-tools/understand-anything/understand-anything-plugin/skills/understand/SKILL.md` using the current subscription agent. Do not run paid model inference, a dashboard, commit hooks or a user-profile installer under this configuration task. Keep output in this isolated worktree; do not redirect into another worker's checkout.

## Artefact

Committed dashboard graph (when present):

`.ua/knowledge-graph.json`

Also mirror a copy under `docs/graphs/` only if `docs/TEMPLATE_STATE.md` names that path.

## Regenerate (local / agent machine)

1. Verify the official plugin or repo-local runtime above is present.
2. From repo root, run the official `understand` skill against this project through the subscription agent (Codex uses `$understand`). Do not open a dashboard.
3. Confirm `.ua/knowledge-graph.json` exists.
4. Update `docs/TEMPLATE_STATE.md` Knowledge graph table: set Actual path + status **generated**.
5. Open a **draft** PR. Do not merge.

## Regenerate on merge

After any merge that changes source layout, regenerate this graph and the Graphify graph in the same PR follow-up (or the next W0/S8 pass). Ticket CONTEXT fields should point at the live paths in `docs/TEMPLATE_STATE.md`.

## Constraints

- No secrets in the graph or PR.
- Do not fetch unrelated corpora.
- Graphify structural facts win over semantic guesses when they disagree.
