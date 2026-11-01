# Environment Contract

This document defines the four-mode environment model for Tempo Flow. Every agent, contributor, and tool that touches an env var, Convex deployment, or Vercel project must read this first. Where this file and any other doc disagree, this file wins. See also HARD_RULES §13.

## Internal-testing tier (preview)

- **Preview pairing:** https://preview.tempoflow.dev (branch integration) → ceaseless-dog-617
- `SITE_URL` on `ceaseless-dog-617` = https://preview.tempoflow.dev.
- Vercel Preview `NEXT_PUBLIC_CONVEX_URL` = `https://ceaseless-dog-617.eu-west-1.convex.cloud` (test deployment `ceaseless-dog-617`).
- Only `preview.tempoflow.dev` is excepted from Vercel protection. Other preview URLs still ask for the Vercel login.

Never point preview at prod `precious-wildcat-890`. Only Amit deploys to live.

---

## The four modes

| Mode | Purpose | Convex | Vercel | Repo env file | Trust gate |
|---|---|---|---|---|---|
| **Dev** | Coding, immediate local testing | `dev:<your-slug>` (auto via `bun x convex dev`) | N/A (`next dev` locally) | `.env.local` (git-ignored) | May break at any time. Not a QA surface. |
| **Test** | Prove behavior | Test deployment `ceaseless-dog-617` | Local `next build` + CI | `.env.local` + CI env | CI green + local smoke pass. Not a shareable URL. |
| **Preview** | Branch / PR validation | Test deployment `ceaseless-dog-617` | `integration` preview at https://preview.tempoflow.dev | Vercel env table (preview scope) | Agents MUST NOT treat preview as shipped. |
| **Deployment** | Promoted stable surface | `prod:<slug>` | Production domain | Vercel env table (production scope) + Convex dashboard env | Only code that passed preview + explicit human promote. |

---

## Convex: deployments

- **`dev`** — local only: each machine gets its own `dev:*` slug via `bun x convex dev`. The older `dev:tremendous-bass-443` is not used by the preview.
- **`test`** — `ceaseless-dog-617` (`https://ceaseless-dog-617.eu-west-1.convex.cloud`). This is the test deployment used by the `integration` preview. It is not a separate staging tier. There is no separate `preview:*` Convex deployment.
- **`prod`** — current production deployment: `prod:precious-wildcat-890` (`https://precious-wildcat-890.eu-west-1.convex.cloud`).

Rule: no agent provisions Convex deployments without an explicit human choice of
team/project. Agents may inspect an existing deployment with an explicit deployment
name on a CLI version that supports it, but must not create, relink, or promote
deployments silently.

Known local CLI state on 2026-06-02:

- The repo-pinned Convex CLI is `1.32.0`; `bunx convex function-spec` fails until `CONVEX_DEPLOYMENT` is set or `bun x convex dev` configures a local dev deployment.
- `npx convex@1.39.1 function-spec --deployment-name=precious-wildcat-890` can inspect the production deployment without writing repo config.
- Before configuring local dev, choose whether this machine should attach to the existing `dev:tremendous-bass-443` project or create a fresh personal `dev:*` deployment.

---

## Vercel: preview and production

- Preview builds of `integration` serve https://preview.tempoflow.dev and use Convex test `ceaseless-dog-617` (see the preview pairing above).
- Production serves https://www.tempoflow.dev from `master` and uses Convex prod `precious-wildcat-890`. Only Amit promotes to production.

---

## Env var precedence

```
.env.local  (per-workspace, git-ignored)      # highest precedence locally
apps/web/.env.local   > root .env.local        # for web-app scope
apps/mobile/.env.local > root .env.local       # for mobile-app scope
Vercel env vars (production/preview scope)     # deployed web only
Convex dashboard env vars                       # convex/ runtime only
EAS secrets                                     # mobile builds only
.env.example                                    # NEVER a source of values — only names
```

Negative rule: do not create or read `apps/web/.env` or `apps/mobile/.env`. Use `.env.local` only. The root `.gitignore` explicitly ignores `apps/web/.env` and `apps/mobile/.env`.

### Key names and where secrets come from (Amit, 2 Oct 2026)

- Sign-in is **magic link only**. The Convex Auth Resend provider reads `AUTH_RESEND_KEY` (Convex Auth default). Older docs that say `RESEND_API_KEY` are out of date.
- Secrets rule (Amit, 2 Oct 2026): secrets come only from the 1Password `dev` vault, through a service account. Never print, log, echo, screenshot or paste a value (chat, ticket, PR, commit, workflow log, report); names only. Never click reveal/show on masked fields. Save a generated secret to 1Password `dev` before setting it. Convex: never run `convex env list`; use `bun x convex env get <NAME>` only for non-secret values (URLs, numbers, emails).
- The internal-testing preview is the `integration` branch. There is no `preview` branch.

---

## Scope tags reference

| Tag | What lives there | Who can edit | How it reaches the process |
|---|---|---|---|
| `[local]` | Developer secrets on one machine only | The developer on that machine | Shell env / `.env.local` loaded by Next.js / Convex CLI |
| `[convex dashboard]` | Runtime secrets for Convex functions | human-amit (dashboard owner) | Convex injects at function invocation |
| `[vercel production]` | Secrets for production Next.js builds and RSC routes | human-amit (Vercel project owner) | Vercel injects at build and edge runtime |
| `[vercel preview]` | Secrets for Vercel Preview builds (branch `integration` and PR branches; there is no `preview` branch) | human-amit (Vercel project owner) | Vercel injects at preview build. Live: Preview builds of `integration` serve https://preview.tempoflow.dev (public via the protection exception) |
| `[EAS secrets]` | Mobile build secrets | human-amit (EAS project owner) | EAS injects during `eas build` |

---

## What is NOT decided yet

- **Convex local dev attachment.** Choose existing `dev:tremendous-bass-443` vs a new personal `dev:*` deployment before running an interactive `bun x convex dev` configuration.
- **EAS project identity.** Resolved on 2026-06-04: `apps/mobile/app.json` points at the accessible Expo/EAS project `@amitlevin/tempi` with project ID `90dfac90-0baa-461b-946c-351d2306e607`. The `tempi` slug is the existing Tempo Rhythm Expo project name; app display name, bundle identifier, Android package, and URL scheme remain Tempo Rhythm / `com.temporhythm.app` / `tempo-rhythm`.

---

## Related

- [docs/HARD_RULES.md](./HARD_RULES.md) — §13 (secrets and env vars) and §13.5 (ship state)
- [docs/SHIP_STATE.md](./SHIP_STATE.md) — one-table source of truth for what is shipped vs planned
- [docs/LOCAL_DEV_WINDOWS.md](./LOCAL_DEV_WINDOWS.md) — local setup guide
- [docs/brain/TASKS.md](./brain/TASKS.md) — master task list (T-0008, T-0020, T-R006, T-R007)
