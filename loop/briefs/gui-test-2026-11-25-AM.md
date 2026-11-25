[GUI-TEST] tempo-rhythm 2026-11-25

Preview URL tested: https://preview.tempoflow.dev

This is the integration preview named in `docs/ENVIRONMENTS.md`. Production (`www.tempoflow.dev`) was not opened. `GET /api/health` returned 200: `{"ok":true,"service":"tempo-web","proof":"P-CLAUDE","commit":"888131c"}`. That value is `VERCEL_GIT_COMMIT_SHA`. It is `888131ccf8ff538882829e387f2ce3fabc848db0` (2026-11-20). `origin/integration` at test time was `f0a4d6643487ebc0b7e0ce2da17a15af60de462a` (2026-11-24). The preview commit is an ancestor of integration, so this preview is behind the branch.

Tested with Playwright 1.62.1, headless Chrome, at 1280×800 and 375×812, plus a desktop browser walk of the same host. No payment was submitted. The contact mailto was not opened. One magic-link submit used `gui-loop-20261125-am@example.com`.

| Flow | PASS or FAIL | What happened | Steps to reproduce | Expected |
|---|---|---|---|---|
| Landing | PASS | HTTP 200. Heading: "A planner that won't shame you." Sign in, Sign up, and Join the free beta are visible. | Open `/`. | The public landing page loads. |
| Landing sections | PASS | Features, Coach, Pricing, and Letter each scroll to a matching id. | On `/`, click those header links. | Each link reaches its section. |
| Sign-in page | PASS | HTTP 200. Heading "Sign in". Email field and "Send magic link". No password field. | Open `/sign-in`. | Magic-link sign-in, no password. |
| Sign-in validation | PASS | Empty submit: "Please fill out this field." `not-an-email`: browser asks for an `@`. No request was sent. | On `/sign-in`, submit empty, then submit `not-an-email`. | The browser blocks an invalid email. |
| Send magic link | FAIL | The page stayed on Sign in and showed "We couldn't send the link yet. Please check your email and try again." `POST /api/auth` returned 400. The body said `Resend: could not send the sign-in email (422)`. "Check your email" did not appear. | Open `/sign-in`, enter `gui-loop-20261125-am@example.com`, press Send magic link. | The page shows "Check your email". |
| Create account page | PASS | HTTP 200. Heading "Create your account". Email field and Send magic link are present. The form was filled and not submitted. | Open `/sign-up`. | A magic-link create-account form, no password. |
| Terms | PASS | HTTP 200. Heading "Terms of use". The page says it is a draft. | Open `/terms`. | The public terms page loads. |
| Privacy | PASS | HTTP 200. Heading "Privacy". The page says it is a draft. | Open `/privacy`. | The public privacy page loads. |
| Contact | PASS | HTTP 200. Heading "Write to Amit." A mailto link is shown. It was not opened. | Open `/contact`. | A public contact page, with no message sent. |
| Payment success page | FAIL | HTTP 200 with no checkout id. The heading says the payment was received (`התשלום התקבל בהצלחה`). The Checkout ID line says none was received (`לא התקבל Checkout ID`). | Open `/success` with no query. | A direct visit with no checkout should not say a payment was received. |
| Health | PASS | HTTP 200 and `"ok": true`. | `GET /api/health`. | The preview health check answers ok. |
| Signed-out app gate | PASS | These routes all returned 200 on `/sign-in` and kept `next` set to the path: `/today`, `/brain-dump`, `/coach`, `/plan`, `/tasks`, `/notes`, `/journal`, `/calendar`, `/habits`, `/goals`, `/projects`, `/insights`, `/settings/profile`, `/billing`, `/search`, `/templates`, `/onboarding`, `/about`, `/changelog`. | Open each path while signed out. | A signed-out visit goes to sign-in and keeps the return path. |
| Keyboard focus | PASS | Tab on the landing page and on Sign in moved through links, the email field, and Send magic link. Each showed a 2px solid outline. | On `/` and `/sign-in`, press Tab. | Focus is visible on the controls. |
| Mobile 375px | PASS | Landing and Sign in loaded. `scrollWidth` was 375, so the page did not scroll sideways. At this width the Features, Coach, Pricing, and Letter links are not in the header and there is no menu. Sign in and Join the free beta stay visible. The Features example card has its own small scrollbar. | Set the viewport to 375×812 and open `/` and `/sign-in`. | The page is usable on a phone width without sideways scrolling. |
| Public links | PASS | Same-origin links from `/`, `/terms`, `/privacy`, `/contact`, `/sign-in`, and `/sign-up` returned 200. No broken hash targets. Mailto links were not opened. Links to the production host were not fetched. | Open those pages and request each http(s) link. | Public links resolve. |

## Console errors

One console error, on `/sign-in`, during the magic-link submit: `Failed to load resource: the server responded with a status of 400`. No page JavaScript exceptions. A later desktop reload of the landing page showed an empty console. Other routes were not rechecked in that desktop console.

## Failed requests

- `POST https://preview.tempoflow.dev/api/auth` → 400, on `https://preview.tempoflow.dev/sign-in`, while sending the magic link. Server text: `Resend: could not send the sign-in email (422)`.

No other response was 400 or higher during the walk.

## UNKNOWN

- Signed-in flows were not reached. The magic link was not delivered, and there is no guest entry. Not tested after sign-in: Today quick-add and tick, brain dump, coach, plan, tasks, notes, journal, calendar, habits, goals, projects, insights, settings, templates, search, and billing. No payment was attempted.
- Whether a deliverable address would get a magic link. Only `example.com` was submitted. Resend returned 422 for that address.
- The create-account submit was not sent, so it was not checked separately from the sign-in send.
- Hebrew UI, other than the bilingual draft lines on Terms and Privacy and the Hebrew text on `/success`. The EN / עב control is visible. It was not used to switch the landing page.
- Whether `/about` and `/changelog` should be public. The nav map lists them as marketing screens. `PUBLIC_ROUTE_PATTERNS` does not include them, and a signed-out visit shows Sign in. They are not linked from the landing page.
- Autosana was not used. That connector is not set up on this run.
- Basic Memory was not available on this run.
