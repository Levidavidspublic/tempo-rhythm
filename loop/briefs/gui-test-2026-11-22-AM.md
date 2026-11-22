[GUI-TEST] tempo-rhythm 2026-11-22

Preview URL tested: https://preview.tempoflow.dev

This is the integration preview named in docs/ENVIRONMENTS.md. Production (www.tempoflow.dev) was not opened. The run started at 2026-11-22 07:23 UTC, so this brief is the AM run. `/api/health` returned HTTP 200 and `{"ok":true,"service":"tempo-web","proof":"P-CLAUDE","commit":"888131c"}`, the same commit as integration tip `888131cc`.

Checked with Playwright 1.62.1 on headless Chrome 157 (34 loads: public pages, signed-out app routes, Hebrew landing, 375px width) and a desktop browser walk of the landing page, sign-in, sign-up, contact, `/success`, `/today`, and a 375px landing viewport. No magic link was sent. No payment was submitted. No mailto was opened.

| Flow | Result | What happened | Steps to reproduce | Expected |
|---|---|---|---|---|
| Landing, English | PASS | HTTP 200. Heading "A planner that won't shame you." Sign in and Join the free beta are visible. Badge: "Beta · accounts approved by hand." | Open `/`. | The marketing page loads. |
| Landing, Hebrew | PASS | HTTP 200. Heading "אפליקציית תכנון שלא מביישת אותך." | Open `/?lang=he`. | Hebrew landing. |
| Landing sections | PASS | Features, Coach, Pricing, and Letter are on-page anchors. Clicking Features scrolls to "Your day on one page, and a coach that asks first." Pricing buttons go to `/sign-up`. | From `/`, click Features. | The page scrolls to that section. No payment form. |
| Privacy, Terms, Contact | PASS | All HTTP 200. Terms and Privacy show a draft banner. Contact heading is "Write to Amit." The mailto button was not clicked. | Open `/privacy`, `/terms`, `/contact`. | Each public page loads. |
| Sign-in form | PASS | No password field. Email field and "Send magic link" are shown. An empty field and `not-an-email` fail browser validation. `gui-loop-test@example.com` is accepted and the button stays enabled. Send was not clicked. | Open `/sign-in`. Leave the field empty, then type an invalid value, then a fake address. Do not send. | Magic-link form, no password. |
| Sign-up form | PASS | Heading "Create your account." Same email field, no password. Terms of Service goes to `/terms`. Privacy Policy goes to `/privacy`. Send was not clicked. | Open `/sign-up`. | Account form, no password. |
| Contact | PASS | Heading "Write to Amit." The address is shown. It was not activated. | Open `/contact`. | Contact page, no message sent. |
| Signed-out app gate | PASS | These paths return HTTP 200 and finish on `/sign-in?next=<path>`: `/today`, `/brain-dump`, `/coach`, `/plan`, `/daily-note`, `/tasks`, `/notes`, `/journal`, `/calendar`, `/habits`, `/goals`, `/projects`, `/insights`, `/search`, `/settings/profile`, `/settings/preferences`, `/billing`, `/onboarding`. | Open each path with no session. | Sign-in gate. The app screen stays hidden. |
| Payment return `/success` | FAIL | HTTP 200 with no checkout query. The page is Hebrew, right to left, and says the payment succeeded. Heading: "התשלום התקבל בהצלחה". The next line tells the reader to use the Checkout ID to verify the purchase with Polar and update the user status. The value is "(לא התקבל Checkout ID)" (no checkout id arrived). That value is too faint to read: near-white gray on a light card. No payment was submitted. | Open `/success` while signed out, with no query string. | Do not say the payment succeeded when no checkout id arrived. The id line should be readable. |
| Mobile, 375px wide | PASS | Landing, sign-in, and the `/today` gate do not overflow horizontally. Sign in and Join the free beta stay visible. Features, Coach, Pricing, and Letter are hidden at this width (they show from the wider breakpoint). The sections are still on the page. | Set the viewport to 375×812. Open `/` and `/sign-in`. | The page fits. Primary actions stay visible. |
| Keyboard focus, sign-in | PASS | Tab order: Tempo, email, Send magic link, Create one, then it wraps. The focused controls use a solid outline. The browser walk showed the ring on Tempo. | Open `/sign-in`. Press Tab. | Each control can be reached and shows focus. |
| Health | PASS | HTTP 200. Body as quoted above. | Open `/api/health`. | `ok` is true. |

## Console errors

None. Playwright recorded no `console` error and no page error across the 34 loads.

## Failed requests

None. Playwright recorded no response with status 400 or higher, and no request that failed to complete.

Landing links on the same host, all HTTP 200: `/`, `/?lang=en`, `/?lang=he`, `/sign-in`, `/sign-up`, `/privacy`, `/terms`, `/contact`. The anchors `#features`, `#coach`, `#pricing`, and `#letter` are not separate documents. The Features click was confirmed in the browser. `mailto:amit@tempoflow.app` was not opened.

## UNKNOWN

- Magic-link delivery, and every signed-in flow (Today quick-add, tasks, notes, journal, coach, brain dump, plan, calendar, habits, goals, projects, insights, settings, billing). Sending the link would email through the live provider. A new account can ask Amit to approve it. That was not done.
- `/about` and `/changelog` content. A signed-out visit redirects to `/sign-in?next=...`. They are not in the public route list (`docs/APP-FLOW.md` §1 and `PUBLIC_ROUTE_PATTERNS` in `apps/web/lib/rootEntry.ts`). Whether they render after sign-in was not tested.
- `/coming-soon` returns HTTP 200 with the heading "Find your rhythm. Get things done. Don't burn out." The landing page does not link to it. It was not walked further.
- A measured contrast ratio for the Checkout ID line. The screenshot shows it is not readable. No WCAG number was calculated.
