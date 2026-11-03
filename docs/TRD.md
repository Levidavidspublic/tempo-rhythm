# Tempo Flow — TRD (technical requirements)

> **Version:** 5 Oct 2026. Replaces the April verbatim copy of this file.
> **Base:** `02-TRD.md` (20 Sep) with its 30 Sep decision update folded in. **Changed only where the 5 Oct PRD forces it.** Each forced change is marked **(5 Oct)**.
> `[EXTRAPOLATED]` = filled in by Claude, for Amit to confirm. `UNKNOWN` = not verifiable.

**Verdict.**

- Tempo stays on Convex + Next.js + Expo, on Bun + Turborepo.
- Pages are markdown with JSON blocks, drawn by json-render through its plain React path.
- Memory is one adapter on Convex over the existing `memories` table.
- **(5 Oct)** Ticket one is now the DeepSeek V4.1 Flash seam.
- **(5 Oct)** Voice streams from the browser to Deepgram with a 30-second token.
- **(5 Oct)** Modules are validated data.
- **(5 Oct)** Language direction comes from the user's locale.

## 1. Stack

| Layer | Choice | Note |
|---|---|---|
| Back end | Convex + Convex Auth | **(5 Oct)** Magic link only, through the Auth.js Resend provider (repo `convex/auth.ts`). No Password provider, no passkeys. |
| Web | Next.js 16 App Router PWA on Vercel | **(5 Oct)** Vercel project `tempo-web`. |
| Mobile | Expo + NativeWind, one-to-one native shell | Newest stable Expo SDK when the shell phase starts, pinned in that ticket. The repo has `~54.0.9` today. Not in next week's batch. |
| Styling | Tailwind v4, shadcn primitives | Anthropic palette (`04-UI-BRIEF.md`). |
| Block rendering | `@json-render/core`, `@json-render/react`, `@json-render/react-native` | Apache-2.0. Pre-1.0: pin the exact version. **(5 Oct)** Not installed in the repo yet; the next-week batch installs it. Zod validates. |
| AI layer | **(5 Oct, Amit permitted the Vercel AI SDK)** `ai` + `@ai-sdk/deepinfra` (`createDeepInfra`, reads `DEEPINFRA_API_KEY`). Convex components `@convex-dev/agent` (threads, tools, tool approval, streaming deltas, hybrid search across threads; Apache-2.0) and `@convex-dev/rag` (per-user namespaces, filters, importance; Apache-2.0). | Package installs touch `package.json` and `convex/convex.config.ts`, so the ticket writer must allow them in the data ticket's MUTATES. |
| Agents | **(5 Oct)** The coach is a Convex Agent (persistent threads). One-off background agents inside a Convex action (e.g. a scheduled job) may use the AI SDK's own `ToolLoopAgent` (AI SDK 6: tools + `stopWhen`, default 20 steps; the loop also stops when a tool needs approval). | |
| Scheduling | **(5 Oct)** Convex `crons.ts` for system jobs (nightly reflect); `@convex-dev/crons` component for jobs registered at runtime per user; `ctx.scheduler.runAt` for one-off reminders. | |
| Sandboxed code [MVP] | **(5 Oct)** Browser widgets: sandboxed `<iframe sandbox="allow-scripts">` (no same-origin), talking to the page only through `postMessage` with catalog actions [EXTRAPOLATED]. Scripts: Vercel Sandbox (`@vercel/sandbox`, fresh micro-VM per run, Node image, timeout). Vercel Sandbox pricing and limits: UNKNOWN. | |
| UI building blocks [MVP] | **(5 Oct)** Calendar: FullCalendar standard plugins (MIT; `direction: 'rtl'` documented for Hebrew). Not the premium/scheduler plugins (commercial). Tasks/boards/widgets: Kibo UI (MIT, shadcn registry: Calendar, Kanban, Gantt, List, Table, Tree, Contribution Graph and more; RTL UNKNOWN). Alternative calendar: react-big-calendar (MIT; RTL UNKNOWN). Each is wrapped as a json-render catalog component. | |
| Language | **(5 Oct)** No i18n library. Typed message files `en` and `he`; `locale` on `users`; `dir` from the locale. | [EXTRAPOLATED] |
| Tooling | Bun 1.3.9 workspaces + Turborepo · Biome · Vitest/`bun test` · Playwright · native `fetch` only | pnpm is not adopted. |

