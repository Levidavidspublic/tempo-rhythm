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
| Backend-as-a-Service | Supabase | Firebase: Firebase Auth + Firestore (see below) |
| ORM | Prisma, Drizzle, TypeORM, Mongoose | Plain Firestore documents with TypeScript types. Check input in the server route (by hand or with `zod`, already a dependency) and in `firestore.rules` |
| Auth | Auth0, Clerk, NextAuth, BetterAuth | Firebase Auth (email link) |
| Payments | Stripe SDK direct | RevenueCat (wraps Stripe, App Store, Play Store) |
| AI provider SDKs | `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@mistralai/mistralai` | Mistral API via native `fetch` against `https://api.mistral.ai/v1/chat/completions` |
| Client state | Redux, Zustand, Jotai, Recoil, MobX | Firestore live reads (`onSnapshot`) are the state |
| HTTP | Axios, ky, got | Native `fetch` |
| Direct DB clients | `mongodb`, `pg`, `mysql2` | Firestore: the client SDK for a person's own data under `users/{uid}`, server routes for everything else |
| Styling | A second global utility-CSS stack on web, or downgrading `apps/web` off Tailwind v4 | **Web:** Tailwind CSS v4 (`@tailwindcss/postcss`). **Mobile:** NativeWind 4 with Tailwind 3.x in `apps/mobile` |
| Task trackers in agent spine | Notion, Linear, Airtable | GitHub Issues + GitHub Projects + `TASKS.md` + Discord |

**Firebase is the backend (Amit, 2026-11-10).** Convex was the backend before and is frozen: no edits to `convex/`, no Convex deploys, nothing new built on it. The Convex packages stay installed and are not forbidden tech, because screens that are not ported yet still read Convex. They keep working until their port lands; the order is in `docs/backlog/FIREBASE-DATA-MODEL.md`. A change may move to production once it is proven in preview (Amit, 2026-11-08, which also lifted the earlier Firebase ban in this table).

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
- Server routes: Next conventions under `apps/web/app/api/<name>/route.ts` (e.g. `apps/web/app/api/waitlist/route.ts`). Server-only helpers: `kebab-case.ts` in `apps/web/lib/server/` (e.g. `gcp-access-token.ts`).
- Old Convex files (frozen, for reading only) are `kebab-case.ts` inside `convex/`; multi-word modules there are `snake_case.ts` (e.g. `convex/lib/ai_router.ts`), because Convex rejects hyphens in module paths.
- Route files (Next.js app router): Next conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).

### Identifiers

- Variables and functions: `camelCase`.
- Types and interfaces: `PascalCase`. Prefer `type` aliases over `interface` unless you need declaration merging.
- Constants: `SCREAMING_SNAKE_CASE` only for genuine compile-time constants (e.g. `MAX_BRAIN_DUMP_LENGTH`). Everything else is `camelCase`.
- Firestore collection names: plural `camelCase`, no prefix. `tasks`, `notes`, `journalEntries`, `libraryItems`, `coachMessages`. **Not** `t_tasks`, `tbl_notes`, etc.
- Names of functions that read or write data: `camelCase` verbs. `listTasks`, `createTask`, `completeHabit`, `generatePlan`.

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

The data lives in Firestore. The map from the old Convex tables to Firestore paths is `docs/backlog/FIREBASE-DATA-MODEL.md`; where it and this section differ on a path, the map wins.

Every document a person owns must have, at minimum:

```ts
// users/{uid}/tasks/{docId}
// The uid in the path is the owner. There is no userId field.
type TaskDoc = {
  // Soft-delete + audit
  createdAt: number; // Date.now() at insert
  updatedAt: number; // Date.now() at every write
  deletedAt?: number; // missing = live; number = soft-deleted at

  // ...domain fields
};
```

Rules:

