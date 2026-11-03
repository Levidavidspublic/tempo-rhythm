# Tempo Flow — Hard Rules

**Read before touching code.** These are non-negotiables for every contributor — human, Cursor IDE, Cursor Cloud agent, plugin author. If anything in this file conflicts with a PRD or a prompt, this file wins. If you find a rule you disagree with, open an issue and discuss — do not silently ignore it.

---

## 1. Product posture

Tempo Flow is an overwhelm-first personal operating system for neurodivergent people. Everything in the product serves that purpose:

- **Never shame the user.** Empty states, error messages, accountability features, and the coach must never imply failure or laziness.
- **Accept the user's reality.** If a user misses a habit for 10 days, the UI says "welcome back, want to start fresh?" — not "streak broken."
- **Accept-reject flow is law.** The AI never silently mutates user state. Every state mutation originating from the AI surfaces a confirm / edit / reject card in the UI, with preview.
- **Undo is a feature.** Every mutation that the AI performs is reversible with a one-click undo for at least 5 minutes after the fact.
- **Personalization is philosophy.** The schema is generic; the user's experience is personalized at the AI + render layer. Do not encode user-specific variants in schema columns.

---

## 2. Forbidden tech (never add as a dependency; never reference in code, env vars, or docs)

| Category | Forbidden | Use instead |
|---|---|---|
| Backend-as-a-Service | Firebase, Supabase | Convex |
| ORM | Prisma, Drizzle, TypeORM, Mongoose | Convex `v.*` validators + `defineSchema` |
| Auth | Auth0, Clerk, NextAuth, BetterAuth | Convex Auth |
| Payments | Stripe SDK direct | RevenueCat (wraps Stripe, App Store, Play Store) |
| AI provider SDKs | `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@mistralai/mistralai` | Mistral API via native `fetch` against `https://api.mistral.ai/v1/chat/completions` |
| Client state | Redux, Zustand, Jotai, Recoil, MobX | Convex reactive queries are the state |
| HTTP | Axios, ky, got | Native `fetch` |
| Direct DB clients | `mongodb`, `pg`, `mysql2` | Convex queries / mutations / actions |
| Styling | A second global utility-CSS stack on web, or downgrading `apps/web` off Tailwind v4 | **Web:** Tailwind CSS v4 (`@tailwindcss/postcss`). **Mobile:** NativeWind 4 with Tailwind 3.x in `apps/mobile` |
| Task trackers in agent spine | Notion, Linear, Airtable | GitHub Issues + GitHub Projects + `TASKS.md` + Convex `agent_*` tables + Discord |

If you believe you need one of these, open an issue first with the specific justification. Do not add it on your own authority.

---

## 3. License boundary rules

- Tempo Flow ships under Business Source License 1.1, converting to Apache 2.0 four years after each versioned release.
- **Do not add dependencies with licenses that restrict our ability to ship under BSL 1.1 or convert to Apache 2.0.** AGPL-licensed code is not acceptable as a direct dependency in the main application. LGPL dynamic linking is acceptable. MIT / BSD / Apache / MPL are all fine. ISC, Unlicense, CC0 are fine.
- **Preserve copyright headers** in any file copied or adapted from another project.
- **Never commit code from another project without verifying the license.** When in doubt, write it yourself.

---

## 4. Naming conventions

### Files

- React components: `PascalCase.tsx` (e.g. `TaskCard.tsx`, `CoachPanel.tsx`).
- Hooks: `useThing.ts`.
- Non-component TypeScript modules: `kebab-case.ts` (e.g. `parse-brain-dump.ts`, `confidence-router.ts`).
- Convex files: `kebab-case.ts` inside `convex/` (e.g. `convex/tasks.ts`, `convex/coach.ts`). **Exception:** multi-word modules must use `snake_case.ts` because the Convex platform rejects hyphens in module paths (e.g. `convex/lib/ai_router.ts`, not `ai-router.ts`).
- Route files (Next.js app router): Next conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).

### Identifiers