**Paths.**

- **(5 Oct)** Convex code stays in `convex/`. The repo has no `packages/core` (`factory/SLOTS.md`).
- Next week's components live in their own folders under `apps/web/components/<feature>/`, per the factory component template.
- Moving to the template layout is still UNKNOWN.

## 2. Services and environments

| | dev | test / preview | live |
|---|---|---|---|
| Convex | `tremendous-bass-443` | `ceaseless-dog-617` | `precious-wildcat-890` |
| Vercel | — | `preview.tempoflow.dev` | `www.tempoflow.dev` |
| Branch | — | `integration` | `master` |

- **(5 Oct)** The PREVIEW target is closed: `preview.tempoflow.dev` follows `integration`. `convex-deploy-test` deploys `integration`'s `convex/` to `ceaseless-dog-617` and refuses any other key.
- Agents merge into `integration` when every machine check passes. **Only Amit deploys to live.**
- Values are set by interactive prompt only. RULE: a bare `npx convex env list` prints values; use the names-only form.

## 3. Provider routing (names only)

These are RUNTIME models. They never write Tempo's code.

| Lane | Provider and model | Env var name | Horizon |
|---|---|---|---|
| **(5 Oct)** Text, interim | DeepInfra `deepseek-ai/DeepSeek-V4.1-Flash` (1M context; OpenAI-compatible; function calling) | `DEEPINFRA_API_KEY` | NW |
| Text fast | DeepInfra `nvidia/NVIDIA-Nemotron-3.5-Lightning` | `DEEPINFRA_API_KEY` | MVP |
| Text balanced | DeepInfra `nvidia/NVIDIA-Nemotron-3-Super-120B-A12B` | `DEEPINFRA_API_KEY` | MVP |
| Text deep | DeepInfra `thinkingmachines/Inkling` | `DEEPINFRA_API_KEY` | MVP |
| Text failover | Together. Model on Together for the DeepSeek interim: UNKNOWN. | `TOGETHER_API_KEY` | NW if the model exists there |
| **(5 Oct)** STT English | Deepgram Flux `flux-general-en`, streaming, with turn detection | `DEEPGRAM_API_KEY` | NW |
| STT Hebrew | Deepgram Nova-3, language `he`, streaming | `DEEPGRAM_API_KEY` | NW |
| TTS, both languages | DeepInfra `ResembleAI/chatterbox-multilingual` (Hebrew included) | `DEEPINFRA_API_KEY` | NW **(5 Oct)** English use [EXTRAPOLATED] |
| **(5 Oct)** S2S English | NVIDIA Nemotron 3 Voicechat (12B, full duplex), hosted on build.nvidia.com | UNKNOWN | MVP; licence and languages UNKNOWN |
| Opt-in lane | Gemini Live, off by default (16 Sep §7) | `GEMINI_API_KEY` | unchanged |
| Overrides | `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL` stay as overrides | — | unchanged; long-term fate UNKNOWN |
| Dead | `MISTRAL_API_KEY`; `convex/lib/ai_router.ts` still calls `api.mistral.ai` | — | removed by ticket one |

**Ticket one (5 Oct).**

