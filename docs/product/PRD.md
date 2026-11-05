# PRD

## Verdict

Tempo Flow is an ADHD daily planner that just works. It is a chat-first Notion and Goblin Tools hybrid, built from the ground up for people with severe learning disabilities and ADHD. It is an executive-function system, not a therapist.

The coach is a coach, not a counsellor. Source: vision lock, 10 Aug 2026, carried in `docs/PRD.md` (5 Oct 2026). Brain dump is not a medical surface (2026-08-10).

## Users

- Adults with ADHD and severe learning disabilities. Amit's words, 2026-11-05.
- The 5 Oct 2026 PRD also names autism. That line is older. It stays until Amit removes it. It is not deleted here.
- First real use is Amit planning his own day. Testers: Beit Issie Shapiro was named as a pool of 3 to 5 people (2026-08-17). How many, and when, is UNKNOWN.
- Dr. Benny Hozmi (KIMACH, Beit Issie Shapiro) asked for a chat focus on day-to-day executive-function decisions, in the spirit of Goblin Tools (2026-10-13).

## Jobs

MVP jobs are internal:

- How do I plan my day?
- How do I study?
- Here are my lecture notes.
- Take a break.

Source: Amit, 2026-11-05.

## What makes the MVP

Four parts, together. One of them alone is not the product.

1. json-render templates, and a web UI for components, graphs and interactive blocks. The person never sees the JSON.
2. Chat. Brain dump. Threads. It pushes back when that helps ("move this to this"). It understands executive-dysfunction nuances that a normal chatbot does not.
3. A daily planner and notes that are easy to manage. Everything is markdown plus json-render, so it can be changed without a new app build.
4. Memory, and Executor connections. Gmail is the example he named for the MVP.

Also in the MVP, because he placed them there:

- Voice-to-voice, including Hebrew, not only the alpha. If there is no decent pre-built API, a 4090 or a 3090 is rented per use, not all day. The number of years is UNKNOWN. The voice model name is UNKNOWN. Hard prompts hand off to GLM Flash and DeepSeek.
- The 29 Oct 2026 voice direction: he talks, and Tempo keeps running the work in the background.
- Feature parity with Project app, Ebbi, FOCO, Pi and dushed. The feature-by-feature matrix is UNKNOWN. Do not invent rows. Later parity, not MVP: Peeta, Toki, Kai, Howie, Parley Notes (2026-10-29).

Sign-in, plans and payments are in [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

The backend the code uses is Convex. The backend the 5 Nov loop names is Firebase Auth plus Firestore, with server code as Vercel functions. See [ARCHITECTURE.md](./ARCHITECTURE.md). The move is not a product generation.

## Onboarding

Nir, 5 Nov 2026, in the factory loop:

- First get the person invested. Then ask them to buy.
- At most 2 questions. Each question has a reason the person can hear.
- Copy uses the person's own words, from real use. Stock nag copy stays out.

## How the loop uses this file

`docs/product/` is the source of truth. The GitHub wiki page `PRD` is a mirror of this file. A wiki edit does not change the product. The loop, the nine checks, and who may merge are in [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md). Tickets live in GitHub, next to the code. There is no second ticket system.

## Gen 1

Proactive. Connected to email and WhatsApp.

Examples he gave: remember to change the electricity bill. Leave about twenty minutes earlier because the bus is slow. "Twenty minutes" is his example, not a measured rule.

The MVP may already connect Gmail. Gen 1 is when Tempo uses email and WhatsApp to speak first. Raw message bodies are not stored. See [TRD.md](./TRD.md).

## Gen 2

Website-to-API. He priced this as a $100 a month plan.

Examples: Apify and Firecrawl for live public information such as public transport. Sign in through a VM and turn a site into an API. His example was a Maccabi website.

On 5 Nov 2026 he also said that example was "like V2 and V3". Later the same day he locked the names: Gen 2 is website-to-API, Gen 3 is acting for the person. This PRD follows that lock. The $100 plan is Gen 2.

## Gen 3

Acting for the person.

Examples: phone the bank, wait on hold, then link him into the chat when a person answers. Negotiate a cable bill down.

Pine (`pine.im`) was named on 29 Oct 2026 as a reference for acting on someone's behalf. That older note called it V2. Under the 5 Nov lock it is Gen 3.

## Success

No numeric success target was set in the 5 Nov words. UNKNOWN.

The older "next week" exit list in `docs/PRD.md` (5 Oct 2026) is history. It is not the MVP exit. The MVP exit is in [ROADMAP.md](./ROADMAP.md).

## Out of scope for the MVP

- Proactive email and WhatsApp behaviour (Gen 1).
- Turning an arbitrary website into an API, Apify, Firecrawl, and VM sign-in (Gen 2).
- Phone calls, hold queues, and negotiating bills (Gen 3).
- A native store app. The 16 Sep 2026 ladder (PWA, then store-grade native, then a Rust desktop "Tempo Max") is history until Amit puts a generation on it. It is not MVP, Gen 1, Gen 2 or Gen 3 in his 5 Nov words.
- StudyFetch one-to-one parity (16 Oct 2026) is older than the 5 Nov MVP. Study and lecture notes are in the MVP. Full StudyFetch parity is UNKNOWN, not assumed.
- Stripe.
- OpenRouter as a product router. The only OpenRouter exception he named is the Jev judge.
- Composio. The connector hub is Executor.
- Electron. Decided 2026-09-20: never Electron for Tempo.
- Zustand. Banned 2026-08-10. `docs/HARD_RULES.md` agrees.

## Open questions

- Which installed plan name (`basic`, `pro`, `max` in `convex/schema.ts`) is $20, and which is $50. UNKNOWN.
- Which GPU, how many years, and which voice model. UNKNOWN.
- The parity matrix against the five MVP apps. UNKNOWN.
- Whether the 10 Aug line that also names autism still stands. Not re-decided on 5 Nov.

## Sources

Amit, this chat, 2026-11-05. Basic Memory `project-tempo-flow` (facts through 2026-11-01) and the 2026-11-05 MVP session note. `docs/PRD.md` in this repo (version 5 Oct 2026) as history. Downloads: `handoff-2026-09-15/session-b/04-PRD-TEMPO-FLOW.md` (file date 2026-09-30), `handoff-2026-09-15/factory-v2-2026-09-19/products` (2026-09-19 and 2026-09-30), `grokbot-tempo-omniagent-2026-10-29/tempo/project-docs-2026-10-21/PRD.md` (folder date 2026-10-29), `tier-economics-2026-11-03/tempo-omniagent-tier-economics-2026-11-03.md`, `claude-jobs-2026-11-04/03-t3-tempo-docs.md`, `nir-questions-2026-11-04/`, `FACTORY-LOOP.md` (2026-11-05). OmniAgent files were not used.
