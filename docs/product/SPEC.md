# SPEC

## Verdict

A builder implements Alpha, then the MVP. Alpha is the four tools on the web. Text is stock GLM 5.3 Flash or DeepSeek, chosen by the task. The MVP adds the Expo phone app and Hebrew-capable voice. Start with the hosted chain in VOICE-TO-VOICE.md; the eligible models and measured Hebrew quality remain UNKNOWN. GPU rental is conditional.

This file says what must be true. It does not add a feature that [PRD.md](./PRD.md) does not name. If a line is UNKNOWN, the ticket that needs it stays open.

## Alpha behaviour

1. The product is the web app.
2. It replaces four tools, together. Basic Memory, for memory. Executor, in the backend, so the person never connects an MCP. NotePlan, for the daily planner. A chatbot.
3. Alpha text is stock GLM 5.3 Flash or DeepSeek, chosen by the task. Hebrew-capable voice sits on MVP; the 6 Nov initial path is a hosted chain, not a mandatory GPU.
4. Notes and the day page are markdown. json-render draws blocks as their own elements. JSON is not shown.
5. Chat can take a brain dump, keep threads, and push back. The morning example was "move this to this."
6. Plain notes that contain lecture notes are part of replacing NotePlan; StudyFetch-like study, NotebookLM-like tools, recurring tasks, and autonomous email checks or alerts are outside Alpha and outside the MVP.

## MVP behaviour

1. The Expo phone app is added. The MVP is the Alpha plus that app.
2. Voice-to-voice works on the MVP, in English and Hebrew. Hard prompts go to GLM Flash and DeepSeek. If there is no decent pre-built API, a 4090 or a 3090 is rented per use, not all day. The voice model, which GPU, and the rental term in years are UNKNOWN. Until those are set, a voice ticket is open.
3. While he is talking, Tempo keeps running the work in the background (2026-10-29, confirmed as MVP on the morning of 2026-11-05). What "the work" includes beyond Alpha is UNKNOWN. A read-only phone call is Gen 2. A call that changes something is Gen 3.

## Outside Alpha and the MVP

- Gen 1: StudyFetch-like study, Wispr Flow-like dictation, NotebookLM-like tools, a CLI, advanced search.
- Gen 1.1 and Gen 1.5: recurring tasks, autonomous email checks or alerts, and the harder connections in [PRD.md](./PRD.md).
- Gen 2: the read-only executive assistant, phone calls that do not change anything, the website-to-API mini server, the $100 plan.
- Gen 3: read-write acting, including a bank call or a bill negotiation that changes something.

## Standing behaviour

These are sourced rules. The evening ladder did not move them.

1. A person signs in with a magic link. There is no password field on the live product. Source: [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
2. The coach does not silently change the person's data. Accept, edit, and reject stay available. `docs/HARD_RULES.md` section 6.2 is the current code rule. Section 6.3 also auto-applies when confidence is at least 0.8 and shows undo. Those two lines clash inside that file. Do not pick a winner here. A ticket stays open until Amit says which one Alpha uses.
3. Undo of an AI change lasts at least 5 minutes. Source: `docs/HARD_RULES.md` section 1. A newer duration was not set.
4. Copy never shames. A missed habit says welcome back. It does not say the streak is broken. Source: `docs/HARD_RULES.md` section 1.
5. English left-to-right and Hebrew right-to-left both work. User text picks its own direction. Times and code stay left-to-right. Source: design note 2026-10-21.
6. Memory is stored per person. Autonomous email checks are Gen 1.1 and Gen 1.5, not Alpha.

## States every Alpha screen has

Default, loading, empty, error, and offline. Each state says what is actually happening. No fake "saved" while a write is still in flight. Source: design note 2026-10-21.

Exact English and Hebrew strings are UNKNOWN until a screen ticket sets them. A ticket without those strings is open, not buildable. Source: [ticket standard](../backlog/TICKET-STANDARD.md), copied into this draft from `docs/source-2026-11-01` (1 Nov 2026). Neither this draft nor its open tickets claim default-branch approval.

## Numbers

Use only numbers Amit or a named standard already set.

- WCAG 2.2 AA contrast 4.5:1 for text, and a target size of at least 24 by 24 CSS pixels (WCAG 2.5.8). Source: ticket standard, 1 Nov 2026, citing WCAG.
- Core Web Vitals: INP 200 ms or less, LCP 2.5 s or less, CLS 0.1 or less. Source: the same ticket standard, citing web.dev.
- `docs/HARD_RULES.md` still says WCAG 2.1 AA and touch targets of at least 44 by 44 dp on mobile. The 1 Nov ticket standard is newer for the web target size. Mobile 44 dp stays until a newer decision replaces it.
- The 3 Nov 2026 figures of 300 and 1,800 voice minutes are historical, not approved acceptance limits for the evening plan meanings. Current entitlements and their mapping to plan identifiers are UNKNOWN. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
- Resource defaults recorded 2026-10-12: 4 MiB per selected file, 50 MiB and 100 ready files per user. Source: `DECISIONS.md` in the 21 Oct packet, citing `CORE-WEB-RESOURCES.md`.

Any other latency, price, or cap is UNKNOWN.

## Done for a slice

A slice is done only when its ticket's DONE command passes on this repo, the changed files stay inside that ticket, and no secret is printed. Nothing is proven against a mock.

## History

The morning SPEC, same day, put study, lecture notes, and a break on the MVP home screen. It put a Gmail connection in the MVP, and it put proactive mail in Gen 1. It named five parity apps as an MVP target: Project app, Ebbi, FOCO, Pi, and dushed. Evening words move study, NotebookLM-like tools, recurring tasks, and autonomous mail out of Alpha and out of the MVP. The parity list was not restated. It is not Alpha or MVP behaviour in this file.

## Open questions

- What is the voice model name? UNKNOWN. Same gap as [PRD.md](./PRD.md).
- Which `docs/HARD_RULES.md` confidence rule does Alpha use, section 6.2 or section 6.3? UNKNOWN.
- What are the exact English and Hebrew strings for each screen? UNKNOWN.

## Sources

[PRD.md](./PRD.md). [ROADMAP.md](./ROADMAP.md). `docs/HARD_RULES.md` at `5504fc40`. Ticket standard on `docs/source-2026-11-01`. Design packet 2026-10-21.
