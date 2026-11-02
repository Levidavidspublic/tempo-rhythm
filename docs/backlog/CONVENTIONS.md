# Backlog conventions (shared) — Phase 1, 2 Nov 2026 · extended for the Opus rewrite (§9–§21), 2 Nov 2026 · fix round 1 (§23 and edits in §1, §13, §15, §16, §19, §22), 2 Nov 2026

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

| One browser suite (`tests/unit/kb-*.test.tsx`, a ticket's DONE) | `bun test tests/unit/kb-<n>.test.tsx --max-concurrency=1` — the exact command `scripts/test-suites.ts` runs for one suite |

No other command forms. Never `bun run test:browser <path>` or `bun run test <path>` in a STEP, DONE,
EVIDENCE or TEST. EVIDENCE names the same command as DONE, word for word: "the summary of
`<DONE command>` pasted into the PR".

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

---

# Part 2 — decided once for the Opus rewrite (2 Nov 2026)

Everything below is fixed here so no ticket re-decides it. A ticket that needs something this part
does not cover is `OPEN` with the exact question for Amit (§19), never a silent choice.

## 9. One unit per ticket — the file sets

At most **3 files + 1 test file** per ticket (TICKET-STANDARD "Sizing"). Each ticket kind has a fixed
file set. A ticket never lists a file outside its set; a bigger unit is split into `a`/`b`/`c` tickets.

| Kind | Files (max 3) | Test (1) | DONE command |
|---|---|---|---|
| Backend function (one exported Convex function) | `convex/<module>.ts` (+ at most one `convex/lib/<helper>.ts` it alone needs) | `convex/<module>.test.ts` | `bun test convex/<module>.test.ts` |
| Pure helper | `convex/lib/<name>.ts` or `packages/<pkg>/src/<name>.ts` | next to it, `<name>.test.ts` | `bun test <that test path>` |
| Web component | `apps/web/components/<area>/<Name>.tsx` · `apps/web/components/<area>/<Name>.css` (Case B of §10 only) · `apps/web/app/e2e/components/<kebab-name>/page.tsx` | `tests/e2e/screens/<kebab-name>.spec.ts` | `CI=1 bunx playwright test tests/e2e/screens/<kebab-name>.spec.ts --reporter=line` |
| Web screen (route) | `apps/web/app/(tempo)/<route>/page.tsx` · `apps/web/lib/e2e/fixtures/<route-kebab>.ts` · `apps/web/lib/e2eWiringRoutes.ts` (one exact line, §17) | `tests/e2e/screens/<route-kebab>.spec.ts` | same Playwright form |
| Mobile component | `apps/mobile/components/v3/<Name>.tsx` · `apps/mobile/app/e2e/<kebab-name>.tsx` (harness route) | `tests/e2e/mobile/<kebab-name>.spec.ts` | `CI=1 bunx playwright test --config playwright.mobile.config.ts tests/e2e/mobile/<kebab-name>.spec.ts --reporter=line` (needs TFV2-0000d, CFG-031, CFG-032) |
| Mobile screen | `apps/mobile/app/(tempo)/<path>.tsx` · `apps/mobile/lib/e2e/fixtures/<screen>.ts` | `tests/e2e/mobile/<screen>.spec.ts` | same mobile form |
| Config lane (schema, deps, CI, test config) | named exactly in the CFG ticket (§18) | named in the ticket | named in the ticket |

- Marketing routes outside `(tempo)` (`apps/web/app/page.tsx`, `about`, `changelog`, …) use the
  screen set with their real route path.
- A ticket that only **verifies** existing code and adds missing tests lists the existing file
  (unchanged unless a STEP names the exact change) plus its one test file.
- `SCOPE` lists the files and the test. `MUTATES` lists every SCOPE file again with `(new)` or
  `(edit)` plus any data or system it changes (table rows written, a route registered). Scope guard
  accepts only files in SCOPE ∪ MUTATES.

## 10. Stylesheet rule (web)

`apps/web/app/tempo.css` (imported by `globals.css`, copied verbatim from `docs/design/v3/tempo.css`)
already holds the classes of ~90 components, each under a comment `/* @component <Name> | class … */`.
It is a shared file: **no build ticket edits it.** Every web component ticket says which case applies:

- **Case A — tempo.css already defines the component's classes**, either under a `@component <Name>`
  block (check with `grep -n "@component <Name> " apps/web/app/tempo.css`) or in the Stage 1 part of the
  file without such a header (the ticket names the line numbers): the component uses exactly those classes,
  sets `data-component="<Name>"` on its root, and adds **no stylesheet**. The SPEC lists every class and
  `data-*` attribute it uses. The file set is `<Name>.tsx` + harness page + spec.
- **Case B — no block exists:** the ticket creates one stylesheet,
  `apps/web/components/<area>/<Name>.css`, imported once as the first local import of `<Name>.tsx`
  (`import "./<Name>.css";`). The SPEC lists every rule (selector, properties, token values). Rules:
  - every class starts with `tp-<kebab-name>` (BEM: `tp-job-row`, `tp-job-row__schedule`,
    `tp-job-row--off`); no top-level element selectors, no `html`/`body`, no other component's classes;
  - values only from the `--tp-*` tokens in §5 — no hex/rgb/hsl/named colours (`scan:design-tokens`
    fails on raw hex), no raw px for spacing, radius, type size or duration (`1px` borders and `0` allowed);
  - logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`,
    `text-align: start`), never `left`/`right`;
  - `transition`/`animation` use `var(--tp-dur-*)` and `var(--tp-ease-*)` only, and the file ends with
    `@media (prefers-reduced-motion: reduce) { .tp-<kebab-name>, .tp-<kebab-name> * { transition: none; animation: none; } }`;
  - breakpoints: base (no query) = 390 px layout, then `@media (min-width: 768px)`,
    `(min-width: 1024px)`, `(min-width: 1280px)`.
- Screens never get a stylesheet: a screen composes components and uses only their classes plus the
  existing shell classes (`TempoShell`, `.tp-page`, `.tp-pagehead`, `.tp-section`).
- Mobile v3 code styles with the palette from `usePrefs().colors` (`apps/mobile/components/v3/prefs.tsx`) in React Native `style` objects inside the component file, as `apps/mobile/components/v3/*.tsx` does today; no separate stylesheet.

## 11. Copy and locale rule

- **New** components and screens keep their copy in their own `.tsx` file, in one constant at the top:

  ```ts
  type CopyKey = "title" | "retry" | "count";
  const COPY: Record<Lang, Record<CopyKey, string>> = {
    en: { title: "Modules", retry: "Try again", count: "{n} modules" },
    he: { title: "מודולים", retry: "לנסות שוב", count: "{n} מודולים" },
  };
  ```

  `Lang` is imported from `@/lib/i18n` (web) or `apps/mobile/lib/v3/i18n.ts` (mobile). The file reads
  `const { lang } = useLocale(); const copy = COPY[lang];` (web, `useLocale` from
  `@/components/providers/LocaleProvider`) or `const { lang } = usePrefs();` (mobile, from
  `apps/mobile/components/v3/prefs.tsx`). Placeholders are `{name}` and are filled with
  `copy.count.replace("{n}", String(n))`. The ticket SPEC gives every key with its exact EN and HE value.
- A ticket that **changes an existing** component which already reads `t("<key>")` keeps those keys and
  adds any new string to a `COPY` constant in the same file. It never edits `apps/web/lib/i18n.ts` or
  `apps/web/lib/i18n-groups/*` unless the ticket is about those files.
- Backend error messages are English only (the UI maps them; §16). User-facing strings a backend
  returns (fixed prompts, card text) are given in both languages in the SPEC and returned as
  `{ en: string; he: string }`.
- Every visible string, `aria-label`, `aria-description`, screen-reader-only text (class `tp-sr-only`),
  toast, button, placeholder, `title` and `alt` is listed in the SPEC as `EN: "…" / HE: "…"`. No
  "see the HTML", no "e.g.", no "similar copy". Copy that is Amit's to choose (quotes, testimonials,
  prices, legal text) makes the ticket `OPEN` (§19).

## 12. Hebrew glossary and voice (one form everywhere)

Voice:
- **Gender-neutral, always.** Address the person with an infinitive ("לנסות שוב"), "אפשר ל…"
  ("אפשר לבטל מתי שרוצים"), an impersonal plural present ("רושמים מה שקרה"), or a noun. Never a
  gendered second-person verb, pronoun or adjective (not "תרשמי", "תחזור", "כשתחזרי", "את צריכה",
  "מוכן/ה"), and not the plural imperative ("הקלידו", "נסו") in new copy. "שלך" is allowed.
- The coach is **"המאמן"** (masculine noun, third person: "המאמן מציע").
- "Tempo" stays in Latin letters.
- Numbers, times, dates, durations, cron text and code are wrapped in `.tp-num` or `.tp-mono`
  (LTR isolate) inside Hebrew text. A prefix before a number or Latin word takes a maqaf: "ב־5", "ל־Tempo".
- Abbreviations use geresh: "דק׳". Ellipsis is the single character "…".
- Never the shaming words in `convex/lib/shameWords.ts` (EN "failed", "overdue", "lazy", "must",
  "should have", "streak lost", "you never"; HE "נכשל", "איחרת", "עצלן", "חייב", "היית צריך").

Glossary (use exactly these; a term not listed uses the existing repo string if one exists, else a
noun for a one-word button and an infinitive for a phrase):

| EN | HE | EN | HE |
|---|---|---|---|
| Today | היום | Page / Pages | דף / דפים |
| Daily note | הדף היומי | Weekly page | הדף השבועי |
| Note / Notes | פתק / פתקים | Task / Tasks | משימה / משימות |
| Habit / Habits | הרגל / הרגלים | Routine / Routines | שגרה / שגרות |
| Goal / Goals | מטרה / מטרות | Project / Projects | פרויקט / פרויקטים |
| Template / Templates | תבנית / תבניות | Module / Modules | מודול / מודולים |
| Built in | מובנים | Plain mode | מצב פשוט |
| Scheduled job / jobs | פעולה מתוזמנת / פעולות מתוזמנות | Coach | המאמן |
| Chat / Thread | שיחה | Memory / Memories | זיכרון / זיכרונות |
| Journal | יומן | Brain dump | פריקת מחשבות |
| Plan (nav, planning) | תכנון | Plan (billing) | מסלול |
| Trial | ניסיון | Calendar | לוח שנה |
| Event | אירוע | Focus | מיקוד |
| Time block | בלוק זמן | Energy | אנרגיה |
| Reminder (nag) | תזכורת | Notification | התראה |
| Insights | תובנות | Activity | פעילות |
| Search | חיפוש | Settings | הגדרות |
| Profile | פרופיל | Preferences | העדפות |
| Privacy | פרטיות | Proposal | הצעה |
| Week / Month / Day | שבוע / חודש / יום | Daily / Weekly / Monthly | יומי / שבועי / חודשי |
| Now / Soon / Later | עכשיו / בקרוב / אחר כך | On / Off | פועל / כבוי |
| Save | שמירה | Cancel | ביטול |
| Undo | ביטול | Delete | מחיקה |
| Edit | עריכה | Add | הוספה |
| Remove | הסרה | Close / Dismiss | סגירה |
| Back | חזרה | Continue | המשך |
| Open | פתיחה | Send | שליחה |
| Copy | העתקה | Export / Import | ייצוא / ייבוא |
| Accept / Approve | אישור | Reject / Discard | דחייה |
| Not now | לא עכשיו | Try again / Retry | לנסות שוב |
| Start | להתחיל | Resume | להמשיך |
| Pause | השהיה | Forget | לשכוח |
| Show more | להציג עוד | Clear | ניקוי |
| Sign in / Sign out | התחברות / התנתקות | Loading… | בטעינה… |
| Untitled | ללא כותרת | Ask the coach | לשאול את המאמן |
| You're offline. Changes save when you're back. | אין חיבור כרגע. השינויים יישמרו כשהחיבור יחזור. | Your data is safe. | המידע שלך שמור. |

## 13. Component harness data rule (web and mobile)

- The harness page (`apps/web/app/e2e/components/<id>/page.tsx`, `"use client"`) imports **only** the
  component under test, React, and types. It never imports `convex/react`, `@/convex/_generated/*`,
  `fetch`, a provider other than what the TFV2-0023a frame gives, or another component's harness.
- Fixture data is written inline in the page as typed constants that satisfy the component's props
  type (`const JOB_ON: ScheduledJobRowProps["job"] = {…}`), one per state.
- The page renders **every state stacked**, each inside `<section data-testid="<id>-<state>">`, in
  the order the SPEC lists them. State names are the SPEC's exact names (`default`, `loading`,
  `empty`, `error`, `offline`, `success`, `disabled`, plus any the component has).
- Callback props get a harness handler that writes the call into one shared element:
  `<output data-testid="<id>-log">` whose text becomes `<propName>:<JSON of the first argument>`
  (for example `onToggle:{"id":"job-1","on":false}`). Specs assert this text; nothing else records calls.
  Exact form by argument count: one argument → `` `${name}:${JSON.stringify(a)}` ``; no argument → `` `${name}:` ``
  (nothing after the colon); two or more → `` `${name}:${JSON.stringify([a, b, …])}` `` (a JSON array of all of
  them). A harness page writes it with one helper declared in the page:
  `const log = (name: string) => (...args: unknown[]) => setLog(args.length === 0 ? `${name}:` : `${name}:${JSON.stringify(args.length === 1 ? args[0] : args)}`);`
  with `const [logText, setLog] = useState("");` and `<output data-testid="<id>-log">{logText}</output>`.
- Components take **all** data and every action through props. A component never calls `useQuery`,
  `useMutation`, `useAction` or `fetch`; only a screen does (§14).
- Mobile harness routes live at `apps/mobile/app/e2e/<id>.tsx` and follow the same rules. The route
  renders `null` unless `process.env.EXPO_PUBLIC_TEMPO_E2E === "1"`, and on mount calls
  `usePrefs().setLang(lang)` when `useLocalSearchParams().lang` is `"en"` or `"he"`. Mobile screens force
  states with `useE2EMobile()` (§15) and fixtures from `apps/mobile/lib/e2e/fixtures/<screen>.ts`, the
  same way as §14.

## 14. Screen data rule (web)

- A screen's `page.tsx` is the only place that calls Convex. It reads data with `useQuery`, writes with
  `useMutation`/`useAction`, and passes plain props down to components.
- State forcing: `const forced = useE2EState();` (TFV2-0000c, `apps/web/lib/e2e/useE2EState.ts`). When `forced !== null` the page calls
  every query with `"skip"` (`useQuery(api.modules.list, forced ? "skip" : {})`) and renders
  `FIXTURES[forced]` from `apps/web/lib/e2e/fixtures/<route-kebab>.ts`; it never contacts Convex.
- The fixtures file exports `export const FIXTURES: Record<"<state>" | …, <ScreenView>>` (one entry per
  SPEC state, typed with the screen's view type) and nothing else. It imports types only.
- `offline` is real behaviour too: the page reads `useOnline()` (`apps/web/lib/useOnline.ts`); the
  forced state `offline` makes the page behave as if `useOnline()` returned `false`.
- Every screen ticket registers its route in `E2E_WIRING_ROUTES` as its own named STEP with the exact
  line (§17), and `apps/web/lib/e2eWiringRoutes.ts` is in SCOPE and MUTATES.
- Week start is never hard-coded: screens read `userPreferences.weekStartsOn` (`0 | 1 | 6`) through
  `api.preferences.get` and pass `weekStartsOn` to components as a prop. Time zone likewise comes from
  `userPreferences.timeZone` via `api.preferences.get`. (Code truth: `convex/preferences.ts`
  `PREFERENCE_DEFAULTS` = `weekStartsOn: 1`, `timeZone: "UTC"`.)
- Typeface: components use `--tp-font-serif`, `--tp-font-sans`, `--tp-font-mono` only. Q-05 (§19)
  decides the token values and blocks no component or screen ticket.

## 15. E2E helpers (built by the groundwork tickets; use exactly these)

`tests/e2e/helpers/harness.ts` (TFV2-0000b):

```ts
import type { Page } from "@playwright/test";
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;
export type HarnessLang = "en" | "he";
/** Opens /e2e/components/<id>?lang=<lang>&theme=<theme> and waits for [data-testid="<id>-default"] or the first state section. */
export function openHarness(page: Page, id: string, opts?: { lang?: HarnessLang; theme?: "light" | "dark" }): Promise<void>;
/** Opens <route>?state=<state>&lang=<lang>, then page.waitForLoadState("networkidle"). */
export function openScreen(page: Page, route: string, opts: { state: string; lang?: HarnessLang }): Promise<void>;
/** Asserts <html dir> and <html lang>. */
export function expectDir(page: Page, lang: HarnessLang): Promise<void>;
/** Collects console errors from now on; the spec asserts the array is empty at the end. */
export function trackConsoleErrors(page: Page): string[];
/** Asserts every visible button, link, input and [role=switch|checkbox|radio|tab|option] inside the locator is at least 24×24 CSS px. */
export function expectTargetSize(page: Page, selector: string): Promise<void>;
/** Asserts computed transition-duration and animation-duration of every element under the selector are ≤ 0.25 s, and ≤ 0.001 s after page.emulateMedia({ reducedMotion: "reduce" }) (tempo.css sets 0.01ms under reduced motion). */
export function expectMotionBudget(page: Page, selector: string): Promise<void>;
/** Navigates twice (warm-up, then measured) and returns LCP (ms) and CLS from PerformanceObserver. */
export function measureVitals(page: Page, url: string): Promise<{ lcpMs: number; cls: number }>;
```

Every spec starts with `test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");` and runs
each case at both `VIEWPORTS` and both languages with `for` loops over
`[["mobile", VIEWPORTS.mobile], ["desktop", VIEWPORTS.desktop]]` and `["en", "he"]`.

`apps/web/lib/e2e/e2eState.ts` + `apps/web/lib/e2e/useE2EState.ts` (TFV2-0000c):

```ts
// e2eState.ts — pure, no React or Next imports
export const E2E_STATE_PATTERN = /^[a-z][a-z-]{0,23}$/;
/** Returns raw when bypass is true and raw matches E2E_STATE_PATTERN, else null. */
export function parseE2EState(raw: string | null, bypass: boolean): string | null;
/** True only when NODE_ENV !== "production" and NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1". */
export function isE2EBypass(env: { NODE_ENV?: string; NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS?: string }): boolean;

// useE2EState.ts — "use client"
/** parseE2EState(useSearchParams().get("state"), isE2EBypass(process.env)). Call inside <Suspense>. */
export function useE2EState(): string | null;
```

`apps/mobile/lib/e2e/e2eState.ts` + `apps/mobile/lib/e2e/useE2EMobile.ts` (TFV2-0000d):

```ts
// e2eState.ts — pure, no React Native or Expo imports (so bun can test it)
export function parseE2EMobileState(raw: string | null, enabled: boolean): string | null; // same rule as parseE2EState
export type TempoGate = "sign-in" | "onboarding" | "render";
/** e2e true → "render"; else !isLoading && !isAuthenticated → "sign-in"; else hasProfile && onboardedAt === undefined → "onboarding"; else "render". */
export function tempoGate(input: { isLoading: boolean; isAuthenticated: boolean; hasProfile: boolean; onboardedAt: number | undefined; e2e: boolean }): TempoGate;

// useE2EMobile.ts
/** parseE2EMobileState((useLocalSearchParams().state as string | undefined) ?? null, process.env.EXPO_PUBLIC_TEMPO_E2E === "1"). */
export function useE2EMobile(): string | null;
```

**The mobile spec skeleton** (a mobile ticket may write "the §15 mobile spec skeleton"; it states only its
path, its states and its bullets). File `tests/e2e/mobile/<name>.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { VIEWPORTS, expectTargetSize, trackConsoleErrors } from "../helpers/harness"; // only the helpers it uses
import { type Key, translate } from "../../../apps/mobile/lib/v3/i18n"; // pure module, no React Native imports

test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");
const NOISE = /example\.convex\.cloud|WebSocket/i;

for (const [vpName, vp] of [["mobile", VIEWPORTS.mobile], ["desktop", VIEWPORTS.desktop]] as const) {
  for (const lang of ["en", "he"] as const) {
    test(`<bullet name> · ${vpName} · ${lang}`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      await page.setViewportSize(vp);
      // screen route: the language comes from the phone store (AsyncStorage on web = localStorage, key "tempo.v3.lang")
      await page.addInitScript((l) => localStorage.setItem("tempo.v3.lang", l), lang);
      await page.goto("/<path>?state=<state>");        // harness route instead: page.goto(`/e2e/<id>?lang=${lang}`), no init script
      await page.waitForLoadState("networkidle");
      const k = (key: Key<"<screen>">) => translate(lang, "<screen>", key);
      // … the bullet's assertions; text is matched with k("<key>"), never a hard-coded string unless the SPEC says the string is literal in the code …
      expect(errors.filter((m) => !NOISE.test(m))).toEqual([]);
    });
  }
}
```

The language loads asynchronously, so the first assertion of every test is a web-first `expect(…).toHaveText(…)` /
`toBeVisible()` on a translated string (it waits). `<html dir>` is not asserted on mobile web; direction is
asserted through the element's computed `direction` or `flex-direction` as the SPEC states. DONE count =
4 × bullets (+1 per `(once)` bullet).

Mobile specs live in `tests/e2e/mobile/` and run under `playwright.mobile.config.ts` (CFG-031: Expo web
on `http://localhost:8081`, env `EXPO_PUBLIC_TEMPO_E2E=1`,
`EXPO_PUBLIC_CONVEX_URL=https://example.convex.cloud`). CFG-032 makes `(tempo)` routes render signed
out only when `__DEV__ && process.env.EXPO_PUBLIC_TEMPO_E2E === "1"`. Every mobile UI ticket depends on
CFG-031, CFG-032 and TFV2-0000d.

## 16. Backend function rules

- **Kind is always named:** `query`, `mutation`, `action`, `internalQuery`, `internalMutation`,
  `internalAction`, or `httpAction`, imported from `./_generated/server`.
- **Signature is always given in full**, as the ticket's SPEC code block:

  ```ts
  export const setEnabled = mutation({
    args: { jobId: v.id("jobs"), enabled: v.boolean() },
    returns: v.null(),
    handler: async (ctx: MutationCtx, args: { jobId: Id<"jobs">; enabled: boolean }): Promise<null> => { … },
  });
  ```

  `args` and `returns` validators are both written. Ids are `v.id("<table>")` / `Id<"<table>">`
  wherever the field is a Convex id; plain `v.string()` only where the code already uses strings
  (for example `starter:*` template ids, `tasks.projectId`).
- **Auth:** every public function starts with `const user = await requireUser(ctx);`
  (`convex/lib/requireUser.ts`), which throws `"Not authenticated"`, `"User not found"` or
  `"This account is not active"`. AI paths use the gate the module already uses
  (`requireApprovedForAi` in `convex/lib/aiGate.ts`).
- **Ownership:** a row whose `userId !== user._id`, or that does not exist, or whose `deletedAt` is set
  (unless the function is a restore) throws `new Error("<Thing> not found")` with the module's existing
  noun (`"Task not found"`, `"Habit not found"`, `"Template not found"`, `"Job not found"` for new
  tables). A module that already uses `"Access denied"` for foreign rows keeps it; the ticket says which.
- **Error mechanism:** follow the file. Existing modules throw `new Error("<exact message>")`; new
  modules do the same. `ConvexError` codes only where the file already uses them. Every error the SPEC
  lists has: the exact message, the exact trigger, and exactly one TESTS case. TESTS always include
  the signed-out case (`"Not authenticated"`) and, for any function that takes a row id, the
  other-user case.
- **Limits:** every list read is bounded (`.take(n)` with `n` a named exported constant, or
  `boundedQuery` from TFV2-0001). "Bytes" is UTF-8 (§7 H).
- **Tests** use `bun:test`, `makeFakeCtx`, `makeSignedOutCtx` and `run` from
  `convex/lib/testFakeCtx.ts` (TFV2-0000a adds `makeSignedOutCtx`, `db.delete`, `db.replace`,
  `.unique()` and a `scheduler.runAfter` recorder).
- **Every test helper a TESTS bullet uses has a stated origin**, one of: (a) the four exports above
  (`import { makeFakeCtx, makeSignedOutCtx, run } from "./lib/testFakeCtx";` from `convex/`, `"./testFakeCtx"` from
  `convex/lib/`); (b) the standard `rejection` helper below; (c) a helper that already exists in the test
  file being edited — the ticket names it with its exact signature and line ("`makeWorld(): World`, line 40 of
  `convex/voice.test.ts`") and STEP 1 greps for it; (d) a helper the ticket defines, written out in full in SPEC.
  No other helper names (`world`, `signedOutCtx`, `seed…`) appear without one of these origins.
- **The standard `rejection` helper** — declared once at the top of a test file that needs it (or reused if the
  file already has a function of this exact name and behaviour):

  ```ts
  async function rejection(p: unknown): Promise<string> {
    try { await p; } catch (e) { return e instanceof Error ? e.message : String(e); }
    throw new Error("expected a rejection");
  }
  ```

  A `ConvexError` code is read the same way only when the module throws `new ConvexError("<code>")` (its
  `message` is the code); a module that throws `new ConvexError({ code })` is asserted with
  `expect(p).rejects.toMatchObject({ data: { code: "<code>" } })` — the ticket says which, from the code. Seed rows with `await ctx.db.insert("<table>", {…})`
  before calling `run(fn, ctx, args)`. A test asserts a returned value or a stored row, never only
  that "no error was thrown".
- **Schema:** a build ticket never edits `convex/schema.ts`. A table or field it needs comes from a
  `CFG-…` ticket (§18) that it lists in `Depends`.

## 17. Shared files — one exact line each

A shared file is edited by many tickets. A ticket may add exactly the line(s) named here and nothing
else; the SPEC quotes the exact line(s); the file counts toward the 3-file limit.

| File | Exact addition |
|---|---|
| `apps/web/lib/e2eWiringRoutes.ts` | one line `  "/<route>",` inserted as the last entry before `] as const;` (a route with children adds a second line `  "/<route>/(.*)",`) |
| `packages/ui/src/primitives/index.ts` | one line `export { <Name>, type <Name>Props } from "./<Name>";` in alphabetical order |
| `packages/ui/src/index.ts` | no edits (it already re-exports `./primitives`) |
| `convex/crons.ts` | one line `crons.<interval\|daily\|cron>("<name>", <schedule>, internal.<module>.<fn>, {});` before `export default crons;` |
| `convex/http.ts` | one line `http.route({ path: "<path>", method: "<METHOD>", handler: <handler> });` plus its one import line |
| `apps/web/lib/i18n.ts` | only tickets about i18n itself (TFV2-0020) |

## 18. Config lane — the CFG ticket format

- Any change to `convex/schema.ts`, `convex/auth*`, `convex/convex.config.ts`, `package.json`,
  `bun.lock`, `playwright.config.ts`, `.github/**` or `**/.env*` is a **CFG** ticket, titled
  `CFG-NNN — <what> — config lane: Amit`. Amit (or a `convex-arch`-labelled run) builds it; the factory
  lanes never do.
- CFG tickets live in the "Groundwork" section at the top of `BACKLOG-v2.md`, before Chunk 1. A build
  ticket that needs one lists its id in `Depends` and `WHEN`.
- One CFG ticket = one table, or the new fields of one existing table, or one config file change.
- **Every field added to an existing table is `v.optional(…)`** (the deployment is populated; see the
  `TF-OSS-01` comment in `convex/schema.ts`). New tables follow the repo shape: `userId: v.id("users")`,
  `createdAt: v.number()`, `updatedAt: v.number()`, `deletedAt: v.optional(v.number())`, index
  `by_userId_deletedAt` on `["userId", "deletedAt"]`.
- **A new table with `userId` and `deletedAt`** must also be covered by account deletion, or
  `convex/lib/accountDeletion.test.ts` fails typecheck and its coverage tests: its first index is
  `.index("by_userId", ["userId"])` (then `by_userId_deletedAt`); the CFG ticket adds the one line
  `  "<table>",` as the last entry of `USER_OWNED_TABLES` in `convex/lib/accountDeletion.ts` and one
  `OWNED_FIXTURES` entry `<table>: fixture("owned-table-soft-delete", (userId) => ({ …required fields… })),`
  in `convex/lib/accountDeletion.test.ts`. Its file set is `convex/schema.ts` ·
  `convex/lib/accountDeletion.ts` · `convex/lib/accountDeletion.test.ts` · test
  `convex/schema_<cfgid>_<table>.test.ts`, and DONE also runs `bun test convex/lib/accountDeletion.test.ts`.
  A table with `userId` but no `deletedAt` (append-only) needs a lifecycle decision: the ticket is OPEN.
- A CFG ticket that adds an index to `memories`, or a field or index to `conversations`, `notes`,
  `chatRequests`, `pageOperations`, `pageOperationPayloads` or `pageProposals`, also updates the exact
  expectation for that table in `convex/lib/accountDeletion.test.ts` (those tests pin the field and
  index lists) and quotes the changed lines.
- SPEC gives the exact `defineTable({…})` code (or the exact lines added to an existing table), every
  index with its exact name and field list, and the reading/writing tickets.
- Test file: `convex/schema_<cfg id, lower case, no dash>_<table>.test.ts`, e.g. `convex/schema_cfg012_jobs.test.ts` (one per CFG ticket, so CFG tickets never share a file),
  using only public schema API:

  ```ts
  import { describe, expect, test } from "bun:test";
  import schema from "./schema";
  const table = schema.tables.<table>;
  test("fields", () => {
    expect(Object.keys(table.validator.fields).sort()).toEqual([/* exact sorted names */]);
    expect(table.validator.fields.<field>.isOptional).toBe("optional");
  });
  test("indexes", () => {
    expect(table[" indexes"]()).toContainEqual({ indexDescriptor: "<name>", fields: [/* … */] });
  });
  ```

  (A vector index is read with `(table as unknown as { vectorIndexes: { indexDescriptor: string; vectorField: string; dimensions: number; filterFields: string[] }[] }).vectorIndexes`.)
- DONE: `bun test convex/schema_<cfgid>_<table>.test.ts` → `0 fail`, then `bun run typecheck` → exit 0.
- A CFG ticket whose shape is Amit's product choice is `OPEN` with that question; every ticket that
  depends on it is `OPEN` by inheritance (§19).

## 19. Dependencies, OPEN and the open-question register

- **STATUS (Amit, 2 Nov 2026):** every non-stub ticket has exactly one line `- **STATUS:** approved-unsent` (meets the bar, not yet sent as an issue; not rewritten again) or `- **STATUS:** open — <its OPEN question>` directly under its heading; stubs have none.
- `Depends` lists only ids that exist in `BACKLOG-v2.md` (TFV2-…, CFG-…), each earlier in the file.
  The Groundwork section at the top (TFV2-0000a…d, then CFG-001…) comes before Chunk 1. No legacy ids (TRW-, TM-, TEMPO-, #issue) in `Depends`;
  those go in `Folds-in` or `WHY`. No cycles.
- `WHEN` is exactly `first` when `Depends` is `none`, otherwise `after <the same ids, same order>`.
- A ticket that depends on an `OPEN` ticket is `OPEN` and says
  `OPEN: inherits <id> (<Q-nn>: <question>) — Amit.` A ticket with its own question writes
  `OPEN: <Q-nn or new>: <exact question> — Amit.`
- Exact forms (fix round 1). The question text is the register's own wording for a `Q-nn` (copied from
  the table below, word for word), and for a `new:` question the exact text of the line that asks it:
  - own register question: `- **OPEN:** Q-08: forget: soft delete with 30-day grace vs complete hard delete. — Amit.`
  - own new question: `- **OPEN:** new: <one exact question ending in ?> — Amit.` (a CFG ticket's own shape question
    is a `new:` question too);
  - inherited: `- **OPEN:** inherits <id> (<Q-nn or new>: <the parent's question, word for word>) — Amit.` —
    `<id>` is the ticket in this ticket's `Depends` that is OPEN; several parents are joined with `; inherits`
    in `Depends` order; a chain is not spelled out (name the direct parent and its root question only);
  - both: the inherited part first, then `; new: <question> — Amit.`
- A question goes only on tickets whose build it changes. Work the question does not touch is split into its
  own non-OPEN ticket (`a`), and only the dependent part (`b`) is OPEN. A ticket never ships a fallback that
  hides a check ("print UNKNOWN and exit 0", "skip when unavailable"): a check that cannot run fails, or the
  ticket is OPEN with that question.
- Config-lane work (§18 file list) always has a `CFG-NNN` id and lives in the Groundwork section; a TFV2 id
  that held config work is a stub `— superseded by CFG-NNN`.
- `OPEN: none.` is written only when nothing is left to decide. On an `OPEN` ticket,
  `GATES: n/a — OPEN (not buildable until Amit answers).` and nothing else. Its title ends `— OPEN`.
- A ticket replaced by another is a stub: title `— superseded by <id>`, one line
  `- **Status:** superseded by <id>; not a build ticket.`, nothing else. No ticket depends on a stub.

Open-question register (cite by number; Amit answers every one):

| Q | Question | Note |
|---|---|---|
| Q-01 | Voice stage: is live voice Gen 1 or later? | REWRITE-PLAN-v2 §4.1 |
| Q-02 | Prices and billing tiers (values shown to users). | §4.2 |
| Q-03 | Interim text model id (runtime model). | §4.3; `convex/lib/ai_router.ts` is truth until answered |
| Q-04 | Sign-up policy: cap 30 vs unlimited-with-approval; where Amit approves. | §4.4 |
| Q-05 | Body typeface values for `--tp-font-*`. | §4.5; blocks no component ticket (§14) |
| Q-06 | AI changes: always propose (confirm/edit/reject) vs auto-apply with 5-min undo. | §4.6 |
| Q-07 | Block model authority (`notes.body` single authority vs typed tables). | §4.7 |
| Q-08 | `forget`: soft delete with 30-day grace vs complete hard delete. | §4.8 |
| Q-09 | Confidence auto-apply threshold: where it lives, user-tunable or not. | §4.9 |
| Q-10 | Default week start for new users (code default today: Monday, `weekStartsOn: 1`). | §4.10; only a ticket that changes `PREFERENCE_DEFAULTS` is blocked |
| Q-11 | Nag delivery channel beyond in-app. | §4.11 |
| Q-12 | HARD_RULES §2 (AI SDK forbidden) vs TRD §3 (AI SDK + Convex Agent permitted); RAG/vector search permitted? | §4.12 |
| Q-13 | Time zone storage — answered by code: `userPreferences.timeZone`. | closed; cite only if a ticket wants another store |
| Q-14 | Embedding model and vector dimension. | proposed 1024 |
| Q-15 | Per-country crisis resources beyond Israel; Hebrew crisis phrase list approval. | PRD F-24 |

A ticket-specific question not in the register is written in full on the ticket.

## 20. NUMBERS catalogue (pass range · source · how the test checks it)

| Number | Pass range | Source | Check |
|---|---|---|---|
| Text contrast | ≥ 4.5:1 (≥ 3:1 for text ≥ 24 px or ≥ 18.66 px bold) | WCAG 2.2 SC 1.4.3, https://www.w3.org/TR/WCAG22/#contrast-minimum | colours only from §5 tokens; `bun run scan:design-tokens` passes |
| Non-text contrast (borders of controls, focus ring) | ≥ 3:1 | WCAG 2.2 SC 1.4.11 | tokens `--tp-line-control`, `--tp-accent` only |
| Target size | ≥ 24 × 24 CSS px | WCAG 2.2 SC 2.5.8, https://www.w3.org/TR/WCAG22/#target-size-minimum | `expectTargetSize` |
| Focus visible | outline ≥ 2 px (`--tp-focus-w`) on `:focus-visible` | WCAG 2.2 SC 2.4.7 | Playwright: Tab to each control, computed `outline-width` ≥ `2px` |
| Motion | each transition ≤ 250 ms; ≤ 1 ms with reduced motion (tempo.css uses `0.01ms`) | DESIGN.md motion rule; §5 | `expectMotionBudget` |
| LCP (screens) | ≤ 2,500 ms | web.dev Core Web Vitals, https://web.dev/articles/vitals | `measureVitals` |
| CLS (screens) | ≤ 0.1 | web.dev Core Web Vitals | `measureVitals` |
| INP (screens) | ≤ 200 ms | web.dev Core Web Vitals | UNKNOWN in the local dev server — measured on preview, not a ticket gate |
| Backend p95 latency | UNKNOWN unless the ticket cites a measured baseline | no baseline measured in this repo (Amit) | not a ticket gate while UNKNOWN |
| Bounded reads | ≤ the ticket's named constant | the code constant | a test seeds constant + 1 rows and asserts the cap |

## 21. GATES text

Build tickets copy this line exactly:

`1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check · 9 Jev judge (typesafe/jev-1.13): instruction-following, formatting, naming, clean code each >= 0.85; a massive violation fails · 10 Process check: REPORT lists every STEP and DONE item with evidence; a missing item fails.`

CFG tickets add `· 11 config lane: built by Amit or a convex-arch run only.` `OPEN` tickets write only
`n/a — OPEN (not buildable until Amit answers).`

## 22. Shared code facts and the standard spec skeleton (UI tickets cite these instead of a preamble)

Every ticket must stand alone as one GitHub issue. A ticket never relies on a range preamble or a
"shared facts" block in the backlog; it cites a section here, or writes the fact inline.

**The standard spec skeleton** (a ticket may write "the §22 spec skeleton"):
- The spec imports `{ test, expect }` from `@playwright/test` and the helpers it uses from
  `../helpers/harness` (TFV2-0000b). Its first statement is
  `test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");`.
- Every TESTS bullet becomes one `test()` per combination inside
  `for (const [vpName, vp] of [["mobile", VIEWPORTS.mobile], ["desktop", VIEWPORTS.desktop]] as const) for (const lang of ["en", "he"] as const) { … }`,
  named `"<bullet name> · ${vpName} · ${lang}"`, each calling `page.setViewportSize(vp)` and then
  `openHarness(page, "<id>", { lang })` (component) or `openScreen(page, "<route>", { state, lang })`
  (screen). A spec with k bullets therefore reports `4×k passed`; a bullet that the ticket marks
  "once" runs a single time and adds 1.
- Every test starts `const errors = trackConsoleErrors(page);` and ends `expect(errors).toEqual([])` for
  harness specs. Screen (route) specs first drop messages matching
  `/example\.convex\.cloud|WebSocket/i` (the placeholder Convex URL under the Playwright `webServer`
  cannot connect), then assert `[]`.
- In a harness page every state section is stacked, so every locator is scoped to its section:
  `page.getByTestId("<id>-<state>").locator(…)`.

**Code facts (read from `integration`):**
- Icons: `TpIcon` from `@/components/tempo/TpIcon`, props `{ name: TpIconName; size?: "sm" | "md" | "lg"; flip?: boolean; className?: string }`
  where `TpIconName` is `keyof typeof ICONS` (the quoted keys of the `ICONS` object in that file, so an unknown
  name fails typecheck); renders `<svg class="tp-icon" aria-hidden="true"><use href="#i-<name>"/></svg>`
  (plus `tp-icon--sm` / `tp-icon--lg` / `tp-icon--flip`). The sprite (`TpIconSprite`) is not mounted in the
  harness: specs assert the `use[href="#i-<name>"]` element. Every icon name a ticket uses is checked in its
  code-map STEP with `grep -n '^  "<name>":' apps/web/components/tempo/TpIcon.tsx` (one line expected).
- **React 19 types:** `@types/react` ^19.2.7 has no global `JSX` namespace and the repo declares none. A
  component's return type is written `React.JSX.Element` (or `React.JSX.Element | null`), never bare
  `JSX.Element`, and the file has `import type React from "react";` unless it already imports `React`
  (`import * as React from "react";` also satisfies it). Children are typed `React.ReactNode` the same way.
- `apps/web/app/tempo.css`: the global focus ring is `:focus-visible` (line 91,
  `var(--tp-focus-w) solid var(--tp-accent)`); the skeleton shimmer `.tp-skeleton` is a 1.4 s
  infinite loop (line 465), so no spec runs `expectMotionBudget` on a `loading` section; reduced motion
  sets every duration to `0.01ms` (line 480).
- Page-level classes for v3 screens live in `apps/web/app/v3/*.css` (`habits.css`, `goals.css`,
  `you.css`, `settings.css`, `extras.css`, `coach-chat.css`), imported globally by `globals.css`; a
  screen or View may use them and never edits them.
- `useOnline()` (`apps/web/lib/useOnline.ts`) starts `true` and follows `online`/`offline` events.
- `ProfileReady` (`apps/web/components/today/ProfileReady.tsx`, props `{ children: ReactNode; fallback?: ReactNode }`)
  mounts children only once `users.getProfile` returns a row; signed out under the E2E bypass it
  renders children as they are. Routes wrap their data component in it because every query calls
  `requireUser`.
- Dates in Views are formatted with
  `Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { …, timeZone: "UTC" })` over
  `new Date(Date.UTC(y, m - 1, d, 12))` of a `YYYY-MM-DD` key, so output never depends on the test
  machine's zone. "Today" is computed by the route from `userPreferences.timeZone`, never by a View.
- Screen pattern for an existing screen whose components call Convex: an `a` ticket builds a
  props-only View component (web component kind, harness + spec), a `b` ticket replaces the route
  `page.tsx` to feed it (screen kind, fixtures + wiring line + spec). The old screen component stays
  in the repo, unimported, unless a ticket deletes it by name.

## 23. Self-contained tickets and test mechanics (fix round 1, 2 Nov 2026)

Five independent reviews of the Opus rewrite found these gaps. Each rule below is fixed once here;
tickets cite the sub-section (`§23.3`) or write the fact inline.

### 23.1 Every spec follows its template, and DONE counts it

- Every web e2e spec (component, screen, and a spec over existing code such as the shell) uses the §22
  spec skeleton: the viewport × language loop, `trackConsoleErrors` first and `expect(errors).toEqual([])`
  last (screen specs drop `/example\.convex\.cloud|WebSocket/i` first), `openHarness` / `openScreen`.
  Every mobile spec uses the §15 mobile spec skeleton.
- A bullet that must run once (a click that changes global state, a vitals measurement) is marked
  `(once)` and names its single viewport and language. DONE is then exactly
  `4 × <loop bullets> + <once bullets> passed`, written as a number (`→ 20 passed`), and the TESTS list
  is numbered so the count can be checked by reading.

### 23.2 The CSS custom-property probe (checking that a token is applied)

A spec never hard-codes a token's pixel value. It compares the element's computed value with the value
the browser computes for the token in the same place:

```ts
async function tokenValue(scope: Locator, cssProp: string, token: string): Promise<string> {
  return scope.evaluate((el, [p, t]) => {
    const probe = document.createElement("div");
    probe.style.setProperty(p, `var(${t})`);
    el.appendChild(probe);
    const out = getComputedStyle(probe).getPropertyValue(p);
    probe.remove();
    return out;
  }, [cssProp, token] as const);
}
// usage: expect(await title.evaluate((el) => getComputedStyle(el).fontSize))
//          .toBe(await tokenValue(page.getByTestId("<id>-default"), "font-size", "--tp-text-2xl"));
```

`scope` is the state section (so theme and `dir` resolve as for the element). The helper is declared at
the top of the spec that uses it, exactly as above (`import type { Locator } from "@playwright/test";`).
Colours are compared the same way (`"color"`, `"--tp-ink"`), so the check is independent of theme values.

### 23.3 No pointers: write the rule, the code and the data in the ticket

- Never "exactly as `<file>` lines N–M", "copied verbatim from TFV2-…", "same as the other ticket",
  "see …". Write the logic out (step by step, or as code), and inline every fixture and string.
- A name that another ticket creates (a constant, prop, function, type, CSS id, field) is quoted with its
  exact definition and the creating ticket's id, for example
  ``PROPOSAL_UNDO_MINUTES = 5` (`export const`, `convex/proposals.ts`, created by TFV2-0213a)``, and that
  ticket is in `Depends`. A name from existing code is quoted with its definition and file.
- No `...` or `…` gaps inside SPEC types, props, objects or fixtures: every field is written. The only
  allowed `{ … }` is a function body whose behaviour the SPEC states in full in prose or steps.

### 23.4 Contracts of what a ticket composes

- Every component, helper, hook, CSS class, `data-*` attribute and icon a ticket relies on but does not
  create is listed in SPEC under **Relies on** with the exact part of its contract the ticket depends on:
  props it is given, behaviour (for example "`HabitSheet` calls `onClose()` after `onSubmit` resolves"),
  the DOM it renders that a test selects, and for a pure helper the exact outputs for the inputs the test
  uses (for example `speechSentences("A.  B")` → `["A.", "B"]`).
- STEP 1 (code-map) checks each one with an exact command and the expected result: `grep -n` for a prop or
  behaviour line, `grep -n "\.<class>\b" apps/web/app/tempo.css apps/web/app/v3/*.css` for every class,
  the §22 icon grep for every icon. If a check fails, the builder stops with
  `blocked: PATH_DRIFT — <what differs>`; a ticket never relies on an unchecked contract.
- Layout claims agree with the math the SPEC gives (columns × min width + gaps ≤ container width at each
  breakpoint, with the container width stated, including the §4 harness frame's width when the test runs in
  the harness).

### 23.5 Forced and harness modes never contact Convex

- In a route, `const forced = useE2EState();` is read first. When `forced !== null` the route returns
  `<View {...FIXTURES[forced]} />` directly — **outside** `ProfileReady` (which calls `users.getProfile`)
  and with every `useQuery` given `"skip"` — so no Convex call is made.
- Every value the forced View shows comes from the fixture, including "today", the anchor date and
  counts: the fixture holds the date key (`today: "2026-11-02"`), and the route never computes them from
  `Date.now()` in forced mode.

### 23.6 Errors, limits and agreement between SPEC and TESTS

- Every error the SPEC lists has exactly one TESTS case with its exact trigger; every TESTS error is in the
  SPEC. Signed out (`"Not authenticated"`) and, for a row id, the other-user case are always included.
- Every limit is tested on both sides: at `n` (accepted, or exactly `n` returned) and at `n + 1` (rejected,
  or capped at `n`). A time window of D days is tested at D (inside) and D + 1 (outside): a 30-day window
  is tested with 30 and 31.
- Every prop, callback, constant and string named in TESTS exists in SPEC with the same name, and every
  SPEC behaviour a TESTS bullet covers says the same thing in both places (no CSS hex in a comment when
  DO NOT forbids hex; no "two per row" where the grid math gives three).

### 23.7 Test data is fully seeded

- Every seeded row and fixture lists every field the code reads, each with an exact value: strings in quotes,
  numbers as numbers, ids as the fake ctx returns them (`"tasks:1"`), and timestamps as fixed epoch-ms
  literals (`updatedAt: 1_793_577_600_000`), never `Date.now()` unless the assertion is relative to it.
- A shape word in a test ("plain object", "a draft row", "a quiz block") is defined once in the SPEC as a
  TypeScript type or literal.
