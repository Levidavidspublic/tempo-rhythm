# KB-45 sign-up evidence

Baseline: `origin/integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The original `SignUpForm.tsx` was saved and rendered before editing. The controlled before/after capture uses the same mounted `SignInForm` and fictional Maya/Dana email data; only the auth action and Next navigation adapters are stubbed in a loopback harness. The screenshots are sandbox rendering, not a live account, real approval state, or deployment proof. Source implementation commit: `ff1f1b2`.

The contact sheet `kb-45-sign-up-explains-approval-and-keeps-the-form-accessible.jpg` pairs the original mounted page and current mounted wrapper at 390 and 1280 px, English and Hebrew, light and dark. On the original route, the outer `<main>` is explicitly English and LTR even when the document language is Hebrew. That route file is outside this ticket; the new wrapper sets its own `lang` and `dir`. The shared child form's existing English copy is owned by KB-10; the new approval and legal guidance is localized here. The separate `SignUpModal` title is likewise outside scope.

## Hydrated gallery and keyboard findings

`Kb45Gallery` renders the real `SignUpForm`, which in turn renders the production `SignInForm`, plus controlled, fictional guidance examples. The examples labelled loading, error, disabled, waiting and approved are display examples, never live account status. The browser fixture stubs only the auth action and navigation and tests the real child's empty-field validation, pending disabled action, failed send, retry with the entered email retained, and sent view. It also changes all gallery guidance states and retries the example error. English/Hebrew and 390/1280 px use one `main` and one `h1`, no horizontal overflow, reduced motion and visible 44 px controls. The Hebrew wrapper has `dir=rtl`; email input stays LTR. The error example's retry returns focus to its state control. The gallery captures are included at the end of the contact sheet. Device screen-reader results are UNKNOWN until tested on a device.

## New regression cases

- Default guidance describes the magic-link and hand-approval flow.
- Waiting copy describes review without claiming an account is pending.
- Approved copy describes a later path without claiming approval.
- Empty guidance remains explicit.
- Loading guidance exposes busy semantics.
- Error guidance offers retry.
- Disabled guidance keeps its action visible and unavailable.
- Hebrew legal links keep the existing destinations and safe new-tab attributes.
- English and Hebrew dictionary keys stay paired.
- All named views are exported.
- Hydrated gallery exercises actual form validation, pending, retry, Hebrew links, RTL, focus, and 44 px controls.

## Checks

Bun 1.3.9. Local frozen install, lint, typecheck (5/5), scan/notices quartet, and ten focused render tests passed. The pushed code head passed GitHub full Test, E2E, Build, Typecheck, Lint, scans, notices, scope/config, and secret checks. Final local command outcomes and failure tails are recorded in the draft PR. No backend call, approval policy, route, or config was changed.
