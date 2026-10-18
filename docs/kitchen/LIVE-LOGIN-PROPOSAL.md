# Proposal: fix sign-in on the live site, and update its copy

Status: **for Amit's approval. Nothing here has been applied.** The kitchen run only read pages, code and Vercel logs. It changed no environment variable, deployment or page.

## What "live" is

- Vercel project `tempo-web`. Production domain `www.tempoflow.dev` (`tempoflow.dev` redirects there). `preview.tempoflow.dev` is the `integration` branch.
- Production runs `master` at `007d28a` ("Integration (#327)", 4 Oct). `integration` is about 25 commits ahead.
- Production's Convex deployment is **precious-wildcat-890** (eu-west-1). Preview and development use **ceaseless-dog-617**. Which function code precious-wildcat-890 runs: UNKNOWN (its last deploy was manual).

## The sign-in problem

**What happens:** a visitor types their email on `/sign-in` and presses "Send magic link". The server fails while sending the email, and the page shows "We couldn't send the link yet. Please check your email and try again." That message blames the person's email, which isn't the problem.

**Evidence:** Vercel production logs show 9 failed attempts on 16 Oct between 23:42 and 23:47 UTC, all from one person. Each is `POST /api/auth`, then "Hit error while running `auth:signIn`", then a Convex "Server Error". The same error was first seen on 11 Aug. The Convex request IDs to look up are `8cd0e0a092e434ba`, `5682c3789fab44ea`, `ed60d8a64ee31722`, `73c9d898c2d3916c`, `11e9b8d5fb19a580`, `9281d09d6fdc6d20`, `56ba149c45ba3719`, `bdab970fab054a31` and `ab104c8085835981`.

**Likely causes, most likely first** (the real error text is in the Convex logs, which the run couldn't open):
1. `AUTH_RESEND_KEY` is missing or wrong on precious-wildcat-890. Convex Auth reads the Resend key under that name, on the Convex deployment. Vercel production has a `RESEND_API_KEY`, which sign-in never reads.
2. `RESEND_FROM_EMAIL` isn't set on precious-wildcat-890. `convex/auth.ts` then falls back to `onboarding@resend.dev`, and Resend only lets that sender mail the account owner. Everyone else gets an error.
3. `SITE_URL`, `JWT_PRIVATE_KEY` or `JWKS` is missing on precious-wildcat-890. `docs/phase4-brain-dump-validation.md` records this exact failure on a fresh deployment.
4. precious-wildcat-890 runs different function code from `master`.

## Fix options

**A. Recommended. Settings only, no code.** Done by Amit or by a helper with 1Password and Convex access.
1. Convex dashboard → precious-wildcat-890 → Logs: search the request IDs above and read the real error.
2. Convex dashboard → precious-wildcat-890 → Settings → Environment Variables. Check these names exist and fix whichever is wrong:
   - `AUTH_RESEND_KEY`: a Resend key allowed to send for tempoflow.dev.
   - `RESEND_FROM_EMAIL` = `Tempo Flow <noreply@tempoflow.dev>`, the sender `docs/APP-FLOW.md` names.
   - `SITE_URL` = `https://www.tempoflow.dev`.
   - `JWT_PRIVATE_KEY` and `JWKS`: present.
3. Resend → Domains: tempoflow.dev shows Verified. Public DNS already has its DKIM and SPF records. It has no DMARC record; adding one helps delivery.
4. Request one link to your own address. Check that it arrives and that the link opens `/today`.
5. Optional: remove the unused `RESEND_API_KEY` from Vercel production so nobody mistakes it for the sign-in key again.

**B. Hardening, as a code PR with the `convex-arch` label (it touches `convex/`).**
- `convex/auth.ts`: drop the `onboarding@resend.dev` fallback, so a missing sender fails with a clear "Missing environment variable RESEND_FROM_EMAIL" instead of a silent refusal from Resend.
- `apps/web/components/auth/SignInForm.tsx`: when sending fails for any reason other than the rate limit, say "We couldn't send your link. This is on our side. Please try again in a few minutes." (Hebrew: "לא הצלחנו לשלוח את הקישור. הבעיה אצלנו. אפשר לנסות שוב בעוד כמה דקות.")

**C. Not a sign-in fix: promote `integration` to `master`.** It brings the newer sign-in card and the approval gate (F-01a: new emails start as pending). Do it only after A works, and deploy Convex production with it, or the site and its backend won't match.

## Copy on the live landing page

Every row is page `/` in `apps/web/app/page.tsx`, except the title (`apps/web/app/layout.tsx`) and the sign-up subtitle (`SignInForm.tsx`). `integration` has the same words.

| Now | Proposed English | Proposed Hebrew | Why |
|---|---|---|---|
| "Free during beta. Open sign-up." | "Free during beta. Ask to join." | "חינם בזמן הבטא. אפשר לבקש להצטרף." | Sign-up needs approval (PRD F-01a) |
| "Closed beta open now" | "Private beta" | "בטא פרטית" | It says two opposite things |
| "42 handcrafted screens", "1 person, one year", "All 42 screens, unlocked" | "Made by one person" | "נבנה על ידי אדם אחד" | The numbers aren't real |
| Three tester quotes and "Thirty people used it for four weeks" | Remove the section | (removed) | Made-up testimonials |
| "Web + iOS + Android" | "On the web. Phone apps later." | "באתר. אפליקציות לטלפון בהמשך." | The phone apps aren't out |
| "AI coach · warmth dial · voice" | "A coach you can type or talk to" | "מאמן שאפשר לכתוב לו או לדבר איתו" | Voice is off until keys are set; the PRD has no warmth dial |
| "Encrypted at rest, prompts that shift with your mood" | "Prompts that fit your day." | "שאלות שמתאימות ליום שלך." | Not verified |
| "with gentle audio cues" (Routines) and the "Weekly / Sunday, softly" recap | Remove, or mark "Coming later" | "בקרוב" | Not built |
| "Tasks, notes, and calendar — one markdown page per day." | "Tasks, notes and plans on one page for each day." | "משימות, הערות ותוכניות בעמוד אחד לכל יום." | Em dash; PRD F-02 |
| Every heading with " — " | Replace the dash with a period or comma | (same in Hebrew) | No em dashes in UI copy |
| Title "Tempo Flow — your brain's operating system" | "Tempo Flow: a gentle planner" | "Tempo Flow: מתכנן עדין" | Em dash; the page's own letter says Tempo "doesn't try to be your operating system" |
| "Join Tempo Flow — free to start" | "Free during beta. We'll email you a link." | "חינם בזמן הבטא. נשלח לך קישור במייל." | Em dash |
| "Ask Sam about Convex" (sample brain dump) | "Call the bank" | "להתקשר לבנק" | An internal joke |
| "Made in Tel Aviv by one person." | Keep | "נבנה בתל אביב על ידי אדם אחד." | Accurate, if true |

## What approving means

- **A:** someone with access does steps 1 to 5. The kitchen run can't: it never changes environment variables or touches production.
- **B and the copy:** one small PR into `integration`, separate from #1081, reaching live with the next promotion to `master`.
- **C:** your call, after A.

## UNKNOWN

- The real error text (in the Convex production logs), and which variable names exist on precious-wildcat-890.
- Resend's dashboard state, whether its key may send for tempoflow.dev, and whether any link email has ever been delivered from live.
- Which code precious-wildcat-890 runs.
- The rendered sign-in page: it renders in the browser, so its text was read from the code at `007d28a`.
- The Hebrew wording: machine-written, not checked by a native speaker.
