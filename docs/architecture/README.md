# Architecture maps

Standalone Archify diagrams (v3.0.1). Open the `.html` in a browser (standalone, no install).

Mapped from integration @ 5f9cf22443ed7a15881f1214b3b31ac203c82a21

| File | What it shows |
|---|---|
| `system-architecture.json` / `.html` | Tempo Flow runtime: web (Next.js 16 on Vercel), mobile (Expo 54), Convex Auth, Convex functions, Convex data (dev `tremendous-bass-443`, test `ceaseless-dog-617`, prod `precious-wildcat-890`, Amit only), Mistral slots, Polar checkout, RevenueCat webhook. Trust boundary is the Convex security group. |
| `factory-workflow.json` / `.html` | Ticket (`factory-write-tickets`, `factory-promote`) → dispatcher (`factory-dispatch`, gh-aw Copilot, `FACTORY_MODEL_DISPATCH`, routing only) → 3 lanes (`factory-lane-claude`, `factory-lane-cursor`, `factory-lane-codex`) → checks (CI, scope-guard, config-guard, Security) → Bugbot (planned: no workflow file) → ship (GitHub merge queue into `integration`, then Vercel preview and `convex-deploy-test` to `ceaseless-dog-617`). Live deploy is planned (no `deploy-live` workflow). Pause switch and `blocked:amit` after 3 failed fixes are on the failure lane. |

The three build lanes are one node with three source files. A separate box per lane failed the showcase corridor check.

Graph wins over these maps when they disagree.

## Refresh

`.github/workflows/archify.yml` refreshes these files on a push to `integration`: pause-gated, at most once an hour, and the refresh opens a `config` pull request from `config/architecture-refresh`. It does not merge.

Manual run: Actions → Archify → Run workflow. Use `force=true` only when the factory is paused.

`graphify.yml` (pause-gated; `force=true` while paused) and this workflow both run on push to `integration`.

## Finalize receipts

Archify `finalize --quality showcase` (repo evidence on, update check disabled):

- `system-architecture`: exit 0. Gates validate, deliver, check, browser-check: pass. One layout repair removed a mobile/Polar crossing. No update notice.
- `factory-workflow`: exit 0. Gates validate, deliver, check, browser-check: pass. Repair collapsed the lane fan-in and shortened the canvas so the desktop viewport fit. Advisory bend/stretch signal only. No update notice.

Receipt JSON is not committed.
