# Tempo Flow product docs

Written 2026-11-05. Owner: Amit Levin. Repo: `Levidavidspublic/tempo-rhythm`. Branch base: `integration` at `5504fc40`.

These files are the product source of truth. The GitHub wiki page `PRD` is a mirror of [PRD.md](./PRD.md). A wiki edit does not win. The loop is [../factory/FACTORY-LOOP.md](../factory/FACTORY-LOOP.md). The CI read is [../factory/CI-READONLY.md](../factory/CI-READONLY.md).

## How to read

Newest decision wins. Older lines stay as history. A fact from the code is marked SOURCED to a file. A gap is UNKNOWN. A fill-in is EXTRAPOLATED.

`docs/HARD_RULES.md` still says it wins over a PRD inside this repo. Where a newer decision in this folder clashes with that file, this folder is the product target and `HARD_RULES.md` is the rule the code still enforces. This job does not edit `HARD_RULES.md`. A later ticket must change it.

## Index

| File | What it is |
|---|---|
| [PRD.md](./PRD.md) | Who it is for, and what MVP, Gen 1, Gen 2 and Gen 3 contain |
| [SPEC.md](./SPEC.md) | Behaviour a builder must hit, and what is still open |
| [APP-FLOW.md](./APP-FLOW.md) | Screens that exist in the repo, and how a person moves |
| [DESIGN.md](./DESIGN.md) | Look, type, and layout |
| [KIT.md](./KIT.md) | Shared components in `packages/ui` |
| [UX-GUIDELINES.md](./UX-GUIDELINES.md) | How timing, touch, states, nudges and Hebrew should feel |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The parts, and how they talk |
| [BACKEND-SCHEMA.md](./BACKEND-SCHEMA.md) | Convex tables at `5504fc40`, and the Firestore target with no collection names yet |
| [TRD.md](./TRD.md) | Technical requirements, limits, privacy, security |
| [TECH-STACK.md](./TECH-STACK.md) | What is installed, with versions from package.json |
| [ROADMAP.md](./ROADMAP.md) | MVP, then Gen 1, then Gen 2, then Gen 3 |
| [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md) | $20 and $50, voice use, Whop and Paddle, sign-in |
| [CONFIG-PLAN.md](./CONFIG-PLAN.md) | Config jobs and which lane owns each one |

## Levels

Use these words. Do not call a level a phase. A phase is a one-to-two-week project.

| Level | Meaning | Source |
|---|---|---|
| MVP | An ADHD daily planner that just works | Amit, 2026-11-05 |
| Gen 1 | Proactive | Amit, 2026-11-05 |
| Gen 2 | Website-to-API | Amit, 2026-11-05 |
| Gen 3 | Acting for the person | Amit, 2026-11-05 |

## Decisions that win (2026-10-16 through 2026-11-05)

- Backend target: Firebase Auth plus Firestore. Server code is Vercel functions (FACTORY-LOOP.md, Nir, 2026-11-05). The code is still Convex. Magic link still stands. Who sends the mail is UNKNOWN.
- Headline: "an ADHD daily planner that just works."
- Text model: GLM 5.3 Flash (2026-10-21). Tagging: Qwen 8B. Crisis classifier: gpt-oss-safeguard 20B.
- Plans: $20 and $50 a month. The difference is how much voice-agent use you get (2026-10-25, restated 2026-11-03 and 2026-11-05).
- Payments: Whop and Paddle. No Stripe (2026-10-29). Amit cannot use Stripe as an Israeli seller.
- Sign-in: magic link only, via Resend. Paid sign-up gives access at once. A separate beta-tester path that Amit approves. Beta testers get premium free (2026-10-21). Guest sign-in only on preview, never live (2026-10-12).
- Voice-to-voice is in the MVP, not the alpha. If there is no decent pre-built API, rent a 4090 or a 3090 per use, not all day, for a term of years. It handles Hebrew. Hard prompts go to GLM Flash and DeepSeek (Amit, 2026-11-05). The 2026-10-29 direction is also in the MVP: he talks, and Tempo keeps working in the background.
- MVP parity set: Project app, Ebbi, FOCO, Pi, dushed (2026-10-29). Later set: Peeta, Toki, Kai, Howie, Parley Notes.
- Connectors: Executor, not Composio. MVP includes memory and connecting tools such as Gmail (Amit, 2026-11-05). Gen 1 is the proactive use of email and WhatsApp.
- Hebrew and English. Proper right-to-left and left-to-right.
- Clinical direction from Dr. Benny Hozmi (KIMACH, Beit Issie Shapiro): more chat-focused, day-to-day executive-function decisions (2026-10-13, restated 2026-10-29).

## History only

- 5 Oct 2026 PRD horizons (next week / MVP / end product), including "Gen 1 = native shell + study track + connectors".
- README phase name "Tempo 1.0 Foundation".
- 16 Oct 2026: live voice-to-voice in English only, Hebrew as read-aloud TTS.
- `docs/HARD_RULES.md` voice caps (30 / 90 / 180 minutes a day) and its Mistral-only router and RevenueCat-as-Stripe-wrapper line.
- Repo checkout payments in code: Polar on the web (`@polar-sh/nextjs`), RevenueCat on mobile (`react-native-purchases`).

## Sources

Amit's words in this chat, 2026-11-05. Basic Memory `project-tempo-flow` and `inbox/Session — Tempo MVP in Amit's words, 2026-11-05`. Downloads listed in [PRD.md](./PRD.md). GitHub `integration` at `5504fc40`.
