# WALK — Deliberate beta requests from the signed-in waiting screen

Ticket #1272. Prepared from integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`, #1266 beta backend, and frozen #1265 Executor root i18n. State: coded; browser/full validation pending.

The sign-in form offers regular and beta copy modes. Both send only the existing Resend magic link; neither submits a beta request or grants access. After authentication, the existing waiting screen offers an explicit request button backed by `approval.requestBetaAccess({})`. Queued state appears only after server success or a persisted request timestamp. ApprovalGate remains authoritative for access. Revoked accounts have no request button. Failed requests preserve the optional name draft, failed email sends preserve the email, and unmounted request/form generations ignore late completions.

Both page and modal auth use existing v3 token classes, translated copy, visible focus styles and token-based touch sizing. Email remains LTR; the surface follows locale direction. Added 28 matching EN/HE keys; Hebrew is machine-drafted for Amit's native read. Ordinary signup copy advertises no free plan, explains the $1 trial, and clearly states checkout is unavailable and signing in starts no charge/trial.

## Dependency and scope

- Scope: SignInForm.tsx, WaitingForApproval.tsx, root i18n.ts, tests/unit/tempo-beta-request.test.tsx and this evidence folder only.
- Removing the 28 added EN/HE entries reproduces #1265's frozen i18n byte for byte. Executor strings were not replaced.
- No backend, auth provider, route, package, config, env, payment, deployment or public writes. No real email/account call.
- The optional `BETA_REQUEST_BASELINE` test setting points at local copies of the previous two UI files to capture baseline screenshots; it is not a runtime product feature. The normal suite always runs the changed mounted source.

## Test results (cloud agent sandbox)

Bun 1.3.9. Four scoped files passed syntax transpilation. Translation-key and dependency-preservation checks passed. These checks do not establish typecheck or mounted behavior.

Prepared nine isolated Chromium tests using the real mounted components, actual translations/CSS and synthetic auth/Convex boundaries: Resend-only beta flow, regular signup, deliberate request success/duplicate suppression, failure/retry with retained draft, persisted/approved states without navigation, revocation/account switch fencing and signout, unavailable response, sign-in unmount fencing, and screenshots at 390/1280 in EN/HE light/dark. External browser requests are blocked; no email/provider action runs.

Mounted tests and before/after screenshots: **UNKNOWN pending the root's browser slot**. Required frozen install, lint, typecheck, full tests, four scans, local Playwright and build: **UNKNOWN pending allocated-checkout validation**.