- Amit sets `DEEPINFRA_API_KEY` and `DEEPGRAM_API_KEY` on `ceaseless-dog-617`, by name, before the batch runs.
- **(5 Oct, revised)** The seam is the AI SDK DeepInfra provider: `deepInfra("deepseek-ai/DeepSeek-V4.1-Flash")` as the Agent's `languageModel`, and `deepInfra.embeddingModel("Qwen/Qwen3-Embedding-8B")`, shortened to 1,024 dims, as its `embeddingModel` [EXTRAPOLATED pick, §5]. `convex/lib/ai_router.ts` is replaced by the Agent definition.
- `convex/coach.ts` stops returning fixed technique replies. The coach is one `Agent` with `createTool` tools: `createNote`, `addTaskToToday`, `fillTemplate`, `draftModule`, `searchMemory`, `scheduleJob`. It uses `streamText(..., { saveStreamDeltas: true })`, so replies stream to every open screen through Convex.
- Module drafts use the Agent's built-in tool approval ("approval-requested" state), which gives the Approve / Discard step without custom code.
- Nothing calls `api.mistral.ai` any more.

**Gate:** a written DeepInfra Service Order before any paid tier.

## 4. Markdown + JSON blocks + json-render

- A page is one row in `notes`. Blocks are fenced JSON inside `body`, info string `json tempo`, envelope `type` / `id` / `v` / `data`. Convention and schemas: `05-BACKEND-SCHEMA.md` (fixed 20 Sep).
- **(5 Oct)** The next-week subset of block types is `page-meta`, `task`, `template`. The other block types (`event`, `habit`, `nag`) come at MVP.
- **(5 Oct)** Today = the `notes` row with `pageType: "daily"` and `date` = the user's local date. It is created from the default Daily template on first open.
- **(5 Oct)** `notes` gains `pageType` and `date`. On every save, `noteBlocks` (a derived index) is rebuilt, and an invalid block is indexed as `broken` and left in `body` untouched.
- The model never writes to the database directly. It proposes blocks or actions; code validates; code writes. Internal writes carry a 5-minute Undo.
- The user never sees JSON, on any screen.

## 4a. Modules (5 Oct)

- **Template module [NW]:** a `notes` row with `pageType: "template"` holding one `template` block. `template.data` gains:
  - `origin`: `builtin` / `user`
  - `status`: `draft` / `live`
  - `enabled`: boolean
  - `summary`: the plain-language "what this module does" text, generated by code from the validated content and not by the model [EXTRAPOLATED]
- **View module [MVP]:** a new block type `view` whose `data` is a json-render spec. Its `type` values must be catalog component names; its actions must be catalog action names.
- **Authoring:** the coach receives a module-authoring instruction set generated from the json-render catalog and the Zod block schemas, the way Claude Code's `plugin-authoring` skill tells Claude which events and methods exist.
- **Validation:** Zod on every field. Unknown component, unknown action, any URL or any script → rejected, and the module stays `draft`.
- **Approval:** `draft` → `live` only on the user's tap.
- **Off switches:** `enabled: false` hides one module. A per-user `plainMode` flag ignores all `origin: user` modules.
- **Fallback:** a module that fails at render falls back to the built-in layout for that page type.

## 4b. Coach artifacts (5 Oct) [MVP]

