# Config plan

## Verdict

Each job below is a config ticket. Grok Bot is not a lane. Orchestrator is named in [FACTORY-LOOP.md](../factory/FACTORY-LOOP.md) as `orchestrator.inc`. This plan does not add a ticket for it. Lanes, when a ticket names an owner:

- Reason: cloud browser, deploys, Convex-or-Firebase, and provider/payment config. Today the backend code is still Convex. The 5 Nov target console is Firebase.
- Codex on the Railway box: repo files and checks that do not need Amit's sign-in.
- Cursor: cloud agents, Bugbot, CI. Cursor does not edit `.github/**` unless Amit names that in a later ticket. This plan does not.
- Amit: sign-ins, payments, approvals, anything legal.

A secret is a name. Nobody prints a value. Cloudflare stays. This plan does not add a Cloudflare ticket. Custom models that teach subtasks and threading are not in the alpha. Which generation is UNKNOWN. This plan does not add a ticket for them.

## Tickets

### CFG-01 Resend magic link

Owner: Amit opens the Resend account and the sending domain. Reason stores the key in the vault and sets Convex env by name.

Names: `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL`.

Who sends the magic link (Resend, Firebase Auth, or both) is UNKNOWN. The 5 Nov target is Firebase. The code is still Convex.

Done when a preview magic link arrives. Live guest sign-in is absent.

### CFG-02 Beta approval

Owner: Amit approves testers. Reason wires the allow-list names.

Names: `BETA_ALLOWLIST_EMAILS`, `BETA_MAX_TESTERS`, `BETA_FOUNDER_EMAIL`.

Done when a tester he approved has premium access, and a stranger does not.

### CFG-03 Backend consoles

Owner: Reason. Amit only if Convex or Firebase asks him to sign in.

Today: Convex dev, staging, and production. Dev does not hold a production key. Four lanes stay Dev, preview, staging, production.

The code at `5504fc40` is still Convex. The 5 Nov target is Firebase Authentication plus Cloud Firestore on the free Spark plan. Spark has no Cloud Functions and no App Hosting. Server code and every model call run as Vercel functions (FACTORY-LOOP.md, 2026-11-05). Cloudflare stays. Upgrading to the paid Blaze plan is an open decision. It is Amit's only. It is not a step in this ticket. The Firebase project id, the region, and the collection map are UNKNOWN. This ticket does not create the project and does not paste a key. A ticket adding Firebase fails `scan:forbidden-tech` until `docs/HARD_RULES.md` changes. This plan does not edit that file.

### CFG-04 Vercel `tempo-web`

Owner: Reason for deploy config. Amit for the Vercel sign-in if it is not already connected.

Done when preview is not the production domain. The production domain recorded in memory is `tempoflow.dev`. Re-check before anyone points DNS. This ticket does not change DNS.

### CFG-05 Model router target

Owner: Codex on the Railway box for the code ticket that points `convex/lib/ai_router.ts` at the alpha text target. Reason sets provider env names. Amit creates the provider account.

The alpha text target is stock GLM 5.3 Flash or DeepSeek, chosen by the task (Amit, 2026-11-05 evening). The morning line that named only GLM 5.3 Flash is older for the alpha. Qwen 8B still tags. gpt-oss-safeguard 20B stays the crisis classifier (CFG-14). Custom models that teach subtasks and threading are a later stage. Which generation is UNKNOWN. They are not in the alpha, and they are not this ticket.

The code today still calls Mistral. `MISTRAL_API_KEY` remains the name in `.env.example` until that ticket lands. The 5 Nov target is Firebase. The code is still Convex.

Done when a preview coach reply comes from stock GLM 5.3 Flash or DeepSeek, chosen by the task, and the hard-rules file is updated in that same ticket so it does not still require Mistral.

### CFG-06 Deepgram listening

Owner: Amit creates the Deepgram account. Reason sets the env name. The name in Convex is UNKNOWN until the existing voice code is read. Do not guess a variable.

The 5 Nov target is Firebase. The code is still Convex. Do not switch listening to DeepInfra.

Done when a preview session can listen. Switching to DeepInfra is not this ticket.

### CFG-07 Hebrew voice-to-voice

Owner: UNKNOWN which vendor account, because the model and the GPU (4090 or 3090) are UNKNOWN. Amit rents the GPU if there is no decent pre-built API. Reason does not rent it.

Voice-to-voice is a GPU deploy on the MVP, not the alpha. The GPU is a 4090 or a 3090, per use, not all day. Which one, which voice model, and how many years are UNKNOWN. Hebrew is in that voice deploy. Listening stays on CFG-06 (Deepgram) until a test says otherwise.

This ticket stays open. It is not buildable yet.

### CFG-08 Whop

Owner: Amit. Payments and the Whop sign-in are his.

Done when a $20 and a $50 product exist in Whop. Mapping onto `basic` / `pro` / `max` waits until he names it. Evening of 5 Nov 2026: $20 is the bare essential. $50 adds the voice feature. $100 is more agentic (API and calls on the person's behalf). Whether $100 includes the voice feature is UNKNOWN. This ticket does not add a $100 product.

### CFG-09 Paddle

Owner: Amit. Same as Whop. Paddle's October 2026 reply is summarised in [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

Done when the same two prices exist in Paddle, and Stripe is not added. The evening meanings of those two prices are in CFG-08. Whether $100 includes the voice feature is UNKNOWN. This ticket does not add a $100 product.

### CFG-10 Executor

Owner: Amit completes any OAuth consent. Reason wires the connection for Gmail as the MVP example.

On the alpha, the person does not connect MCPs. Executor runs in the backend. The 5 Nov target is Firebase. The code is still Convex.

Done when his Gmail can be connected on preview and a raw message body is not written to the store. Today that store is Convex.

### CFG-11 Reason hub

Owner: Reason. Tempo must be able to reach Reason and OpenMausBot through Executor (2026-10-29). The MCP route is `apps/web/app/api/mcp/route.ts`.

Done when a preview call lists Reason as a connection without printing a token.

### CFG-12 CI watch

Owner: Cursor, read-only, until Amit asks for a workflow edit.

Done when someone can say which workflows on `integration` are green. No new label that starts a loop, an agent, or a paid review.

### CFG-13 Bugbot and cloud agents

Owner: Amit turns anything on. Cursor may draft the outline in `docs/factory/CURSOR-AGENTS.md`. Switching on bills per use. This config plan does not switch anything on.

### CFG-14 Crisis classifier

Owner: Codex for the code seam. Amit for the provider account. Model name: gpt-oss-safeguard 20B.

The hotline copy and the exact branch (breathing, therapist, ERAN) are UNKNOWN. The ticket stays open on that copy.

## Not a config lane

Opening a bank, a store agreement, or a two-factor enrolment is Amit's. Agents stop at the sign-in wall.

## Sources

Amit, 2026-11-05, for the lanes. `.env.example` for the names above. [PRD.md](./PRD.md) and [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