- **The path is the owner.** A person's own data lives at `users/{uid}/{collection}/{docId}`, where `uid` is the Firebase Auth user id. Never store a `userId` field to say who owns a document, and never read it to decide access.
- **Secrets and gates are private.** Token ciphertext, token hashes, OAuth secrets, authorization fields (`role`, `approvalStatus`, `isActive`, ...), billing state and shared counters live under `private/...`. `firestore.rules` denies that tree to every client; only server routes read or write it. Never put such a field under `users/{uid}`: the owner rule would let the person edit it.
- **Deny by default.** `firestore.rules` closes everything except a person's own `users/{uid}` tree. A new top-level collection is server-only unless a rules change in the same PR says otherwise, and a rules change is a backend change (AGENTS.md rule 4).
- **Every write sets `updatedAt: Date.now()`.** Never rely on Firestore's own write time for user-visible sort order.
- **Soft delete only.** Hard deletes are forbidden except for: RAM-only scanner staging rows, expired rate-limit buckets, and test fixtures. All user-visible data soft-deletes via `deletedAt`. Restore must be possible.
- **Query through an index.** Never read a whole collection and filter in code. A query that needs a composite index declares it in `firestore.indexes.json` in the same PR.
- **Generic schema.** Do not add fields like `recipe_ingredients_json` or `routine_morning_block_id`. Those are `libraryItems` with a `type` field and a flexible `content` field. The AI layer handles per-user formatting.
- **Enumerations are a union of literal strings**, not free-form strings, and are checked on write. Example: `status: "todo" | "doing" | "done" | "archived"`.
- **References store the other document's id** in a field named for what it points to (`noteId`, `conversationId`), not a copy of the other document. (EXTRAPOLATED from the data model, which keeps the Convex field names. Whether to use Firestore's reference type instead is not decided.)
- **No variant collections.** Never `tasks_v2` or `tasks_pro`. Every person's tasks are at `users/{uid}/tasks`.

### Current repository (until the ports land)

- `convex/schema.ts` is still the field reference: the Firestore fields are the same, minus `userId`. `convex/` is frozen (§2).
- Screens that are not ported yet still read and write Convex. Port them in the order the data-model doc gives, one PR each.
- Server-only collections that exist today: `waitlist` and `whopMemberships`, written by `apps/web/app/api/waitlist/route.ts` and `apps/web/app/api/whop/webhook/route.ts`.
- The rules on `integration` check only the uid. The data-model doc describes the stricter owner rule that also checks the account gate; it is not written or deployed yet.

---

## 6. AI integration rules

### 6.1 Routing

- All LLM calls go through one router using native `fetch` against `https://api.mistral.ai/v1/chat/completions`. No vendor SDKs. The router today is `convex/lib/ai_router.ts`, which is frozen with the rest of `convex/`. A new LLM call is made from a server route through the same router API at `packages/ai/src/router.ts`. That package does not exist yet: the first ticket that needs it ports the router there, unchanged.
- Three tiers, explicit at every call site:
  - **`fast` → `mistral-small-latest`** — classification, extraction, tagging, short chat turns, accept-reject card copy, confidence scoring.
  - **`balanced` → `mistral-medium-latest`** — coach conversations, planning sessions, brain-dump parsing, rewrites, journal reflection.
  - **`deep` → `mistral-large-latest`** — hard multi-step reasoning, long-context synthesis, rare escalations.
- Fallback policy: on `429 / 503 / timeout`, retry same tier once with 500 ms backoff, then surface a typed error. On `context_length_exceeded`, automatically escalate `fast → balanced → deep` and stop at the first that fits. No other silent escalation.
- Rationale: direct Mistral (EU-hosted, GDPR-native, no training on paid API data by default) gives better privacy posture and lower cost than OpenRouter for our workload. OpenRouter is no longer used.
- Default `safe_prompt: false` — accept-reject + confidence router already cover this; we don't need Mistral's additional opinionated filter.

### 6.2 Accept-reject flow

- Every AI-originating change is first written as a proposal document (`users/{uid}/coachProposals`, `users/{uid}/pageProposals`). The UI renders a confirm / edit / reject card, and only on confirm does the real write run.
- The proposal payload must be a structured preview the UI can render, not a blob of model text.
- **Never let a server route write AI-generated values into a person's data with no user confirm.**

### 6.3 Confidence router

