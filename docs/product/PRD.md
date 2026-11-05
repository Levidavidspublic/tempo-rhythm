# PRD

## Verdict

Alpha is the web app. It replaces four tools. The MVP is that web app, plus the Expo phone app, plus the voice GPU.

The coach is a coach, not a counsellor. Source: vision lock, 10 Aug 2026, carried in `docs/PRD.md` (5 Oct 2026). Brain dump is not a medical surface (2026-08-10).

Line to use: "Find your rhythm. Get things done. Don't burn out." Source: `Downloads/nir-followup-2026-11-05/01-cursor-tempo-docs-nir-update.md` (Nir, 5 Nov 2026).

## Alpha

Alpha is the web app. Source: Amit, 2026-11-05 evening.

The usable web alpha is due by the end of November 2026. That date is Nir's phase deadline. A phase is a one-to-two-week project. The date does not add a product level name. Sources: the Nir file above, and `docs/factory/FACTORY-LOOP.md` section 7.

Alpha replaces four tools, together:

1. Basic Memory, for memory.
2. Executor, in the backend, so the person never connects an MCP.
3. NotePlan, for the daily planner.
4. A chatbot.

Inside that replacement: json-render templates, a chat that can brain-dump, keep threads, and push back, and markdown notes. The person never sees JSON. Source: Amit, 2026-11-05 evening. The push-back example "move this to this" is his morning wording the same day.

Alpha text is stock GLM 5.3 Flash or DeepSeek, chosen by the task. The voice GPU is on the MVP. Source: Amit, 2026-11-05 evening.

Plain notes that contain lecture notes are part of replacing NotePlan; StudyFetch-like study, NotebookLM-like tools, recurring tasks, and autonomous email checks or alerts are outside Alpha and outside the MVP.

## MVP

The MVP is the Alpha, plus the Expo phone app. Source: Amit, 2026-11-05 evening.

Voice-to-voice is the GPU deploy. It sits on the MVP. It was not moved this evening. Source: Amit, morning of 2026-11-05.

If there is no decent pre-built API, rent a 4090 or a 3090 per use, not all day, for a term of years. Years UNKNOWN. Voice model name UNKNOWN. It can handle Hebrew. Hard prompts go to GLM Flash and DeepSeek. Source: Amit, morning of 2026-11-05.

The 29 Oct 2026 voice direction stays on the MVP: he talks, and Tempo keeps running the work in the background. What "the work" includes beyond Alpha is UNKNOWN.

## Gen 1

Gen 1 is StudyFetch-like study, Wispr Flow-like dictation, NotebookLM-like tools, a CLI, and advanced search. Source: Amit, 2026-11-05 evening.

Gen 1.1 and Gen 1.5 are inside Gen 1. They are harder connections. The split between 1.1 and 1.5 is UNKNOWN.

Those connections are several email accounts, including Outlook, WhatsApp via WhatsApp Web JS, Discord, and reminders sent through them. Recurring tasks and automatic email checks or alerts sit here with those connections. Source: Amit, 2026-11-05 evening.

Reminder examples, from the morning of 2026-11-05, stay here. They are no longer the name of Gen 1. Remember the electricity bill. Leave earlier because the bus is slow. "Twenty minutes" is his example, not a measured rule.

The morning PRD said raw message bodies are not stored. See [TRD.md](./TRD.md).

## Gen 2

Gen 2 is a read-only executive assistant. It can phone for the person. It can turn any website into a read-only backend API: a mini server with half a CPU core and a headless browser. Half a CPU core is his figure. He said this is not reverse-engineering the tool. Source: Amit, 2026-11-05 evening.

This is the $100 a month plan, because it is expensive to run. "More agentic" is his name for what $100 adds. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

A phone-the-bank call that only reads, including waiting on hold and linking him in when a person answers, sits in Gen 2. The same call sits in Gen 3 if it changes something on the person's behalf.

## Gen 3

Gen 3 is read-write. It acts for the person. It is connected to their phone. It waits until a compliance level is reached. That level is UNKNOWN. Source: Amit, 2026-11-05 evening.

Negotiating a cable bill down changes something, so it sits in Gen 3. A bank call that changes something on the person's behalf sits in Gen 3. The morning examples are kept. The evening split decides which level each one is.

## Why not ChatGPT or Notion

Wording: EXTRAPOLATED. Amit did not dictate this sentence. The facts are the four-tool Alpha above.

Tempo keeps the planner, the memory, the connections, and the chatbot in one ADHD web app.

- NotePlan's job sits in the daily planner and in markdown notes. The person never sees JSON.
- Basic Memory's job sits in memory. Executor sits in the backend, so the person never connects an MCP.
- The chatbot's job sits in a chat that can brain-dump, keep threads, and push back.

## Onboarding

First get the person invested. Then ask them to buy. At most 2 questions. Each question must say why it is asked. The two questions are UNKNOWN. Sources: the Nir file above, and `docs/factory/FACTORY-LOOP.md` section 7.

Copy, onboarding, and design tickets use the customer's own words, from real user feedback. Source: `FACTORY-LOOP.md` section 7.

## Users

