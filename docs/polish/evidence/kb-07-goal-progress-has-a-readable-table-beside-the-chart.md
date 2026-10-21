# KB-07 — weekly goal progress values

The mounted `/goals/progress` screen now places a disclosure and semantic two-column table directly below its weekly chart. Both use the existing `WeekPoint` values. The chart's SVG is decorative to assistive technology; the visible summary and the table provide the same information in words and numbers. The date range labels both views. A week with zero completed tasks shows `0` without judgment.

![Before and after contact sheet, with viewport and language labels](kb-07-goal-progress-has-a-readable-table-beside-the-chart.jpg)

## Capture method and limits

The **before** images were captured *before changing the mounted component*. A temporary Bun script extracted the exact original `WeeklyChart` JSX from `GoalsProgressScreen.tsx`, supplied fictional weekly points, and rendered it with the checked-in `linePoints`, `weeklySummary`, `fill`, translations, and v3 CSS. This is an isolated production-component baseline. It is **not** an authenticated `/goals/progress` route capture. The design HTML prototype was viewed separately but is not presented as the before image.

The **after** images come from a hydrated loopback gallery that imports the actual exported `Kb07Gallery` from the changed mounted module. It uses the production `GoalProgressTable`, `ProgressRangeCaption`, and chart with fictional points; it does not contact Convex. The contact sheet compares the original chart to the gallery view with its table expanded at 390 and 1280 px in English and Hebrew. Separate light/dark gallery screenshots were captured under `work/` during browser checks and used to inspect colour changes. No real account data appears in any image.

## Browser interaction findings

- Native `summary` disclosure opens with Enter, closes with Enter, and retains keyboard focus.
- Gallery controls exercise default, zero activity, loading, error, disabled and eight-week overflow states. The retry control returns focus to the active Progress state control.
- English/Hebrew switching changes the gallery direction and copy. Numbers remain isolated left-to-right. The fixture checks both 390 and 1280 px, 44 px phone targets, one `h1`, one `main`, large text, reduced motion, and no viewport overflow.

The checked-in browser test uses Bun's bundler and an isolated local server. The `react-native` alias applies only to that fixture. Device VoiceOver/TalkBack results and the authenticated backend route remain **UNKNOWN**; native Hebrew copy is machine-drafted and needs Amit's read.

## AWAY — repair draft, validation pending

Gallery weeks now start on local Mondays. Fixture imports resolve from the workspaces that declare them. America/Los_Angeles browser coverage checks exact dates, date range and ISO week labels at both widths. Focused: 9 pass, 0 fail, 36 assertions. Lint and typecheck pass; frozen install UNKNOWN after 120 seconds at dependency resolution. Production aggregation is unchanged.

The lead owns the remaining full unit suite, scan confirmation, local E2E and build commands. They are queued separately under the shared resource lock; no passing result is claimed for an unfinished command. This repair may be pushed as a draft for hosted CI, but is not yet eligible for integration. No assertions, check configuration, timeout or skip conditions were weakened. The lead will append actual outcomes and failure tails before the merge gate.
