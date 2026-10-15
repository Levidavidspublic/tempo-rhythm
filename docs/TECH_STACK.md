# TECH_STACK — tempo-rhythm

Last synced: 2026-09-17

Honest stack for **`Division6066/tempo-rhythm`** (Tempo Flow), read from
committed manifests. If a ticket or the README quick-start disagrees with
`package.json` / `convex/` / `apps/*`, **the code wins**.

Documentation lives under [`docs/`](./) only. `tempo-rhythm` has **no GitHub
Wiki tab**.

Related: [`HARNESS.md`](./HARNESS.md) · [`HOW_TO_ADD_A_FEATURE.md`](./HOW_TO_ADD_A_FEATURE.md) · [`TEMPLATE_STATE.md`](./TEMPLATE_STATE.md) · [`HARD_RULES.md`](./HARD_RULES.md)

---

## Mid-tier MODEL rule (factory compute)

Who **writes this repo** (Cursor Cloud / Composer / Squad). Separate from
product inference (Mistral via `convex/lib/ai_router.ts`).

**Allowed:** GPT 5.6 Terra · GLM 5.3 Flash · DeepSeek V4.1 Flash · Claude Sonnet 5 · Grok 4.5 / 4.6  
**Never:** Fable · Astra · Opus · Soul  
**Unused:** Haiku · Luna

Claude in Squad = **Claude Code lane only** (first-party). No Anthropic key in
Squad. Never OpenRouter.

---

## This product

| Field | Observed |
|-------|----------|
| Product | Tempo Flow |
| Repo | `tempo-rhythm` |
| Default agent base | **`integration`** (Amit promotes `integration` → `master`) |
| Package manager | **Bun `1.3.9`** (`packageManager`, `bun.lock`) — README `pnpm` lines are wrong |
| Monorepo | Turborepo `^2.3.3` · workspaces `apps/*`, `packages/*` |
| Lint / format | Biome `2.3.8` only (no ESLint, no Prettier) |
| Graphify | `docs/graphs/tempo-rhythm.json` — **generated** (`graphifyy==0.9.40`, `--no-cluster`; 9870 nodes / 11882 edges) |
| Understand Anything | `.ua/knowledge-graph.json` — **not generated**. Do not invent `.ua/` |

---

## Surfaces (from package.json)

| Surface | Path | Stack (as shipped) |
|---------|------|---------------------|
| Web | `apps/web` (`tempo-rhythm-web`) | Next.js `^16`, React `19.2.3`, App Router, Turbopack, Tailwind CSS **v4** + `@tailwindcss/postcss` |
| Mobile | `apps/mobile` (`tempo-rhythm-mobile`) | Expo `~54`, Expo Router `~6`, React Native `0.81.5`, NativeWind `^4.2` on Tailwind **3.4.x** |
| Backend | `convex/` at repo root | Convex `^1.32.0` — queries, mutations, actions, HTTP, scheduled jobs |
| Auth | `@convex-dev/auth` `^0.0.91` | Convex Auth only |
| Shared | `packages/{types,utils,ui,config}` | Types, helpers, tokens (`packages/ui`), shared Biome |

Web and mobile **intentionally** use different Tailwind majors. Do not downgrade
web to v3 or add a second global utility-CSS framework on web.

---

## Data, auth, payments, product AI

| Concern | Use in this repo | Do not use |
|---------|------------------|------------|
| Database / API | Convex `v.*` + `defineSchema` | Firebase, Supabase, Prisma, Drizzle, TypeORM, `pg` / `mongodb` |
| Auth | Convex Auth | Clerk, Auth0, NextAuth, BetterAuth |
| App state | Convex reactive queries; local React state | Redux, Zustand, Jotai, Recoil, MobX |
| HTTP | Native `fetch` | Axios, ky, got |
| Mobile payments | RevenueCat (`react-native-purchases`) | Direct Stripe SDK |
| Web checkout | Polar (`@polar-sh/nextjs`) — align with PRD over time | Client-side Stripe secrets |
| Product LLM | Mistral API via native `fetch` in Convex actions (`convex/lib/ai_router.ts`) | `openai`, `@anthropic-ai/*`, `@google/generative-ai`, `@mistralai/mistralai`, OpenRouter |

Product model tiers (HARD_RULES §6): `fast` → `mistral-small-latest`,
`balanced` → `mistral-medium-latest`, `deep` → `mistral-large-latest`. Every
AI-originated write is a **proposal** (accept / edit / reject).

---

## Context tooling

- Graphify CLI: `graphifyy==0.9.40` — regenerate on merge; never invent graphs
- Understand Anything: skill installed; `.ua/knowledge-graph.json` only via real `/understand`
- OpenCode (Squad Computer): Zen free **Big Pickle** / **Union Alpha** only; not via OpenRouter

---

## Bolt

Bolt Forge shells are **reference specs only** (bolt-01…03). Not product
prototypes for `tempo-rhythm`. Do not vendor a Bolt / Lovable / v0 / Replit
shell into this monorepo.

---

## Quality gates

Root scripts (see [`CI.md`](./CI.md)):

```bash
bun run typecheck
bun run lint
bun run test
bun run scan:forbidden-tech
bun run scan:ram-only-audit
bun run scan:design-tokens
bun run check:notices
```

There is no `convex:schema-guard` script in root `package.json` today.

This file names **products**, not credentials. Never paste ENV values.
