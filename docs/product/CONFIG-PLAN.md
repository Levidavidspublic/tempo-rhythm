# Config plan

## Verdict

Each job below is a config ticket. Grok Bot does not own any of them. Lanes:

- Reason: cloud browser, deploys, Convex.
- Codex on the Railway box: repo files and checks that do not need Amit's sign-in.
- Cursor: cloud agents, Bugbot, CI. Cursor does not edit `.github/**` unless Amit names that in a later ticket. This plan does not.
- Amit: sign-in, payment, and approval.

A secret is a name. Nobody prints a value.

## Tickets

### CFG-01 Resend magic link

Owner: Amit opens the Resend account and the sending domain. Reason stores the key in the vault and sets Convex env by name.

Names: `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL`.

Done when a preview magic link arrives. Live guest sign-in is absent.

### CFG-02 Beta approval

Owner: Amit approves testers. Reason wires the allow-list names.

Names: `BETA_ALLOWLIST_EMAILS`, `BETA_MAX_TESTERS`, `BETA_FOUNDER_EMAIL`.

Done when a tester he approved has premium access, and a stranger does not.

### CFG-03 Convex dev, staging, production

Owner: Reason. Amit only if Convex asks him to sign in.

Done when dev does not hold a production key. Four lanes stay Dev, preview, staging, production.

### CFG-04 Vercel `tempo-web`

Owner: Reason for deploy config. Amit for the Vercel sign-in if it is not already connected.

Done when preview is not the production domain. The production domain recorded in memory is `tempoflow.dev`. Re-check before anyone points DNS. This ticket does not change DNS.

### CFG-05 Model router target

Owner: Codex on the Railway box for the code ticket that points `convex/lib/ai_router.ts` at GLM 5.3 Flash. Reason sets provider env names. Amit creates the provider account.

The code today still calls Mistral. `MISTRAL_API_KEY` remains the name in `.env.example` until that ticket lands.

Done when a preview coach reply comes from GLM 5.3 Flash, and the hard-rules file is updated in that same ticket so it does not still require Mistral.

### CFG-06 Deepgram listening

Owner: Amit creates the Deepgram account. Reason sets the env name. The name in Convex is UNKNOWN until the existing voice code is read. Do not guess a variable.

Done when a preview session can listen. Switching to DeepInfra is not this ticket.

### CFG-07 Hebrew voice-to-voice

Owner: UNKNOWN which vendor account, because the model and the GPU (4090 or 3090) are UNKNOWN. Amit rents the GPU if there is no decent pre-built API. Reason does not rent it.

This ticket stays open. It is not buildable yet.

### CFG-08 Whop

Owner: Amit. Payments and the Whop sign-in are his.

Done when a $20 and a $50 product exist in Whop. Mapping onto `basic` / `pro` / `max` waits until he names it.

### CFG-09 Paddle

Owner: Amit. Same as Whop. Paddle's October 2026 reply is summarised in [PRICING-AND-PLANS.md](./PRICING-AND-PLANS.md).

Done when the same two prices exist in Paddle, and Stripe is not added.

### CFG-10 Executor

Owner: Amit completes any OAuth consent. Reason wires the connection for Gmail as the MVP example.

Done when his Gmail can be connected on preview and a raw message body is not written to Convex.

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
