# Architecture

## Verdict

The browser and the phone talk to Convex. Convex holds the data, the auth, and the coach actions. The web app is Next.js on Vercel. The phone app is Expo. Models and voice providers sit behind Convex actions. Executor is the connector hub. Payments are Whop and Paddle in the product target. The installed clients are still Polar and RevenueCat.

## Diagram

```
Person
  |  magic link (Resend)          voice (Deepgram now; Hebrew voice-to-voice target)
  v
+-------------------+         +----------------------+
| apps/web          |         | apps/mobile          |
| Next.js 16        |         | Expo SDK 54          |
| Vercel tempo-web  |         | EAS (store later)    |
+---------+---------+         +----------+-----------+
          |  Convex client               |
          v                              v
+----------------------------------------------------+
| convex/                                            |
|  Auth (magic link)                                 |
|  queries / mutations / actions / HTTP / crons      |
|  schema.ts tables (see BACKEND-SCHEMA.md)          |
|  ai_router.ts  -->  GLM 5.3 Flash target           |
|                    code today still names Mistral  |
|  crisis path   -->  gpt-oss-safeguard 20B          |
|  connections   -->  Executor (MCP), not Composio   |
+--------+------------------+------------------------+
         |                  |
         v                  v
   Whop and Paddle     Deepgram / rented GPU voice
   (target)            Qwen 8B for tagging
   Polar + RevenueCat
   (installed)
```

Reason, Cursor, and Codex on the Railway box are how the product is built and configured. They are not a runtime the person uses inside the planner. See [CONFIG-PLAN.md](./CONFIG-PLAN.md).

## Parts

| Part | Path | Role |
|---|---|---|
| Web | `apps/web` | The planner, chat, notes, settings |
| Mobile | `apps/mobile` | Expo shell. Not the MVP exit by itself |
| Backend | `convex/` | Data, auth, coach, connections, crons |
| UI kit | `packages/ui` | Shared primitives and tokens |
| Utils | `packages/utils` | Shared helpers, including blocks and wiki links |
| Types | `packages/types` | Shared types |
| Product docs | `docs/product/` | This folder |

## How a day page is saved

The person edits markdown. The page body is the authority (`notes.body`, decision recorded 2026-10-12). json-render reads blocks inside that markdown and draws them. `noteBlocks` is a derived index. It can be rebuilt. The person does not see JSON.

## How the coach changes something

The coach proposes. The screen shows Accept, Edit, and Reject. Only then does the mutation run. High-stakes changes always ask, including deletions and payments (`docs/HARD_RULES.md` section 6.3). The clash with auto-apply at confidence 0.8 or higher is open. See [SPEC.md](./SPEC.md).

## How tools connect

`connections`, `connectionSecrets`, `oauthClients`, `oauthPending`, and `connectionCalls` are the tables. Executor is the hub (2026-10-25 and 2026-10-29), including Reason and OpenMausBot as tools Tempo must be able to reach. MCP HTTP is `convex/mcpHttp.ts` and `apps/web/app/api/mcp/route.ts`.

Gen 1 uses email and WhatsApp as proactive sources. Gen 2 adds website-to-API. Those generations do not add a second database.

## Graphify

Graphify is set up. `docs/graph/README.md` says the graph is the Actions artifact `graphify-graph`, from `.github/workflows/graphify.yml`, graphifyy 0.9.74, on push to `integration`. `graph.json` is not committed. An older snapshot is `docs/graphs/tempo-rhythm.json`.

This job did not run Graphify and did not install it. Whether the latest artifact matches `5504fc40` is UNKNOWN until someone downloads it. This job does not edit `.github/`.

## Sources

Repo layout at `5504fc40`. `docs/graph/README.md`. [TECH-STACK.md](./TECH-STACK.md). [BACKEND-SCHEMA.md](./BACKEND-SCHEMA.md).
