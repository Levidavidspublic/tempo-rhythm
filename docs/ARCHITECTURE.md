# Tempo Flow (tempo-rhythm) — Architecture

> Draft from the repo's `integration` branch on 29 Oct 2026 (Factory Worker 2). Facts come from the files named here. Anything not confirmed in the repo is marked UNKNOWN. Older docs (`docs/TRD.md`) are cited where the code agrees with them.

## Shape
- Bun workspaces + Turborepo monorepo (`package.json`, `turbo.json`).
- `apps/web` — Next.js App Router web app (`tempo-rhythm-web`). Route groups in `apps/web/app`: `(app)`, `(auth)`, `(bare)`, `(tempo)`, plus `api`, `checkout`, `settings`, `sign-in`, `sign-up`, `v3` and static pages.
- `apps/mobile` — Expo Router + NativeWind app (`tempo-rhythm-mobile`), RevenueCat (`react-native-purchases`).
- `packages/ui` (`@tempo/ui`, json-render + zod), `packages/utils`, `packages/types`, `packages/config`.
- `convex/` — the only backend (`convex.json` → `functions: convex/`). No `packages/core` (TRD §1).

## Backend (Convex)
- Auth: Convex Auth with the Auth.js Resend provider, magic link only (`convex/auth.ts`).
- One component registered: `@convex-dev/agent` 0.3.2 (`convex/convex.config.ts`).
- AI routing in `convex/lib/ai_router.ts`; DeepInfra referenced there and in `convex/voice.ts`. Exact model list: see code; not restated here.
- HTTP endpoints: `convex/http.ts`, `convex/mcpHttp.ts` (MCP server), `convex/connectionsHttp.ts` (connectors/OAuth).
- Scheduled jobs: `convex/crons.ts`.
- Tables in `convex/schema.ts`: users, subscriptionStates, conversations, messages, voiceSessions, chatRequests, memories, tasks, taskRepeatCfgs, calendarEvents, focusBlocks, notes, noteBlocks, pageOperations, pageOperationPayloads, pageProposals, habits, goals, dayPlans, timeBlocks, habitCheckIns, templates, userPreferences, coachWebSearches, nags, coachSettings, coachProposals, notifications, mcpTokens, connections, connectionLimits, connectionSecrets, oauthClients, oauthPending, connectionCalls.
- Fuller schema notes: `docs/BACKEND-SCHEMA.md`.

## Environments (TRD §2)
| | dev | preview | live |
|---|---|---|---|
| Convex | tremendous-bass-443 | ceaseless-dog-617 | precious-wildcat-890 |
| Vercel | — | preview.tempoflow.dev | www.tempoflow.dev |
| Branch | — | integration | master |
- Agents merge to `integration`. Only Amit deploys live (`deploy-live.yml`, `release*.yml`).

## Factory / CI
- `.github/workflows/`: ci, security, scope-guard, config-guard, e2e-preview, preview-acceptance, convex-deploy-test, graphify, archify, plus factory-* lanes (claude, codex, cursor), merge, promote, nightly, quiet-hours, weekly-report.
- Diagrams: `docs/architecture/system-architecture.html`, `factory-workflow.html`.
- Knowledge graph: `docs/graph/` (README only on integration; graph.json + GRAPH_REPORT.md live on branch `graphify/v5-tempo-rhythm`).

## UNKNOWN
- Whether the template layout (`packages/core`) will be adopted (TRD says UNKNOWN).
- Current live deploy state.
