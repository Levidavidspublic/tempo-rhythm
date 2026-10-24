# Tempo Flow — PRD

> **Version:** 5 Oct 2026. **Owner:** Amit Levin. Replaces the April verbatim copy of this file (Phase 06 Step 2).
> **Built from:** `04-PRD-TEMPO-FLOW.md` (16 Sep), `01-PRD-PATCH.md` (20 Sep, with the 30 Sep decision update), and Amit's interview of 5 Oct 2026. Where they disagree, this file wins.
> Items in the April master document that none of these carry forward count as superseded.
> **Precedence:** HARD_RULES > ticket > PRD > chat prompt.
> **Amendment (8 Oct 2026):** see §13. It records the owner's clarified daily-life-support direction and a bounded weekend target, and it marks which earlier statements it supersedes. Everything else in this file is unchanged history.
> **Tags:** every feature carries one horizon: **[NW]** next week · **[MVP]** · **[END]** end product. `[EXTRAPOLATED]` = filled in by Claude, for Amit to confirm. `UNKNOWN` = not verifiable from the sources or official docs.

## 0. Verdict

Tempo Flow is an executive-function coach and daily planner: an agent-first, modifiable markdown note taker with a coach chat beside it, plus scheduled jobs.
Every page is markdown with JSON blocks inside it. json-render draws each block as its own element, and the user never sees JSON.
The coach talks (live voice, English and Hebrew), reads your pages and memory, and changes the app for you.
It writes notes, adds tasks to Today, and builds new templates and modules, the way Claude Code writes its own mods (§5).

**Next week's target:** a real person opens `preview.tempoflow.dev`, signs in with a magic link, writes a note, and talks or types to the coach. This works in English or Hebrew, right-to-left or left-to-right, and the coach can act on their notes and Today. It is built in 2–3 days and polished for the rest of the week.

## 1. Vision and positioning

- **Canonical line (Vision Lock, 10 Aug):** "An executive function aid for adults with ADHD, autism, or learning disabilities. It is a coach, not a therapist or counselor."
- **Tagline:** "Tempo Flow — your brain's operating system." **Short form:** "A starter for your brain."
- **Closest product:** today.ai (memory, acts before it is asked, to-dos, notes). It is built for neurotypical users. Tempo is that for a neurodivergent user: it **paces** and **nags**.
- **What Tempo is at its core:** markdown + built-in templates + a chat with memory that can modify the app itself. "Kind of like how Claude Code can now modify itself. That's basically what Tempo Flow is with the chat and memory." (Amit, 5 Oct)
- **Design references:** Memos (design and behaviour only, no code), with Joplin secondary. The UX bar is NotePlan + StudyFetch, and parity means features, not look.
- **Look:** the Anthropic colour palette and taxonomy, because Amit finds them calming. It must look polished, not vibe-coded.
- **Language:** English first. Hebrew is fully supported, and the layout works right-to-left and left-to-right (§4.7).

## 2. Users

| | |
|---|---|
| Primary | Adults with ADHD, autism or learning disabilities whose executive dysfunction is the root cause. Design target: diagnosed and medicated. |
| Anti-persona | Dysfunction downstream of bipolar disorder, personality disorders, PTSD, addiction recovery, or anxiety/depression as the primary condition. Said plainly in-app; downloads are not gatekept. |
| First user | Amit. |
| Next-week test | The "mom test": Amit sends the preview link, the person signs up and uses Tempo as a chatbot or a planner, and it works. |
| Other testers | UNKNOWN. |
| Escalation | Three nights without sleep, severe distress or an escalating crisis → show real resources for the user's country, stop coaching. |

## 3. Horizons

### 3.1 Next week [NW]

**Goal.** Sign in with a magic link → write a note → chat with the coach by text or live voice, in English or Hebrew. The coach can create a note, add a task to Today, fill a template, and build a new template on request.

**Build window.** Built in 2–3 days, then polished for the rest of the week.

**Exit check (all on `preview.tempoflow.dev`):**

1. The existing preview smoke test passes.
2. A Playwright run creates a note with a task block; no JSON is visible anywhere on the page.
3. A typed coach message gets a reply from the live runtime model, not a canned reply.
4. "Add 'call the bank' to today" puts a task on today's page, and Undo removes it.
5. Asking the coach for a template shows a preview card. Approving it makes the template usable at once, and it can be turned off.
6. Pasting a memory export shows a review list, and kept items are saved.
7. Switching to Hebrew flips the layout to right-to-left, and the copy is Hebrew.
8. Asking the coach "every weekday at 8, write my plan into Today" creates a scheduled job after approval. It shows in the Modules list and can be switched off.
9. **Manual check:** one live voice round trip in English and one in Hebrew, each including one interruption and one action ("add X to today").

