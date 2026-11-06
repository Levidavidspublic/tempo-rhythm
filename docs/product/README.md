# Tempo Flow product docs

Written 2026-11-05. Updated the evening of 2026-11-05 from Amit's later words the same day. Owner: Amit Levin. Repo: `Levidavidspublic/tempo-rhythm`. Branch base named that morning: `integration` at `5504fc40`. This evening pass did not re-check that commit.

These files are the product source of truth. The GitHub wiki page `PRD` is a mirror of [PRD.md](./PRD.md). A wiki edit does not win. The loop is [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md). The CI read is [../factory/CI-READONLY.md](../factory/CI-READONLY.md).

## How to read

Newest decision wins. Older lines stay as history. A fact from the code is marked SOURCED to a file. A gap is UNKNOWN. A fill-in is EXTRAPOLATED.

`docs/HARD_RULES.md` still says it wins over a PRD inside this repo. Where a newer decision in this folder clashes with that file, this folder is the product target and `HARD_RULES.md` is the rule the code still enforces. This draft now corrects the Firebase target and legacy Mistral wording in the owning `docs/HARD_RULES.md`. It remains unmerged: default-branch rules and enforcement are unchanged; dependent code must use the owner-reviewed migration/configuration route.

## Index

| File | What it is |
|---|---|
| [PRD.md](./PRD.md) | Who it is for, and what Alpha, MVP, Gen 1, Gen 1.1, Gen 1.5, Gen 2, and Gen 3 contain |
| [SPEC.md](./SPEC.md) | Alpha behaviour, what the MVP adds, and what is still open |
| [APP-FLOW.md](./APP-FLOW.md) | Screens that exist in the repo, and how a person moves |
| [DESIGN.md](./DESIGN.md) | Look, type, and layout |
| [KIT.md](./KIT.md) | Shared components in `packages/ui` |
| [UX-GUIDELINES.md](./UX-GUIDELINES.md) | How timing, touch, states, nudges and Hebrew should feel |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The parts, and how they talk |
| [BACKEND-SCHEMA.md](./BACKEND-SCHEMA.md) | Convex tables at `5504fc40`, and the Firestore target with no collection names yet |
| [TRD.md](./TRD.md) | Technical requirements, limits, privacy, security |
| [TECH-STACK.md](./TECH-STACK.md) | What is installed, with versions from package.json |
| [ROADMAP.md](./ROADMAP.md) | Alpha, MVP, Gen 1, Gen 1.1, Gen 1.5, Gen 2, Gen 3 |
| [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md) | $20, $50, and $100, Whop and Paddle, sign-in |
| [CONFIG-PLAN.md](./CONFIG-PLAN.md) | Config jobs and which lane owns each one |
| [VOICE-TO-VOICE.md](./VOICE-TO-VOICE.md) | Proposed MVP voice architecture; no preview test or latency claimed |

## Levels

Use these words. Do not call a level a phase. A phase is a one-to-two-week project. Gen 1.1 and Gen 1.5 are inside Gen 1.

| Level | Meaning | Source |
|---|---|---|
| Alpha | The web app. Replaces Basic Memory, Executor in the backend, NotePlan, and a chatbot | Amit, 2026-11-05 evening |
| MVP | Alpha, plus the Expo phone app and Hebrew-capable voice; hosted chain first, GPU conditional | Amit, 2026-11-05 evening. Voice stayed on the MVP from that morning |
| Gen 1 | StudyFetch-like study, Wispr Flow-like dictation, NotebookLM-like tools, a CLI, advanced search | Amit, 2026-11-05 evening |
| Gen 1.1 | Harder connections, with Gen 1.5. The split is UNKNOWN | Amit, 2026-11-05 evening |
| Gen 1.5 | Harder connections, with Gen 1.1. The split is UNKNOWN | Amit, 2026-11-05 evening |
| Gen 2 | Read-only executive assistant. The $100 plan. "More agentic" | Amit, 2026-11-05 evening |
| Gen 3 | Read-write. Acts for the person. Connected to their phone | Amit, 2026-11-05 evening |

The harder connections are several email accounts, including Outlook, WhatsApp via WhatsApp Web JS, Discord, and reminders sent through them. Recurring tasks and automatic email checks or alerts sit there too. The morning reminder examples stay under 1.1 and 1.5: the electricity bill, leave earlier because the bus is slow, and "twenty minutes" as his example.

