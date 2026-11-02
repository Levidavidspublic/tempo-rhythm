# Backlog conventions (shared) — Phase 1, 2 Nov 2026

One source of truth for every ticket in [`BACKLOG-v2.md`](./BACKLOG-v2.md). Decided once here so no
ticket re-decides it. Verified against this repo at branch `docs/source-2026-11-01`
(Next.js 16.0.0, React 19.2.3, Convex 1.32, bun 1.3.9). When a ticket contradicts this file, this
file wins and the ticket is out of date.

---

## 1. Test commands (exact — do not invent others)

| Purpose | Command |
|---|---|
| Full suite (CI `Test` job) | `bun run test` — runs `scripts/test-suites.ts all`: the ten `tests/unit/kb-*.test.tsx` browser suites one at a time, then unit |
| Unit only | `bun run test:unit` |
| Browser suites only | `bun run test:browser` |
| **One test file (a ticket's DONE)** | `bun test <path>` (bun's own runner, e.g. `bun test convex/notes.test.ts`) |
| Playwright e2e, one spec (a UI ticket's DONE) | `CI=1 bunx playwright test <spec> --reporter=line` |
| Playwright e2e, full | `bunx playwright test` |
| Lint | `bun run lint` |
| Typecheck | `bun run typecheck` |
| Build | `bun run build` |

**`bun test <path>` runs one file. `bun run test <path>` is WRONG and does not run the file:**
`scripts/test-suites.ts` treats any extra argument as a *browser-suite name filter*, finds no
`tests/unit/kb-*.test.tsx` match, and exits 2. The two must never be mixed.

## 2. Convex function tests

- Convex tests use **`bun:test`** plus the fake context in **`convex/lib/testFakeCtx.ts`**
  (`makeFakeCtx`, `run`). They are **not** Vitest and **not** `convex-test` — `convex-test` is
  legacy and used only by `convex/pageCleanup.test.ts`.
- Test files live next to the code they test: `convex/<file>.test.ts` and `convex/lib/<file>.test.ts`.
- Run a single file with `bun test convex/<file>.test.ts`; the group runs under `bun run test:unit`.

## 3. E2E foundation (how a UI test signs in, seeds, forces error/offline, switches locale)

- **Signed-in session:** the repo's dev-only auth bypass — `NODE_ENV !== "production"` **and**
  `TEMPO_E2E_AUTH_BYPASS === "1"` **and** `NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1"`. The Playwright
  `webServer` in `playwright.config.ts` already sets all three. The bypass only releases routes in
  `isCoreTaskViewRoute` (`/today`, `/tasks`, `/projects`) or `E2E_WIRING_ROUTES`
  (`apps/web/lib/e2eWiringRoutes.ts`). A UI spec opens one of those routes, or registers its route
  there first.
- **Seed:** no shared seed database. A component spec seeds through the component's documented
  props in the harness page (a static, data-free render). A backend/Convex test seeds through
  `convex/lib/testFakeCtx.ts` (`makeFakeCtx`, `run`). A screen spec seeds through `?state=` query
  params or `page.route(…)` mocks — never live Convex.
- **Force error / offline:** `?state=error` and `?state=offline` (the components.md §4 StateSwitch
  contract), or `page.route(…)` aborting the network for offline. Every state must be forceable.
- **Locale switch:** `?lang=en|he` plus the real **`LocaleProvider`**
  (`apps/web/components/providers/LocaleProvider.tsx`, hook `useLocale()`). `resolveLang` precedence
  is URL `?lang=` → `localStorage["tempo-lang"]` → English; `dirFor("he") === "rtl"`. UI harnesses
  wrap in `LocaleProvider`, never a hand-rolled context.

## 4. Component render harness (TFV2-0023a)

- Runs under the **same server the e2e job uses**: `bun run --cwd apps/web dev` (the Playwright
  `webServer` command), with the bypass flags above.
- Route: **`/e2e/components/<id>`**. The shared frame lives at
  `apps/web/app/e2e/components/layout.tsx` (a server component) and wraps children in `<Suspense>` +
  a client `HarnessFrame` (`apps/web/lib/e2e/HarnessFrame.tsx`) that reads `?lang=` / `?theme=` with
  `useSearchParams()` **inside Suspense**, wraps in `LocaleProvider`, applies `dir` / `lang` /
  `data-theme`, and calls `notFound()` unless the bypass flags are set.
- `/e2e/components` and its children are added to `E2E_WIRING_ROUTES` in
  `apps/web/lib/e2eWiringRoutes.ts`.
- **No shared catalog file.** Each component ticket creates its **own**
  `apps/web/app/e2e/components/<id>/page.tsx` (a client component) that renders its component in
  every documented state under `data-testid="<id>-<state>"`. One broken page breaks only its own
  route; parallel builders never edit the same file.
- Each component ticket's DONE runs its own spec:
  `CI=1 bunx playwright test tests/e2e/screens/<id>.spec.ts --reporter=line`.

## 5. Token names (the `--tp-*` custom properties actually defined)

Source of truth: `docs/design/v3/tokens.css` and `apps/web/app/globals.css`. Tickets reference these
names, never invent a token.

- **Text scale:** `--tp-text-xs` 13 · `--tp-text-sm` 15 · `--tp-text-md` 17 (base) ·
  `--tp-text-lg` 20 · `--tp-text-xl` 24 · `--tp-text-2xl` 30 · `--tp-text-3xl` 38 ·
  `--tp-text-4xl` 48. (DESIGN.md §3 lists a heading *intent* of 26/32/42 for xl/2xl/3xl; that
  "Run 2 polish" bump is not yet in tokens.css, so tickets name the token and do **not** assert a
  pixel value that contradicts tokens.css.)
- **Spacing** (4 px scale): `--tp-space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 ·
  `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64 · `-20` 80.
- **Radius:** `--tp-radius-sm` 6 · `--tp-radius-md` 10 · `--tp-radius-lg` 14 · `--tp-radius-xl` 20 ·
  `--tp-radius-pill` 999.
- **Color:** `--tp-ground` `--tp-paper` `--tp-sunken` `--tp-hover` `--tp-ink` `--tp-ink-muted`
  `--tp-ink-subtle` `--tp-line` `--tp-line-strong` `--tp-line-control` `--tp-accent`
  `--tp-on-accent` `--tp-accent-wash` `--tp-done` `--tp-done-wash` `--tp-info` `--tp-info-wash`
  `--tp-caution` `--tp-caution-wash` `--tp-danger` `--tp-danger-wash` `--tp-glass`
  `--tp-glass-solid` `--tp-glass-line` `--tp-scrim`.
- **Type/lead/track:** `--tp-font-serif` `--tp-font-sans` `--tp-font-mono` `--tp-leading-body`
  `--tp-leading-heading` `--tp-leading-snug` `--tp-tracking-body` `--tp-tracking-label`
  `--tp-word-spacing` `--tp-measure`.
- **Focus:** `--tp-focus-w` (2px) · `--tp-focus-gap` (2px).
- **Layout:** `--tp-rail-w` 264 · `--tp-coach-w` 400 · `--tp-topbar-h` 56 · `--tp-tabbar-h` 64 ·
  `--tp-touch` 44 · `--tp-paper-max` 760.
- **Motion:** `--tp-dur-fast` 120 · `--tp-dur-base` 180 · `--tp-dur-slow` 240 · `--tp-dur-exit` 160 ·
  `--tp-ease-in` `--tp-ease-out`. Nothing exceeds 250 ms; `prefers-reduced-motion` collapses to
  instant. Shadows: `--tp-shadow-whisper` `--tp-shadow-card` `--tp-shadow-float` `--tp-shadow-modal`.

## 6. Where each kind of test lives

| Kind | Location | Run with |
|---|---|---|
| Convex function test | `convex/<file>.test.ts`, `convex/lib/<file>.test.ts` | `bun test convex/…` |
| Shared package test (`packages/ui`, `packages/utils`) | `packages/*/src/**/*.test.ts(x)` | `bun test packages/…` |
| Web component render test | `apps/web/components/**/*.test.tsx` | `bun test apps/web/components/…` |
| Web lib test | `apps/web/lib/*.test.ts` | `bun test apps/web/lib/…` |
| Browser suite (React DOM + fixture server) | `tests/unit/kb-*.test.tsx` | `bun run test:browser` |
| Playwright e2e spec | `tests/e2e/**/*.spec.ts` | `CI=1 bunx playwright test … --reporter=line` |

Tests live in the package of the code they test. No tautological tests (a test must assert real
behaviour, not echo the implementation). Exact strings match real framework output.

## 7. Ticket rules (A–H) — restated as standing law

- **A.** Every UI test must be runnable through §3: sign in (bypass), seed, force error/offline,
  switch locale. It names the exact fixture, seed, locale switch and harness entry it uses.
- **B.** A dependency change lists `package.json` **and** `bun.lock` in SCOPE with a pinned version,
  or the ticket goes to the config lane (`config lane: Amit`).
- **C.** `Depends` lists every function, file, table or component another ticket creates, and that
  ticket comes earlier in build order.
- **D.** Tests live in the package of the code they test; no tautological tests; exact strings match
  real framework output; copy never contradicts its own test.
- **E.** Framework: Convex file names use only letters, digits, `_` and `.` (no hyphens). Expo
  Router: no non-route files in `app/`. Token names match §5.
- **F.** Every state is forceable and has a measurable assertion.
- **G.** Any undecided product choice makes the ticket `OPEN` with the question for Amit.
  `OPEN: none` must be true — no hidden choices such as `minmax(…)`, soft-vs-hard delete, an `e.g.`
  list, or week start.
- **H.** One function per backend ticket (split bundles). Every error code is tested. No
  contradictions ("never rejects" vs "throws", "positive integers" vs allowing 0). "Bytes" = UTF-8
  byte length (`new TextEncoder().encode(x).length`), never `JSON.stringify` length.

## 8. Backend conventions

- **Error mechanism:** follow the code. Where a module already throws `throw new Error("<exact
  message>")`, the ticket gives that exact message. Use `ConvexError` codes only where the file
  already uses them, or for a new file. Every error is tested.
- **"Bytes"** is UTF-8 length, not JSON string length.
- **One function per ticket** — `save` and `patchBlock` are two tickets, not one.