**Not next week:** the native app, billing, nags, the study track and connectors.

> *8 Oct: the weekend target in §13.2 is a narrower, dated slice. It does not replace this exit check.*

### 3.2 MVP [MVP] — the minimum real product [EXTRAPOLATED boundary]

This is the web PWA as a product people can pay for: the next-week build plus the following.

- The full planning surface: daily, weekly and monthly views, events, habits and brain dump.
- The adaptive coach and crisis handling.
- Nags in the user's own words.
- View modules.
- Memory view, forget and export.
- English speech-to-speech on NVIDIA once its licence is verified.
- Visible billing on Polar (web).
- Runtime models back on the Nemotron + Inkling ladder.

The boundary is Claude's reading of "V0.5 polished" in the 16 Sep PRD plus the patch's "nags are core".

### 3.3 End product [END]

- **Gen 1 (V1), the remainder:** the one-to-one Expo native shell (Android APK, iOS TestFlight), the study track, connectors through Executor, MCP server + CLI + REST, and BYOK.
- **V1.5:** store-grade native, meaning push notifications and the camera, shipped on the App Store and Google Play (family-friendly).
- **V2 "Tempo Max":** a Rust desktop app (Tauri 2), plus a minimal VPS that spawns the real `claude` binary on the user's own OAuth.
- **Later (Gen 2+):** the plugin SDK and marketplace, and the rest of §4.12.

## 4. Feature list

### 4.1 Pages, notes and templates

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-01 | Sign-in by magic link only (Resend), plus sign-out. No password, no passkeys. | NW (on `integration`) | 1 Oct ruling; repo |
| F-01a | **Approval-gated sign-up:** a new person enters their email and becomes a pending request. Only after Amit approves it does Resend send them a magic link. An unapproved email can never sign in. **Every approved user gets the premium tier.** Where Amit approves (admin screen, Convex dashboard, or an email link): UNKNOWN. | NW | Amit 5 Oct |
| F-02 | Every page is one markdown document. Tasks, events, habits, nags and templates are JSON blocks inside it, drawn by json-render. **The JSON is never shown on any screen.** | NW | patch 1; 20 Sep ruling |
| F-03 | Note editor: write markdown; blocks draw as their own elements; a broken block draws as a quiet card with Undo. | NW | patch 1; 20 Sep app flow (EXTRAPOLATED there) |
| F-04 | Built-in templates: Daily page, Weekly page, Project page, Plain note [EXTRAPOLATED set]. Starting content is adapted from popular public Joplin, Notesnook, Notion and Obsidian templates: structure only, never copied text. | NW (Daily + Plain note); MVP (rest) [EXTRAPOLATED split] | Amit 5 Oct; patch 4 |
| F-05 | **Today** is today's daily page. It is made from the Daily template on first open, and its tasks are task blocks. | NW | Amit 5 Oct; 05-SCHEMA |
| F-06 | When a page is created, the app proposes the right template and one tap accepts. The user never hand-builds a template. | MVP [EXTRAPOLATED timing] | patch 4 |
| F-07 | Daily, weekly and monthly views from the same markdown; elastic vs inelastic events (a fixed class stays put while a flexible walk bends around it). | MVP | 16 Sep §4 |
| F-08 | Project/folder tree, structured tags, calendar tokens (`{{next_monday}}`). | MVP | 16 Sep §4 |
| F-09 | Brain dump → ordered plan → add to Today. | MVP | 16 Sep ticket #2 |
| F-10 | Events and habits as blocks (no streak counters as pressure). | MVP | 05-SCHEMA |

