# Overnight run: Tempo Flow v3, markdown-first, then build

Started from a Claude Code cloud session (environment tempo-overnight). Unattended. Amit reads the morning report.

## Context
- Design: docs/design/v3/ on branch batch/v3-markdown-first (DESIGN.md, components.md, screen-map.md, tokens.css, tempo.css, tempo.js, screens/web/*.html, screens/mobile/*.html, Source Docs/). Read README.md, DESIGN.md, components.md, screen-map.md, Source Docs/PRD.md and Source Docs/HARD_RULES.md first.
- Repo rules: AGENTS.md, factory/SLOTS.md, docs/HARD_RULES.md. They win on process, data and safety. Package manager is bun (see SLOTS.md), not pnpm.
- Goal: keep the v3 look exactly (every class, data-component, token, layout, copy, state). Change only what makes it markdown-first, then build it into apps/web and apps/mobile.
- Branching: batch/v3-markdown-first is the batch branch. Do each piece on its own branch off it (v3/a-specs, v3/b1-tokens, ...) and open PRs INTO batch/v3-markdown-first.

## Markdown-first rules (every screen spec and the code)
1. A page is ONE markdown string, the source of truth (e.g. pages.body + pages.version). Nothing else is canonical.
2. Tempo blocks (task, event, time block, habit, nag, energy, template, page-meta, artifacts) live inside the markdown as fenced blocks with a stable id (e.g. ```tempo-task {json}```). They render as the existing quiet cards. The JSON is never shown (F-02).
3. Tasks, events and habits tables are indexes derived from the markdown on save. They never hold their own copy of the text.
4. Edits: debounced autosave of the whole body with optimistic concurrency (pages.saveBody({ id, markdown, baseVersion })). Block actions such as ticking a task call a server mutation that rewrites that fence in the markdown and bumps the version. Replace the pages.updateBlock / insertBlock / moveBlock specs with markdown-level operations that keep the same UI.
5. Editor: live-preview markdown (Obsidian live preview / Craft feel; the existing paper page, block handles and slash menu stay). Typed input rules: # ## ###, -, 1., - [ ], >, ```, ---, **bold**, *italic*, `code`, [[link]], #tag. Pasting markdown parses it; copying gives markdown.
6. Round trip: nothing is ever lost (all text, every block fence and id), and saving is idempotent: save(load(x)) may normalise whitespace or list markers once, but save(load(save(load(x)))) must equal save(load(x)). Add a test with a fixture page holding every block type, Hebrew + English mixed paragraphs and a GFM table.
7. Slash menu Text group adds: Heading 1-3, Numbered list, Checklist, Quote, Code, Divider, Table (GFM). Keep the Tempo blocks group as it is.
8. Page menu adds "Copy as Markdown" and "Export .md". Memory export stays.
9. Daily, weekly, journal, brain dump results and templates are all markdown pages. Templates are markdown with {{tokens}} (e.g. {{next_monday}}). The journal keeps its UI but saves its entry as markdown (its own page per date, linked from the daily page); say so in the spec.
10. One page route: /notes/[id]. /p/[pageId] redirects to it.
11. RTL: dir="auto" per markdown paragraph (F-72). Numbers and code stay LTR.
12. Editor library: criteria are markdown as source of truth, rule 6 round trip, RTL, MIT or Apache licence, passes scan:forbidden-tech and check:notices. Write the choice and two rejected options in docs/design/v3/DESIGN.md section 15 "Markdown model". If nothing meets every criterion, DO NOT stop: pick the closest, put it behind an EditorAdapter interface so it can be swapped, write exactly which criterion fails, and continue.

## Phases
A. Specs (docs only). On v3/a-specs, update every affected screen header (@data, @actions, @flow) in docs/design/v3/screens, plus components.md, screen-map.md and DESIGN.md section 15. Don't change visual markup or CSS. PR into batch/v3-markdown-first.
B. Build. Small PRs into batch/v3-markdown-first, one screen group each, in this order: tokens + tempo.css port to Tailwind v4 @theme -> TempoShell -> markdown model + Convex schema/mutations + round-trip test -> Page editor + slash menu + blocks -> Today / Daily / Weekly -> Notes, Templates, Journal, Brain dump -> Coach panel -> the rest of the web screens -> mobile shell + mobile screens. Before each PR, run the AGENTS.md "Testing (cloud agents)" list and paste results in the PR body. Merge a PR into the batch branch only when CI is green and the automatic Codex review has no P0/P1 finding (wait up to 20 minutes for it; if none arrives, merge on green CI and note it). Builder (you) and checker (Codex) stay different models.
C. Preview check. Open the batch PR batch/v3-markdown-first -> integration. On its Vercel preview URL, use Playwright to open every route at 390 and 1280, light/dark, en/he, and report anything that doesn't render. Screenshots under /tmp only.
D. Stop. Do not merge into integration and do not release to production. Amit merges in the morning (that redeploys preview.tempoflow.dev), then runs the release.

If you run out of time or budget, stop cleanly after the current PR and write the report. A finished half is worth more than a broken whole.

## Hard limits
- No convex dev/deploy or convex:* scripts; schema changes ship in PRs only. No real keys. No new paid services or add-ons.
- Don't post "@cursor review" or "bugbot run", don't dispatch factory-* workflows, don't re-enable disabled workflows.
- Don't edit test config, CI files or scan baselines to get green.
- Don't change copy except where the markdown model needs new strings (add en + he; mark Hebrew for native review).

## Morning report (final message + batch PR body)
Verdict first. Then: PRs opened/merged with links; per-PR test results; preview route check table; the editor library chosen, why, and any criterion it misses; anything UNKNOWN; anything not done, in order.