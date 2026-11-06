# Proposed rule reconciliation — 6 Nov 2026

Status: DRAFT, OWNER REVIEW REQUIRED. These are replacement proposals, not effective rule overrides. Current default-branch `docs/HARD_RULES.md`, `AGENTS.md`, `factory/SLOTS.md` and `docs/ENVIRONMENTS.md` continue to govern until their approved changes land. No code, workflow, provider setting or repository protection changes here.

Source: Amit's adopted 6 Nov long run and Reason backend scope. These supersede the older planning assumptions described below, but the repository's owner-review route remains required. Do not relabel this proposal as a completed `docs/DECISIONS.md` entry.

## Exact replacement proposals for the rule PR

| Owning location | Current instruction to replace | Proposed replacement |
|---|---|---|
| `docs/HARD_RULES.md` §2, Backend-as-a-Service row | Firebase forbidden; use Convex | Firebase Authentication and Cloud Firestore on Spark are the new backend target. Supabase remains forbidden. Retain existing Convex code and data pending a backed-up migration, verification and rollback plan. No Blaze upgrade. |
| `docs/HARD_RULES.md` §2, Auth/ORM/state/direct DB rows | Only Convex APIs describe the permitted backend | Retained Convex code follows existing Convex rules. New Firebase code follows the reviewed DATA-CONTRACT and AUTH-CONTRACT; server code and model calls run in Vercel functions. No new state library, ORM or direct DB client is authorized by this change. |
| `docs/HARD_RULES.md` §6.1 | All model calls must use Mistral through the Convex router | New model calls run through a named server-only Vercel adapter using native fetch and the approved task/provider lane. No client-side provider keys, vendor SDKs, OpenAI API billing or OpenRouter runtime. The Jev CI judge is the sole OpenRouter exception. Exact exports, timeout/retry/limits and model selection belong to the reviewed CHAT-CONTRACT. Existing Mistral code remains retained legacy behavior until that migration is verified. |
| `docs/HARD_RULES.md` §2 payment row | RevenueCat wraps Stripe | No new Stripe integration. Payment/account/legal actions remain Amit's; product processor choice and entitlement mapping follow PRICING-AND-PLANS and the reviewed payment contract. Retained legacy code is not removed by this rule draft. |
| `docs/HARD_RULES.md` §12 review; `AGENTS.md` rule 12; `factory/SLOTS.md` B-5/B-6 and invocation section | Bugbot invocation/gate conflicts with the CodeRabbit slot | CodeRabbit fills the review role. Component/batch review placement and required gate wiring must be verified against the approved factory process. Do not invoke an older Bugbot review command. Bugbot/security automations are separately scoped and cost-gated; this change neither starts them nor changes required checks. |
| `AGENTS.md` read-first/layout; `factory/SLOTS.md` A-4 | Six docs live outside the repo or canonical store UNKNOWN | Product docs are under `docs/product/`, beginning with README. Default-branch project rules outrank draft product prose. Wiki and Downloads copies are mirrors/history. |
| `factory/SLOTS.md` backend row | Convex is the only backend | Current implementation: retained `convex/`. Target: Firebase Spark plus Vercel functions; exact new file/export map is OPEN. Target configuration is not implementation evidence. |
| `docs/HARD_RULES.md` §5/§13 | Convex schema/env instructions imply all future code | Scope these instructions to retained Convex code. A reviewed Firebase contract must define ownership, field types, immutable/server-only fields, indexes, migration identity mapping and environment mapping before target code. No inferred schema or client self-upgrade rights. |

The environment names remain Dev, Test, Preview and Deployment. Test and Preview share the existing test deployment. The proposed Firebase/Vercel map is OPEN; no separate staging tier or fourth Convex deployment is implied.

## Unresolved owner policy — do not decide in a cleanup

- Confidence: §1/§6.2 require confirmation for every AI mutation, while §6.3 permits high-confidence auto-apply. Keep affected tickets OPEN until Amit selects the policy; no threshold or guard is weakened.
- Voice entitlements: current hard-rule daily Basic/Pro/Max limits and historical monthly 300/1,800 figures do not establish entitlements for the evening $20/$50/$100 meanings. Keep price points; ask for the mapping and current limits only when needed.
- Factory branch path: root instructions include both batch-branch and direct-integration paths. Resolve the actual approved branch/review/queue route in the dedicated factory configuration change, prove one ticket reaches preview, then pause automations. No paid review is started by a documentation correction.
- Live release remains Amit's even where older loop prose implies automatic release. Region, legal consent, billing upgrades and account creation are not invented here.

## Required evidence before this proposal becomes effective

Owner-reviewed rule PR; exact enforcement changes in their authorized config scope; positive and negative scan fixtures (Firebase permitted, unauthorized stack still rejected); no lowered threshold or removed test; real preview evidence for target configuration. Existing Convex data, backups and rollback path must remain available until an explicitly approved cutover.
