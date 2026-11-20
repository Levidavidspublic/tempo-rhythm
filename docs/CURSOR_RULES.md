# Tempo Flow — Cursor Rules (Annotated)

This document is the long-form companion to `.cursorrules` at the repo root. It repeats every rule Cursor must follow and explains the rationale — the "why" behind each one. When Cursor needs to decide whether a rule applies in a novel situation, the rationale here is the intended interpretation.

For the hard non-negotiables, see [`HARD_RULES.md`](./HARD_RULES.md). This file and HARD_RULES should agree; if they don't, HARD_RULES wins.

---

## 1. Read order every session

**Rule.** Read these files in order before touching code:

1. `docs/HARD_RULES.md`
2. `docs/brain/TASKS.md` (filter by your owner tag)
3. `docs/brain/PRDs/PRD_Phase_1_MVP.md` (current phase spec)
4. `docs/CURSOR_PROMPTS.md` (if you need a kickoff template)

**Rationale.** Context drift is the single biggest failure mode of long-running Cursor Cloud agents. Reading the rules first and the current PRD second keeps the agent aligned with project posture instead of free-forming from model priors. `TASKS.md` tells you what you are allowed to work on; the PRD tells you what "done" means.

---

## 2. Owner tags

**Rule.** Only claim tasks whose owner tag matches your agent identity. Valid tags: `cursor-ide`, `cursor-cloud-1`, `cursor-cloud-2`, `cursor-cloud-3`, `twin`, `pokee`, `zo`, `human-amit`.

**Rationale.** Parallel Cursor Cloud agents step on each other's files if they both grab the same feature. The cluster split (Core Features / AI & Intelligence / Platform & Polish) is designed so that most PRs touch disjoint directories. `twin` / `pokee` / `zo` tasks require non-Cursor tooling — if a Cursor agent picks one up, it will fail. `human-amit` tasks require real-world actions (card entry, 2FA SMS, Apple Developer enrollment) that no agent can do.

---

## 3. Pre-flight preamble

**Rule.** On every non-trivial task, before writing code:

1. List the files you plan to create or modify.
2. Confirm your understanding against the current PRD.
3. List any clarifying questions.
4. Wait for approval before writing code.

**Rationale.** Cursor Cloud agents that start coding immediately produce a lot of work quickly, and much of it is wrong because they misread the scope. The pre-flight pass takes five minutes and saves hours. For trivial tasks (typo fixes, single-line changes, simple renames), skip the preamble.

---

## 4. Forbidden tech

**Rule.** Do not add as dependencies, do not reference in code, do not mention in env vars or docs:

| Category | Forbidden | Use |
|---|---|---|
| Backend-as-a-Service | Supabase | Convex or Firebase (Firebase is allowed; see HARD_RULES §2) |
| ORM | Prisma, Drizzle, TypeORM, Mongoose | Convex `v.*` validators |
| Auth | Auth0, Clerk, NextAuth, BetterAuth | Convex Auth |
| Payments | Stripe direct SDK | RevenueCat (mobile); web may use Polar in this repo — converge on PRD |
| AI SDKs | `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@mistralai/mistralai` | Mistral API via native `fetch` in Convex actions (`convex/lib/ai_router.ts`) |
| Client state | Redux, Zustand, Jotai, Recoil, MobX | Convex reactive queries |
| HTTP | Axios, ky, got | Native `fetch` |
| Direct DB | `mongodb`, `pg`, `mysql2` | Convex |
| Styling | Second global CSS framework on web; removing Tailwind v4 from web | Web: Tailwind v4. Mobile: NativeWind + Tailwind 3.x |
| Task trackers in agent spine | Notion, Linear, Airtable | GitHub + `TASKS.md` + Convex + Discord |

**Rationale.**

- **Firebase:** allowed (Amit, 2026-11-08). A change may move to production once it is proven in preview.
- **Supabase:** Convex gives reactive queries, serverless functions, file storage, cron, and auth in one product. Adding another BaaS balloons infra cost and adds a sync-between-two-backends problem.
- **ORMs:** Convex's schema + validators are the ORM. Adding Prisma or Drizzle would duplicate the schema definition and introduce a second source of truth.
- **Auth libraries:** Convex Auth is designed for Convex. Third-party auth forces a user table in a second system, which fights against the tenant-isolation model.
- **Stripe direct:** RevenueCat wraps App Store, Play Store, and Stripe in a single SDK with subscription state management. Going direct means building three parallel billing systems.
- **AI SDKs:** Direct provider SDKs lock us into one vendor and add bundle weight. Convex actions call the Mistral API with native `fetch`; routing tiers live in `convex/lib/ai_router.ts`.
- **Client state libraries:** Convex queries are reactive. A Redux store on top of reactive queries is a performance and consistency problem in waiting.
- **Axios:** native `fetch` works everywhere we ship. Axios adds weight and an abstraction that is not needed.
- **Direct DB clients:** Convex is the database. We do not open direct DB connections.
- **Web vs mobile Tailwind:** The web app uses Tailwind v4 with PostCSS. The Expo app uses NativeWind with Tailwind 3.x — do not force the mobile app onto Tailwind v4 until NativeWind explicitly supports it.
- **Notion / Linear / Airtable in the agent spine:** founder preference. Use GitHub + `TASKS.md` + Convex + Discord instead.

