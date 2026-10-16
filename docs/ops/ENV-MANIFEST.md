# Environment manifest

Generated 2026-10-16. Names only, never values. All items live in the 1Password **dev** vault.
PRODUCTION: an agent deploys to production only when its own prompt says "DEPLOY TO PRODUCTION".

| variable | environment | service | where it's set | 1Password item name | who may set it |
|---|---|---|---|---|---|
| CONVEX_DEPLOY_KEY | preview | Convex (preview deploy key, project `tempo`) | Vercel project `tempo-web` → Preview | Convex — tempo-rhythm — CONVEX_DEPLOY_KEY (preview) | Amit / setup agent; builds read it |
| CONVEX_DEPLOY_KEY | production | Convex prod `precious-wildcat-890` | Vercel project `tempo-web` → Production | Convex — tempo-rhythm — CONVEX_DEPLOY_KEY (production) | Amit only; an agent only when its prompt says DEPLOY TO PRODUCTION |
| VERCEL_TOKEN | all | Vercel (team amit-levins-projects) | agent shell env only | Vercel — VERCEL_TOKEN (agents) | any agent (preview); production only with DEPLOY TO PRODUCTION |
| CLAUDE_CODE_OAUTH_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| CODEX_MENTION_PAT | CI | GitHub Actions | repo secret (set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| CONVEX_DEPLOY_KEY_LIVE | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| CONVEX_DEPLOY_KEY_TEST | CI | GitHub Actions | repo secret (set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| COPILOT_GITHUB_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| CURSOR_API_KEY | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| DISPATCH_PAT | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| FACTORY_APP_ID | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| FACTORY_APP_PRIVATE_KEY | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| FACTORY_BATCH_TOKEN | CI | GitHub Actions | repo secret (set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| GH_AW_CI_TRIGGER_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| GH_AW_DEFAULT_OTLP_ENDPOINT | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| GH_AW_DEFAULT_OTLP_HEADERS | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| GH_AW_GITHUB_MCP_SERVER_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| GH_AW_GITHUB_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| VERCEL_AUTOMATION_BYPASS_SECRET | CI | GitHub Actions | repo secret (set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| VERCEL_ORG_ID | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| VERCEL_PROJECT_ID | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |
| VERCEL_TOKEN | CI | GitHub Actions | repo secret (NOT set) | UNKNOWN (no matching dev-vault item checked) | Amit |

> Gap: the Vercel build command does not run `npx convex deploy --cmd "<build>"` yet, so builds do not deploy Convex with the app until that code change lands (docs.convex.dev/production/hosting/vercel). Production builds are also skipped by the Ignored Build Step set on 2026-10-15 (kitchen repos).

## How an agent sets a variable (value on STDIN only)

Item titles contain an em dash, which `op read "op://…"` rejects ("invalid character in secret reference"). So read by exact title with `op item get … --reveal` and pipe straight into the CLI. Never echo, log or paste the value.

| Service | Command (documented stdin form) | Source |
|---|---|---|
| Convex (dev) | `op item get "<repo> — CONVEX_DEPLOY_KEY (dev)" --vault dev --fields label=credential --reveal` is exported as `CONVEX_DEPLOY_KEY`, then `op item get "<ITEM>" --vault dev --fields label=credential --reveal \| npx convex env set NAME` | docs.convex.dev/cli ("pass the value via stdin") |
| Convex (prod) | same as above plus `--prod`, only when the prompt says DEPLOY TO PRODUCTION | docs.convex.dev/cli |
| Vercel Preview | `op item get "<ITEM>" --vault dev --fields label=credential --reveal \| vercel env add NAME preview "" --yes --scope amit-levins-projects` (token from `VERCEL_TOKEN` env, item "Vercel — VERCEL_TOKEN (agents)") | vercel.com/docs/cli/env (`vercel env add [name] [environment] < [file]`) |
| Vercel Production | same with `production`, only when the prompt says DEPLOY TO PRODUCTION | vercel.com/docs/cli/env |
| Railway | `op item get "<ITEM>" --vault dev --fields label=credential --reveal \| railway variable set NAME --stdin` with `RAILWAY_TOKEN` from "Railway — agentwright — RAILWAY_TOKEN" | docs.railway.com/cli/variable ("Set variable from stdin") |
| `op inject` / `op run` | UNKNOWN for these items: they need `op://` references and em-dash titles are rejected. Use the item ID instead of the title if needed. | developer.1password.com/docs/cli |

Read back names only: `vercel env ls preview`, `npx convex env list --names-only`.
NOT documented (argument-only, value would land in argv/history): `npx convex env set NAME VALUE`, `vercel env add … --value`, `railway variable --set KEY=VALUE`. Do not use them.