- Variables and functions: `camelCase`.
- Types and interfaces: `PascalCase`. Prefer `type` aliases over `interface` unless you need declaration merging.
- Constants: `SCREAMING_SNAKE_CASE` only for genuine compile-time constants (e.g. `MAX_BRAIN_DUMP_LENGTH`). Everything else is `camelCase`.
- Convex table names: plural, no prefix. `tasks`, `notes`, `journalEntries`, `libraryItems`, `coachMessages`. **Not** `t_tasks`, `tbl_notes`, etc.
- Convex query/mutation/action names: `camelCase` verbs. `listByUser`, `createTask`, `completeHabit`, `generatePlan`.

### Branch names

- `feat/<task-id>-<short-kebab>` e.g. `feat/T-042-brain-dump-extractor`
- `fix/<task-id>-<short-kebab>`
- `chore/<scope>-<short-kebab>`
- `docs/<scope>-<short-kebab>`

### PR titles

- Conventional Commits format: `feat(scope): short summary`, `fix(scope): ...`, `chore: ...`, `docs: ...`.
- Reference `TASKS.md` IDs in the body (`Task: T-042`).

---

## 5. Schema rules

Every Convex table must have, at minimum:

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tasks = defineTable({
  // Ownership — optional for Convex Auth transitional state and anonymous usage.
  userId: v.optional(v.string()),

  // Soft-delete + audit
  createdAt: v.number(),   // Date.now() at insert
  updatedAt: v.number(),   // Date.now() at every mutation
  deletedAt: v.optional(v.number()), // null/undefined = live; number = soft-deleted at

  // ...domain fields
})
  .index("by_user", ["userId", "deletedAt"])
  .index("by_user_updated", ["userId", "updatedAt"]);
```

Rules:

- **`userId` is `v.optional(v.string())`** on every table. Never `v.string()` (non-optional). Convex Auth has transitional states and some tables predate sign-in (e.g. onboarding brain dumps).
- **Every write sets `updatedAt: Date.now()`.** Never rely on Convex's internal timestamps for user-visible sort order.
- **Soft delete only.** Hard deletes are forbidden except for: RAM-only scanner staging rows, expired rate-limit buckets, and test fixtures. All user-visible data soft-deletes via `deletedAt`. Restore must be possible.
- **Indexes are mandatory.** Every table that is queried by `userId` has a `by_user` index. Do not scan.
- **Generic schema.** Do not add columns like `recipe_ingredients_json` or `routine_morning_block_id`. Those are `libraryItems` with a `type` field and a flexible `content` field. The AI layer handles per-user formatting.
- **Enumerations as `v.union` of literal strings**, not free-form strings. Example: `status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done"), v.literal("archived"))`.
- **References are `v.id("otherTable")`** not raw strings.
- **No per-user variant tables.** Never `tasks_user_123`. All users share one `tasks` table; `userId` discriminates.

### Current repository (until migration tasks)

Several tables today use **`userId: v.id("users")`** tied to Convex Auth. That is acceptable until `docs/brain/TASKS.md` reconciliation migrates toward the optional-string `userId` pattern for anonymous onboarding. New code should prefer the PRD target when adding tables.

---

## 6. AI integration rules

### 6.1 Routing

- All LLM calls go through `convex/lib/ai_router.ts` using native `fetch` against `https://api.mistral.ai/v1/chat/completions`. No vendor SDKs. When a second consumer appears outside `convex/`, migrate the router to `packages/ai/src/router.ts` (same API).
- Three tiers, explicit at every call site:
  - **`fast` → `mistral-small-latest`** — classification, extraction, tagging, short chat turns, accept-reject card copy, confidence scoring.
  - **`balanced` → `mistral-medium-latest`** — coach conversations, planning sessions, brain-dump parsing, rewrites, journal reflection.
  - **`deep` → `mistral-large-latest`** — hard multi-step reasoning, long-context synthesis, rare escalations.