### 4.2 Coach

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-20 | Coach chat beside the editor, replying live from the runtime model (§7). This replaces today's fixed technique replies. It is built on Convex's official Agent component, which provides chat threads, tool calls and live streaming of replies, so the coach is configuration plus tools, not hand-written backend code. | NW | Amit 5 Oct; repo `convex/coach.ts`; Convex Agent docs |
| F-21 | The coach reads the user's pages and memory for context. | NW [EXTRAPOLATED] | implied by F-22 |
| F-22 | **Coach actions:** create a note, add a task to Today, fill a template. Each action shows in the chat with a 5-minute Undo. | NW | Amit 5 Oct; 16 Sep undo rule |
| F-23 | The coach builds and edits templates and modules on request (§5). | NW | Amit 5 Oct |
| F-24 | Fixed crisis card: when a user signals crisis, the coach stops coaching and shows real resources. The card text is fixed, never model-written. | NW minimal [EXTRAPOLATED horizon]; per-country data MVP | 16 Sep §2; 20 Sep |
| F-25 | Adaptive coach: dial 0–10, panic button, bad-day detection, 10-second action, realism checker, forgiveness contract, graduated load 2→4. | MVP | 16 Sep §4 |
| F-26 | Anti-slop verification; Socratic questioning on the ADHD-tax category. | END | 16 Sep SHOULD |
| F-27 | Cron accountability with partial credit; self-rules (trial → lock → cooldown). | END | 16 Sep SHOULD |
| F-28 | **Coach artifacts:** the coach can make interactive pieces, such as flashcards, a quiz, a checklist or a small tracker, drawn by json-render from Tempo's catalog only. Each one is saved into a page as a block, and the user never sees JSON. Flashcards made here feed the study track later (F-90). | MVP [EXTRAPOLATED horizon] | Amit 5 Oct; json-render docs |

### 4.3 Voice

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-30 | **Live voice mode with the coach** is the number-one feature. It is a hands-free conversation where you can interrupt the coach mid-sentence, and every spoken reply is also shown as text (read-back). | NW | Amit 5 Oct |
| F-31 | Voice can do everything the text coach does: new note, task added to Today, template filled or built. | NW | Amit 5 Oct ("all of the above") |
| F-32 | English: Deepgram Flux streaming speech-to-text → runtime model → text-to-speech. | NW [EXTRAPOLATED pipeline] | Amit 5 Oct ("the Deepgram new model") |
| F-33 | Hebrew: Deepgram Nova-3 `he` → runtime model → Chatterbox multilingual (Hebrew verified). | NW | Known facts; 16 Sep §7 |
| F-34 | English speech-to-speech on NVIDIA Nemotron 3 Voicechat. Its licence for a paid product and its language list (Hebrew) are UNKNOWN. | MVP, once verified | Known facts; Amit 5 Oct |
| F-35 | Walkie-talkie push-to-talk on every tier. Live conversation on Pro/Max at 90/180 minutes a day. | MVP (with billing) | 16 Sep §4 |
| F-36 | Audio recap of a note set; screen sharing with the coach. | END | 16 Sep SHOULD |

### 4.4 Modules: Tempo changes itself

The full model is in §5.

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-40 | Ask the coach in plain words, by text or voice, for a template or module, and it writes it. | NW | Amit 5 Oct |
| F-41 | Before anything goes live, a preview shows the module plus a plain-language "what this module does" card, with Approve and Discard. | NW | modelled on Claude Code's mod approval and validation |
| F-42 | An approved module is live at once. Later edits made through the chat apply in place. | NW | modelled on mod hot reload |
| F-43 | Modules list: turn one off. **Plain mode** turns every user module off. Built-in templates appear as built-in modules: they can be turned off but not deleted. | NW | modelled on `/plugin`, `--safe-mode` and built-in mods |
| F-44 | View modules change how a page type lays out its blocks, using only Tempo's catalog components. | MVP [EXTRAPOLATED split] | Amit 5 Oct |
| F-45 | Plugin SDK + marketplace, where authors keep 100%. | END | 16 Sep LATER |
| F-46 | **Pages can hold code as well as markdown.** A page or module may include a code block (a small widget or a script) that the coach or the user writes. It only ever runs isolated: widgets in a sandboxed frame in the browser, scripts in a Vercel Sandbox micro-VM. Never inside the app itself, never with the user's keys, and only after the user approves it. | MVP [EXTRAPOLATED horizon] | Amit 5 Oct |
| F-47 | **Scheduled jobs (cron):** the user asks the coach "every weekday at 8, write my plan into Today" and the coach registers a recurring job, after approval. Jobs appear in the Modules list with an on/off switch, and each run's output lands in a page. | NW (one job type: write into a page) [EXTRAPOLATED scope]; MVP (any agent task) | Amit 5 Oct |
| F-48 | Ready-made open-source building blocks for calendar, tasks and widgets, wrapped as Tempo catalog components so the coach and modules can use them (TRD §1). | MVP | Amit 5 Oct |

