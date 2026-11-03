# Archify refresh (run by .github/workflows/archify.yml)

You keep `docs/architecture/` current. Two maps, each = typed JSON source + rendered standalone HTML:

| File | Archify type | Shows |
|---|---|---|
| `docs/architecture/system-architecture.json` / `.html` | architecture | Tempo Flow runtime: apps (web, mobile), Convex backend (dev / test ceaseless-dog-617 / prod), auth, AI providers, Vercel previews, external services, trust boundaries |
| `docs/architecture/factory-workflow.json` / `.html` | workflow | ticket → dispatcher (gh-aw, Copilot) → 3 lanes (Claude / Cursor / Codex) → checks (CI, scope-guard, config-guard, security) → Bugbot review → merge (GitHub merge queue into integration) → preview (Vercel + Convex test) → one-click deploy to live (Amit only) |

`docs/architecture/README.md` holds the line `Mapped from integration @ <full sha>`.

Steps:
1. `git log --oneline <mapped sha>..origin/integration` and `git diff --stat <mapped sha>..origin/integration`. Read only files that could change a fact on either map (new app/service/provider, Convex deployment wiring, .github/workflows/factory-*, scripts/factory/*, deploy workflows). Do not re-read the whole repo.
2. If no map fact changed: change nothing, push nothing, stop and say "maps current".
3. If something changed: `git fetch origin integration && git checkout -B config/architecture-refresh origin/integration`. Edit only the affected JSON. Follow .archify-skill/archify/SKILL.md (fast authoring path; `meta.quality_profile` "showcase"; set `meta.output` to the HTML file name). Then for each changed map run
   `node .archify-skill/archify/bin/archify.mjs finalize <type> docs/architecture/<name>.json docs/architecture/<name>.html --quality showcase --json`
   Repair at most 2 rounds per the skill. A non-zero exit is failure. If only browser-check reports `skipped` (no Chrome), say so; that is not a pass.
4. Update the mapped sha in README.md to `git rev-parse origin/integration`.
5. Commit only `docs/architecture/**` (never `.archify-skill/`, never finalize scratch folders outside docs/architecture). Message: `docs(architecture): refresh maps @ <short sha>`.
6. `git push --force-with-lease origin config/architecture-refresh`. If an open PR from that branch exists (`gh pr list --head config/architecture-refresh`), it updates; else `gh pr create --base integration --head config/architecture-refresh --label config --title "docs(architecture): refresh maps" --body "<what changed, finalize receipts summary>"`.
7. Never merge. Never touch master/main. Never print secrets. Facts you cannot verify from the code: write them as "UNKNOWN" in the node detail, do not guess.
