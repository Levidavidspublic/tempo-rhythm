# WALK — Deliberate beta requests from the signed-in waiting screen

Ticket #1272. Prepared from integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`, #1266 beta backend, and frozen #1265 Executor root i18n. State: coded; candidate 3 corrections locally checked, mounted behavior blocked by deadlines and full validation incomplete.

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

Mounted tests: **BLOCKED**, with exact failure receipts below. Baseline screenshots are complete; candidate 2 after screenshots are partial. Required frozen install, full lint/typecheck/tests, four scans, local Playwright and build remain incomplete for this final source.

## Allocated browser run and final scoped correction

WALK — Actual checkout began at PR #1283 head 8699d2c9d69345abdfca70c1366fd189278dad93. Bun 1.3.9 and installed local Chromium; no preview/live account calls. The external-request block remained enabled. All original assertions and 5-second behavior / 90-second builder / 120-second setup-and-screenshot deadlines were preserved.

| Run | Result | Evidence |
| --- | --- | --- |
| Candidate 1 mounted suite | 0 pass, 9 fail, 1 unhandled error; 9 assertions; 63.43s | mounted-candidate-1.log |
| Baseline screenshot case | 1 pass, 8 filtered, 0 fail; 33 assertions; 142.02s total, 114.32s screenshot case | baseline-capture.log; all 16 before PNGs |
| Candidate 2 mounted suite | 0 pass, 9 fail, 1 unhandled error; 9 assertions; 64.92s | mounted-candidate-2.log |
| Candidate 2 after screenshot case | 0 pass, 8 filtered, 1 fail, 1 unhandled error; 97 assertions; 143.84s total | after-candidate-2-capture.log; 11 of 16 after PNGs |
| Candidate 3 scoped Biome from apps/web | 4 files checked, no errors/fixes | candidate-3-lint.log |
| Candidate 3 existing releaseOnboardingGate | 14 pass, 0 fail; 46 assertions; 2.08s | candidate-3-release-regression.log |

The first behavior case exceeded its unchanged five-second deadline during localhost navigation in both mounted attempts. Bun killed its dangling browser; later cases failed against the closed browser. These results do not demonstrate a passing beta request flow or a product assertion failure. Hosted tests also reproduced the timeout cascade, so this is not classified as a local-only problem. Candidate 2 only added minify:true to the fixture bundle, reducing 1.3 MiB to 671,690 bytes. Development React stack/act diagnostics and StrictMode symbols remained present (candidate-2-bundle.json); the optimization did not fix the deadline failure.

The after capture exceeded its unchanged 120-second screenshot deadline. The 11 saved views passed their per-view single-main/h1, horizontal-overflow, visible-focus and visible-control-height assertions before capture; this does not establish the five missing views. Saved after views: all eight sign-in combinations and waiting 390 English light/dark plus Hebrew light. Missing: waiting 390 Hebrew dark and all four waiting 1280 combinations.

Visual inspection covered before phone English sign-in / Hebrew waiting and after phone English/Hebrew sign-in, Hebrew waiting, plus desktop English dark sign-in. The inspected views show readable copy, visible focus and no horizontal clipping. All screenshots are synthetic. The before images use the frozen original two-component baseline; all after images are candidate 2, before the final semantic/ID/copy corrections, and are not claimed as final-source browser proof. Hebrew remains machine-drafted for Amit's native read.

Candidate 3 fixes three independently verified hosted regressions: semantic output elements replace three paragraph status roles, existing page email IDs (#sign-in-email and #sign-up-email) are restored while modal IDs remain distinct, and the EN/HE next-step copy keeps the explicit beta request while explaining manual account approval. No request or entitlement logic changed. Existing preview-smoke locators require the restored page IDs; the Send magic link label was already unchanged.

The first scoped lint invocation used the repo root and could not resolve the web config; its failure is retained in candidate-3-lint-root-cwd.log. Running the unchanged tool from the declaring web workspace passed. An optional scratch SSR diagnostic was terminated with signal TERM/exit143 before producing results to release resources; it is INCONCLUSIVE, not a passing check. It changed no repository files.

No further browser run occurred after candidate 3. Source is frozen after the final permitted correction. Current full CI, CodeRabbit, guards, final-source geometry and runtime behavior remain merge gates. Browser/server processes from these runs exited; only inert zombies remained, and the shared browser slot was explicitly released.

status: blocked
ticket: #1272
evidence: 14 existing regression tests and scoped lint pass; mounted suite and partial capture failures preserved
changed: three scoped UI/i18n files, one fixture minification option, scoped evidence
unknowns: full final-source checks; mounted behavioral acceptance; five missing after views; final-source screenshots; actual preview
notes for ticket sync: no fourth source candidate without explicit authorization; inherited account-deletion expectation belongs to #1280.
