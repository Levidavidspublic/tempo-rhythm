# Pricing and plans

## Verdict

Two paid plans: $20 a month and $50 a month. Both are the same product. The difference is how much voice-agent use you get. Payments go through Whop and Paddle. Stripe is out. Sign-in is a magic link through Resend.

These are Amit's figures. They are not re-checked here.

## The two plans

| Plan | Price | Voice-agent use | Text |
|---|---|---|---|
| Lower | $20 a month | 300 minutes a month (10 a day) | Same allowance as the $50 plan |
| Higher | $50 a month | 1,800 minutes a month (1 hour a day) | Same allowance as the $20 plan |

Source of the minute split: `Downloads/tier-economics-2026-11-03/tempo-omniagent-tier-economics-2026-11-03.md` (2026-11-03), which calls it "Your 300 / 1,800 split." The price points were decided 2026-10-25. The "voice is the difference" line was restated 2026-11-03 and 2026-11-05.

`docs/HARD_RULES.md` section 9 still says live voice is 30, 90 or 180 minutes a day on Basic, Pro and Max. That file is older. The $20 / $50 minute split wins for the product. The code is not changed in this job.

## What the code calls a plan

`convex/schema.ts` `subscriptionStates.plan` allows `none`, `trial`, `basic`, `pro`, `max`. `users.entitlementTier` allows `none`, `basic`, `pro`, `max`, `god`.

Which of `basic`, `pro` and `max` is the $20 plan, and which is the $50 plan, is UNKNOWN. `god` is in the schema. What a person pays for it is UNKNOWN. Do not invent a third public price.

A $100 a month plan was named for Gen 2 (website-to-API). It is not one of the two MVP prices. It is not in `subscriptionStates.plan` today.

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

## Sources

Amit, 2026-11-05. Basic Memory `project-tempo-flow` decisions 2026-10-12, 2026-10-21, 2026-10-25, 2026-10-29. The 3 Nov 2026 tier file named above. `convex/schema.ts` and `.env.example` at `5504fc40`. `docs/HARD_RULES.md` sections 2 and 9 as the older rule.