- The coach makes flashcards, quizzes, checklists and small trackers through one tool, `makeArtifact(spec)`.
- The spec must be a json-render spec using only Tempo's catalog components (for example `Flashcard`, `Quiz`, `Checklist`, `Tracker` — names [EXTRAPOLATED]). It is validated with the catalog's Zod schemas before saving.
- The saved artifact is an `artifact` block in a page, drawn by the same registry as every other block.
- The system prompt for this tool comes from `catalog.prompt()` (json-render's generated prompt), with Tempo rules added through `customRules`.
- json-render also has an "inline mode" (`catalog.prompt({ mode: "inline" })` + `pipeJsonRender`) that streams UI inside a chat reply. Whether it works with the Convex Agent's delta streaming is UNKNOWN, so the tool approach is the default.
- **Dev skills for the factory's coding agents:** install json-render's own skills with `npx skills add vercel-labs/json-render --skill core` and `--skill react` now, and `--skill react-native` at the Expo phase. Not the `shadcn` skill (Tempo draws blocks with its own components), and never the `redux` / `zustand` / `jotai` skills (banned).

## 5. Memory — the Convex adapter, kept as written

| Call | On Convex |
|---|---|
| `remember(userId, text, meta)` | Insert into `memories`; `meta.kind` goes in `metadata` (EXTRAPOLATED, 20 Sep). |
| `recall(userId, query, limit)` | Convex search index on `memories.content`, filtered by `userId` (EXTRAPOLATED, 20 Sep). |
| `context(userId, topic)` | `recall`, then trim to a token cap. |
| `forget(userId, memoryId \| all)` | User-facing at MVP. Hard or soft delete: open (patch C4). |
| `export(userId)` | Every memory as plain markdown (MVP). |
| **(5 Oct)** `importPreview(userId, text, source)` | Split pasted or uploaded text into candidate items; nothing is saved. `source`: `chatgpt` / `claude` / `paste` [EXTRAPOLATED]. Accepts `.txt`, `.md`, `.json` and pasted text. The exact export formats of ChatGPT and Claude memory: UNKNOWN. |
| **(5 Oct)** `importCommit(userId, items)` | `remember` for each kept item, with `metadata.source`. |

**(5 Oct) How the port is built, with no outside memory service:**

- `memories` gains an `embedding` field and a vector index (`vectorIndex`, 1,024 dimensions, filter field `userId`). Convex allows 2–2,048 dimensions, at most 256 results per search, and runs vector search only in actions.
- `recall` = Convex vector search (meaning) + the existing search index (keyword), merged.
- Past chats come from the Agent's `contextOptions.searchOptions` with `textSearch` and `vectorSearch` on, and `searchOtherThreads: true` for the same user.
- Pages are searchable through `@convex-dev/rag`, one namespace per user, as the coach's `searchMemory` tool [MVP].

**Embedding model options on DeepInfra (5 Oct catalogue):**

No public Hebrew-specific embedding benchmark was found (searched 5 Oct). The pick follows the multilingual MTEB board and is then confirmed by Tempo's own Hebrew test.

| Model | Notes |
|---|---|
| `Qwen/Qwen3-Embedding-8B` | **Default pick [EXTRAPOLATED].** Highest open-weight multilingual MTEB score among models on DeepInfra (70.58; only KaLM-Embedding-Gemma3-12B scores higher, and it is not in DeepInfra's catalogue). Apache-2.0, 100+ languages (Hebrew not named individually), 32k tokens, about $0.01/1M. Native 4,096 dims, but it supports Matryoshka (MRL) dims from 32 to 4,096: keep the first 1,024 values and re-normalise, which fits Convex's 2,048 limit. Whether DeepInfra accepts a `dimensions` parameter is UNKNOWN; truncating in code works either way. |
| `Qwen/Qwen3-Embedding-4B` / `-0.6B` | Same family, cheaper (69.45 for 4B). |
| `BAAI/bge-m3` | 100+ languages, 8k tokens, 1,024 dims, about $0.01/1M. In the AI SDK DeepInfra list. Test candidate. |
| `intfloat/multilingual-e5-large` | About 100 languages, 512 tokens, 1,024 dims. |
| `google/embeddinggemma-300m` | Multilingual, 2k tokens, cheapest at about $0.002/1M. |
| `nvidia/Nemotron-3-Embed-1B` / `-8B` | 34 languages (Hebrew UNKNOWN), 32k tokens. Fits the Nemotron runtime family. |

Hebrew quality is UNKNOWN for all of these. Before locking one, run a check on 20 Hebrew + 20 English questions against about 200 of Amit's own notes. Compare Qwen3-Embedding-8B, bge-m3 and multilingual-e5-large-instruct on top-3 hit rate. Changing the model later means re-embedding everything.

## 5d. Scheduled jobs (5 Oct)

- **NW:** the coach tool `scheduleJob({ cron, task, targetPageType })` needs approval. It registers a job with `@convex-dev/crons`, and each run writes into a page (e.g. Today). Jobs list with on/off in the Modules screen. Times are stored in UTC and shown in the user's time zone [EXTRAPOLATED].
- **MVP:** any agent task on a schedule (a `ToolLoopAgent` run inside an action), plus nag delivery (F-60).
- **System crons in `crons.ts`:** nightly reflect (MVP).

## 5c. Life graph and reflect (5 Oct) [MVP, EXTRAPOLATED design]

Patterns taken from Graphify, Understand Anything and Hindsight; none of the three is installed, because none runs inside Convex.

- **`entities` table:** `userId`, `kind` (`person` / `project` / `goal` / `place` / `habit`), `name`, `aliases`, `embedding`.
- **`edges` table:** `userId`, `from`, `to`, `relation`, `origin` (`extracted` = from `[[links]]` and blocks, no model; `inferred` = model-guessed), `confidence`, `sourceRef`. These mirror Graphify's EXTRACTED / INFERRED tags.
- **Retain:** after each chat turn and each page save, a scheduled action extracts entities and claims into `memories` + `entities` + `edges`.
- **Recall, four ways (Hindsight's model):** by meaning (vector), keyword (search index), links (`edges`) and time (`createdAt` index).
- **Reflect:** a Convex cron consolidates memories into `observations` rows, each with the memory ids that support it. Shown to the user; deletable.
- **Graph view** of life projects, like Understand Anything's explorable map — END.

## 5a. Voice (5 Oct)

Convex-only: no separate voice server. The browser talks to Deepgram directly; Convex does the token, the coach (Agent component) and the TTS. Audio is made one sentence at a time, not streamed byte by byte, so first-audio latency is UNKNOWN until measured. Fallback if it is too slow: a managed voice agent (Deepgram Voice Agent API or ElevenLabs Agents), with coach actions run as client-side tools that call the same Convex mutations.


1. The browser asks a Convex action for a speech-to-text token. The action calls Deepgram `POST /v1/auth/grant` and returns a token with a 30-second TTL, plus the model to use (`flux-general-en`, or Nova-3 with `he`, from the user's locale). The token only has to be valid when the WebSocket opens.
2. The browser streams microphone audio to Deepgram `/listen` over a WebSocket and shows the live transcript.
3. At end of turn, the browser sends the final transcript to the same Agent thread as text chat (same tools, same Undo). The reply streams back as text deltas through Convex.
4. As each sentence of the reply completes, a Convex action sends it to Chatterbox multilingual on DeepInfra and returns that sentence's audio, so speech starts before the whole reply is written [EXTRAPOLATED]. The browser plays it, and the text shows as read-back.
5. **Barge-in:** when Deepgram reports the user is speaking again, the browser stops playback at once and the new turn starts.
6. **Latency budget (16 Sep):** acknowledgement < 0.2 s, response about 1 s.

## 5b. Language and direction (5 Oct) [EXTRAPOLATED mechanics]

- `users.locale` (`en` / `he`; any locale code accepted); default from the browser, switchable in the app.
- `<html lang dir>` is set from the locale. A locale in the RTL list (`he`, `ar`, `fa`, `ur`) gets `dir="rtl"`.
- Layout uses logical CSS only: `ms-`/`me-`/`ps-`/`pe-` and `start`/`end`, never `left`/`right`. Direction-sensitive icons mirror.
- Note paragraphs render with `dir="auto"`, so mixed Hebrew and English lines each read correctly.
- Copy lives in `apps/web/messages/en.json` and `he.json`. A missing Hebrew key falls back to English.
- The coach and TTS answer in `users.locale`.

## 6. Connectors

Executor (executor.sh) behind an adapter: reads plus light writes, heavy writes hard-refused, every external write confirmed. Executor's call shape and env var names: UNKNOWN. Not in next week's batch.

## 7. Security RULES

1. Secrets by name only. Never a value, prefix or fragment anywhere.
2. **(5 Oct) amended, accepted by Amit 5 Oct:** text and TTS model calls run in Convex actions through the seam. **One exception:** the browser streams microphone audio directly to Deepgram using a 30-second token minted by a Convex action. No long-lived key ever reaches a shell. No separate voice server exists; everything server-side is Convex functions the factory writes.
3. Server-side order before any model call: auth → entitlement → quota.
4. Every query and mutation checks `ctx.auth` and filters by `userId`.
5. Soft delete everywhere, 30-day grace (notes already do this).
6. BYOK keys are encrypted per user and never returned to the client. No Anthropic key in third-party code, ever.
7. Crisis card text is fixed content, never written by a model.
8. **(5 Oct, revised)** Data modules use only catalog components and actions and are validated before going live. Code written into a page runs only in a sandbox (an iframe without same-origin, or a Vercel Sandbox micro-VM). It never runs in the app's own process, never gets environment variables or user keys, and never runs before the user approves it.
9. **(5 Oct)** Magic link only. Remove the passkeys flag (`NEXT_PUBLIC_ENABLE_PASSKEYS`) and the `/settings/passkeys` page.

10. **(5 Oct)** Approval-gated sign-up: `createOrUpdateUser` in `convex/auth.ts` (Convex Auth's documented hook for refusing a sign-in) refuses any email without an approved `signupRequests` row. The magic link is sent only after approval. Approved users get the premium tier. This replaces today's open signup.

## 8. CI

**(5 Oct)** The required checks on `integration` (ruleset `factory-integration`) are: `ci`, `e2e-preview`, `secret-scan`, `config-guard`, `scope-guard`. The merge queue is planned, not on.

The review gate (Cursor Bugbot, interim) is not a required check. Whether it counts as a "machine check": UNKNOWN.

Diagrams and Graphify: Graphify 0.9.74 runs on push to `integration`.

## 9. Forbidden

- OpenRouter or any gateway
- Anthropic keys in third-party code
- Electron
- Firebase, Supabase
- Auth0, Clerk, NextAuth, BetterAuth
- Stripe
- Redux, Zustand, Jotai, Recoil, MobX, and json-render's adapters for them
- axios, ky, got
- raw DB clients
- Tailwind v3 on web
- single-vendor AI SDKs (e.g. the `openai` or `@anthropic-ai/sdk` packages). **(5 Oct)** The Vercel AI SDK (`ai`, `@ai-sdk/*` providers) is permitted.
- Notion, Linear, Airtable as product integrations
- Composio
- FlyonUI
- pnpm
- any code from Memos or Joplin
- image generation
- stock nag copy and emoji in nags
- JSON shown to the user
- **(5 Oct)** user or model-written code running outside a sandbox
- FullCalendar premium / scheduler plugins (commercial licence)

## Open questions

1. With Bun staying, does Tempo move to the template folder layout?
2. `forget`: hard delete at once, or soft delete with the 30-day grace?
3. What happens to the three `AI_*` names once the seam is stable?
4. **(5 Oct)** Does Together host DeepSeek V4.1 Flash for failover?
5. **(5 Oct)** NVIDIA Voicechat: its env var name, its licence for paid use, and Hebrew.
6. **(5 Oct)** The exact ChatGPT and Claude memory export formats.

## Sources

- `02-TRD.md` (20 Sep + 30 Sep update) · `05-BACKEND-SCHEMA.md` (20 Sep)
- Repo `integration` at `e781c67`: `convex/auth.ts`, `convex/coach.ts`, `convex/lib/ai_router.ts`, `convex/schema.ts`, `factory/SLOTS.md`, `apps/*/package.json`
- Deepgram token-based authentication guide and models-and-languages page
- DeepInfra DeepSeek V4.1 Flash API page and Chatterbox multilingual page
- NVIDIA Nemotron Voicechat model card
- Claude Code docs: Mods overview, Create a mod (read 5 Oct 2026)
- Via Context7, 5 Oct: `/get-convex/agent` (agent usage, context, streaming, tool approval, RAG); Convex vector search docs; `/websites/ai-sdk_dev` DeepInfra provider; `/vercel-labs/json-render` (catalog prompt, generation modes, skills)
- DeepInfra embeddings catalogue; Graphify, Understand Anything and Hindsight READMEs (read 5 Oct)


---