### 4.5 Memory

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-50 | One memory adapter on Convex (remember, recall, context, forget, export) over the existing `memories` table. No outside memory engine. Recall searches by meaning and by keyword, and the coach can also search the user's past chats (Convex Agent component, hybrid search across threads). | NW (recall used by the coach) | 20 Sep ruling; Amit 5 Oct; Convex Agent docs |
| F-51 | **Memory import:** upload or paste your ChatGPT or Claude memory. Tempo shows each item to keep, edit or drop, and saves the kept items. | NW | Amit 5 Oct |
| F-52 | See and forget memories; export all memories as markdown. | MVP | 04f spec; patch 7 |
| F-53 | Import of ChatGPT, Claude or Markdown content (not just memory). *(8 Oct: reviewed-import rules in §13.3, R-03.)* | END | 16 Sep SHOULD |
| F-54 | **Life graph:** people, projects, goals, places and habits, linked. Links the user wrote (`[[links]]`, blocks) are kept apart from links the AI guessed, which are marked as guesses. Search by meaning + keyword + links + time. This is a Graphify / Understand Anything-style graph, but for life projects instead of code, built on Convex. | MVP [EXTRAPOLATED horizon] | Amit 5 Oct |
| F-55 | **Reflect:** a scheduled pass turns many memories into observations ("gym slips after late nights"), the way Hindsight's reflect step does. Observations are shown to the user and can be deleted. | MVP [EXTRAPOLATED horizon] | Amit 5 Oct |

### 4.6 Nags

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-60 | Nags are in the user's own words or derived from them. No stock copy, no emoji. A nag with no accepted phrase cannot be switched on. | MVP | patch 3 |
| F-61 | Nag delivery beyond in-app. Channel: UNKNOWN. | MVP / END | patch C6 |

### 4.7 Language and direction

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-70 | Website copy and app copy in English and Hebrew. | NW | Amit 5 Oct |
| F-71 | The layout switches left-to-right / right-to-left with the language, built so other right-to-left languages (Arabic, Persian and others) work without redesign. | NW | Amit 5 Oct |
| F-72 | Mixed Hebrew and English inside one note renders each paragraph in its own direction. | NW [EXTRAPOLATED] | follows F-71 |
| F-73 | The coach and voice answer in the user's chosen language. | NW [EXTRAPOLATED] | follows F-30, F-70 |

### 4.8 Look

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-80 | Polished look on the Anthropic palette and taxonomy. | NW | 20 Sep ruling; Amit 5 Oct "quite polished" |
| F-81 | Per-component animations; chat button at the bottom right; avatar in the top header (inspiration "Taby"; link UNKNOWN). | MVP [EXTRAPOLATED horizon] | 2 Oct ruling |
| F-82 | Typeface: Atkinson Hyperlegible vs Anthropic type (patch C3) is UNKNOWN. The Hebrew typeface is UNKNOWN. | — | patch C3 |

### 4.9 Study track

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-90 | Record → notes → flashcards → test; SM-2; recall quiz; Anki export; scoped RAG. It is a separate mode, never mixed into Today. | END (Gen 1) [EXTRAPOLATED: after MVP] | 16 Sep §3–4 |

### 4.10 Connectors and access

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-100 | Connectors through Executor (executor.sh) behind an adapter: reads plus light writes, heavy writes hard-refused, every external write confirmed. A commitment verified from real data. | END (Gen 1) | patch 6 |
| F-101 | MCP server + CLI + REST. *(8 Oct: an inbound Tempo MCP already exists in the repo; its extension with shared memory is §13.3, R-08.)* | END (Gen 1) | 16 Sep §4 |
| F-102 | Key vault: BYOK with any OpenAI-compatible key plus local endpoints, encrypted per user. | END (Gen 1) | 16 Sep §4 |
| F-103 | Bring-your-own ChatGPT subscription sign-in, only in the shape that passes the first-party test. Terms of service: UNKNOWN. | END | 3 Oct |

### 4.11 Billing, platforms, account

