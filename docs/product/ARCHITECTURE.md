# Architecture

## Verdict

Two pictures. The code at `5504fc40` still talks to Convex. The product target, from the factory loop Nir signed on 5 Nov 2026, is Firebase Authentication plus Cloud Firestore on the free Spark plan. Spark has no Cloud Functions and no App Hosting. Server code and every model call run as Vercel functions. Cloudflare stays. Upgrading to the paid Blaze plan is an open decision. It is Amit's only. It is not a step. This file records both pictures. It does not move the code.

The web app is Next.js on Vercel. The phone app is Expo. Executor is the connector hub. Payments are Whop and Paddle in the product target. The installed clients are still Polar and RevenueCat.

Sign-in stays a magic link (Amit, 2026-10-12 and 2026-10-21). Whether that link is sent by Resend, by Firebase Auth, or by both is UNKNOWN. Do not drop Resend in a ticket until he says which.

Alpha text is stock GLM 5.3 Flash or DeepSeek, chosen by the task (Amit, 2026-11-05 evening). The morning line that named only GLM 5.3 Flash is older for the alpha. Qwen 8B still tags. gpt-oss-safeguard 20B is still the crisis classifier (2026-10-21). Custom models that teach subtasks and threading are a later stage. Which generation is UNKNOWN. They are not in the alpha.

Executor runs in the backend for the alpha. The person does not connect MCPs. Alpha replaces Basic Memory, Executor, NotePlan, and a chatbot. MVP adds Expo.

Voice-to-voice belongs to MVP, not Alpha, in Hebrew and English. The 6 Nov brief starts with a hosted STT → text → TTS chain; per-use GPU rental is conditional on inadequate hosted quality. See [VOICE-TO-VOICE.md](./VOICE-TO-VOICE.md). Eligible models, actual Hebrew quality, latency and economics remain UNKNOWN. Existing Deepgram listening is not silently replaced.

$20 is the bare essential. $50 adds the voice feature. $100 is more agentic (API and calls on the person's behalf). Whether $100 includes the voice feature is UNKNOWN.

`docs/HARD_RULES.md` still bans Firebase. The 5 Nov loop is newer and names Firebase as the backend. A ticket adding Firebase fails `bun run scan:forbidden-tech` until that file changes. This file does not edit it.

## Diagram

Code today:

```
Person
  |  magic link (Resend, code today)   listening: Deepgram
  |  voice-to-voice is MVP, not alpha
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
|  ai_router.ts  -->  code today still names Mistral |
|  crisis path   -->  gpt-oss-safeguard 20B          |
|  tagging       -->  Qwen 8B                        |
|  connections   -->  Executor (MCP), not Composio   |
+--------+------------------+------------------------+
         |                  |
         v                  v
   Whop and Paddle     Listening: Deepgram now
   (target)            Qwen 8B for tagging
   Polar + RevenueCat  Hosted voice chain at MVP; GPU is conditional
   (installed)
```

Product target (FACTORY-LOOP.md, role table, Nir 5 Nov 2026). Alpha is web. MVP adds Expo.

```
Person
  |  magic link (mailer UNKNOWN: Resend, Firebase Auth, or both)
  v
+------------------------+      +----------------------+
| apps/web (alpha)       |      | apps/mobile          |
| Next.js on Vercel      |      | Expo, added at MVP   |
| Vercel functions =     |      |                      |
| server code and every  |      |                      |
| model call             |      |                      |
+-----------+------------+      +----------+-----------+
            |                              |
            v                              v
+----------------------------------------------------+
| Firebase Auth + Cloud Firestore on Spark (free)    |
| No Cloud Functions. No App Hosting.                |
| Collection layout UNKNOWN                          |
| Blaze: open decision, Amit only, not a step        |
+----------------------------------------------------+
            |
            v
   Alpha text: stock GLM 5.3 Flash or DeepSeek by task
   Qwen 8B tags. Crisis: gpt-oss-safeguard 20B
   Listening: Deepgram, until a test says otherwise
   Voice-to-voice: MVP GPU (4090 or 3090), not alpha
   Executor in the backend. Person does not connect MCPs
   Cloudflare stays. Whop and Paddle
```

Reason, Cursor, and Codex on the Railway box are how the product is built and configured. They are not a runtime the person uses inside the planner. See [CONFIG-PLAN.md](./CONFIG-PLAN.md).

## Parts

| Part | Path | Role |
|---|---|---|
| Web | `apps/web` | The planner, chat, notes, settings |
| Mobile | `apps/mobile` | Expo shell. Alpha is web. MVP adds Expo. Not the MVP exit by itself |
| Backend today | `convex/` | Data, auth, coach, connections, crons. Still the code at `5504fc40` |
| Backend target | Firebase Auth + Cloud Firestore on Spark | Named in the 5 Nov loop. No Cloud Functions. No App Hosting. Collection names UNKNOWN. Server code and every model call move to Vercel functions. Blaze is an open decision, not a step |
| UI kit | `packages/ui` | Shared primitives and tokens |
| Utils | `packages/utils` | Shared helpers, including blocks and wiki links |
| Types | `packages/types` | Shared types |
| Product docs | `docs/product/` | This folder |

## How a day page is saved

The person edits markdown. The page body is the authority (`notes.body`, decision recorded 2026-10-12). json-render reads blocks inside that markdown and draws them. `noteBlocks` is a derived index. It can be rebuilt. The person does not see JSON.

## How the coach changes something

The coach proposes. The screen shows Accept, Edit, and Reject. Only then does the mutation run. High-stakes changes always ask, including deletions and payments (`docs/HARD_RULES.md` section 6.3). The clash with auto-apply at confidence 0.8 or higher is open. See [SPEC.md](./SPEC.md).

## How tools connect

`connections`, `connectionSecrets`, `oauthClients`, `oauthPending`, and `connectionCalls` are the tables in the code today. Executor is the hub (2026-10-25 and 2026-10-29), including Reason and OpenMausBot as tools Tempo must be able to reach. MCP HTTP in the code today is `convex/mcpHttp.ts` and `apps/web/app/api/mcp/route.ts`. On the alpha, Executor runs in the backend. The person does not connect MCPs.

Gen 1 uses email and WhatsApp as proactive sources. Gen 2 is a read-only assistant: phone calls, and a website turned into a read-only API on half a CPU core and a headless browser. He said that is not reverse-engineering. Half a CPU core is his figure. It is not an alpha limit. Gen 3 read-write waits on a compliance level. The level is UNKNOWN. None of these generations is a reason to keep Convex. The database move is the 5 Nov backend target, not a generation of its own.

## Graphify

Graphify is set up. `docs/graph/README.md` says the graph is the Actions artifact `graphify-graph`, from `.github/workflows/graphify.yml`, graphifyy 0.9.74, on push to `integration`. `graph.json` is not committed. An older snapshot is `docs/graphs/tempo-rhythm.json`.

This job did not run Graphify and did not install it. Whether the latest artifact matches `5504fc40` is UNKNOWN until someone downloads it. This job does not edit `.github/`.

## Sources

Repo layout at `5504fc40`. `docs/graph/README.md`. [TECH-STACK.md](./TECH-STACK.md). [BACKEND-SCHEMA.md](./BACKEND-SCHEMA.md). [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md) section "Role → today's tool", row Backend.