If you think you need a forbidden dependency, open an issue first with the justification.

---

## 5. Accept-reject flow

**Rule.** The AI never silently mutates user state. Every AI-originating state change surfaces as a proposal card the user can confirm, edit, or reject.

**Rationale.** Neurodivergent users — the primary audience — often have low trust in automated systems that change things without asking. Silent mutation erodes that trust even when the mutation is correct. A small upfront friction (one click to confirm) is worth orders of magnitude more in long-term retention. Implementation lives in `convex/proposals.ts` and the UI `<ProposalCard />` component.

---

## 6. Confidence router

**Rule.** Every AI mutation carries a `confidence: number` in `[0, 1]`.

- ≥ 0.8: auto-apply with a 5-minute undo toast.
- 0.5–0.8: one-click confirm dialog.
- < 0.5: clarifying-question dialog.
- High-stakes categories (calendar events, deletions, cross-user, payments) always require explicit confirm regardless of confidence.

**Rationale.** A flat "always ask" rule creates click fatigue. A flat "always auto-apply" breaks trust. The confidence router gives the AI a quantified way to escalate the right decisions to the user. High-stakes categories override the router because the cost of a wrong auto-apply is much higher than the friction of a confirm.

---

## 7. RAM-only scanner rule

**Rule.** Any ingestion of third-party content (email, WhatsApp, Telegram, ChatGPT export, Claude export, Obsidian vault, Apple Notes) processes in memory only. Raw source bytes never write to disk or Convex. Only the approved, derived records (tasks, events, commitments, person mentions) persist, after the user approves them via the accept-reject flow.

**Rationale.** Neurodivergent users tend to be privacy-sensitive. The RAM-only posture is a differentiator: Tempo Flow can say "your scan never touched a disk." It is also a candidate patent (the ephemeral-scanner-with-derived-persistence pattern) and a compliance simplifier — there is no "raw messages" table to export or delete because there is no such table.

---

## 8. Generic schema rule

**Rule.** Convex tables are generic. Personalization happens at the AI and render layer. Same `libraryItems` table stores recipes, routines, templates, references, discriminated by a `type` field. User-specific structure emerges from RAG + prompting, not from schema columns.

**Rationale.** Overwhelm-first users have wildly different needs. Person A's "recipes" folder is a precise list; person B's is a brain-dump of cravings. Encoding either shape in the schema serves one and fights the other. A generic schema plus a personalization layer serves both. It also makes the app self-hostable: the generic schema is portable, and the user's RAG is the personalization that travels with them.

---

## 9. Default table fields

**Rule.** Every table has `userId: v.optional(v.string())`, `createdAt: v.number()`, `updatedAt: v.number()`, and `deletedAt: v.optional(v.number())`. Every mutation sets `updatedAt`. Deletes are soft (set `deletedAt = Date.now()`), not hard.

**Rationale.** `userId` optional handles anonymous onboarding and Convex Auth transitional states. `createdAt` + `updatedAt` give us user-visible sort order that does not depend on Convex internals. Soft delete means we can always recover from an AI mis-mutation and it feeds into the 30-day grace window for account deletion under GDPR.

**Current repository:** several live tables use `userId: v.id("users")` until migration tasks in `docs/brain/TASKS.md` land.

---

## 10. Design tokens only

**Rule.** Prefer design tokens and theme variables over one-off colors. No arbitrary hex in new UI unless a token already exists. For web Tailwind v4, extend tokens via CSS variables / `@theme` in `apps/web/app/globals.css` (and eventually `packages/ui`). `bun run scan:design-tokens` must pass on changed UI.

**Rationale.** Arbitrary values are how design systems erode. Once one file uses `#ff7a00` instead of `text-accent`, the next agent copies it, and within two weeks you have 17 orange-ish oranges and no way to theme. The design-token enforcer (`bun run scan:design-tokens`) fails the build on arbitrary values.

---

## 11. Accessibility

**Rule.** WCAG 2.1 AA minimum. Screen-reader labels on every interactive element. Keyboard navigation on web. 44x44 dp touch targets on mobile. Focus states visible. OpenDyslexic toggle. Reduced-motion respected.