- Fallback policy: on `429 / 503 / timeout`, retry same tier once with 500 ms backoff, then surface a typed error. On `context_length_exceeded`, automatically escalate `fast → balanced → deep` and stop at the first that fits. No other silent escalation.
- Rationale: direct Mistral (EU-hosted, GDPR-native, no training on paid API data by default) gives better privacy posture and lower cost than OpenRouter for our workload. OpenRouter is no longer used.
- Default `safe_prompt: false` — accept-reject + confidence router already cover this; we don't need Mistral's additional opinionated filter.

### 6.2 Accept-reject flow

- Every AI-originating mutation goes through `convex/proposals.ts` — it inserts a proposal row, the UI renders a confirm / edit / reject card, and only on confirm does the real mutation run.
- The proposal payload must be a structured preview the UI can render, not a blob of model text.
- **Never call a mutation directly from an `action` with AI-generated arguments and no user confirm.**

### 6.3 Confidence router

Every AI-originating mutation carries a `confidence: number` in the range `[0, 1]`.

- `confidence ≥ 0.8`: auto-apply, but show an inline undo toast for 5 minutes.
- `0.5 ≤ confidence < 0.8`: one-click confirm dialog.
- `confidence < 0.5`: open a clarifying dialog that asks the user the minimum questions needed to raise confidence (e.g. "Which test?", "Which 20th?", "How much time do you have?").

High-stakes categories (calendar events with real-world consequences, deletions, cross-user interactions, payments) always require confirm regardless of confidence.

### 6.4 RAM-only scanner rule

Any ingestion of third-party content (email, WhatsApp, Telegram, ChatGPT export, Claude conversation export, Obsidian vault, Apple Notes) must process in memory only:

- Raw message bodies **never** write to disk or Convex.
- The scanner extracts structured candidates (task, event, commitment, person mention), surfaces them for user approval via the accept-reject flow, and discards the source bytes when the action returns.
- Only the approved, derived records persist.
- If a user re-connects an integration, the scanner re-runs on the live source; there is no "historical cache" of raw content.
- Document the scanner entry point with a `// RAM-ONLY` comment and include a linter check (`bun run scan:ram-only-audit`) that fails if a scanner function persists raw content.

### 6.5 Coach personality setting

- `profiles.coachDial: v.number()` in the range `[0, 10]`, default `5`.
- `0` = warm, gentle, wisdom-forward mentor; `5` = peer friend; `10` = high-intensity accountability archetype (stern and direct).
- The user may override per session via the coach-settings panel.
- The system prompt for the coach includes a line: `"Current accountability dial: N / 10. Match tone accordingly."`
- Do not hard-code personality anywhere else. Tone comes from the dial only.

### 6.6 RAG retrieval

- Global RAG: default retrieval is hybrid — recent time-window (7 days) union semantic top-K union graph neighbors of any entity mentioned in the prompt.
- Scoped RAG (Tempo 1.5): when the user is in a notebook-scope session, retrieval is constrained to the selected notes, folders, projects, or tags.
- User setting `ragScope: v.union(v.literal("global"), v.literal("scoped"))` with scoped subject stored separately.
- Never include raw PII from other users in retrieval context. Tenant isolation is enforced at the Convex query layer (`userId` filter) before retrieval, not after.

---

## 7. Design system rules

### 7.1 Palette

The "Soft Editorial" palette is defined in **`packages/ui`** and **`apps/web/app/globals.css`** (Tailwind v4 `@theme` / CSS variables). Prefer semantic utilities — avoid arbitrary hex and one-off arbitrary sizing unless a token exists.

- Light and dark modes are both first-class.
- WCAG AA contrast minimum. AAA where reasonably achievable.
- Color-blind safe: never encode meaning in color alone. Pair every color with an icon, label, or pattern.

### 7.2 Typography

- Headings: Newsreader (serif).
- Body: Inter (sans).
- Monospace: IBM Plex Mono.
- **OpenDyslexic:** user-toggleable from Settings → Accessibility. When enabled, all body copy switches to OpenDyslexic. Headings remain in Newsreader by default; a secondary toggle can switch headings too.

### 7.3 Components

