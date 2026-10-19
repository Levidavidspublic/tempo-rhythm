# KB-74 · Mobile navigation drawer keeps keyboard focus in view

Source baseline: `origin/integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. Before captures bundle the verbatim original `TempoShell.tsx` saved before the first host edit (SHA-256 `bb2473d1e21cfca0e80fd164906307656d5fc39a9c7b076474457abd57a82782` matches that integration file), with unchanged real Sidebar, Topbar, TabBar, coach and palette children. After captures bundle the scoped production TempoShell and the same real children. Both branches compile the repository global stylesheet through its installed PostCSS/Tailwind plugin, as the production build does. The original was frozen before editing; its browser capture ran later under the fixture lock and exited 0 for 390/1280 px English/Hebrew. Both use fictional Maya profile data and stubbed query/auth/navigation transport; no real account or backend write is exercised. Hebrew copy is machine-drafted for Amit's native review.

![Before and after drawer contact sheet](kb-74-mobile-navigation-drawer-keeps-keyboard-focus.jpg)

The contact sheet labels 390/1280 px, English/Hebrew, light before/after, after dark, original open drawer, keyboard-open after state with visible focus, restored-focus state, and the real interactive gallery. The original open drawer can leave focus on its topbar trigger; after the repair the first actionable Sidebar control receives focus. No production route or child module was added.

## Browser and keyboard findings

- `TempoShell` remains the single mounted owner in the signed-in `(tempo)` layout. Its actual topbar and tabbar triggers open the real Sidebar drawer. The active-at-open guard avoids stealing focus after the user moves elsewhere; closing returns to the remembered visible trigger only while focus remains in the drawer or scrim.
- While the narrow drawer is modal, background shell children are inert and Tab / Shift+Tab wrap between visible Sidebar controls. Escape and scrim click dismiss. Following a Sidebar link focuses the existing main, including the same route; resizing to desktop releases modal inert and trapping without forcing focus to a hidden menu.
- The real command palette and coach sheet supersede the drawer with their own focus and Escape ownership. The gallery reuses the mounted shell, locale/theme controls and actual overlays, with fictional data.
- Tests include programmatic button clicks while another control retains focus, StrictMode replay, RTL, phone targets of at least 44 px, computed v3 CSS, no horizontal overflow, reduced motion and browser pageerror collection.
- A local fixture cannot establish a live authenticated shell or device screen-reader behavior; those remain **UNKNOWN**.

The 25 named browser and regression cases are:

- local copy has English/Hebrew key parity
- fixture hydrates the real three navigation children with v3 CSS
- topbar opener moves focus into the real Sidebar
- tabbar opener moves focus into the real Sidebar
- keyboard opening shows visible focus inside the real drawer
- programmatic topbar click remembers its real trigger while another button had focus
- programmatic tabbar click returns to tabbar rather than the previously focused control
- forward Tab wraps from the last drawer control to its first
- reverse Tab wraps from the first drawer control to its last
- background main, topbar and tabbar are inert while the drawer is modal
- Escape closes the drawer and restores its visible topbar opener
- scrim click closes and restores a valid opener
- dismissal does not steal focus the reader moved outside the shell
- following a Sidebar link closes drawer and focuses the existing main
- same-route Sidebar link closes drawer and focuses main
- real command palette supersedes the drawer without returning to an inert rail
- Ctrl K supersedes the open drawer and Escape closes only the palette
- real coach sheet supersedes the drawer and returns to its coach button
- resizing to desktop releases inert and drawer Tab containment
- desktop static rail stays accessible without modal trapping
- StrictMode reopen still focuses the drawer after dismissal
- Hebrew RTL drawer opens on the leading edge and restores focus
- gallery language and theme controls update the real shell
- mounted shell and gallery fit both languages, themes and widths
- reduced motion uses the existing near-zero CSS policy

## Test results (cloud agent sandbox)

Bun: **1.3.9**. Final source/test commit: `62c85a6`; earlier source/test commits: `86e7a97`, `3e97fde`. Formal local gates remain queued under the shared validation lock.

| Command | Exit | Result |
|---|---:|---|
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 0 | Checked 1033 installs across 1079 packages, no changes on retry in 319.97s; first attempt stalled at resolution and was interrupted |
| `bun run lint` | 0 | 5/5 tasks, 0 errors; 9 pre-existing warnings |
| `bun run typecheck` | pending | Queued under shared validation lock |
| `bun test tests/unit/kb-74.test.tsx` | 0 | 25 pass, 0 fail, 127 assertions; real hydrated shell, gallery, keyboard, RTL, phone/desktop, light/dark |
| `bun run test` | pending | Queued under shared validation lock |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK |
| `CI=1 bunx playwright test --reporter=line` | pending | Queued |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | pending | Queued |

Initial CI on `3e97fde` passed Lint, Typecheck, Build, E2E, scans, and scope/config guards. Its Test job reported **3301 pass, 3 todo, 1 fail**: the fixture child bundle returned extensionless absolute paths for `@/` aliases and omitted a fictional `useConvex` stub needed by the real coach hook. The corrected fixture passed a bundle-only smoke and the complete hydrated browser run locally, then was pushed at `62c85a6`. CI on that head is pending. The initial CI failure is a fixture failure, not a product-shell regression result.

The first hydrated fixture run reached all 25 cases: 24 passed and one focus-ring assertion failed because the fixture served raw `globals.css`. Its Tailwind `@theme` ring token was unresolved in a standalone browser; the focused control matched `:focus-visible` but showed no outline or box shadow. Both fixture branches now compile the actual global stylesheet through installed PostCSS/Tailwind. On the final fixture, all 25 cases pass; in English and Hebrew the focused Sidebar control has a computed 2 px accent outline. No product CSS override was needed. Frozen-original open-drawer captures log the active Topbar menu trigger, documenting the initial focus issue.

```text
Initial CI Test failure (job 118300164944):
error: File not found ".../apps/web/components/coach/CoachPage"
error: File not found ".../apps/web/components/coach/CoachPanel"
error: File not found ".../apps/web/lib/i18n-groups/kb-74"
error: No matching export in "kb74:convex/react" for import "useConvex"
error: KB-74 isolated browser bundle did not start; child exited=true
3301 pass · 3 todo · 1 fail
```
