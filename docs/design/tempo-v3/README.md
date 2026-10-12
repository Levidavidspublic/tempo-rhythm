# Tempo v3 design (source of truth)

This folder holds the Tempo v3 HTML screens exported from Open Design. It is empty until the redesign is finished.

- `screens/`: one HTML file per screen, plus the shared CSS and JS they load.
- `hero-board.html`: the board that links every screen, with the theme and direction toggles.
- `screenshots/`: contact sheets only (one per route group, 1280 light and 390 dark). Full screenshots stay local.
- `CHECK-REPORT.md`: design-level problems found by `../_check`, to send back to Open Design.

Open Design's working files (`.file-versions`, `.od-*`, `*.artifact.json`, `.remember`) never go in here; `.gitignore` blocks them.
