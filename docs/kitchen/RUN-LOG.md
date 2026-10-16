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
- [ ] `AWAY` 2. Audit with one subagent per area: Today · Chat/Coach · Notes/Pages · Calendar/Tasks · Settings/Onboarding.
- [ ] `AWAY` 3. Fix, area by area.
  - [ ] Today
  - [ ] Chat/Coach (Open WebUI patterns, ideas only)
  - [ ] Notes/Pages
  - [ ] Calendar/Tasks
  - [ ] Settings/Onboarding
- [ ] `AWAY` 4. After screenshots in `docs/kitchen/polish/after/`; full check run (AGENTS.md "Testing").
- [ ] `AWAY` 5. Issue "Kitchen: polish pass" (#1051, opened 16:30); one draft PR into `integration` with `Closes #1051`.
- [ ] `AWAY` 6. RESUME comment on the PR; this log updated.
- [ ] `AT` 7. Amit reviews and decides (see "Needs Amit" in the PR's RESUME comment). Never merged by the agent.

## Log

| time (UTC) | commit | area | result | proof |
|---|---|---|---|---|
| 2026-10-16 16:14 | `eb0b12c` | setup | Branch created from `integration`. Bun 1.3.9, `bun install --frozen-lockfile` OK | — |
| 2026-10-16 16:35 | `eb0b12c` | before | 44 JPEGs: 11 screens × 390/1280 × light/dark. No sideways scroll on any of them (scrollWidth − innerWidth = 0). The Next.js dev badge is hidden | `docs/kitchen/polish/before/` |
| 2026-10-16 16:22 | `7905a83`…`e67c7ee` | step 1 | 967, 968, 969, 970, 965, 964 squash-applied in that order. No conflicts. lint 0 errors (9 old warnings), typecheck pass, unit tests 2315 pass / 0 fail | this log; CI on the PR |

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

### Screenshots: what the local server can and cannot show
- Screenshots come from the local dev server. It runs with a placeholder Convex URL and the repo's dev-only E2E bypass (`playwright.config.ts` env). There are no keys and no preview URL.
- Pages that read Convex show their **loading** or **signed-out** state.
- `/notes` is outside the dev bypass, so it redirects to `/sign-in`.
- Data-filled states can't be produced locally. They are UNKNOWN unless a preview walk proves them.
