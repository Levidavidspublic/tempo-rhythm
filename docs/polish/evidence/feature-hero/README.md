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
- Mandatory lint/typecheck/test/scans/E2E/build: pending the lead's serialized gate. No all-green claim.
- Preview deployment and authenticated product behavior: UNKNOWN; this evidence is local public-route proof only.

## Supplemental desktop reduced-motion check

WALK — CodeRabbit review `5605920217` on source `6b2ca7c48a815530af8865b886b34fa59707da31` identified a valid coverage gap: the committed Playwright suite directly asserts the copy container, but not the desktop examples container. Both containers currently share the only hero animation declaration, inside `prefers-reduced-motion: no-preference`. That source inspection does not replace independent browser evidence or future regression coverage.

The original supplemental actual-route Chromium check measured `.tempo-hero__examples` at width 1280 in English and Hebrew with reduced motion, before awaiting any copy animation. Its scratch browser tool asserted visibility, no animation, identity transform, opacity, two-frame geometry stability and zero page errors. However, its [original captured states](examples-reduced-motion-original.json) stored only the initial box. Those original states cannot independently show the second geometry measurement; CodeRabbit comment `4342112481` correctly identified this evidence limitation. The original artifact is preserved unchanged.

A fresh actual-route observation on `ee1fd5caca0307df3608a21a702a957359de2aa4` separately read and saved `initialBox` and `settledBox`, with two animation frames between the DOM reads. The [new captured states](examples-reduced-motion.json) contain both actual measurements, source commit and capture timestamps for English and Hebrew at width 1280. Both cases passed: examples visible, `animationName: none`, zero animations, identity transform, opacity `1`, exactly equal initial/settled boxes and zero page errors. The observation exited 0; its owned browser closed and owned Next server PID 184826 exited. No second measurement was reconstructed from the original JSON. No real account, preview URL, provider call or paid request was used.

No product defect was demonstrated by this check. The committed regression suite still lacks direct examples assertions; this supplemental proof does not claim to close that test-maintenance gap or to be a fourth source/test candidate. CodeRabbit's review state is `COMMENTED`, not `APPROVED`. Product source, tests, assertions and deadlines are unchanged. The lead owns the review response and merge decision after the remaining gates.
