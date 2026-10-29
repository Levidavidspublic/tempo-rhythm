# Tempo Flow (tempo-rhythm) — Tech stack

> Draft from the repo's `integration` branch on 29 Oct 2026 (Factory Worker 2). Facts come from the files named here. Anything not confirmed in the repo is marked UNKNOWN. Older docs (`docs/TRD.md`) are cited where the code agrees with them.

| Layer | Choice | Source |
|---|---|---|
| Package manager | Bun 1.3.9 workspaces | root `package.json` packageManager |
| Monorepo | Turborepo ^2.3.3 | root `package.json` |
| Backend | Convex ^1.32.0, convex-helpers 0.1.104 | root `package.json` |
| Auth | @convex-dev/auth ^0.0.91, @auth/core 0.37.4 (Resend magic link) | `convex/auth.ts` |
| AI | ai 5.0.82, @ai-sdk/provider-utils 3.0.14, @convex-dev/agent 0.3.2 | root `package.json` |
| Validation | zod 4.3.6 | root `package.json` |
| Web | Next.js, React, Tailwind v4 (@tailwindcss/postcss), Radix primitives, CodeMirror 6 + Lezer markdown, react-markdown + remark-gfm, lucide-react | `apps/web/package.json` |
| Web payments | @polar-sh/nextjs | `apps/web/package.json` |
| Blocks | @json-render/core, @json-render/react | `packages/ui/package.json` |
| Mobile | Expo, expo-router, React Native, NativeWind, Reanimated, react-native-purchases (RevenueCat) | `apps/mobile/package.json` |
| Lint/format | Biome 2.3.8, ultracite | package.json files |
| Tests | `bun test`, convex-test 0.0.38, Playwright ^1.61.1 | root `package.json`, `playwright.config.ts` |
| Hosting | Vercel (web), Convex cloud (backend) | `docs/TRD.md` §2 |

## Notes
- TRD §1 mentions AI SDK 6 `ToolLoopAgent`; the installed `ai` is 5.0.82. Which is current: UNKNOWN.
- TRD lists `@ai-sdk/deepinfra` and `@convex-dev/rag`; neither is in the root `package.json`. UNKNOWN whether planned or removed.
- Exact Next.js / Expo versions: see `apps/*/package.json` (not restated).