| ID | Feature | Horizon | Source |
|---|---|---|---|
| F-110 | Billing visible, never hidden. Polar on web, RevenueCat on mobile, no Stripe. Trial $1 / 3 weeks → Basic $10 → Pro $20 → Max $40; annual = two months free; notices at 3 days, 1 day and 1 hour before conversion. | MVP (web); END (mobile) | 16 Sep §8; 5 Oct |
| F-120 | Web PWA on Vercel (`tempo-web`). | NW | Known facts |
| F-121 | One-to-one Expo native shell (not a WebView), Android APK, iOS TestFlight. | END (Gen 1) | 16 Sep §3 |
| F-122 | Store-grade native: push notifications, camera; App Store + Google Play. | END (V1.5) | 16 Sep §3 |
| F-123 | Rust desktop (Tauri 2) + VPS spawning the real `claude` binary. | END (V2) | 16 Sep §3 |
| F-130 | Per-user isolation, `/api/health`, Playwright smoke tests. | NW (merged) | Known facts |
| F-131 | Soft delete with 30-day grace; Undo for 5 minutes on internal changes; confirmation before any external write. | NW (rule) | 16 Sep §4 |

### 4.12 Later (Gen 2+)

- Dispatch B, dispatched to Agentwright instead of rebuilt.
- Two-way calendar sync, course platforms, WhatsApp and Telegram bridges.
- Offline inference, local-first sync, Inkling distillation.
- Regional inference, SOC 2 Type II, family plans.

## 5. Modules — how Tempo changes itself

**Model.** In Claude Code you describe a feature in plain words, and Claude writes a mod, which is a plugin that changes how Claude Code looks and behaves. You approve it, it loads at the end of the turn and reloads on every change, and you can turn it off. Some of Claude Code's own features are built the same way (`/diff`).

Tempo does the same for a daily planner, with one deliberate difference: **data modules run in the app; anything written as code runs only in a sandbox** (F-46).

| Claude Code mods | Tempo modules |
|---|---|
| Describe a mod in a session; Claude writes it using its built-in `plugin-authoring` skill | Describe a template or module to the coach (text or voice). The coach writes it from a module-authoring instruction set generated from Tempo's catalog and block schemas, so it only writes things Tempo can draw |
| Claude Code asks you to approve before a mod Claude wrote loads | Preview + Approve / Discard before a module goes live (F-41) |
| `claude plugin validate` lists which events a mod handles and what it calls | Tempo validates every module against its schemas and shows "what this module does": which page types it shapes, which blocks it adds, and what it changes (F-41) |
| Hot reload at the end of each turn that changes the mod | Live at once on approval; chat edits apply in place (F-42) |
| Turn one mod off in `/plugin`; `--safe-mode` turns off every installed mod | Turn one module off; Plain mode turns every user module off (F-43) |
| Built-in mods (`/diff`, `agents-md`) | Built-in templates are built-in modules (F-43) |
| A mod runs with your permissions and isn't sandboxed | **RULE:** a data module uses only Tempo's catalog components and actions. Code in a page (F-46) runs only in an isolated sandbox, never in the app's own process. Neither can read secrets or touch another user's data |
| Share through a marketplace | Plugin SDK + marketplace, END (F-45) |

**Module kinds.**

1. **Template module [NW]:** a page shape, meaning headings, checklists, prompts and starting blocks, stored as a page with a `template` block.
2. **View module [MVP]:** how a page type lays out its blocks, built only from catalog components.
3. **Code module [MVP]:** a widget or script written as code, run only in a sandbox (F-46).
4. **Scheduled job [NW, minimal]:** a recurring agent task (F-47).

**RULES.**

- A module that fails validation never goes live.
- A module that breaks after going live falls back to the built-in layout. One bad module never breaks a page.
- The JSON stays hidden in modules too.

## 6. Rules (locks)

- Stack: Convex + Next.js 16 PWA on Vercel + Expo, on Bun + Turborepo. pnpm is not adopted.
- Markdown with JSON blocks, rendered with json-render.
- Sign-in by magic link only.
- Tailwind v4 on web; shadcn primitives; native `fetch` only.
- Executor, never Composio. Details: `docs/TRD.md`.
- **Never:** OpenRouter or any gateway · Anthropic keys in third-party code · Electron · Firebase, Supabase · Auth0, Clerk, NextAuth, BetterAuth · Stripe · Redux, Zustand, Jotai, Recoil, MobX · axios, ky, got · Tailwind v3 on web · Notion, Linear, Airtable as product integrations · code from Memos or Joplin · image generation · stock nag copy or emoji in nags · JSON shown to the user · code running outside a sandbox.
- **The Vercel AI SDK is permitted (Amit 5 Oct)**, together with Convex's official components (Agent, RAG). Single-vendor AI SDKs stay banned.
- Runtime models (what Tempo runs) and code models (what writes Tempo) are different. Every ticket says which it means.
- Agents merge into `integration` when every machine check passes. **Only Amit deploys to live.**
- "Preview" = internal testing; "deploy" = live to end users.

