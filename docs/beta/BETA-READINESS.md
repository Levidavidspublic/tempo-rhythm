# Beta readiness: Tempo Flow (16 Oct 2026)

For Amit, before Sunday's release decision. Plain answer first, details after.
Tags: **WALK** = seen in a browser, with proof linked · **EXTRAPOLATED** = reasoned from code or tests, not seen · **UNKNOWN** = not checkable from here.

## The short version

- **Where things stand.** preview.tempoflow.dev serves `integration` at `eb0b12c`. tempoflow.dev serves `master` at `007d28a` (about 4 Oct). Neither has any of this week's B07 work yet: all of it is in open draft PRs. WALK
- **Beta after the merges.** The beta is ready to release once you merge the PRs below in order and walk preview once.
  - Every PR has its own before/after proof and green local checks: lint, typecheck, unit tests, scans, build, Playwright, and both secret scanners.
  - All 52 B07 code branches merged together, in the order below, give a tree that passes everything (table at the end of the merge order). EXTRAPOLATED for preview itself, because nothing is merged yet.
- **Release, carefully.**
  - Do a **dry run** of "Release to production" first.
  - Web search and Executor ship switched **off**. They need settings that only you can make, and they stay off until you make them.
- **Blockers only you can clear.** Nothing is blocked on code. The open items are labels, settings, a few decisions and the merges, listed next.

## Needs Amit (AT, in this order)

1. **Close #1009 and #1010.** #1018 and #1019 replace them. Their history held two test fixtures that the secret scans flag, and I can't force-push.
2. **Apply `convex-arch`** to #988, #1018 and #1008, then to #1035 once #988 and #1018 are merged. I never apply it.
3. **Merge in the order below**, then walk preview once with the demo script.
4. **Decide on Bugbot.** The release gate posts `@cursor review` once and waits for Bugbot (DEPLOY.md, step 6). Your brief says CodeRabbit is the only reviewer. Either accept one Bugbot run for the release, or change the gate. That's a config PR, and your call.
5. **Check `FACTORY_BATCH_TOKEN`.** It was the one open setup step on 6 Oct (DEPLOY.md, one-time setup 1). A real run needs it; a dry run only reports it. UNKNOWN whether it's set now.
6. **Convex production settings**, names only. I never set or read them.
   - `MISTRAL_API_KEY`: turns web search on. Mistral bills per search, so it's your call.
   - `TEMPO_EXECUTOR_ENABLED`: leave it unset for the beta, unless you've tried Executor on TEST.
   - If you turn Executor on, it also needs `TEMPO_CONNECTIONS_KEY`, `EXECUTOR_MCP_URL` and `SITE_URL`.
7. **Five small product calls** (each PR says what it costs):
   - #1030, the habit Day Grid: on hold. The habit page already has a tappable 6-week grid, and swapping it would trade one-tap logging of a past day for two taps. The proposal is on the ticket.
   - #1037, more room under the floating coach button on a phone: the "covers the last row" bug didn't reproduce at the bottom of any page today. It widens an 8 px gap to 32 px. Merge it or close it.
   - #1038 changes English /plan times from 09:00 to 9:00 AM, to match /today. Keeping 24-hour is a one-line change.
   - Which heading names /today. It has two h1s: the greeting ("Hi, …"), which the alpha acceptance test expects, and the daily page's date title, which the design mock uses. #1057 fixed /plan and the template builder and left /today for you.
   - #1076: a browser with no language saved takes the account's language, so a Hebrew account opens in Hebrew on a new device, and its new week and day pages get Hebrew titles. A browser that has chosen a language keeps it. Today, a new device shows English until you open Settings → Preferences. If you want every new device to start in English, close it.
