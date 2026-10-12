# Design check

Renders every HTML design screen in Chromium and reports mechanical problems before a design goes into the repo. It is not part of the app build or CI: nothing here is a workspace package, and no guarded path is touched.

## What it checks

Every page in `config.json` → `pages` (default `screens/**/*.html` and `hero-board.html`), at 390 and 1280 px, light and dark, LTR and RTL. That's 8 renders per page.

| Check | How | Fix class |
|---|---|---|
| Overflow | `scrollWidth > viewport width`, then names the boxes or `::before/::after` that stick out | mechanical |
| Console | console errors and uncaught page errors | report |
| Fonts | failed font requests, FontFaces with status `error` | report |
| Overlap | centre of every button/link/input via `elementFromPoint`; lands on another interactive element | design |
| Forbidden words | visible text, placeholders, input values: EXTRAPOLATED, UNKNOWN, Sample data, undefined, null, lorem, raw JSON | mechanical (move to README) |
| Contrast | axe-core `color-contrast` | design |
| Labels / alt | axe-core `label`, `button-name`, `link-name`, `image-alt` and friends | mechanical |
| Links | relative links to files that don't exist (once per page) | mechanical |
| RTL mirror | heuristic: the side nav stays on the same side in LTR and RTL | mechanical |

Theme and direction use the design's own URL switches (`?theme=dark&lang=he`, see `tempo.js`). If a page ignores them, the checker sets `data-theme` / `dir` on `<html>` itself and the summary says so. Change this in `config.json`, not in the script.

## Run it

```bash
cd docs/design/_check
npm install
npx playwright install chromium      # skip if a Chromium is already set via DESIGN_CHECK_CHROMIUM
node check.mjs --design ../tempo-v3 --out ./out --shots-label "C:\Users\User\Projects\tempo-design-inputs\screens-check"
```

Options: `--sheets <dir>` (default `<design>/screenshots`), `--no-sheets`, `--only <text>` (pages whose path contains it), `--concurrency 4`, `--strict` (exit 1 on any mechanical finding). `DESIGN_CHECK_CHROMIUM=/path/to/chrome` uses an existing browser.

## What it writes

- `out/<group>/<page>__<width>-<theme>-<dir>.png`: every full-page screenshot. Local only (`out/` is git-ignored). Copy them to `tempo-design-inputs\screens-check\` on the PC.
- `out/summary.md`: the results table plus every finding, collapsed across variants, each with a screenshot path. This is the source for `CHECK-REPORT.md` and the PR body.
- `out/results.json`: everything, raw.
- `<sheets>/<group>--1280-light.jpg` and `<group>--390-dark.jpg`: one contact sheet per route group. These are the only images committed.

Groups come from the design's own screen registry (`window.Tempo.screens[].group`) when it has one, otherwise from `config.json` → `groupsFallback`.

## Bringing a new design in from Open Design

Copy the finished folder without Open Design's working files:

```powershell
robocopy "<Open Design project>\tempo-v3" "docs\design\tempo-v3" /E /XD .file-versions .od-* .remember /XF *.artifact.json
```

Then run the check, fix only mechanical problems, and list design-level ones in `CHECK-REPORT.md` for Open Design. `PR-TEMPLATE.md` has the PR body.