- Use `shadcn/ui` primitives as the foundation on web. Customize tokens, not component internals.
- On mobile, NativeWind-styled equivalents live in `packages/ui/src/native/`.
- Shared design tokens (colors, spacing, radii, shadows, type scale) consolidate in **`packages/ui`** and web **`globals.css`**; mobile maps the same semantics through NativeWind.
- Avoid arbitrary Tailwind values on new UI. If you need a new token, add it to the shared token source first.

### 7.4 Motion and feedback

- Default to `prefers-reduced-motion` respected.
- Haptics on mobile: tiny tap on task complete, medium on celebration milestones. Never on errors.
- Loading states: skeletons, not spinners, for content areas > 100 ms expected latency.

---

## 8. Accessibility rules

- **WCAG 2.1 AA minimum** across web and mobile.
- Screen-reader labels on every interactive element. Test with VoiceOver and TalkBack on real devices before shipping a feature.
- Keyboard navigation on web: every feature reachable without a mouse.
- Focus states visible. Never `outline: none` without a visible replacement.
- Touch targets ≥ 44x44 dp on mobile, ≥ 24x24 px on web with generous padding.
- Form inputs have associated `<label>` elements.
- Error text is programmatically associated with its field (`aria-describedby`).

---

## 9. Voice rules

- **Walkie-talkie (push-to-talk) voice is universal** across all tiers.
- **Live (streaming) voice is minute-capped** per tier:
  - Basic: 30 minutes per day
  - Pro: 90 minutes per day
  - Max: 180 minutes per day
- **Tracking is in minutes of real audio**, not tokens. A `voiceSessions` row opens on session start with `startedAt`, closes with `endedAt`, and computes `durationMs`. The daily budget is the sum of `durationMs` for the user's local calendar day.
- Daily budgets reset at the user's local midnight (derived from `profiles.timezone`).
- Session start checks available budget; if < 1 minute remains, walkie-talkie remains available, live voice is gated behind an upgrade prompt.

---

## 10. Privacy and compliance rules

- **GetTerms.io IDs** live in Vercel / EAS env vars: `TEMPO_GETTERMS_PRIVACY_ID`, `TEMPO_GETTERMS_TERMS_ID`, `TEMPO_GETTERMS_COOKIES_ID`. They are embedded in `app/(legal)/*` routes.
- **DSR (Data Subject Request) button** lives at Settings → Account → Privacy. Clicking it triggers `convex/dsr.ts:requestDataExport` or `requestAccountDeletion`, which enqueue a job.
- **Data export** produces a ZIP of the user's data as JSON files, one per table. Generated by a Convex action, stored in Convex file storage, link emailed via Resend.
- **Account deletion** soft-deletes immediately (all rows for that `userId` set `deletedAt = Date.now()`), with a 30-day grace window where the user can restore. After 30 days, a scheduled job hard-deletes.
- **Privacy mode** (Tempo 1.5): the user may flag their account as "privacy mode," which forces on-device inference, disables third-party analytics (PostHog opt-out), and defers all sync to manual moments.
- **Analytics are opt-in.** `profiles.analyticsOptIn: v.boolean()`, default `false`. Opt-in is set in the onboarding privacy screen, and may be toggled in Settings → Privacy at any time.

---

## 11. Testing rules

