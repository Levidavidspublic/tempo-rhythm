# SPEC

## Verdict

A builder implements the MVP as an ADHD daily planner that just works. This file says what must be true. It does not add a feature that [PRD.md](./PRD.md) does not name. If a line is UNKNOWN, the ticket that needs it stays open.

## MVP behaviour

1. A person signs in with a magic link. There is no password field on the live product.
2. After sign-in, the home of the work is the day: plan, study, lecture notes, and a break.
3. Notes and the day page are markdown. json-render draws blocks as their own elements. JSON is not shown.
4. Chat can take a brain dump, keep threads, and push back with a concrete move ("move this to this").
5. The coach does not silently change the person's data. Accept, edit, and reject stay available. `docs/HARD_RULES.md` section 6.2 is the current code rule. Section 6.3 also auto-applies when confidence is at least 0.8 and shows undo. Those two lines clash inside that file. Do not pick a winner here. A ticket stays open until Amit says which one the MVP uses.
6. Undo of an AI change lasts at least 5 minutes. Source: `docs/HARD_RULES.md` section 1. A newer duration was not set.
7. Memory is stored per person. Gmail can be connected through Executor in the MVP. Proactive mail is Gen 1, not this list.
8. Voice-to-voice works in the MVP, in English and Hebrew. Hard prompts go to GLM 5.3 Flash and DeepSeek. The voice model, the GPU choice (4090 or 3090), and the rental term are UNKNOWN. Until those are set, a voice ticket is open.
9. While he is talking, Tempo keeps running the work in the background (2026-10-29, confirmed as MVP on 2026-11-05). What "the work" includes beyond the four MVP parts is UNKNOWN. Do not add phone calls. Those are Gen 3.
10. Copy never shames. A missed habit says welcome back. It does not say the streak is broken. Source: `docs/HARD_RULES.md` section 1.
11. English left-to-right and Hebrew right-to-left both work. User text picks its own direction. Times and code stay left-to-right. Source: design note 2026-10-21.
12. The five parity apps are a target: Project app, Ebbi, FOCO, Pi, dushed. A row is not written until someone checks that app. Invented parity is a failure.

## Generations a builder must not pull forward

- Gen 1: Tempo speaks first from email or WhatsApp.
- Gen 2: Apify, Firecrawl, VM sign-in, website-to-API, the $100 plan.
- Gen 3: calling the bank, waiting on hold, negotiating a bill.

## States every MVP screen has

Default, loading, empty, error, and offline. Each state says what is actually happening. No fake "saved" while a write is still in flight. Source: design note 2026-10-21.

Exact English and Hebrew strings are UNKNOWN until a screen ticket sets them. A ticket without those strings is open, not buildable. Source: `docs/backlog/TICKET-STANDARD.md` on branch `docs/source-2026-11-01` (1 Nov 2026). That file is not on `integration` yet.

## Numbers

Use only numbers Amit or a named standard already set.

- WCAG 2.2 AA contrast 4.5:1 for text, and a target size of at least 24 by 24 CSS pixels (WCAG 2.5.8). Source: ticket standard, 1 Nov 2026, citing WCAG.
- Core Web Vitals: INP 200 ms or less, LCP 2.5 s or less, CLS 0.1 or less. Source: the same ticket standard, citing web.dev.
- `docs/HARD_RULES.md` still says WCAG 2.1 AA and touch targets of at least 44 by 44 dp on mobile. The 1 Nov ticket standard is newer for the web target size. Mobile 44 dp stays until a newer decision replaces it.
- Voice minutes: $20 is 300 a month, $50 is 1,800 a month. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
- Resource defaults recorded 2026-10-12: 4 MiB per selected file, 50 MiB and 100 ready files per user. Source: `DECISIONS.md` in the 21 Oct packet, citing `CORE-WEB-RESOURCES.md`.

Any other latency, price, or cap is UNKNOWN.

## Done for an MVP slice

A slice is done only when its ticket's DONE command passes on this repo, the changed files stay inside that ticket, and no secret is printed. Nothing is proven against a mock.

## Sources

[PRD.md](./PRD.md). `docs/HARD_RULES.md` at `5504fc40`. Ticket standard on `docs/source-2026-11-01`. Design packet 2026-10-21.
