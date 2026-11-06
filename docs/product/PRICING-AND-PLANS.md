# Pricing and plans

## Verdict

$20 a month is the bare essential, so people can afford it. The bare essential is sufficient at $20. Source: Amit, 2026-11-05 evening.

$50 a month adds the voice feature. That is the only difference from $20. This confirms the 3 Nov 2026 decision. Source: Amit, 2026-11-05 evening. The 3 Nov file already said voice is the only difference.

$100 a month is more agentic than $20. It adds an API and calls on the person's behalf. It is for severe executive dysfunction. It is meant to save late fees. He gave no fee amount. This is the Gen 2 plan, because that work is expensive to run. "More agentic" is his name for what $100 adds. Source: Amit, 2026-11-05 evening.

Whether the $100 plan includes the $50 voice feature is UNKNOWN.

Payments go through Whop and Paddle. Stripe is out. Sign-in is a magic link through Resend.

Amit's prices were not re-checked against a live checkout in this pass.

## Minute split from the 3 Nov file

He did not repeat these minutes on the evening of 5 Nov. The rows below are that file's split. They are not a new evening rule.

| Plan in that file | Price | Voice-agent use in that file | Text in that file |
|---|---|---|---|
| Lower | $20 a month | 300 minutes a month (10 a day) | Same allowance as the $50 plan |
| Higher | $50 a month | 1,800 minutes a month (1 hour a day) | Same allowance as the $20 plan |

Source: `Downloads/tier-economics-2026-11-03/tempo-omniagent-tier-economics-2026-11-03.md` (2026-11-03). It calls this "Your 300 / 1,800 split." The price points were decided 2026-10-25.

`docs/HARD_RULES.md` section 9 still says live voice is 30, 90 or 180 minutes a day on Basic, Pro and Max. That file is older. The code is not changed in this job.

## NotePlan anchor

NotePlan is the price anchor next to the $20 tier. The Nir file says $12 a month or $99 a year, with a 7-day trial. Source: `Downloads/nir-followup-2026-11-05/01-cursor-tempo-docs-nir-update.md`. This pass did not re-check noteplan.co. Amit's prices stay $20, $50, and $100.

Amit kept Tempo at $20/$50/$100 and positioned it around ADHD and executive dysfunction (5 Nov 2026 evening). The earlier rationale that NotePlan has no AI was factually incorrect: NotePlan documents AI prompting, text generation, and voice transcription. [NotePlan official AI documentation](https://help.noteplan.co/article/210-ai-features), checked 6 Nov 2026. This correction does not change Tempo prices or establish which ADHD-specific features NotePlan has.

## What the code calls a plan

`convex/schema.ts` `subscriptionStates.plan` allows `none`, `trial`, `basic`, `pro`, `max`. `users.entitlementTier` allows `none`, `basic`, `pro`, `max`, `god`.

Which of `basic`, `pro` and `max` is the $20 plan, which is the $50 plan, and which name would be the $100 plan, is UNKNOWN. `god` is in the schema. What a person pays for it is UNKNOWN. Do not invent another public price.

The $100 plan is not in `subscriptionStates.plan` today.

## Payments

- Whop and Paddle (2026-10-29).
- No Stripe. Amit cannot use Stripe as an Israeli seller.
- The repo still depends on `@polar-sh/nextjs` in `apps/web` and `react-native-purchases` in `apps/mobile`. `docs/HARD_RULES.md` still says RevenueCat wraps Stripe. Those are the installed facts. The product target is Whop and Paddle. Switching them is a config and code ticket, not this doc change.
- Paddle's own reply, as recorded in `Downloads/grokbot-tempo-omniagent-2026-10-29/06-grokbot-briefing.md` (2026-10-29): an Israeli individual can sign up; no rolling reserve; 5% + $0.50 per sale; payouts in USD or EUR by wire with a $15 SWIFT fee, $100 minimum, monthly; a $1 21-day trial is fine if it is disclosed and a reminder goes out 7 days before it ends; iOS web checkout works for US customers only. This paragraph is that briefing's record of Paddle's email, not a new quote.

Whop's fee for Tempo is UNKNOWN in the sources read for this folder.

## Sign-in

- Magic link only, via Resend. No email plus password (2026-10-12, restated 2026-10-21).
- Paid sign-up gives access at once (2026-10-21).
- A separate "sign in as beta tester" path. Amit approves each tester. Beta testers get premium free (2026-10-21).
- Guest sign-in only on preview, never on live (2026-10-12).
- The schema already has `users.betaAccess` (`none`, `tester`, `founder`), `users.approvalStatus` (`pending`, `approved`, `revoked`), and `users.betaApprovedAt`.
- Env names in `.env.example`, values not recorded here: `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL`, `BETA_ALLOWLIST_EMAILS`, `BETA_MAX_TESTERS`, `BETA_FOUNDER_EMAIL`.

Passkeys exist as a route `apps/web/app/settings/passkeys/page.tsx`. The 5 Oct 2026 TRD said no passkeys. Whether that route stays is UNKNOWN. This job does not delete it.

## Who may change a price

Amit. Raising or lowering prices is executive work he kept (2026-11-04 Nir notes). Agents do not change a live price.

## History

The morning draft of this file said two paid plans, $20 and $50, were the same product, and the difference was how much voice-agent use you get. It placed $100 on Gen 2 as website-to-API, outside the two MVP prices. The evening verdict above wins. The 300 and 1,800 minute rows stay as the 3 Nov file's split.

The Nir file left an open question: keep the $20 tier, or rethink it against NotePlan's $12. The evening answer is the NotePlan paragraph above. The $20 price stays.

## Open questions

- Does the $100 plan include the $50 voice feature? UNKNOWN.
- Which schema name is $20, which is $50, and which name would be $100? UNKNOWN.
- What does `god` cost? UNKNOWN.
- What is Whop's fee for Tempo? UNKNOWN.
- Does the passkeys route stay? UNKNOWN.

## Sources

Amit, 2026-11-05 evening, over the morning draft. Basic Memory `project-tempo-flow` decisions 2026-10-12, 2026-10-21, 2026-10-25, 2026-10-29. The 3 Nov 2026 tier file named above. The Nir file named above, for the NotePlan anchor only. `convex/schema.ts` and `.env.example` at `5504fc40`. `docs/HARD_RULES.md` sections 2 and 9 as the older rule.