Plain notes that contain lecture notes are part of replacing NotePlan. StudyFetch-like study and NotebookLM-like tools are Gen 1.

## Decisions that win (evening of 2026-11-05, plus older lines the evening did not move)

- Alpha text: stock GLM 5.3 Flash or DeepSeek, chosen by the task. Amit, 2026-11-05 evening. Tagging stays Qwen 8B. The crisis classifier stays gpt-oss-safeguard 20B (2026-10-21).
- Line to use: "Find your rhythm. Get things done. Don't burn out." Nir file, 5 Nov 2026.
- Plans: $20 is the bare essential and is sufficient. $50 adds the voice feature. That is the only difference from $20. It confirms the 3 Nov 2026 decision. $100 is more agentic. Whether $100 includes the $50 voice feature is UNKNOWN.
- Payments: Whop and Paddle. No Stripe (2026-10-29). Amit cannot use Stripe as an Israeli seller.
- Sign-in: magic link only, via Resend. Paid sign-up gives access at once. A separate beta-tester path that Amit approves. Beta testers get premium free (2026-10-21). Guest sign-in only on preview, never live (2026-10-12). The 6 Nov FIREBASE-PLAN names Resend as Tempo's sender; exact Firebase delivery wiring remains OPEN.
- Backend target: Firebase Auth plus Firestore. Server code is Vercel functions (FACTORY-LOOP.md, Nir, 2026-11-05). The code is still Convex. Magic link still stands.
- Voice-to-voice stays on the MVP. If there is no decent pre-built API, rent a 4090 or a 3090 per use, not all day, for a term of years. It handles Hebrew. Hard prompts go to GLM Flash and DeepSeek (Amit, morning of 2026-11-05). The 2026-10-29 direction stays on the MVP: he talks, and Tempo keeps working in the background.
- Connectors: Executor, not Composio. On Alpha, Executor is in the backend so the person never connects an MCP (Amit, 2026-11-05 evening).
- Hebrew and English. Proper right-to-left and left-to-right.
- Clinical direction from Dr. Benny Hozmi (KIMACH, Beit Issie Shapiro): more chat-focused, day-to-day executive-function decisions (2026-10-13, restated 2026-10-29).

## History only

- Morning of 2026-11-05: four levels. MVP was "an ADHD daily planner that just works." Gen 1 was proactive. Gen 2 was website-to-API. Gen 3 was acting for the person. Gmail was the MVP connector example.
- 5 Oct 2026 PRD horizons (next week / MVP / end product), including "Gen 1 = native shell + study track + connectors."
- README phase name "Tempo 1.0 Foundation."
- 16 Oct 2026: live voice-to-voice in English only, Hebrew as read-aloud TTS.
- 2026-10-21 named GLM 5.3 Flash as the only runtime text model. The evening of 2026-11-05 adds DeepSeek beside it. Qwen 8B still tags. gpt-oss-safeguard 20B is still the crisis classifier.
- `docs/HARD_RULES.md` voice caps (30 / 90 / 180 minutes a day) and its Mistral-only router and RevenueCat-as-Stripe-wrapper line.
- Repo checkout payments in code: Polar on the web (`@polar-sh/nextjs`), RevenueCat on mobile (`react-native-purchases`).
- MVP parity set from 2026-10-29: Project app, Ebbi, FOCO, Pi, dushed. Later set: Peeta, Toki, Kai, Howie, Parley Notes. Not restated this evening.

## Sources

Amit, 2026-11-05 evening, over the morning draft of this folder. `Downloads/nir-followup-2026-11-05/01-cursor-tempo-docs-nir-update.md`. Basic Memory `project-tempo-flow` and `inbox/Session — Tempo MVP in Amit's words, 2026-11-05`. Downloads listed in [PRD.md](./PRD.md). GitHub `integration` at `5504fc40`, as named that morning.

## 6 Nov review correction status

This branch is a draft, not default-branch law or runtime evidence. [RULE-RECONCILIATION.md](./RULE-RECONCILIATION.md) contains concrete proposed rule replacements requiring owner review. [BUILD-CONTRACT-GAPS.md](./BUILD-CONTRACT-GAPS.md) separates owner choices from architecture/code-map work. Every backlog candidate remains OPEN; no automation is activated. Planned env names are not SET evidence. Convex is retained until a backed-up, verified cutover authorizes archival.