## 7. Runtime models and voice

| Use | Model | Horizon |
|---|---|---|
| Text, interim | DeepSeek V4.1 Flash on DeepInfra, "in the meantime". When it ends is UNKNOWN. | NW |
| Text, target ladder | Nemotron 3.5 Lightning (fast) · Nemotron 3 Super (balanced) · Inkling (deep), on DeepInfra; Together as failover | MVP |
| Speech-to-text, English | Deepgram Flux | NW |
| Speech-to-text, Hebrew | Deepgram Nova-3 `he` (Flux has no Hebrew) | NW |
| Text-to-speech, both | Chatterbox multilingual on DeepInfra (Hebrew included) | NW [EXTRAPOLATED for English] |
| Speech-to-speech, English | NVIDIA Nemotron 3 Voicechat (licence and languages UNKNOWN) | MVP |
| Embeddings (memory search by meaning) | `Qwen/Qwen3-Embedding-8B` on DeepInfra: the top open-weight model on the multilingual MTEB board available on DeepInfra, Apache-2.0, 100+ languages, output shortened to 1,024 dimensions. No public Hebrew-specific benchmark was found, so a Hebrew test against `BAAI/bge-m3` and `intfloat/multilingual-e5-large-instruct` decides before lock-in [EXTRAPOLATED pick] | NW |

**Gate:** DeepInfra requires a written Service Order before any paid tier (16 Sep §7). Dev and beta are fine.

> *8 Oct: for sensitive personal data, a model service is not accepted just because it is configured here. See §13.3, R-09 and gate G-1.*

## 8. Billing and distribution

Tiers, prices and unit economics are as in `04-PRD-TEMPO-FLOW.md` §8 (16 Sep), unchanged: every tier passes the 30% floor; the $1 trial is knowingly priced as acquisition spend.

