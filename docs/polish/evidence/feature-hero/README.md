# Landing hero entrance evidence

WALK — Ticket #1206, `TEMPO-FEATURE-HERO`, Lane 2. Baseline: integration `39b564ec329705587df5262ed5a061bbec9a1e8f`.

The existing public landing hero enters once using the existing slow-duration, easing and spacing tokens. With reduced motion, no entrance animation is applied. Copy, final geometry, routes, controls and provider behavior are unchanged. No language strings, dependencies or environment settings were added.

## Browser proof

Real local Next.js `/` route, signed out, placeholder Convex URL, no live account or model call. Before screenshots were captured before importing the new stylesheet or adding hero classes. The initial cold-compile navigation exceeded the capture helper's 30-second timeout; after the route returned HTTP 200, the four baseline captures completed. This was a capture warm-up failure, not a passing test.

| Capture | English | Hebrew |
|---|---|---|
| Before, 390 × 844 | [image](before-390-en-light.png) | [image](before-390-he-light.png) |
| Before, 1280 × 844 | [image](before-1280-en-light.png) | [image](before-1280-he-light.png) |
| After, 390 × 844 | [image](after-390-en-light.png) | [image](after-390-he-light.png) |
| After, 1280 × 844 | [image](after-1280-en-light.png) | [image](after-1280-he-light.png) |

The focused test covers 390 and 1280 widths, English and Hebrew, default and reduced motion, one main and h1, correct RTL, one finite entrance, unchanged settled position, no horizontal overflow, keyboard focus and phone-sized hero controls. All data shown is the existing fictional public demo; no account data was used.

First focused candidate: 4 passed / 4 failed, authoritative exit 1. Chromium serialized the completed transform as an identity matrix rather than the string `none`. The correction checks `DOMMatrix.isIdentity`, preserving the intended no-displacement assertion and all cases/deadlines. [Original failure log](focused-first.log).

Second focused candidate: 7 passed / 1 failed, authoritative exit 1 (3.0 minutes). The 390-pixel Hebrew reduced-motion case reached and passed the keyboard-focus assertion, then exhausted its unchanged 30-second overall deadline during the focus-style read. [Second-run log](focused-second.log). The third candidate starts from the adjacent preceding navigation control, uses a real Tab key into the hero and preserves every focus, outline, target-size and geometry assertion. No test is skipped and no deadline increased.

Third focused candidate: **8 passed / 0 failed**, authoritative exit 0 (1.7 minutes). The test also waits for the rendered landing root to commit the chosen locale before measuring geometry. [Final log](focused-final.log).

After images are from the four passing normal-motion cases in this final run. The visible focus ring is intentional keyboard evidence.

## Validation status

- Bun: 1.3.9.
- `git diff --check`: passed.
- `bunx playwright test tests/e2e/landing-motion.spec.ts --reporter=line --workers=1`: 8 passed / 0 failed (1.7 minutes), exit 0; existing Chromium cache, no browser download. All original eight cases and 30-second deadlines retained.
- Mandatory checks completed with failures; see the source-attributed table below. No all-green claim.
- Preview deployment and authenticated product behavior: UNKNOWN; this evidence is local public-route proof only.

## Supplemental desktop reduced-motion check

WALK — CodeRabbit review `5605920217` on source `6b2ca7c48a815530af8865b886b34fa59707da31` identified a valid coverage gap: the committed Playwright suite directly asserts the copy container, but not the desktop examples container. Both containers currently share the only hero animation declaration, inside `prefers-reduced-motion: no-preference`. That source inspection does not replace independent browser evidence or future regression coverage.

The original supplemental actual-route Chromium check measured `.tempo-hero__examples` at width 1280 in English and Hebrew with reduced motion, before awaiting any copy animation. Its scratch browser tool asserted visibility, no animation, identity transform, opacity, two-frame geometry stability and zero page errors. However, its [original captured states](examples-reduced-motion-original.json) stored only the initial box. Those original states cannot independently show the second geometry measurement; CodeRabbit comment `4342112481` correctly identified this evidence limitation. The original artifact is preserved unchanged.

A fresh actual-route observation on `ee1fd5caca0307df3608a21a702a957359de2aa4` separately read and saved `initialBox` and `settledBox`, with two animation frames between the DOM reads. The [new captured states](examples-reduced-motion.json) contain both actual measurements, source commit and capture timestamps for English and Hebrew at width 1280. Both cases passed: examples visible, `animationName: none`, zero animations, identity transform, opacity `1`, exactly equal initial/settled boxes and zero page errors. The observation exited 0; its owned browser closed and owned Next server PID 184826 exited. No second measurement was reconstructed from the original JSON. No real account, preview URL, provider call or paid request was used.

