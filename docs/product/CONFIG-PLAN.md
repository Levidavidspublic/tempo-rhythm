# Config plan

## Verdict

Each job below is a config ticket. Grok Bot is not a lane. Orchestrator is named in [FACTORY-LOOP.md](../factory/FACTORY-LOOP.md) as `orchestrator.inc`. This plan does not add a ticket for it. Lanes, when a ticket names an owner:

- Assigned backend/configuration agent: the former Reason lane, now coordinated by Codex for this run. Firebase Spark and Vercel target; retained Convex is the current implementation. One writer per system. Preview configuration is allowed; live deployment remains Amit's.
- Codex and its assigned workers: repository/configuration work in isolated checkouts or the explicitly assigned Railway lane. The assigned backend/configuration agent may create the named project and keys through Amit's existing signed-in sessions, store and inject secrets through the 1Password dev vault, and record names only (Amit, 6 Nov 2026). New accounts, terms, payments, Google sign-in, and plan upgrades remain Amit's.
- Cursor: cloud agents, Bugbot, CI. Cursor does not edit `.github/**` unless Amit names that in a later ticket. This plan does not.
- Amit: sign-ins, payments, approvals, anything legal.

A secret is a name. Nobody prints a value. Cloudflare stays. This plan does not add a Cloudflare ticket. Custom models that teach subtasks and threading are not in the alpha. Which generation is UNKNOWN. This plan does not add a ticket for them.

## Tickets

### CFG-01 Resend magic link

Owner: assigned configurator checks the existing account and sending-domain state, may create the named key and store it in the dev vault, then injects by name into the environment selected by the auth contract. New accounts, terms, or required consent remain Amit's. Do not default new target secrets to Convex.

Names: `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL`.

The 6 Nov FIREBASE-PLAN names Resend as Tempo's sender; the exact Firebase email-link delivery integration remains OPEN. The 5 Nov target is Firebase. The code is still Convex.

Done when a preview magic link arrives. Live guest sign-in is absent.

### CFG-02 Beta approval

Owner: Amit approves testers. Reason wires the allow-list names.

Names: `BETA_ALLOWLIST_EMAILS`, `BETA_MAX_TESTERS`, `BETA_FOUNDER_EMAIL`.

Done when a tester he approved has premium access, and a stranger does not.

### CFG-03 Backend consoles

Owner: Reason. Amit only if Convex or Firebase asks him to sign in.

The existing four-mode contract is Dev, Test, Preview, and Deployment in [ENVIRONMENTS.md](../ENVIRONMENTS.md). Test and Preview share the test deployment; there is no separate staging tier. The future Firebase/Vercel mapping is OPEN. Do not provision four Convex deployments or invent a new tier.

The code at `5504fc40` is still Convex. The 5 Nov target is Firebase Authentication plus Cloud Firestore on the free Spark plan. Spark has no Cloud Functions and no App Hosting. Server code and every model call run as Vercel functions (FACTORY-LOOP.md, 2026-11-05). Cloudflare stays. The current 6 Nov instruction is Spark only, never Blaze. The 5 Nov open-upgrade wording is superseded history, not an actionable decision or a step in this ticket. The Firebase project id, the region, and the collection map are UNKNOWN. The assigned backend/configuration agent may create the named project and keys through Amit's existing signed-in sessions, store and inject secrets through the 1Password dev vault, and record names only (Amit, 6 Nov 2026). New accounts, terms, payments, Google sign-in, and plan upgrades remain Amit's. Project id, region, and environment mapping must be recorded from evidence; this document does not claim they are SET. The current forbidden-tech rule and its enforcement must be reconciled through owner review before dependent implementation. [RULE-RECONCILIATION.md](./RULE-RECONCILIATION.md) proposes the exact change; no check is disabled.

### CFG-04 Vercel `tempo-web`

Owner: Reason for deploy config. Amit for the Vercel sign-in if it is not already connected.

Done when preview is not the production domain. The production domain recorded in memory is `tempoflow.dev`. Re-check before anyone points DNS. This ticket does not change DNS.

### CFG-05 Model router target

Owner: assigned backend worker for the Vercel server adapter contract and code-map ticket; assigned configurator for existing-account provider keys. New provider accounts remain Amit's. `convex/lib/ai_router.ts` is retained legacy code, not the new target seam. Exact Vercel export/path is OPEN in BUILD-CONTRACT-GAPS.md.

The alpha text target is stock GLM 5.3 Flash or DeepSeek, chosen by the task (Amit, 2026-11-05 evening). The morning line that named only GLM 5.3 Flash is older for the alpha. Qwen 8B still tags. gpt-oss-safeguard 20B stays the crisis classifier (CFG-14). Custom models that teach subtasks and threading are a later stage. Which generation is UNKNOWN. They are not in the alpha, and they are not this ticket.

The code today still calls Mistral. `MISTRAL_API_KEY` remains the name in `.env.example` until that ticket lands. The 5 Nov target is Firebase. The code is still Convex.

Done when a preview coach reply comes from stock GLM 5.3 Flash or DeepSeek, chosen by the task, and the hard-rules file is updated in that same ticket so it does not still require Mistral.

### CFG-06 Deepgram listening

Owner: Amit creates the Deepgram account. Reason sets the env name. The name in Convex is UNKNOWN until the existing voice code is read. Do not guess a variable.

The 5 Nov target is Firebase. The code is still Convex. Do not switch listening to DeepInfra.

Done when a preview session can listen. Switching to DeepInfra is not this ticket.

### CFG-07 Hebrew voice-to-voice

Owner: assigned voice/configuration lane. [VOICE-TO-VOICE.md](./VOICE-TO-VOICE.md) records the 6 Nov hosted-first STT → text → TTS proposal and its evidence gaps. Hebrew voice belongs to MVP, not Alpha. NanoGPT is the initial requested chain; eligible Hebrew model availability, retention terms and measured quality remain UNKNOWN. This document does not silently replace the existing Deepgram listener.

A per-use 4090/3090 or other GPU is a conditional later path if the hosted API is inadequate, not a prerequisite to the initial chain. New accounts, terms and payments remain Amit's. No GPU, endpoint or paid test is started by this docs correction. Exact provider/model, GPU fit, cold start, rental quote and entitlements remain OPEN.

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

Owner: assigned CI worker. The 6 Nov run explicitly authorizes the named factory CI changes on a separate config branch. This document changes no workflow and does not start a paid review.

Done when someone can say which workflows on `integration` are green. No new label that starts a loop, an agent, or a paid review.

### CFG-13 Bugbot and cloud agents

Owner: assigned automation worker under the 6 Nov run. Prepare capped test runs only after the run's cost gate, then pause the automations as requested. This docs change does not activate any automation; a configured cap or a successful paid test is UNKNOWN here.

### CFG-14 Crisis classifier

Owner: Codex for the code seam. Amit for the provider account. Model name: gpt-oss-safeguard 20B.

The hotline copy and the exact branch (breathing, therapist, ERAN) are UNKNOWN. The ticket stays open on that copy.

## Not a config lane

Opening a bank, a store agreement, or a two-factor enrolment is Amit's. Agents stop at the sign-in wall.

## Sources

Amit, 2026-11-05, for the lanes. `.env.example` for the names above. [PRD.md](./PRD.md) and [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).
