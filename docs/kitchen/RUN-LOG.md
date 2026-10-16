# Kitchen: polish pass — run log

Branch `kitchen/polish-pass` from `integration` (`eb0b12c`). One draft PR into `integration`. Mode: kitchen polish, unattended overnight.
If this run restarts: continue from the first unchecked item below.

**Tags.** Each step says who it needs:
- `AWAY`: the agent does it while Amit is away.
- `WALK`: Amit can do it from his phone (read, tap, approve).
- `AT`: Amit needs to be at the computer.

## Steps

- [x] `AWAY` 0. Read AGENTS.md, CLAUDE.md, `factory/SLOTS.md`, `docs/design/v3/` (DESIGN.md, components, screen map) and the six open PRs (bodies, comments, reviews).
- [x] `AWAY` 1. Create `kitchen/polish-pass` from `integration`. Bring in 964, 965, 967, 968, 969 and 970, one squash commit each, unchanged. 966 (ENV-MANIFEST docs) is not a polish PR and was not listed, so it stays out.
- [x] `AWAY` 1a. Before screenshots in `docs/kitchen/polish/before/`. They come from a clean `integration` worktree (`eb0b12c`) on port 3001, with the same script as the after shots (`docs/kitchen/polish/shoot.mjs`).
- [x] `AWAY` 2. Audit with one subagent per area: Today · Chat/Coach · Notes/Pages · Calendar/Tasks · Settings/Onboarding. Findings and their status are in `docs/kitchen/AUDIT.md`.
- [ ] `AWAY` 3. Fix, area by area.
  - [ ] Today
  - [ ] Chat/Coach (Open WebUI patterns, ideas only)
  - [ ] Notes/Pages
  - [ ] Calendar/Tasks
  - [ ] Settings/Onboarding
- [ ] `AWAY` 4. After screenshots in `docs/kitchen/polish/after/`; full check run (AGENTS.md "Testing").
- [x] `AWAY` 5. Issue "Kitchen: polish pass" (#1051); one draft PR into `integration` with `Closes #1051`: https://github.com/Levidavidspublic/tempo-rhythm/pull/1053 (draft).
- [ ] `AWAY` 6. RESUME comment on the PR; this log updated.
- [ ] `AT` 7. Amit reviews and decides (see "Needs Amit" in the PR's RESUME comment). Never merged by the agent.

## Log

| time (UTC) | commit | area | result | proof |
|---|---|---|---|---|
| 2026-10-16 16:14 | `eb0b12c` | setup | Branch created from `integration`. Bun 1.3.9, `bun install --frozen-lockfile` OK | — |
| 2026-10-16 16:35 | `eb0b12c` | before | 44 JPEGs: 11 screens × 390/1280 × light/dark. No sideways scroll on any of them (scrollWidth − innerWidth = 0). The Next.js dev badge is hidden | `docs/kitchen/polish/before/` |
| 2026-10-16 16:22 | `7905a83`…`e67c7ee` | step 1 | 967, 968, 969, 970, 965, 964 squash-applied in that order. No conflicts. lint 0 errors (9 old warnings), typecheck pass, unit tests 2315 pass / 0 fail | this log; CI on the PR |
| 2026-10-16 16:31 | `d82bada` | PR | Draft PR opened; all 17 checks green on the first push (scope-guard passes with the ticket's `type: data`) | PR checks |
| 2026-10-16 16:55 | — | step 2 | Five audits back (Today, Coach, Notes, Calendar/Tasks, Settings). P1s: crisis check missing on Today's brain dump, sideways scroll at 390 (Tasks, coach, notes), blank loading bodies, silent failed saves, no error boundaries | `docs/kitchen/AUDIT.md` |
| 2026-10-16 17:05 | `982a322` | Coach | Open WebUI patterns (ideas only): follow-bottom + Jump to latest, Markdown replies, Copy, typing indicator, starters, growing composer, counter; send is ink; offline + create-error states; refocus | unit `tests/unit/coach_message.test.tsx`, `apps/web/lib/coach-thread.test.ts` |
| 2026-10-16 17:12 | `8588642` | all | Loading skeletons were 0 px wide on every StateLoading (settings, onboarding, billing, memory): fixed | local shot of /settings/profile and /onboarding |
| 2026-10-16 17:40 | `dcaa36a` | Today | Shell-wide error boundary; greeting without the retired orange; TaskRow, EventBlock, quick-add form; brain dump on Today carries open PR #1026 and is redrawn on v3 classes; crisis card on `tp-crisis`; no Convex error text on /brain-dump | unit tests; screenshots in step 4 |

## Decisions and notes

### Open WebUI licence (read 2026-10-16 before borrowing anything)
- Source: `LICENSE` on the `main` branch of `open-webui/open-webui`, fetched raw from GitHub.
- It is a BSD-3-Clause-style licence with an added **clause 4 (branding)**. Licensees may not alter, remove, obscure or replace the "Open WebUI" branding (name, logo, visual or textual identifiers) in any deployment or distribution of the software. The exceptions are: 50 or fewer end users in a rolling 30 days, written permission, or an enterprise licence.
- **What this pass takes from it: interaction ideas only.** That covers composer behaviour, a Stop button while a reply is coming, message actions, the shape of the history list, and suggested prompts on an empty chat.
- **What it does not take:** no code, no markup, no CSS, no icons, no wording, no name and no logo. Everything is built from Tempo's own `tp-*` classes, tokens and existing Convex functions.
- Whether clause 4 or any other term reaches interaction ideas, as opposed to the software itself: **UNKNOWN**. The licence text does not say. This is not legal advice, and Amit should check before borrowing anything beyond ideas.

### New UI libraries
- This pass adds none of its own.
- Brought in unchanged from 964:
  - `@openuidev/react-lang` 1.0.1 (MIT): draws the coach cards from stored proposals, behind the `openui` flag. The flag is on for preview and local, off on production.
  - `tailwind-variants` 3.3.1 (MIT): needed only by the copied PanelUI `kpi.tsx` and `day-grid.tsx`.
- Why they stay: the brief says to bring 964 in so nothing is lost. Both are listed in `THIRD-PARTY-NOTICES.md` (from 964).
- Whether to keep them is Amit's decision. See "Needs Amit".

### Files other open PRs are also changing (avoid needless conflicts)
- Several open B07 PRs change the same screens: #1019, #1020, #1021, #1022, #1024, #1025, #1026, #1036, #1037, #1038, #1039, #1040 and #1042.
- Where one of them already fixes a finding, this pass leaves the file alone, or makes only a small CSS-level fix, and marks the finding "handled by open PR" in `AUDIT.md`. That covers Tasks views and editor, the day plan, energy picks, calendar views and event rows, the history screen, the coach dial, the timeline and the week glance.
- The exception is #1026 (Today's brain-dump panel). This pass carries #1026's panel code, because it redraws that same panel on the v3 classes.
- The Settings/Onboarding fixes are made by one file-editing subagent in its own worktree (CLAUDE.md allows at most one per ticket). They are merged here after its checks pass.

### Local dev server note
- Turbopack's persistent cache kept serving old CSS after `globals.css` changed.
- Every screenshot run first clears `apps/web/.next/dev` and restarts the server.

### Screenshots: what the local server can and cannot show
- Screenshots come from the local dev server. It runs with a placeholder Convex URL and the repo's dev-only E2E bypass (`playwright.config.ts` env). There are no keys and no preview URL.
- Pages that read Convex show their **loading** or **signed-out** state.
- `/notes` is outside the dev bypass, so it redirects to `/sign-in`.
- Data-filled states can't be produced locally. They are UNKNOWN unless a preview walk proves them.