Changed on 5 Oct: Polar on web, RevenueCat on mobile, no Stripe (Amit can't get Stripe as an Israeli seller).

Channels: web PWA first (MVP), then APK + TestFlight (Gen 1), then the stores (V1.5).

## 9. Environments

| | Preview (internal testing) | Live |
|---|---|---|
| URL | `preview.tempoflow.dev` | `www.tempoflow.dev` |
| Branch | `integration` | `master` |
| Convex | test `ceaseless-dog-617` | live `precious-wildcat-890` |
| Who ships | agents merge when checks pass | only Amit |

## 10. Open questions (UNKNOWN)

1. When the DeepSeek interim ends and Nemotron + Inkling return.
2. Whether Together hosts DeepSeek V4.1 Flash.
3. NVIDIA Nemotron 3 Voicechat: its licence for a paid product, and whether it speaks Hebrew.
4. Which languages Deepgram Flux TTS supports.
5. The typeface (patch C3) and the Hebrew typeface.
6. The "Taby" link.
7. The nag channel beyond in-app.
8. Hard vs soft delete for `forget` (patch C4).
9. ~~Open signup~~ Closed 5 Oct: sign-up is approval-gated (F-01a), and approved users get the premium tier. Where Amit approves: UNKNOWN.
10. Testers beyond Amit and the mom test.
11. How a Playwright run receives the magic link on preview.
12. The DeepInfra Service Order.

## 11. Ideas to ask me about later (Claude's own — NOT in scope)

- A per-user daily voice-minute cap during preview, so testers can't run up API spend.
- Module triggers ("when a task is ticked, do X"), like Claude Code's event hooks.
- Export and import a module as a markdown file, for sharing before the marketplace exists.
- A "what changed" timeline per module, like Claude Code's `/diff`.
- A sample-page check for each module, like `claude plugin test`.

## 12. Sources

- `04-PRD-TEMPO-FLOW.md` (16 Sep)
- `tempo-flow-v2-2026-09-20/` `01-PRD-PATCH.md`, `02-TRD.md`, `05-BACKEND-SCHEMA.md`, `00-CHECKLIST.md` (with the 30 Sep decision update)
- Repo `Division6066/tempo-rhythm`, branch `integration` at `e781c67` (5 Oct): `convex/coach.ts`, `convex/auth.ts`, `convex/schema.ts`, `factory/SLOTS.md`
- Claude Code docs: Mods overview and Create a mod (code.claude.com, read 5 Oct)
- Via Context7, 5 Oct: Convex Agent component docs (agent usage, context, streaming, tool approval, RAG); Convex vector search docs; AI SDK DeepInfra provider; json-render docs (catalog prompt, generation modes, skills)
- DeepInfra embeddings catalogue; Graphify, Understand Anything and Hindsight READMEs (read 5 Oct)
- Deepgram changelog, models-and-languages page and token-auth guide; NVIDIA Nemotron Voicechat model card; DeepInfra DeepSeek V4.1 Flash and Chatterbox pages (read 5 Oct)
- Amit's interview, 5 Oct 2026
- Owner request for the 8 Oct amendment (§13); generic requirements only, no private material

## 13. Amendment — 8 October 2026

> **Dated:** 8 Oct 2026. **Owner request:** Amit Levin. **Status:** product requirements and targets only. The new requirements here are proposed targets, not built features; the only exception is a capability this section explicitly identifies as already existing (for example the inbound Tempo planner MCP in R-08 and F-101). The proposed shared-memory extension of that MCP is not built. Nothing here says a feature is fully ready, newly verified, compliant or clinically effective. Earlier sections stay as written; the pointers added above mark the only statements this amendment touches.
> **Status words:** **Target** = intended, not delivered. **Future** = real requirement, no date. **Verified** = proven by a recorded check; this amendment marks nothing Verified. **UNKNOWN** = not established.
> **Privacy of this file:** generic product requirements only. No personal medical reports, family stories, research membership, book text or identifiable private third parties belong here.

### 13.1 Direction

Tempo Flow focuses on daily-life support for people with ADHD, autism and dyslexia. The tone is warm, accepting and capability-oriented. It promotes independence and human relationships and does not replace them. This narrows the emphasis of §1 and §2; "a coach, not a therapist" still holds. Other adaptations are **Future** forks, outside this focus. The current LICENSE is Business Source License 1.1; an open-source or fork-sharing licence is a future choice that is still undecided. This amendment changes no LICENSE and gives no legal guarantee about what others may do with the code. A permissioned book may inform source-grounded coaching only after the text is received and permission is confirmed. No teachings are invented before then.

### 13.2 Weekend target (9–11 Oct), separate from long-term scope

These are dated targets. They are not delivered work and not a promise that all of them finish.

| Date | Target |
|---|---|
| 9 Oct | Critique of the actual screens. The critique report is maintained separately. This PRD creates no screenshots and makes no claim about the UI. |
| 10 Oct | Preview target. |
| 11 Oct | Demonstration. |

**Weekend acceptance, in priority order.** Each item is a **Target** and counts only when a recorded check passes.

1. Signed-in planning and Today as Markdown.
2. Persistent task add and tick.
3. A real coach reply from the runtime model, not a canned one (§3.1 item 3).
4. An explicit, confirmed coach action with Undo (F-22, F-131).
5. Source-attributed, reviewed memory import (F-51, R-03).
6. A narrow voice or focus demonstration, **only if genuinely verified.** Real audio needs a tested browser and source, with English and Hebrew evidence. Unsupported capture is stated openly, and the item is dropped from the demonstration.

**Not weekend promises:** connectors, inbox breadth, scheduled sync, meeting capture, book-based adaptations, and every §13.3 item not listed above.

### 13.3 Requirements (long-term unless §13.2 says otherwise)

| ID | Requirement | Status |
|---|---|---|
| R-01 | **Pages and templates.** Pages are Markdown-first. The AI can create editable templates from a description, habits or an optional sketch. Celebrations are optional and customizable, with reduced-motion and quiet alternatives. | Future (extends F-02, F-23, F-40) |
| R-02 | **One set of records.** Day, week, month, goals, habit-streak and to-do views read and write the same records. No duplicated state between views. | Future (extends F-07, F-10) |
| R-03 | **Personal memory.** Built-in, tagged, searchable memory on Convex spanning plans, journals and conversations. Importing a ChatGPT or Claude export keeps provenance, shows candidates for review, saves only on explicit confirmation, deduplicates, and allows editing and deletion. Deleted items are excluded from retrieval. Retrieval is bounded: no "infinite memory", and no synchronization with private accounts Tempo cannot legitimately reach. | Reviewed import: weekend Target (F-51). Rest: Future (extends F-50–F-52) |
| R-04 | **Second-brain inbox.** Save links, articles, PDFs, and YouTube or Instagram references. Ingestion, transcripts, timestamped notes and Q&A happen only where the content and a supported means of access are available. Web first; mobile share later. | Future |
| R-05 | **Class and meeting capture.** The user explicitly starts and stops it. Notes and Q&A are grounded in the captured source, and action items are proposed for the user to accept. Raw audio is transient at first. An optional accessibility-evaluation upload may inform instruction or coaching preferences that the user reviews. No diagnosis and no claim of clinical effectiveness. | Future |
| R-06 | **Integrations and money.** Slack, Gmail, Outlook and WhatsApp need supported APIs, explicitly selected access and secure setup. Receipt and bill capture and gentle, user-controlled budget check-ins are in scope. Tempo executes no financial actions. | Future (relates to F-100) |
| R-07 | **Onboarding sync.** Onboarding may offer a daily, weekly or monthly sync, only for supported sources the user selects and Tempo can legitimately access. | Future |
| R-08 | **Inbound MCP.** Extend the existing inbound Tempo MCP with bounded shared-memory read and write next to the planner tools, with scopes, confirmation for writes and tenant isolation. No outbound Basic Memory dependency. Tempo does not pretend to have live access to a user's private ChatGPT or Claude memory. | Future (extends F-101) |
| R-09 | **Model services for sensitive data.** The default service must be verified as EU-hosted and not training on user data. The current DeepInfra setup (§7) is **not** asserted to meet this because it exists. A user may choose their own API or subscription provider, which needs supported authentication, a privacy disclosure and consent. Fail closed: sensitive data goes to no service until its provider, region and no-training eligibility are verified in writing, and there is no silent fallback across a privacy boundary. DeepInfra's standard no-training and no-content-retention statements ([data privacy](https://docs.deepinfra.com/account/data-privacy)) do not establish EU residency; its [privacy policy](https://deepinfra.com/privacy) and [terms](https://deepinfra.com/terms) permit US processing or relocation absent an agreement. Self-hostable, MIT-licensed Chatterbox weights do not make DeepInfra-hosted inference EU-resident. Deepgram EU and no-training handling needs the EU endpoint ([regional endpoints](https://developers.deepgram.com/reference/regional-endpoints)) and a documented model-improvement opt-out on every request ([your data](https://developers.deepgram.com/trust-security/your-data)). Deepgram is proprietary; whether the owner's open-weight requirement covers speech-to-text is an unresolved decision. Until a sensitive-data route qualifies, tests use synthetic data only. No provider implementation or certification is claimed. This amendment authorizes no purchase, hosting or grant. No provider guarantees are invented; Gemini is not described as open-weight. | Gate G-1; no compliance claim |

### 13.4 Unresolved gates and decisions

- **G-1. Provider privacy verification.** Check EU hosting and no-training terms in writing for each model service before any sensitive data is sent to it. A gate, not an implementation claim. Status: **UNKNOWN**.
- **G-2. Voice evidence.** Tested browser and capture source, plus English and Hebrew results. Status: **UNKNOWN**.
- **G-3. Integration access.** For each of Slack, Gmail, Outlook and WhatsApp: a supported API, an access route and secret setup. Status: **UNKNOWN**.
- **G-4. Inbox source access.** Which links, PDFs, transcripts and social references Tempo may lawfully and technically read. Status: **UNKNOWN**.
- **G-5. Shared-modification licence.** The repository's current LICENSE is Business Source License 1.1. The open-source or fork-sharing licence Tempo wants is a future choice that is still undecided. This PRD changes no LICENSE and gives no legal guarantee about what others may do with the code.
- **G-6. Book adaptation.** Depends on receipt of the book and on permission. Not started.
- **G-7. Retention.** How long raw audio and imported source text are kept, and the exact deletion and retrieval-exclusion behaviour. Status: **UNKNOWN** beyond the rules above.
- **G-8. Optional Sign in with ChatGPT (subscription login).** Unresolved. The official documentation covers open-source and local-app use and directs paid or remotely hosted apps to an interest route. Open-source status alone does not make this hosted Tempo app eligible. The preview gives no access to private ChatGPT conversations or account memory, and offers no audio or video input or transcription API. Not a promised weekend feature. No OAuth setup, legal acceptance, entitlement assertion or service call is made. Sources: https://developers.openai.com/siwc/token-sharing-open-source and https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations . Status: **UNKNOWN**.
- **Verification status:** this amendment verifies nothing. No item in §13 is Verified.


---