Every AI-originating mutation carries a `confidence: number` in the range `[0, 1]`.

- `confidence ≥ 0.8`: auto-apply, but show an inline undo toast for 5 minutes.
- `0.5 ≤ confidence < 0.8`: one-click confirm dialog.
- `confidence < 0.5`: open a clarifying dialog that asks the user the minimum questions needed to raise confidence (e.g. "Which test?", "Which 20th?", "How much time do you have?").

High-stakes categories (calendar events with real-world consequences, deletions, cross-user interactions, payments) always require confirm regardless of confidence.

### 6.4 RAM-only scanner rule

Any ingestion of third-party content (email, WhatsApp, Telegram, ChatGPT export, Claude conversation export, Obsidian vault, Apple Notes) must process in memory only:

- Raw message bodies **never** write to disk, to Firestore, to logs or to any other store.
- The scanner extracts structured candidates (task, event, commitment, person mention), surfaces them for user approval via the accept-reject flow, and discards the source bytes when the request ends.
- Only the approved, derived records persist.
- If a user re-connects an integration, the scanner re-runs on the live source; there is no "historical cache" of raw content.
- Document the scanner entry point with a `// RAM-ONLY` comment and include a linter check (`bun run scan:ram-only-audit`) that fails if a scanner function persists raw content.

### 6.5 Coach personality setting

- `profiles.coachDial`: a number in the range `[0, 10]`, default `5`.
- `0` = warm, gentle, wisdom-forward mentor; `5` = peer friend; `10` = high-intensity accountability archetype (stern and direct).
- The user may override per session via the coach-settings panel.
- The system prompt for the coach includes a line: `"Current accountability dial: N / 10. Match tone accordingly."`
- Do not hard-code personality anywhere else. Tone comes from the dial only.

### 6.6 RAG retrieval

- Global RAG: default retrieval is hybrid — recent time-window (7 days) union semantic top-K union graph neighbors of any entity mentioned in the prompt.
- Scoped RAG (Tempo 1.5): when the user is in a notebook-scope session, retrieval is constrained to the selected notes, folders, projects, or tags.
- User setting `ragScope: "global" | "scoped"` with scoped subject stored separately.
- Never include raw PII from other users in retrieval context. Tenant isolation comes from the path: retrieval reads only under `users/{uid}/...` for the signed-in uid. It is enforced before retrieval, not after.

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
- **Tracking is in minutes of real audio**, not tokens. A voice session document opens on session start with `startedAt`, closes with `endedAt`, and computes `durationMs`. It is server-only (`private/{uid}/voiceLeases/{docId}`): the client never writes it, because the shared daily cap is summed from these documents. The daily budget is the sum of `durationMs` for the user's local calendar day.
- Daily budgets reset at the user's local midnight (derived from `profiles.timezone`).
- Session start checks available budget; if < 1 minute remains, walkie-talkie remains available, live voice is gated behind an upgrade prompt.

---

## 10. Privacy and compliance rules

- **GetTerms.io IDs** live in Vercel / EAS env vars: `TEMPO_GETTERMS_PRIVACY_ID`, `TEMPO_GETTERMS_TERMS_ID`, `TEMPO_GETTERMS_COOKIES_ID`. They are embedded in `app/(legal)/*` routes.
- **DSR (Data Subject Request) button** lives at Settings → Account → Privacy. Clicking it calls a server route that queues a data export or an account deletion. (UNKNOWN: these routes are not built on Firebase yet.)
- **Data export** produces a ZIP of the user's data as JSON files, one per collection. Generated by a server route, link emailed via Resend. Where the ZIP is stored is UNKNOWN: Firebase Storage is not enabled, and turning it on needs a paid plan, which is the owner's decision.
- **Account deletion** soft-deletes immediately: the account gate `private/{uid}/account/gate` and every document under `users/{uid}` get `deletedAt = Date.now()`. There is a 30-day grace window where the user can restore. After 30 days, a scheduled job hard-deletes. (UNKNOWN: which scheduler runs that job.)
- **Privacy mode** (Tempo 1.5): the user may flag their account as "privacy mode," which forces on-device inference, disables third-party analytics (PostHog opt-out), and defers all sync to manual moments.
- **Analytics are opt-in.** `profiles.analyticsOptIn`: a boolean, default `false`. Opt-in is set in the onboarding privacy screen, and may be toggled in Settings → Privacy at any time.