- Adults with ADHD and severe learning disabilities. Amit's words, 2026-11-05.
- The 5 Oct 2026 PRD also names autism. That line is older. It stays until Amit removes it.
- First real use is Amit planning his own day. Testers: Beit Issie Shapiro was named as a pool of 3 to 5 people (2026-08-17). How many, and when, is UNKNOWN.
- Dr. Benny Hozmi (KIMACH, Beit Issie Shapiro) asked for a chat focus on day-to-day executive-function decisions, in the spirit of Goblin Tools (2026-10-13).

## How the loop uses this file

`docs/product/` is the source of truth. The GitHub wiki page `PRD` is a mirror of this file. A wiki edit does not change the product. The loop, the nine checks, and who may merge are in [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md). Tickets live in GitHub, next to the code. There is no second ticket system.

Sign-in, plans, and payments are in [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

The backend the code uses is Convex. The backend the 5 Nov loop names is Firebase Auth plus Firestore, with server code as Vercel functions. See [ARCHITECTURE.md](./ARCHITECTURE.md). The move is not a product level.

## Success

No numeric success target was set on 5 Nov. UNKNOWN.

The older "next week" exit list in `docs/PRD.md` (5 Oct 2026) is history. Level exits are in [ROADMAP.md](./ROADMAP.md). Where an exit was not stated, that file says UNKNOWN.

## Out of scope for Alpha and the MVP

- StudyFetch-like study, Wispr Flow-like dictation, NotebookLM-like tools, a CLI, and advanced search (Gen 1).
- Recurring tasks, autonomous email checks or alerts, and the harder connections (Gen 1.1 and Gen 1.5).
- The read-only executive assistant, phone calls, and the website-to-API mini server (Gen 2).
- Read-write acting, and the phone connection that waits on a compliance level (Gen 3).
- A native store app, and a Rust desktop client. The 16 Sep 2026 ladder is history until Amit puts a level on it.
- Stripe.
- OpenRouter as a product router. The only OpenRouter exception he named is the Jev judge.
- Composio. The connector hub is Executor.
- Electron. Decided 2026-09-20: never Electron for Tempo.
- Zustand. Banned 2026-08-10. `docs/HARD_RULES.md` agrees.

## History

Morning of 2026-11-05, earlier than this evening. The MVP was "an ADHD daily planner that just works." Its jobs were plan the day, study, lecture notes, and take a break. Its four parts were json-render, chat, the daily planner and notes, and memory plus Executor, with Gmail as the example. Voice-to-voice was already on the MVP. Gen 1 was named proactive, from email and WhatsApp. Gen 2 was website-to-API at $100, with Apify, Firecrawl, and a Maccabi site as examples. Gen 3 was acting for the person. Pine (`pine.im`, 29 Oct 2026) was placed in Gen 3 that morning. Feature parity for the MVP was Project app, Ebbi, FOCO, Pi, and dushed (2026-10-29). Later parity, not in that morning MVP: Peeta, Toki, Kai, Howie, Parley Notes.

Evening of the same day wins on the ladder above. The morning lines stay here.

Also history, not deleted:

- 5 Oct 2026 PRD horizons, including "Gen 1 = native shell + study track + connectors."
- 16 Oct 2026: StudyFetch one-to-one parity, study tools only, Arcade excluded. Live voice-to-voice in English only, Hebrew as read-aloud TTS.
- 2026-10-21 named GLM 5.3 Flash as the only runtime text model. The evening of 2026-11-05 adds DeepSeek beside it for Alpha, chosen by the task. Qwen 8B still tags. gpt-oss-safeguard 20B is still the crisis classifier. Silence this evening did not remove them.
- The morning file also said stock nag copy stays out.

## Open questions

- What are the two onboarding questions? UNKNOWN.
- What compliance level must Gen 3 reach? UNKNOWN.
- Which harder connections are Gen 1.1, and which are Gen 1.5? UNKNOWN.
- What is the voice model name? How many years is the GPU rented? Which GPU, a 4090 or a 3090? UNKNOWN.
- Does the 10 Aug line that also names autism still stand? Not re-decided on 5 Nov.
- Does the 29 Oct parity set still bind a level? Not restated this evening.
- Where would a custom model sit? UNKNOWN. Alpha text is stock GLM 5.3 Flash or DeepSeek.
- Is Pine a read-only call (Gen 2) or a change on the person's behalf (Gen 3)? UNKNOWN.
- How many Beit Issie Shapiro testers, and when? UNKNOWN.

## Sources

Amit, 2026-11-05 evening, which wins over his morning words the same day. `Downloads/nir-followup-2026-11-05/01-cursor-tempo-docs-nir-update.md`. `docs/factory/FACTORY-LOOP.md` section 7. Basic Memory `project-tempo-flow` (facts through 2026-11-01) and the morning 2026-11-05 MVP session note. `docs/PRD.md` in this repo (version 5 Oct 2026) as history. Downloads named in the morning draft of this file stay history: `handoff-2026-09-15/session-b/04-PRD-TEMPO-FLOW.md` (file date 2026-09-30), `handoff-2026-09-15/factory-v2-2026-09-19/products` (2026-09-19 and 2026-09-30), `grokbot-tempo-omniagent-2026-10-29/tempo/project-docs-2026-10-21/PRD.md` (folder date 2026-10-29), `tier-economics-2026-11-03/tempo-omniagent-tier-economics-2026-11-03.md`, `claude-jobs-2026-11-04/03-t3-tempo-docs.md`, `nir-questions-2026-11-04/`. OmniAgent files were not used.