**Rationale.** Primary audience is neurodivergent. Many have co-occurring visual, motor, or auditory differences. Accessibility is not a nice-to-have — it is the product.

---

## 12. Coach personality dial

**Rule.** `profiles.coachDial: v.number()` in `[0, 10]` controls coach tone. `0` = gentle mentor; `5` = peer friend; `10` = high-intensity accountability archetype. The current value is included in the coach system prompt. Tone comes from this dial only — do not hard-code personality elsewhere.

**Rationale.** Users want different things from the same coach. Someone with low self-compassion may benefit from a gentler tone; someone who habitually avoids work may benefit from firm accountability. A single dial — per-user default, overridable per session — lets the same model serve both without a mode-switch UI.

---

## 13. Voice tracking

**Rule.** Count minutes of real audio, not tokens. Track in `voiceSessions` (`startedAt`, `endedAt`, `durationMs`). Daily cap resets at the user's local midnight. Basic 30 min, Pro 90 min, Max 180 min.

**Rationale.** Users experience voice as time, not as token cost. "3 hours of conversation" is legible; "500k tokens of TTS" is not. Tracking in minutes also makes the degradation path clean: when budget runs out, live voice gates behind an upgrade prompt but walkie-talkie still works.

---

## 14. License hygiene

**Rule.** Do not add a dependency with a license that restricts BSL 1.1 → Apache 2.0 conversion. AGPL direct deps are not acceptable. LGPL dynamic linking, MIT, BSD, Apache, MPL, ISC, Unlicense, CC0 are all acceptable.

**Rationale.** The whole license story only works if we can convert to Apache 2.0 in four years. A single AGPL import would block that. License review is part of every `package.json` diff in PRs.

---

## 15. Compliance plumbing

**Rule.** GetTerms.io embed IDs in Vercel / EAS env vars (`TEMPO_GETTERMS_PRIVACY_ID`, `TEMPO_GETTERMS_TERMS_ID`, `TEMPO_GETTERMS_COOKIES_ID`). DSR button at Settings → Account → Privacy triggers `convex/dsr.ts:requestDataExport` or `requestAccountDeletion`. Account deletion is soft + 30-day grace + hard delete via scheduled job.

**Rationale.** GDPR, Swiss FADP, California CCPA all have teeth. Paying for GetTerms to keep policies current and having a one-click DSR path means the founder does not have to hand-respond to DSR emails at 2 a.m. The 30-day grace window is both a compliance best practice and a safety net against impulsive account deletion by an overwhelmed user.

---

## 16. Testing minimums

**Rule.** Every Convex mutation: one happy-path test + one error-case test. Every component with meaningful logic: a render test. AI routing and confidence router: unit-tested against golden fixtures.

**Rationale.** Solo-founder velocity plus agent-written code is a bug factory without tests. The minimum bar is low enough to not block development, high enough to catch most regressions. Golden-fixture tests on AI routing catch prompt drift when models are swapped.

---

## 17. PR hygiene

**Rule.** One logical change per PR. PR description references the `TASKS.md` ID. PR body includes a summary (2–3 sentences, *why* not *what*), screenshots or screen recording for UI changes, test plan (checkable boxes), and acceptance criteria copied from `TASKS.md`. Branch from `integration`; never push to `master`. Conventional Commits in titles.

**Rationale.** Small PRs review quickly and revert cleanly. Large PRs sit for days and produce merge conflicts. The structured description is the minimum information a reviewer needs to evaluate the change without going archaeological on the diff.

---

## 18. Secrets

**Rule.** No secrets in the repo. `.env.example` is the canonical list of required variables. Real values in `.env.local` (git-ignored) and Vercel / EAS env var config. Secret scanning runs in CI.

**Rationale.** A committed secret costs hours of rotation and a public embarrassment. Treat `.env.example` as schema, never carry a real value in it.

---

## 19. Kill-switches

**Rule.** Every integration with a third party (RevenueCat, Mistral, GetTerms, PostHog, Pokee) has a feature flag in Convex `flags` table that disables the integration path in an emergency. The flag is checked on every request, not just at startup.

**Rationale.** If Mistral has an outage, we need to disable AI features gracefully rather than stacking failed requests. If RevenueCat has a billing incident, we need to pause paywall enforcement rather than lock users out. Startup-only flags do not help when a dev server has been running for a week.

---

## 20. When in doubt

- Prefer simplicity over cleverness.
- Prefer Convex primitives over imported libraries.
- Prefer composition over inheritance.
- Prefer small PRs over large PRs.
- Prefer user confirmation over silent automation.
- Ask a clarifying question rather than guess.

If this file conflicts with `HARD_RULES.md`, `HARD_RULES.md` wins.

---

> Tempo Flow is an overwhelm-first product. The code we write should be calm too. Short functions, clear names, no cleverness.