---

## 11. Testing rules

- Every new server route and every new module that writes data gets at least one test beside it (`<module>.test.ts`) — happy path + one error case minimum.
- A change to `firestore.rules` gets rule tests, allowed and denied cases, that pass before it is deployed anywhere. (EXTRAPOLATED: this is the Firebase form of the one-test-per-mutation rule. UNKNOWN: the repo has no rules-test command yet.)
- Every React component with meaningful logic gets a render test with `@testing-library/react` (web) or `@testing-library/react-native` (mobile).
- Every AI routing function (`route-by-task`, `confidence-router`) is unit-tested with a golden fixture set.
- PRs run: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run scan:forbidden-tech`, `bun run scan:ram-only-audit`, `bun run scan:design-tokens`, `bun run check:notices` (see `docs/CI.md`).
- All of these must pass before merge.
- **Merging (Amit, 2026-11-08):** Agents may merge a PR when it is secure and every required check passes (CodeRabbit, Jev, CI), or when Amit explicitly says so. Merging into the live branch stays Amit's job.

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
- **RevenueCat** public keys are safe to ship client-side. Secret keys only in server routes.
- **Firebase needs no secret.** The web config values (`NEXT_PUBLIC_FIREBASE_*`) are public. Server routes reach Google with keyless access (the `GCP_*` names in `docs/backlog/FIREBASE-ENV-MAPPING.md`). Never create, download or commit a service-account key.
- **Four-mode contract.** Dev, test, preview, and deployment are different environments with different trust gates. See `docs/ENVIRONMENTS.md`.
- **Env file precedence.** `.env.local` > Vercel / EAS dashboards > `.env.example` (names only, never values). Never create `.env` (without `.local`) in any app workspace.

---

## 13.5 Ship state

- Every feature has exactly one state: `planned`, `coded`, `locally-tested`, `preview-tested`, or `shipped-and-running`.
- An agent MUST NOT describe a feature as "ready", "done", or "shipped" unless it is `shipped-and-running` (live on production Vercel, backed by the production Firebase project).
- Casual edits to a `shipped-and-running` feature either (a) re-verify the full ladder or (b) move the feature back to `coded`.
- `docs/SHIP_STATE.md` is the one-table source of truth. Reality wins — the table updates to match reality, not the other way around.

---

## 14. Owner-tag discipline

- **Only claim tasks whose owner tag matches your agent identity.** A `cursor-cloud-1` agent does not touch `cursor-cloud-2` work, and none of them touch `twin`, `pokee`, `zo`, or `human-amit` tasks.
- **Never ask a human to do work labeled for a code agent.** If a task is `cursor-cloud-2`, the cloud agent does it; Amit only reviews.
- **Never have a code agent click a web dashboard.** That is Twin's job. If a task genuinely requires a dashboard action, its owner tag is `twin` or `human-amit`, not `cursor-*`.

---

## 15. Ask-the-Founder queue

- Submissions land in an `askFounderQueue` collection with `subject`, `body`, `priority: "low" | "medium" | "high"`, `createdAt`. A server route writes them, and they are server-only. (UNKNOWN: the exact Firestore path. It is not in the data-model doc yet.)
- A server route notifies Pokee, which routes to a Google Sheet + Discord + optional SMS to the founder.
- **Never surface another user's submission to any other user.** Transcript sharing requires explicit opt-in per submission.

---

## 16. Plugin boundary

(Applies from Tempo 1.5 onwards; enforce the plumbing from day one.)

- Plugins can declare permission scopes: `read:tasks`, `write:tasks`, `read:notes`, `write:notes`, `read:coach`, etc.
- Plugins receive scoped API tokens; they never see other users' data, never see credentials, and never make direct network calls outside their declared allowed domains.
- Plugins run in sandboxed iframes on web and in constrained server routes on the server.
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
