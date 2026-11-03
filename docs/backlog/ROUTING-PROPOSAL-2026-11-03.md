# Browser-test routing — cause and proposed fix (for Amit, 3 Nov 2026)

## Verdict
The loop sends every browser-test ticket to Codex first, and Codex can't push code from the task the loop starts for it. So a browser-test ticket gets a draft PR with only an empty scaffold commit, and nothing lands.

Three smaller gaps sit behind that:
- nothing in the backlog marks a ticket as a browser test;
- the label router never asks for browser routing;
- the ticket validator and the lane picker disagree on which lane comes first.

I changed nothing in `.github` or `scripts/factory`. Everything below is read from `integration` at `27e6322`.

## Repo variables today (read in GitHub settings, 3 Nov 2026 12:20)
`FACTORY_CODEX_AT_LIMIT=true`, `FACTORY_CURSOR_AT_LIMIT=false`, `FACTORY_CURSOR_MODE=api`, `FACTORY_AGENT_PREFERENCE=claude,codex,cursor`, `FACTORY_ACTIVE_BATCHES=FT1`, `FACTORY_MAX_IN_FLIGHT=15`, `FACTORY_CODEX_MODE` not set (default `pr`), `FACTORY_MODEL_CODEX=GPT-5.6 Terra`.
So **today** a ticket marked `browser_test: true` goes to **Cursor** (Codex is switched off by `FACTORY_CODEX_AT_LIMIT`), and the Codex push limit below bites only once Codex is switched back on. What blocks browser tickets today is gap 5 (nothing marks them, so they route as plain build tickets → Claude) and gap 3 (a written `lane:` is ignored). The 2/2/2 loop also needs `FACTORY_CODEX_AT_LIMIT=false` for its two Codex tickets.

## The cause, step by step
1. **The lane picker puts Codex first.** In `scripts/factory/lane-limits.mjs` line 59, `candidates("browser")` = the preference order with Claude moved last. With the default `claude,codex,cursor` that is **codex → cursor → claude**. `next-tickets.mjs` uses it for every ticket whose front-matter has `browser_test: true` (line 63, `ticketKind`).
2. **The Codex lane can't land the code.** `factory-lane-codex` (mode `pr`) does two things: it creates `t/<issue>-<slug>` with an empty commit, and it posts `@codex implement …` on a draft PR. `factory/LOOP.md` lines 52–55 ("Known limit") record that Codex tasks started by `@codex` on a PR run without GitHub write access: on #670 Codex fixed the code but could not push. Until Codex's environment allows pushing, a browser ticket routed to Codex stays an empty draft PR. The loop then waits for green CI that never comes.
3. **The lane the validator approves is ignored.**
   - `validate-tickets.mjs` lines 25 and 34 require `browser_test: true` → `lane: cursor | codex`, with Cursor preferred. `.github/factory/ticket-writer-prompt.md` and the issue template say the same.
   - But `next-tickets.mjs` line 78 keeps a ticket's `lane:` only with `lane_pin: true`.
   - So a ticket written as `lane: cursor` is routed to Codex anyway.
4. **The label router never asks for browser routing.** `dispatch-router.yml` line 113 calls `lane-limits.mjs --want "$lane"` with no `--kind`, so it always routes as a plain build ticket. Line 101 also sends any SCOPE containing `.spec.` or `tests/` to Claude. Every browser-test ticket has a `.spec.ts` in SCOPE.
5. **No ticket says it is a browser test.** `BACKLOG-v2.md` tickets carry no front-matter, and no rule says how `browser_test` is set when a ticket becomes an issue. By CONVENTIONS §9, every web component, web screen and mobile UI ticket has a Playwright DONE, so all of them are browser tests.

## Proposed fix (config lane: yours to approve; ordered from smallest to largest)
1. **Today, no code change.** Pick one:
   - **(a)** In Codex → Environments → tempo-rhythm, allow GitHub access and "push to branch". This is the setting LOOP.md names. Then re-test on one browser ticket. Whether the setting exists in that form today is UNKNOWN until someone looks.
   - **(b)** Until (a) is verified, set repo variable `FACTORY_CODEX_MODE=manual`. Browser tickets then go to Cursor, then Claude; Codex gets no factory tickets and Amit starts Codex tasks by hand. The Claude lane can run Playwright: its allowed tools include `Bash(bunx:*)`.
2. **Code change, one config PR** (`scripts/factory/lane-limits.mjs`, `scripts/factory/next-tickets.mjs` and `scripts/factory/test-factory.mjs`):
   - `candidates("browser")` = **cursor → claude → codex** (Codex last while it can't push). This matches the validator and the ticket writer.
   - `next-tickets.mjs`: keep a valid `lane:` for `browser_test: true` tickets (treat it as pinned).
   - Update the browser assertions in `test-factory.mjs` (lines 292–372) to the new order.
3. **Label router** (`dispatch-router.yml`): read `browser_test` from the issue front-matter and pass `--kind browser`. Check the browser case before the `.spec.`/`tests/` → Claude rule.
4. **Issue conversion rule** (docs only; I can add it to CONVENTIONS once you agree): when a BACKLOG-v2 ticket becomes an issue, `browser_test: true` if its DONE runs `bunx playwright test`, else `false`. `type: data` if SCOPE has a `convex/` file, else `component`.

## Until it's fixed
Leave browser-test tickets out of loop 1, as the Tuesday pack says. Fire only backend and pure-helper tickets (DONE = `bun test …`).
