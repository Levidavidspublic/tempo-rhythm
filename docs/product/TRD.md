# TRD

## Verdict

The code at `5504fc40` is Convex, Next.js, and Expo, on Bun and Turborepo. The product target for the backend is Firebase Authentication plus Cloud Firestore on the free Spark plan (Nir, 5 Nov 2026, in the factory loop). Spark has no Cloud Functions and no App Hosting. Server code and every model call run as Vercel functions. Cloudflare stays. Upgrading to the paid Blaze plan is an open decision. It is Amit's only. It is not a step. The alpha text target is stock GLM 5.3 Flash or DeepSeek, chosen by the task (Amit, 2026-11-05 evening). The morning line that named only GLM 5.3 Flash is older for the alpha. The product target for payments is Whop and Paddle. The code still routes models through Mistral and still has Polar and RevenueCat installed. This file records both. It does not change code.

## Requirements

- Magic-link auth. No password provider on the live product. The code does this with Convex Auth and Resend. The target auth product is Firebase Auth. The 6 Nov FIREBASE-PLAN names Resend as Tempo's sender; the exact Firebase email-link delivery integration remains OPEN.
- Pages are markdown in `notes.body`, drawn by json-render.
- Memory is the `memories` table, one person at a time.
- Coach writes go through a proposal the person can accept, edit, or reject. The confidence auto-apply clash stays open. See [SPEC.md](./SPEC.md).
- Alpha (web) text is stock GLM 5.3 Flash or DeepSeek, chosen by the task (Amit, 2026-11-05 evening). The morning line that named only GLM 5.3 Flash is older for the alpha. Custom models that teach subtasks and threading are a later stage. Which generation is UNKNOWN. They are not in the alpha.
- Tagging uses Qwen 8B (2026-10-21).
- Crisis classification uses gpt-oss-safeguard 20B (2026-10-21). A crisis severity path toward a breathing exercise, the person's therapist, or a hotline (ERAN was named for Israel) is a recorded idea from 2026-10-21. The exact routing rules are UNKNOWN. Do not invent a script. Do not present the coach as a clinician.
- Voice-to-voice is an MVP requirement, not Alpha, in English and Hebrew. Start with the hosted STT → text → TTS chain in [VOICE-TO-VOICE.md](./VOICE-TO-VOICE.md); GPU rental is conditional if hosted quality is inadequate. Exact models, bounded API contract, Hebrew quality, latency and costs remain UNKNOWN. Existing Deepgram listening is not silently replaced.
- Executor is the only connector hub. On the alpha the person does not connect MCPs. Executor runs in the backend.

## Generations

- Alpha is web. It replaces Basic Memory, Executor, NotePlan, and a chatbot. The person does not connect MCPs. Executor runs in the backend.
- MVP adds Expo. Voice-to-voice is on the MVP, not the alpha.
- Gen 2 is a read-only assistant: phone calls, and a website turned into a read-only API on half a CPU core and a headless browser. He said that is not reverse-engineering. Half a CPU core is his figure. It is not an alpha limit.
- Gen 3 read-write waits on a compliance level. The level is UNKNOWN.
- $20 is the bare essential. $50 adds the voice feature. $100 is more agentic (API and calls on the person's behalf). Whether $100 includes the voice feature is UNKNOWN.

## Limits

- Voice minutes recorded before the evening of 5 Nov 2026: 300 a month on the $20 plan, 1,800 on the $50 plan. See [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md). That evening, $20 is the bare essential and $50 adds the voice feature. Whether those minute caps still apply was not restated.
- File defaults recorded 2026-10-12: 4 MiB per file, 50 MiB and 100 ready files per person.
- Undo window: at least 5 minutes (`docs/HARD_RULES.md` section 1).
- Soft-deleted accounts: 30 days, then a hard delete (`docs/HARD_RULES.md` section 10). Whether every child row returns on restore was still open on 2026-10-21.
- Web vitals and contrast: the numbers in [SPEC.md](./SPEC.md). No other performance number is set. Half a CPU core is a Gen 2 figure, not an alpha limit. This file does not set a latency number.
- A chat that holds 15 things at once, with stress at 20 and 25, was an example in the 4 Nov 2026 Nir notes. It was an example of a stress test, not a shipped cap. Do not treat 15 as a schema limit.

## Privacy

Target order recorded 2026-10-13: GDPR first, then California's equivalent, then HIPAA or something like it. "HIPAA or something like it" is his phrase. It is not a claim that Tempo is a HIPAA covered service.

- Analytics default off (`docs/HARD_RULES.md` section 10).
- Raw email, WhatsApp, and similar bodies are processed in memory and not written to Convex (`docs/HARD_RULES.md` section 6.4). Only the approved extract is kept. The Firestore target keeps that rule. This file does not name a collection.
- Export and deletion controls are required. `docs/HARD_RULES.md` names `convex/dsr.ts`. That file is not in the tree at `5504fc40`. A ticket must not call it until the path is real.
- Secrets are never written into a doc, a ticket, or a log. Names only.

## Security

- No Stripe SDK (`docs/HARD_RULES.md` section 2, and Amit 2026-10-29).
- No OpenRouter in the product path. Jev is his one exception, and it is a judge for pull requests, not a Tempo model.
- `docs/HARD_RULES.md` section 2 still bans Zustand, Redux, Firebase, Supabase, Clerk, Auth0, NextAuth, Prisma, and Drizzle. The 5 Nov loop names Firebase as the backend target. The other names stay banned. A ticket adding Firebase fails the forbidden-tech scan until `docs/HARD_RULES.md` changes. This doc set does not edit that file.
- Tenant isolation happens before a model sees text. Today that filter is the Convex query. On Firestore the same rule applies to the security rules and the server function. The Firestore rules text is UNKNOWN.
- High-stakes actions, including payments and deletions, always ask the person.

## Environments

Four lanes were decided 2026-08-13: Dev, PR preview, Staging, Production. Feature flags, not a fifth environment. Dev does not hold production keys.

Guest sign-in is preview only.

## Forbidden in a product ticket

Editing `.github/**`, `convex/schema.ts`, `convex/auth*`, or any `.env` file, unless Amit names that file in a later ticket. This doc set does not name them as editable.

## Sources

[PRD.md](./PRD.md), [TECH-STACK.md](./TECH-STACK.md), [SPEC.md](./SPEC.md). `docs/HARD_RULES.md` at `5504fc40`. Amit, 2026-10-13 through 2026-11-05.
