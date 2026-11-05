# Tech stack

Versions are copied from package.json on `integration` at `5504fc40`. They are not remembered from an older doc.

## Why this stack

Amit decided on 2026-10-18 to stay on the current cross-platform stack. No Kotlin plus Swift rewrite. On 2026-09-20 he kept Bun and banned pnpm for Tempo, and banned Electron. The Sep 2026 factory notes that talk about moving Tempo onto a pnpm template are history.

## Root `package.json`

| Name | Version |
|---|---|
| Package | `tempo-rhythm` 0.1.0 |
| Package manager | `bun@1.3.9` |
| Workspaces | `apps/*`, `packages/*` |
| `convex` | `^1.32.0` |
| `@convex-dev/auth` | `^0.0.91` |
| `@convex-dev/agent` | `0.3.2` |
| `ai` | `5.0.82` |
| `@ai-sdk/provider-utils` | `3.0.14` |
| `@auth/core` | `0.37.4` |
| `zod` | `4.3.6` |
| `convex-helpers` | `0.1.104` |
| `@biomejs/biome` | `2.3.8` |
| `turbo` | `^2.3.3` |
| `@playwright/test` | `^1.61.1` |
| `convex-test` | `0.0.38` |
| `@types/node` | `^20.19.0` |

Task runner: Turborepo. Scripts include `dev`, `dev:web`, `dev:mobile`, `build`, `typecheck`, `lint`, `test`, `scan:forbidden-tech`, `scan:ram-only-audit`.

## `apps/web/package.json` (`tempo-rhythm-web` 0.1.0)

| Name | Version |
|---|---|
| `next` | `^16.0.0` (App Router, Turbopack in the dev and build scripts) |
| `react` / `react-dom` | `19.2.3` |
| `tailwindcss` | `^4.1.18` |
| `@tailwindcss/postcss` | `^4.1.18` |
| CodeMirror packages | `@codemirror/view` `6.43.13`, `@codemirror/state` `6.7.6`, `@codemirror/lang-markdown` `6.5.2`, `@codemirror/language` `6.12.4`, `@codemirror/commands` `6.11.1` |
| `@lezer/markdown` | `1.7.2` |
| `react-markdown` | `10.1.0` |
| `remark-gfm` | `4.0.1` |
| `@openuidev/react-lang` | `1.0.1` |
| `@polar-sh/nextjs` | `^0.9.1` |
| `typescript` | `^5.9.3` |
| `ultracite` | `6.3.10` |

Polar is installed. The product target is Whop and Paddle. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

## `apps/mobile/package.json` (`tempo-rhythm-mobile` 1.0.0)

| Name | Version |
|---|---|
| `expo` | `~54.0.9` |
| `expo-router` | `~6.0.19` |
| `react` | `19.1.0` |
| `react-native` | `0.81.5` |
| `nativewind` | `^4.2.1` |
| `tailwindcss` | `^3.4.19` |
| `react-native-purchases` | `^9.6.10` |

RevenueCat's client is installed. It is not the product payment target.

## Shared packages

`packages/ui`, `packages/utils`, `packages/types`, `packages/config`. The UI kit is [KIT.md](./KIT.md).

## Product models (not all installed as npm packages)

| Role | Choice | Source |
|---|---|---|
| Runtime text | GLM 5.3 Flash | Amit, 2026-10-21 |
| Tagging | Qwen 8B | Amit, 2026-10-21 |
| Crisis classifier | gpt-oss-safeguard 20B | Amit, 2026-10-21 |
| Hard voice prompts | GLM Flash and DeepSeek | Amit, 2026-11-05 |
| Listening | Deepgram, until a side-by-side test says otherwise | 2026-10-16. A 29 Oct question asked whether to switch listening to DeepInfra. That switch is not decided. |
| Bring-your-own voice | A provider by name plus key or OAuth | 2026-10-16 |

`docs/HARD_RULES.md` section 6.1 still routes every LLM call to Mistral through `convex/lib/ai_router.ts`. `.env.example` still names `MISTRAL_API_KEY`. That is the code today. The product target is GLM 5.3 Flash. The router change is a later ticket.

Vercel project name recorded in memory: `tempo-web`. Domain recorded in memory: `tempoflow.dev`. Both are Basic Memory 2026-10-01 and 2026-10-22, not re-checked against the Vercel account in this job.

## Sources

`package.json`, `apps/web/package.json`, `apps/mobile/package.json` at `5504fc40`. Amit's model and payment decisions in [PRD.md](./PRD.md).
