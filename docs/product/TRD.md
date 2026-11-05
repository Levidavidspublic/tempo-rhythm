# TRD

## Verdict

Tempo stays on Convex, Next.js, and Expo, on Bun and Turborepo. The product target for text is GLM 5.3 Flash. The product target for payments is Whop and Paddle. The code at `5504fc40` still routes models through Mistral and still has Polar and RevenueCat installed. This file records both. It does not change code.

## Requirements

- Magic-link auth through Convex Auth and Resend. No password provider on the live product.
- Pages are markdown in `notes.body`, drawn by json-render.
- Memory is the `memories` table, one person at a time.
- Coach writes go through a proposal the person can accept, edit, or reject. The confidence auto-apply clash stays open. See [SPEC.md](./SPEC.md).
- Voice-to-voice is an MVP requirement, English and Hebrew. Provider details that are UNKNOWN stay UNKNOWN.
- Executor is the only connector hub.
- Crisis classification uses gpt-oss-safeguard 20B (2026-10-21). A crisis severity path toward a breathing exercise, the person's therapist, or a hotline (ERAN was named for Israel) is a recorded idea from 2026-10-21. The exact routing rules are UNKNOWN. Do not invent a script. Do not present the coach as a clinician.
- Tagging uses Qwen 8B (2026-10-21).

## Limits

- Voice use: 300 minutes a month on the $20 plan, 1,800 on the $50 plan. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
- File defaults recorded 2026-10-12: 4 MiB per file, 50 MiB and 100 ready files per person.
- Undo window: at least 5 minutes (`docs/HARD_RULES.md` section 1).
- Soft-deleted accounts: 30 days, then a hard delete (`docs/HARD_RULES.md` section 10). Whether every child row returns on restore was still open on 2026-10-21.
- Web vitals and contrast: the numbers in [SPEC.md](./SPEC.md). No other performance number is set.
- A chat that holds 15 things at once, with stress at 20 and 25, was an example in the 4 Nov 2026 Nir notes. It was an example of a stress test, not a shipped cap. Do not treat 15 as a schema limit.

## Privacy

Target order recorded 2026-10-13: GDPR first, then California's equivalent, then HIPAA or something like it. "HIPAA or something like it" is his phrase. It is not a claim that Tempo is a HIPAA covered service.

- Analytics default off (`docs/HARD_RULES.md` section 10).
- Raw email, WhatsApp, and similar bodies are processed in memory and not written to Convex (`docs/HARD_RULES.md` section 6.4). Only the approved extract is kept.
- Export and deletion controls are required. `docs/HARD_RULES.md` names `convex/dsr.ts`. That file is not in the tree at `5504fc40`. A ticket must not call it until the path is real.
- Secrets are never written into a doc, a ticket, or a log. Names only.

## Security

- No Stripe SDK (`docs/HARD_RULES.md` section 2, and Amit 2026-10-29).
- No OpenRouter in the product path. Jev is his one exception, and it is a judge for pull requests, not a Tempo model.
- No Zustand, Redux, Firebase, Supabase, Clerk, Auth0, NextAuth, Prisma, or Drizzle (`docs/HARD_RULES.md` section 2).
- Tenant isolation happens in the Convex query, before a model sees text.
- High-stakes actions, including payments and deletions, always ask the person.

## Environments

Four lanes were decided 2026-08-13: Dev, PR preview, Staging, Production. Feature flags, not a fifth environment. Dev does not hold production keys.

Guest sign-in is preview only.

## Forbidden in a product ticket

Editing `.github/**`, `convex/schema.ts`, `convex/auth*`, or any `.env` file, unless Amit names that file in a later ticket. This doc set does not name them as editable.

## Sources

[PRD.md](./PRD.md), [TECH-STACK.md](./TECH-STACK.md), [SPEC.md](./SPEC.md). `docs/HARD_RULES.md` at `5504fc40`. Amit, 2026-10-13 through 2026-11-05.
