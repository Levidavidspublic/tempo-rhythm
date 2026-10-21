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

## 2026-10-21 scoped repair

Repair baseline: `6c0c71c983950248e62c60ac0052e0214336353e`, still based on `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The original page before images above remain from the original pre-edit mount. The added modal pairs capture the actual mounted `SignUpModal` immediately before this repair and after it, at 390/1280 px, English/Hebrew, light/dark. Only auth actions and Next links are replaced by fictional loopback adapters; the modal, shared form, locale provider, dialog primitives, and utility classes are real production modules. No email is sent.

The modal previously used `--tp-on-accent` for legal text against its fixed dark caller surface. In dark theme this becomes near-black; the new regression reproduced 1.1949:1 contrast against gray-800 before the CSS repair. The legal line now has its own `--tp-paper` surface and retains the ordinary muted text/accent link tokens, so both themes use the design system's documented contrast pairs. The browser checks each legal text/link pair against that actual computed surface, keyboard focus rings, 44 px link dimensions, RTL, and no horizontal overflow. The refreshed contact sheet preserves the original page comparisons, refreshes current page/gallery captures, and adds every modal before/after pair.

CodeRabbit review `5597596578` on the baseline identified two gallery accessibility issues. The persistent wrapper now has explicit polite, atomic live-region semantics; `aria-busy` remains on the loading example. Retry focus uses a phase-driven effect and a pending ref, and returns to the error choice only if focus remains on the document body. A browser regression deliberately moves focus during retry and checks that the chosen control keeps it. Explicit `aria-live`/`aria-atomic` avoids treating these structured section/button views as form `<output>` content. Browser fixtures now create temporary bundles under ignored `work/`. Sent-view assertions use the fictional email and removed submit control, so they do not depend on the shared child remaining English after KB-10.

Repair capture run: Bun 1.3.9, `bun test tests/unit/kb-45.test.tsx` with `KB45_CAPTURE_DIR` set to ignored local capture output, exit 0: 11 passed, 0 failed, 386 assertions. This includes all eight real-modal locale/width/theme combinations. The new contrast regression first failed on the unmodified CSS at 1.1949:1; its repaired capture run passed. Final validation results for the final repair source are recorded below and in the completion report. Screen-reader behavior on a device and live-account approval remain UNKNOWN.

### Repair validation handoff (pending final gates)

| Command | Exit / result |
| --- | --- |
| `bun --version` | 0 / 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN / stopped with exit 143 after several minutes stalled at `Resolving dependencies`; existing own-worktree dependencies remain available, and tracked manifests/lockfile are unchanged |
| `bun run lint` | 0 / 5 successful tasks, 0 errors; existing warnings remain |
| `bun run typecheck` | 0 / 5 successful tasks; a final-source repeat is running |
| Focused hydrated capture | 0 / 11 pass, 0 fail, 386 assertions; all refreshed captures complete |
| Final-source focused check / full Test / scan quartet / E2E / build | UNKNOWN / scheduled by `work/kb45-repair-gates.sh`, with a separate shared lock for each heavy command; exact exits accumulate in `work/kb45-repair-gates-status.txt` |

The initial scoped lint run rejected a redundant `role="status"` on a div under `useSemanticElements`; this was corrected to explicit polite/atomic live semantics and the final lint passed. The final-source check also verifies the language-independent sent-email marker and the atomic live-region attribute. Final gate outcomes must be added before claiming integration eligibility. A draft may carry this explicit pending-validation handoff. Raw logs and capture outputs remain in ignored `work/`; no new repair commit or push has been made at this handoff.

## AWAY — repair draft, validation pending

The final source uses a language-independent sent-email assertion for compatibility with KB-10. Root independently completed final typecheck (5/5). The 11-case capture pass and all earlier failed diagnostics above remain distinct from the remaining full repository gates.

The lead owns the remaining full unit suite, scan confirmation, local E2E and build commands. They are queued separately under the shared resource lock; no passing result is claimed for an unfinished command. This repair may be pushed as a draft for hosted CI, but is not yet eligible for integration. No assertions, check configuration, timeout or skip conditions were weakened. The lead will append actual outcomes and failure tails before the merge gate.
