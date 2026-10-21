# Alpha loop scripts

One headless-browser script per weekend-alpha loop (`docs/sprint/RUN-LOG.md` on `run/weekend-alpha`). Each script runs one pass against preview, saves screenshots, and exits `0` only on a pass. They are plain Node scripts on `@playwright/test`'s browser API, not Playwright specs, so `playwright.config.ts` and CI are unchanged.

| Script | Loop |
|---|---|
| `l1-sign-in-today.mjs` | Sign in with the guest/test sign-in, Today loads as the daily page |
| `l2-today-task.mjs` | Add a task on Today by typing, reload, it is still there (once). Completes its own "Alpha" tasks before and after, since Today shows 3 open tasks |
| `l3-template-slash.mjs` | Page from a template, add a Heading 2 with the slash menu, reload, it persisted |
| `l4-coach-plan-undo.mjs` | Ask the coach to plan the afternoon, the proposal card shows the change, Accept, it appears, Undo removes it |
| `l5-decision-card.mjs` | On Today, ask "What order should I do these in?", a decision card renders, Save to today writes it to today's page |

Every pass ends with the crisis check: one crisis-style message on `/coach` must show the fixed crisis card (`data-testid="coach-crisis-resources"`), no typing state, and no `coach:reply` call in the WebSocket frames the browser sends (the only client path to the model).

## Signed-in sweep

`sweep.mjs` loads every signed-in app screen at 390 and 1280 px, light and dark, en and he (8 renders per route), with `ALPHA_STORAGE_STATE`. It also opens the first note, week, template, goal, project, habit and routine it finds. A render fails on an uncaught page error, an error screen ("Application error", "Something went wrong", 404), an HTTP 5xx, a horizontal scroll, or landing on sign-in or the approval wait. It only loads pages; it never clicks anything that writes. Console errors are listed but don't fail it.

```bash
node e2e/alpha/sweep.mjs                              # every route, 8 variants each
node e2e/alpha/sweep.mjs --only today,coach --widths 390
```

Output: `out/sweep/<run time>/summary.md`, `results.json` and one screenshot per render.

## Run

```bash
node e2e/alpha/l2-today-task.mjs          # one pass of one loop
node e2e/alpha/run.mjs --times 5          # every loop 5 times in a row, stops a loop at its first non-pass
node e2e/alpha/run.mjs --times 5 l2 l3    # some loops
```

Exit codes: `0` PASS, `1` FAIL, `2` BLOCKED_VERIFICATION (no usable signed-in, approved session).

Environment (all optional):

| Name | Use |
|---|---|
| `ALPHA_BASE_URL` | Target, default `https://preview.tempoflow.dev` |
| `ALPHA_STORAGE_STATE` | Path to a Playwright storage-state file of a synthetic, approved test account. Without it, the scripts look for a guest control on `/sign-in` |
| `ALPHA_CHROMIUM` | Path to an installed Chromium, instead of Playwright's download |
| `ALPHA_OUT` | Output folder, default `e2e/alpha/out` (git-ignored) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Sent as `x-vercel-protection-bypass` to the preview origin only, when preview is protected |
| `HTTPS_PROXY` | Passed to Chromium as its proxy |

Never point these at a real person's account. A storage-state file holds a live session: keep it out of git and out of uploaded artifacts.

## Output

`out/<loop>/<run time>/NN-<step>.png` and `result.json` per pass, and `out/summary.json` from `run.mjs`.