8. **Words only you can confirm:**
   - the landing letter (#987);
   - /ask-founder's "Amit builds Tempo and reads every message himself" and the address `amit@tempoflow.app` (#1023);
   - the /privacy and /terms drafts, which are marked "draft — to be reviewed" (#984);
   - a native Hebrew read. All new Hebrew is machine-drafted.

## Merge order

Within a step, any order works. A later step needs the earlier ones it names.

| step | PRs | needs |
|---|---|---|
| 1 | #964 demo/friend · #965 clumsy-test fixes | none |
| 2 | #967 · #968 · #969 · #970 (walk polish) · #981 tracking in Hebrew · #985 Executor research doc · #992 top-bar crumb · #1001 long page title wraps · #1021 energy card in Hebrew · #1022 day plan wraps and reads in Hebrew · #1023 no scaffold pages · #1024 calendar and history in Hebrew · #1025 one habit per double click, new-project hint · #1037 room under the coach button on a phone · #1038 /plan timeline and /coach controls in Hebrew · #1052 Ctrl+K gives focus back on Escape · #1054 /coach's "Today's plan" card in Hebrew · #1056 Today fits a phone (habit rows), Hebrew habit strip · #1057 one h1 on /plan and the template builder · #1068 /templates cards in Hebrew · #1069 a routine with no steps says so, a run survives a reload · #1070 "New goal" asks for a name first · #1072 notes pages keep the last half-second of typing, one `<main>`, Hebrew loading text · #1073 signing out clears this tab's kept brain dump and task draft · #1076 a new device takes the account's language · this page's PR (closes #1003) | none |
| 2b | #1036 calendar event rows (Edit, Delete, edit form, Undo) in Hebrew | #1024 |
| 2c | #1008 sign-in email in en and he | `convex-arch` |
| 2d | #1055 /plan's time-block dialog in Hebrew | #1038 |
| 2e | #1050 notes page menu: Escape closes it, Export .md keeps the title | #1001 |
| 2f | #1071 /tracking with no habits: no "Longest among 0 habits: 0." | #968, #981 |
| 3 | #984 /privacy and /terms drafts · #987 honest landing · #994 OpenUI cards on by default · #1002 one brain dump · #1004 sparklines read right to left · #1006 first name while waiting · #1040 /insights as PanelUI cards and a Day Grid · #1042 the weekly glance's Hebrew focus total | #964 |
| 4 | #993 /tasks: Enter adds, Hebrew | #965 |
| 5 | #1020 no default "Home reset" project | #993 |
| 5b | #1039 /tasks: Undo after delete, Enter saves, Escape closes | #1020 |
| 5c | #1067 /tasks keeps a typed title when you leave and come back | #1039 |
| 6 | #1026 brain-dump panel readable in dark mode · #1058 /brain-dump keeps the dump and the sorted plan across Back, Forward and a reload | #1002 |
| 7 | #988 coach web search backend and week-bounded done tasks | `convex-arch` |
| 8 | #1000 web search switch and sources card · #995 weekly glance reads one week | #964, #988 |
| 9 | #1018 Executor connection backend | #988, `convex-arch` |
| 9b | #1035 the coach doesn't propose a task already open on Today | #1018, `convex-arch` |
| 10 | #1019 Settings → Connections and "Look in my apps" | #1018 merged *and deployed to TEST* (otherwise preview logs a console error on /settings/integrations) |

**Do not merge:** #975, which deploys live, as its title says. Close #1009 and #1010 (replaced).

**Proof that the order works.** On 16 Oct (re-run after wave 6) I checked every pair of the 53 B07 branches (this page's included) with `git merge-tree`: 1,378 pairs, 0 conflicts. I then merged all 52 code branches into `integration`, in this order, on a local branch that was never pushed:

| check on the combined tree | result |
|---|---|
| `bun install --frozen-lockfile` | pass |
| `bun run lint` / `bun run typecheck` | pass (5/5) / pass (5/5) |
| `bun run test` | 2782 pass, 0 fail |
| `bun test convex` | 1112 pass, 0 fail |
| scans (forbidden tech, RAM-only, design tokens, notices) | pass |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | pass |
| `CI=1 bunx playwright test` | 28 passed, 89 skipped (need a signed-in preview), 0 failed |

## What works today (WALK)

All on preview, with a separate test account, 16 Oct. Rendering held in all 256 loads (32 routes × 390/1280 × light/dark × en/he): every load returned HTTP 200, with no bounce to sign-in, 0 px sideways scroll, no console errors, and right-to-left in Hebrew. Full lists: `evidence/what-worked.md`, `evidence/render-matrix.md`.

- **Tasks:**
  - long and Hebrew-plus-emoji titles;
  - one task per reload;
  - fast completes settle correctly;
  - a task added in one tab appears live in another.
- **Notes:**
  - a double "New note" makes one note;
  - `[[` links with "Linked here";
  - delete with Undo;
  - the page menu reads in Hebrew.
- **Habits, routines, calendar, plan, templates:** empty adds explain themselves, and double clicks make one item.
  - A routine run's Done, Back and Skip work.
  - (The habit double click was the exception, fixed by #1025.)
- **Coach:**
  - a double Enter sends one message;
  - proposals arrive as cards;
  - a double Accept makes one task;
  - Undo works after leaving and coming back.
- **Brain dump:** Sort works in Hebrew and with emoji, with reasons and Accept/Reject.
- **Settings:**
  - theme, text size, profile with "Undo my edits", nags and memory all keep the last choice;
  - the coach-push dial works with the keyboard.
- **Billing:** no payment step. "Choosing a plan opens after early access."
- **Navigation and keyboard:**
  - Ctrl+K works, in Hebrew too, and the mobile sidebar works;
  - "Skip to page" works;
  - a 2 px focus ring on every control on Today.

Each B07 PR adds a WALK proof of its own fix, on localhost against the TEST deployment, before and after. The proofs are in `docs/polish/evidence/b07-*.jpg` on each PR's branch. Web search's switch and card (#1000) and Executor's row (#1019) were proved as static renders with mocked data, because their backends aren't deployed yet.

## Known broken after the merges

Severity from the clumsy pass (`evidence/clumsy-table.md`; the worst in `evidence/clumsy-worst.jpg`). None of these is a blocker.

| severity | what | where it's tracked |
|---|---|---|
| major | /tracking: a 99999-minute block says "did not save, try once more", which can never work | #968 |
| minor | Hebrew still English in a few places: Panic's action text (it comes from the server), and the outline inside a new week or day page ("Focus", "Days", "Monday" …, from the server's starter template). The time field in /plan's time-block dialog follows the browser's own language. Week and day pages made before #1076 keep their English titles (it doesn't rename pages). | outline: #1075 in progress (web code only); the rest: no fix yet (notes on #1021, #1038 and #1055) |
| minor | Headings: /today has two h1s | your call (Needs Amit, item 7); #1057 fixes /plan and /templates/builder |
| minor | /history: "No messages have been added to this thread yet." under every thread that isn't selected (only the selected thread's messages are loaded) | #1074 in progress, on top of #1024 |
| infra | Component tests under `apps/web/components/**` never run in CI. Run together they fail, because mocks leak between files (`tests/unit/releaseOnboardingGate.test.tsx`). | no ticket yet. Each new component test passes on its own. |
| infra | Typing into a server-rendered form before the page hydrates loses the text (seen in the calendar e2e) | the e2e now waits (#1024); the product race remains |

**Fixed by the PRs above** (WALK before/after on each): the scaffold pages (#1023), Today's long intention and Hebrew day plan (#1022), the energy card (#1021), the dark brain-dump panel (#1026), the "Home reset" default (#1020), double habits (#1025), /calendar and /history in Hebrew with "1 saved thread" (#1024), the event row in Hebrew with plain error copy instead of raw server text (#1036), /plan and /coach controls in Hebrew (#1038), Undo after deleting a task and Enter/Escape in its editor (#1039), plus everything in the B07 list above.
Wave 5 (16 Oct, evening) adds:
- /brain-dump keeps the typed dump and the sorted plan across Back, Forward and a reload in the same tab, so a sort is never wasted. This was the last **major** (#1058).
- Today fits a 390 phone. The real cause was a long habit name pushing "Check" off the screen, not the coach cards; the habit strip also reads in Hebrew (#1056).
- In Hebrew: /coach's "Today's plan" card (#1054) and /plan's time-block dialog (#1055).
- The notes ⋯ menu closes on Escape, and "Export .md" keeps the title (#1050).
- Ctrl+K gives focus back where it was (#1052).
- /plan and the template builder each have one h1 (#1057).

Wave 6 (16 Oct, night) closes the rest of the clumsy pass except the rows in the table above:
- /tasks keeps a typed title when you go to another page and come back, per view, in the same tab (#1067).
- Notes pages save the last half-second of typing before a reload or Back (typed, reloaded after 150 ms: lost twice before, kept twice after). They also have one `<main>` and a Hebrew loading text (#1072).
- Routines: a routine with no steps says "Add steps" instead of opening an empty run, and a run resumes at the right step after a reload in the same tab, skips included (#1069).
- /goals: "New goal" asks for a name first, and the count reads "Showing 1 goal" (#1070).
- /templates: the built-in template cards read in Hebrew (12 English words to 0); English is unchanged, character for character (#1068).
- /tracking with no habits drops "Longest among 0 habits: 0." (#1071). 0 or −5 minutes get the same in-app hint as 99999 (#968).
- A new device takes the account's language, so a Hebrew account's new week and day pages get Hebrew titles (#1076, product call in item 7).
- Signing out clears this tab's kept brain dump (#1058) and task draft (#1067), so the next person on a shared computer doesn't see them (#1073).

**Proved with static renders, not on preview** (the test account is under a week old, and weekly pages aren't on preview): /insights as PanelUI cards with the same totals as the old charts (#1040), and the weekly glance's Hebrew focus total (#1042). Both show one fixed fixture through the old and new code, styled by the real build's CSS.

## 5-minute demo script (after the merges)

Run it on preview at 1280, then once on a phone. EXTRAPOLATED: each step is proven on its own PR, but not yet together on preview.

1. **Landing (30 s).** Open tempoflow's landing in English, then switch to Hebrew. Every claim on it is something the beta does today (#987). Show /privacy, marked draft (#984).
2. **Sign in (40 s).** Use the magic link. The email says who it's from and what the link does, in both languages (#1008). A new account is asked for a first name while it waits (#1006).
3. **Today (60 s).**
   - Set an intention, pick top tasks and an energy level, then press "This is my day". A long intention wraps (#1022).
   - Pick Medium in "Match your energy" and add one suggestion (#1021).
4. **Brain dump on Today (45 s).** Paste a messy paragraph and press Sort. Only "Now" goes on today; "Soon" and "Later" wait in tasks (#1002). It's readable in dark mode (#1026). On /brain-dump, sort, open another page and press Back: the dump and the plan are still there (#1058).
5. **Coach (60 s).** Ask "plan my afternoon". The proposal comes back as a card (OpenUI is on by default, #994). Accept it, then Undo.
   - If `MISTRAL_API_KEY` is set and the switch is on in settings: ask something current. The reply cites sources in a small card (#988, #1000).
6. **Tasks and pages (40 s).**
   - On /tasks, press Enter: one task, with no project (#993, #1020).
   - Delete it, then press Undo in the toast: it comes back (#1039).
   - Type a title without adding it, open Today, press Back: the title is still there (#1067).
   - Open a page with a long title: it wraps (#1001).
   - The top-bar crumb names the page (#992).
7. **Hebrew pass (30 s).** Switch to Hebrew and show Today with its habit strip (#1056), /calendar with an event's row (#1024, #1036), /plan with its timeline and time-block dialog (#1038, #1055), /coach's dial and "Today's plan" card (#1038, #1054), /templates (#1068), and /history. Show the weekly glance, whose sparklines and focus total read right to left (#1004, #995, #1042).
8. **Settings → Integrations (15 s).** Executor shows "Not set up yet" until you turn it on (#1019). Planned connectors say "Coming later". "Ask the founder" opens a real page with a mail link (#1023).

## Release steps (exact, from `docs/DEPLOY.md`)

Before clicking:
- the merges above are done;
- preview is walked;
- AT items 4 to 6 are decided.

1. GitHub → **Levidavidspublic/tempo-rhythm** → **Actions** → **Release to production**.
2. **Run workflow** ▾ → branch **integration** → tick **Dry run** → **Run workflow**. Only Division6066 can run it.
3. Read the dry run. It stops after "gate verdict" with "Dry run: release gate GREEN" (or red) and a comment on the release PR.
   - The gate pins the integration commit and opens or updates the `Release YYYY-MM-DD` PR.
   - It runs full CI, the secret scans, Playwright against the integration preview, and one Bugbot review (AT item 4).
   - Any red check or Bugbot finding stops it and labels the PR `blocked:amit`.
4. If it's green, run it again with **Dry run unticked**.
   - It waits until the release PR can merge.
   - **This release changes `convex/`** (#988, #1018, #1008), so it deploys Convex prod (precious-wildcat-890) before the web. That needs `CONVEX_DEPLOY_KEY_LIVE`, set on 6 Oct.
   - It then merges, checks that master's tree equals the tested commit, and waits for Vercel's production deployment.
   - Last, it checks that `https://www.tempoflow.dev/api/health` reports the new commit.
5. It usually takes 20 to 35 minutes. Green run = live. The summary shows the master commit, the Vercel link and the health check.

**Roll back** (manual, `docs/DEPLOY.md` → Roll back):
- **Web:** Vercel → amit-levins-projects → tempo-web → Instant Rollback. Afterwards, click **Undo Rollback** before the next release.
- **Convex:** promote the previous deployment of precious-wildcat-890 in the Convex dashboard.
- **The code:** revert it on integration with a normal PR.

## UNKNOWN

- Whether `FACTORY_BATCH_TOKEN` is set now (open on 6 Oct).
- Executor end to end: the live MCP URL, whether a `*.convex.site` redirect is accepted, and whether `crypto.subtle` AES-GCM runs in Convex's runtime. All were tested against a fake; see #1018.
- Web search with a real Mistral key (no key here, and none should be used).
- Whether amit@tempoflow.app is read.
- How the merged beta behaves on preview: proven per PR and as a combined local build, but not seen on preview, because nothing is merged yet.
- Two wave-6 cases seen only in unit tests, not in a browser: /tracking with zero habits (#1071; no test account has zero habits), and the sign-out step of #1073 (signing the test account out would end the session these proofs use). #1073's browser proof covers the other half: kept tab state survives reloads and page changes while signed in.
- A native Hebrew read of all new copy.

## Evidence in this folder

- `evidence/clumsy-table.md`: 41 findings with severity and the PR that covers each.
- `evidence/what-worked.md`: what held up under clumsy use.
- `evidence/render-matrix.md`: 32 routes × 8 variants.
- `evidence/clumsy-worst.jpg`, `evidence/clumsy-hebrew-gaps.jpg`: contact sheets. The test account is "Dana"; all of its data is named `clumsy …`.
