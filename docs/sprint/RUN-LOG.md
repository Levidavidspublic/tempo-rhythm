# Run log

Branch `demo/friend` (draft PR "Demo: friend walk-through"), from `integration` `eb0b12c`. The weekend-alpha run's log is on `run/weekend-alpha` (#934) and is not repeated here.

## Demo

Goal: Amit demos Tempo Flow to a friend. The friend opens tempoflow.dev, reads the copy (features, the coach, pricing, beta testers, the letter), signs up, waits for Amit's approval, and lands in the beta. Every step is proven at 390 and 1280 px, light and dark, en and he, with headless screenshots.

Started 2026-10-16 07:05 UTC by Claude Code (cloud session). Times are UTC.

Steps:
- **S1** Landing and copy pages: every section reads cleanly, every link and button goes somewhere real, `#letter` renders.
- **S2** Sign up → the approval-pending screen says plainly what happens next.
- **S3** Sign in with an approved account → Today: brain dump → first plan → a coach proposal with Undo → a decision card.
- **S4** First run for a brand-new account: empty states, loading states, no console or page errors.
- **S5** `docs/demo/DEMO-SCRIPT.md`: a 5-minute walk-through with the exact clicks.

How the runs work:
- Signed-out pages: a headless Chromium script loads each page in 8 variants (390/1280 px × light/dark × en/he, set with `?theme=` and `?lang=`). It records the HTTP status, sideways scroll, console and page errors, and checks every link target (same-site pages by status, `#anchors` by element).
- Signed-in steps run on preview with a **synthetic** mail.tm account. It signs up by magic link and is approved on the TEST Convex deployment `ceaseless-dog-617` through `convex-test-admin.yml` (owner-only workflow, dispatched on `integration`). The session file stays in the session's scratch folder (mode 0600), never in git. The address is masked in every screenshot.

| time | commit | step | result | proof |
|---|---|---|---|---|
| 07:06 | live `007d28a` / preview `eb0b12c` | — | **Live is behind preview.** tempoflow.dev (`www`) serves `master` `007d28a`, deployment `dpl_q2y7rPnq8KahaAfPkGEyjpAwnXHS` (tempo-web, built about 4 Oct). preview.tempoflow.dev serves `integration` `eb0b12c`. The landing copy is the same on both; the app behind sign-in is not (see "Live site vs preview" in the PR). | `/api/health` on both hosts |
| 07:10 | preview `eb0b12c` | S1 | 48 renders (`/`, `/sign-up`, `/sign-in`, `/privacy`, `/terms`, `/contact` × 8 variants): all 200, no sideways scroll, no console or page errors. All 13 link targets resolve, and `#features`, `#coach`, `#pricing` and `#letter` exist. Looked at the screenshots: **(1)** the logo draws only its dot (gradient in box units, so the straight bar and stem don't paint); **(2)** at 390 px the nav labels wrap ("Sign / in", "Join the free / beta"); **(3)** dark mode: the Brain Dump card keeps a cream gradient under light text, so its heading is unreadable; **(4)** Pricing says "Open sign-up" and "every new account gets the full app", the opposite of the approval gate; **(5)** `/contact` is a Hebrew form whose Send only logs to the console, with `support@temporhythm.app` (the domain does not resolve) under both "Email" and "Phone"; **(6)** `/privacy` and `/terms` are Hebrew text laid out left to right, with the same dead address | screenshots in the session's scratch folder |
| 07:20 | local dev, `8d605ce` | S1 | Fixed (1)-(6) in `8d605ce`. Local re-run of `/`, `/contact`, `/privacy`, `/terms`: 32 renders, all 200, no sideways scroll, 0 console or page errors, every link resolves. Privacy and Terms text is Amit's (not rewritten): only its direction and the dead address changed | screenshots in the session's scratch folder |
| 07:23 | preview `eb0b12c` | S2 | New synthetic account: `/sign-up` → "Check your email" in 0.9 s → email in 4 s (subject "Sign in to preview.tempoflow.dev", one link) → link opens `/today` → **blank page for about 2 s** (the gate's empty loading div) → "Waiting for approval". 8 variants: all 200, no errors, but the Hebrew variants show the English text, and it says "just sign in again" | screenshots in the session's scratch folder |
| 07:25 | preview `eb0b12c` | S2 | With the waiting page open and no reload, `convex-test-admin` approved the account: the page became Today by itself at 07:25:58, 48 s after the dispatch. So "it opens by itself" is true and can go in the copy | screenshots in the session's scratch folder |
| 07:30 | `a5561eb` | S2 | Waiting screen: three plain next steps, en and he; loading: labelled skeleton instead of an empty page; sign-up card mentions the hand approval. Unit tests: 3 new (the loading and next-steps tests fail on the old code); 20/20 pass with i18n | `tests/unit/releaseOnboardingGate.test.tsx` |