- Every new Convex mutation gets at least one test (`convex/<module>.test.ts`) — happy path + one error case minimum.
- Every React component with meaningful logic gets a render test with `@testing-library/react` (web) or `@testing-library/react-native` (mobile).
- Every AI routing function (`route-by-task`, `confidence-router`) is unit-tested with a golden fixture set.
- PRs run: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run scan:forbidden-tech`, `bun run scan:ram-only-audit`, `bun run scan:design-tokens`, `bun run check:notices` (see `docs/CI.md`). There is no `convex:schema-guard` script in root `package.json` today.
- All of these must pass before merge.

---

## 12. Git and PR rules

- **Never push to `master`.** All work lands through a pull request against `integration`. Amit merges `integration` into `master`.
- **`master` is always deployable.** If a PR would break `master` once promoted, fix the PR or revert.
- **One logical change per PR.** Large features land as a stack of PRs.
- **PR description** must reference the `TASKS.md` task ID and include:
  - Summary (2–3 sentences, *why* not *what*)
  - Screenshots or screen recording for any UI change
  - Test plan (checkable boxes)
  - Acceptance criteria copied from `TASKS.md`
- **Reviewers** are required. For Cursor Cloud agent PRs, reviewer is the human (Amit) or a second agent flagged as `reviewer`. **Factory loops (Amit, 2026-10-06):** the reviewer is Cursor Bugbot on the loop's batch PR (`batch/<loop-id>` → `integration`, see `factory/LOOP.md`); component PRs pass CI and merge into the batch branch without their own review.
- **Conventional Commits** for commit and PR titles.

---

## 13. Secrets and env vars

See `docs/ENVIRONMENTS.md` for the full four-mode contract (dev / test / preview / deployment).

- **No secrets in the repo.** Ever. Use `.env.local` locally (git-ignored) and Vercel / EAS env var config for deployed environments.
- **`.env.example`** is the canonical list. Every new env var is added there with a placeholder and a one-line comment.
- **Secret scanning** runs in CI (Gitleaks + TruffleHog in `.github/workflows/security.yml`). Never merge a PR where the scan fires.
- **Mistral keys** are scoped per environment and rotated quarterly.
- **RevenueCat** public keys are safe to ship client-side. Secret keys only in server-side Convex actions.
- **Four-mode contract.** Dev, test, preview, and deployment are different environments with different trust gates. See `docs/ENVIRONMENTS.md`.
- **Env file precedence.** `.env.local` > Vercel/Convex/EAS dashboards > `.env.example` (names only, never values). Never create `.env` (without `.local`) in any app workspace.

---

## 13.5 Ship state

- Every feature has exactly one state: `planned`, `coded`, `locally-tested`, `preview-tested`, or `shipped-and-running`.
- An agent MUST NOT describe a feature as "ready", "done", or "shipped" unless it is `shipped-and-running` (live on production Vercel + production Convex).
- Casual edits to a `shipped-and-running` feature either (a) re-verify the full ladder or (b) move the feature back to `coded`.
- `docs/SHIP_STATE.md` is the one-table source of truth. Reality wins — the table updates to match reality, not the other way around.

---

## 14. Owner-tag discipline

- **Only claim tasks whose owner tag matches your agent identity.** A `cursor-cloud-1` agent does not touch `cursor-cloud-2` work, and none of them touch `twin`, `pokee`, `zo`, or `human-amit` tasks.
- **Never ask a human to do work labeled for a code agent.** If a task is `cursor-cloud-2`, the cloud agent does it; Amit only reviews.
- **Never have a code agent click a web dashboard.** That is Twin's job. If a task genuinely requires a dashboard action, its owner tag is `twin` or `human-amit`, not `cursor-*`.

---

## 15. Ask-the-Founder queue

- Submissions land in Convex `askFounderQueue` with `userId`, `subject`, `body`, `priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"))`, `createdAt`.
- A Convex HTTP action `/ask-founder/webhook` notifies Pokee, which routes to a Google Sheet + Discord + optional SMS to the founder.
- **Never surface another user's submission to any other user.** Transcript sharing requires explicit opt-in per submission.

---

## 16. Plugin boundary

(Applies from Tempo 1.5 onwards; enforce the plumbing from day one.)

- Plugins can declare permission scopes: `read:tasks`, `write:tasks`, `read:notes`, `write:notes`, `read:coach`, etc.
- Plugins receive scoped API tokens; they never see other users' data, never see credentials, and never make direct network calls outside their declared allowed domains.
- Plugins run in sandboxed iframes on web and in constrained Convex actions server-side.
- Plugin monetization happens on patronage platforms (Patreon, Ko-fi, Buy Me a Coffee, GitHub Sponsors). Tempo Flow takes no cut.

---

## 17. If a rule feels wrong

Open an issue with:

- The rule (quote it).
- The concrete scenario where it bites.
- Your proposed alternative.
- The downside of the alternative.

Rules are updated only via PR to this file, with reviewer approval from the project owner.

---

*Last revised: this document is versioned with the repo. Check `git log docs/HARD_RULES.md` for history.*
