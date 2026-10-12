# Overnight run: Tempo Flow v3, markdown-first, merged to preview

Claude Code cloud session (environment tempo-overnight). Unattended. Amit's rule: KISS. Amit reads the morning report.

## Goal
By morning, preview.tempoflow.dev runs the v3 redesign as a markdown-first app. Everything is merged into `integration` (that is what deploys the preview). Nothing goes to `master` or live.

## Read first
- docs/design/v3/ on branch `batch/v3-markdown-first`: README.md, DESIGN.md, components.md, screen-map.md, screens/web/*.html, screens/mobile/*.html, Source Docs/PRD.md, Source Docs/HARD_RULES.md.
- AGENTS.md, factory/SLOTS.md, docs/HARD_RULES.md. They win on process and safety. Use bun.
- Open PR #874 (docs/contracts/CORE-WEB-EDITOR-MODES.md). Its decisions are settled below.

## Decisions (settled by Amit; do not reopen)
1. `notes.body` markdown is the only source of truth. No second stored representation. Tempo blocks are fenced blocks inside it, using the existing codec (PR #826 / its merged form) with the #874 boundary-guard fixes. The JSON is never shown.
2. Editor = CodeMirror 6 live preview (Obsidian-style decorations over the markdown text). Saving is byte-exact: an untouched page loads and saves back identical. Add that test with a fixture holding every block type, Hebrew + English mixed paragraphs and a GFM table. Add remark-gfm for the read view.
3. `[[links]]` are live: picker on `[[`, and "Linked here" backlinks, as the v3 design shows.
4. `- [ ]` stays a plain markdown checkbox. It is not a Tempo task block.
5. Keep the v3 look exactly: classes, data-component names, tokens, layout, copy, states. Port tokens.css / tempo.css to Tailwind v4 @theme.
6. One page route: /notes/[id]; /p/[pageId] redirects to it. Journal, daily, weekly, brain-dump results and templates are markdown pages ({{tokens}} in templates).
7. Slash menu Text group: Heading 1-3, Bullet, Numbered, Checklist, Quote, Code, Divider, Table. Page menu: Copy as Markdown, Export .md. Paste markdown parses; copy gives markdown. RTL: dir="auto" per paragraph; numbers and code LTR.

## How to work (KISS)
- Every change is a PR straight into `integration`. Branch names `v3/<short-name>` (never `t/...`). If a PR gets the `factory` label, remove it.
- This is an owner-authorised exception to AGENTS.md rules 1 (one ticket = one `t/<issue>-…` branch and PR) and 12 (draft PRs only), for this run only. Each v3 PR links no ticket and carries the `config` label, so scope-guard and config-guard still judge it (guarded files still need Division6066's `config` label), and its body names this file as its scope. Every other AGENTS.md rule still applies: no secrets, no spend, no live deploys, no test-config or baseline edits.
- Before each PR, run the AGENTS.md "Testing (cloud agents)" list and paste the results in the PR body.
- Codex is the reviewer. Merge a PR only when required CI is green AND the Codex review has run on its latest commit with no P0/P1 finding. If Codex flags P0/P1, fix and push, then wait for the new review. If no Codex review arrives within 30 minutes, ask for one once by commenting "@codex review"; if there is still none, leave the PR open (never merge without a review) and move on to work that does not depend on it. Use `gh pr merge --squash --auto` (integration has a merge queue). If you cannot merge from this session, leave the PR ready and keep going; list it in the report.
- Builder (you) and checker (Codex) stay different models.

## Order
1. Open and merge the design docs: PR `batch/v3-markdown-first` -> `integration`.
2. Finish the open PRs this work depends on: #826 (if still open), #874, #878, #893, #891, #884, #887, #896, #873. For each: update from integration; if it passes and matches the decisions above, merge it. If it is broken or contradicts them, redo it as a new `v3/` PR from integration, link the old one, then close the old one with a comment. Leave every other open PR alone.
3. Build, one small PR per group, merging as you go: tokens + tempo.css -> TempoShell -> markdown model + editor + round-trip test -> Page editor, slash menu, blocks -> Today / Daily / Weekly -> Notes, Templates, Journal, Brain dump -> Coach panel -> remaining web screens -> mobile shell + mobile screens.
4. Preview check after the last merge: with Playwright, open every route on preview.tempoflow.dev at 390 and 1280, light/dark, en/he, and list anything that doesn't render. Screenshots under /tmp only. Fix what you can with more PRs.

If time or budget runs out, stop cleanly after the current PR and write the report. A merged half beats a broken whole.

## Hard limits
- Never push or merge to `master`; never run the release or deploy-live workflows.
- No convex dev/deploy or convex:* scripts; schema changes ship in PRs (convex-deploy-test handles the TEST deployment on merge). No real keys. No new paid services or add-ons.
- Don't post "@cursor review" or "bugbot run", don't dispatch factory-* workflows, don't re-enable disabled workflows.
- Don't edit test config, CI files or scan baselines to get green.
- New copy only where needed, in en + he; mark Hebrew for native review.

## Morning report (final message, and as a comment on the docs PR from step 1)
Verdict first. Then: PRs merged / closed / left open, with links; per-PR test results; preview route check table; anything UNKNOWN; anything not done, in order.