No product defect was demonstrated by this check. The committed regression suite still lacks direct examples assertions; this supplemental proof does not claim to close that test-maintenance gap or to be a fourth source/test candidate. CodeRabbit's review state is `COMMENTED`, not `APPROVED`. Product source, tests, assertions and deadlines are unchanged. The lead owns the review response and merge decision after the remaining gates.

## Final mandatory validation

WALK — Product and committed tests remain the third focused candidate. Integration `7d1a0f6` was merged normally; subsequent commits changed evidence only. Static checks ran at `ee1fd5c`; full tests, scans, Playwright and build ran at `204bb59`. These exact source attributions and process exit results are retained in [mandatory-checks.json](mandatory-checks.json).

| Command | Result | Tested head |
|---|---|---|
| `bun --version` | 1.3.9 | `ee1fd5c` |
| `bun install --frozen-lockfile` | Exit 0; 1033 installs across 1079 packages, no changes, 333.27 seconds | `ee1fd5c` |
| `bun run lint` | Exit 0; 5/5 tasks, existing warnings only | `ee1fd5c` |
| `bun run typecheck` | Exit 0; 5/5 tasks | `ee1fd5c` |
| `bun run test` | Exit 1; 3488 pass / 5 fail / 3 todo, 81407 assertions, 211 files, 1298.71 seconds | `204bb59` |
| Four scans/notices | Exit 0; forbidden-tech, RAM-only audit, design tokens and notices all pass | `204bb59` |
| `CI=1 bunx playwright test --reporter=line` | Exit 1; 32 pass / 4 fail / 89 existing skips, 7.3 minutes | `204bb59` |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Exit 0; 1/1 tasks, 2m14.804s | `204bb59` |

The earlier 120-second frozen-install execution ended 124 while resolving dependencies and remains historical UNKNOWN. The later bounded 360-second observation completed successfully; no dependency or lockfile was changed. The environment restart also interrupted an earlier typecheck and full-suite run; those are not passing runs.

Full-test failures: the unchanged hash-chain bound case exceeded its existing five-second limit; three unchanged KB-64 cases encountered an already-closed browser; and the unchanged `definitionStarts` linearity test failed at 3301.33ms. The successful KB-61 and other cases do not erase those failures. [Last 20 test-output lines](mandatory-test-tail.log).

Playwright failures: calendar event creation, sign-out visibility, core task-view navigation, and this ticket's own `landing hero390he no-preference` case. In the own-case trace, all functional, focus, target-size and page-error assertions completed. Screenshot capture began at trace time92113.986, fonts were recorded loaded at92145.387, and the screenshot had no completed event before the unchanged30-second deadline; the after-hook also exceeded its limit. This remains a failed case, not a passing functional-test substitute or a font-network UNKNOWN. The earlier focused8/0 result is a different run and does not replace it. [Last 20 Playwright-output lines](mandatory-e2e-tail.log). No existing skip or deadline was changed, and no failed case was retried.

After Playwright exited, its owned browser was gone and its owned Bun/Next processes were stopped PID1 zombies, with no live server. Only this worktree's ignored `apps/web/.next/dev` was removed after verifying its real path and that it was not a symlink. This recovered the reported2.1G development cache before the build; all source, tests, screenshots, traces and logs were retained. The build then passed, and no active Bun, Next or Chromium process remained when the shared heavy-work slot was released. [Build output tail](mandatory-build-tail.log).

AWAY — Full tests and full Playwright are failed. The committed desktop-examples regression gap remains documented above and requires the owner-authorized follow-up recorded by the lead. This evidence does not claim CodeRabbit approval, preview verification, merge eligibility or production readiness.

## AT-28 authorized committed examples regression — 22 October 2026

WALK — Amit authorized one additional scoped test correction on 22 October. Product source and all eight existing cases, copy assertions and deadlines stay unchanged. The committed test now captures desktop examples' initial animation state before waiting for the copy, asserts no animation and immediate opacity/identity transform with reduced motion, verifies the finite normal-motion animation, and independently compares initial, settled and later geometry. TestInfo receives the actual state measurements as an attachment; no reconstructed measurement is used.

The first focused execution of this candidate passes **8 / 0**, exit 0, 2.6 minutes. Both English and Hebrew desktop cases pass for both motion preferences, as do all four phone cases. [Exact command and source attribution](at28/focused.json), [output](at28/focused.log), and all eight current screenshots in [at28](at28/) preserve the result separately from earlier attempts. Original before/after screenshots remain unchanged.

The owned Next process group has no live members and port 3000 is free. Mandatory install/lint/typecheck/full tests/scans/full Playwright/build for this candidate have not yet run; the lead schedules their exclusive heavy slot. Earlier mandatory failures above remain historical evidence and are not overwritten or turned into passes. No current hosted CI, CodeRabbit clearance, preview or merge claim is made by this focused result.
