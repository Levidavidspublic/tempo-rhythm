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


## Third candidate: clean process isolation, 21 October 2026

Budget audit uses coherent candidate rounds rather than command or commit counts. The initial submission ended at old `6c0c71c` / rebased `d088ad3`, including implementation and capture follow-up; the latter also changed a modal token and fixture capture setup, so it is not a docs-only commit. The one recorded subsequent review repair is old `2c996e2` / rebased `d4ac160`, covering focus, live-region semantics and contrast. Multiple failures and gates within that candidate do not create new rounds. The exhausted-ticket list in current `IMPLEMENTATION.md` does not list KB-45, and available evidence/reflog/review records contain no explicit third-round or extra-pass consumption. This isolation change is the third ordinary candidate on that ledger; it does not grant another repair round.

Starting source: `d4ac16043e8af501b96cc68f353d3415404f77fc`. Hosted full-suite evidence on that candidate recorded 3,436 pass, 3 todo, 1 fail, 81,532 assertions in 178.97 seconds: the scoped browser fixture failed building scheduler (`EISDIR`) and resolving a Radix entry after other integration fixtures. The ten static cases passed. The excerpt is retained as `work/kb45-isolation/hosted-before.log`; no new full-suite baseline is claimed locally.

Only the scoped test and this evidence change. All eleven original cases now run in a clean child containing the sole Bun build/server and the actual React, Playwright, PostCSS, Tailwind, dictionary and product imports. The full-suite parent imports none of those runtime modules, builds/serves nothing, and reports each original case name. Every parent case first validates the actual child exit, then requires exactly eleven passes, zero failures and eleven executed cases before its supplementary name assertion. This rejects incomplete/skipped child runs as well as nonzero exits.

An audit proves the **entire original test body** is byte-identical after indentation: all 58 underlying `expect` sites, loops, native build inputs, styles, browser assertions, 240-second browser deadline and 30-second cleanup deadline are preserved. Parent static wrappers allow time for the full child; the child deadlines are unchanged. The product's retry-focus guard, polite/atomic live region and legal contrast fixes remain unchanged, as do its dictionary, CSS and existing JPG. No new screenshot or live-account result is claimed. Repaired test SHA-256: `29eab6c560f7265b316f3c9b70dfd79fdb845d5347396dd291957e1048c0424a`.

Final checks for this third candidate are recorded below after completion. Full repository Test, E2E, build, hosted CI and remote review remain with the coordinating agent. No push, rebase, config, backend, route or product mutation is included.


### Test results (cloud agent sandbox), third candidate

| Command | Exit | Result |
| --- | --- | --- |
| `bun --version` | 0 | 1.3.9 |
| `timeout 120s bun install --frozen-lockfile` | 124 | UNKNOWN: stalled at dependency resolution for 120.45 seconds. Existing dependencies were used; no installation success or network diagnosis claimed. |
| `bun run lint` | 0 | 5 successful tasks, 0 errors; 10 existing warnings (UI 1, web 9). |
| `bun run typecheck` | 0 | 5 successful, 5 total; 103.20 seconds. |
| `flock /workspace/work/kb-finish/heavy-check.lock bun test tests/unit/kb-45.test.tsx` | 0 | **11 pass, 0 fail, 11 wrapper assertions**, 124.23 seconds of test execution. The first wrapper runs the complete child; every wrapper validates its successful eleven-case result. The locked command's 1,052.64 seconds includes queue time. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK. |
| `bun run test` on this third candidate | — | UNKNOWN: full repository gate remains with the coordinating agent. |
| `CI=1 bunx playwright test --reporter=line` | — | UNKNOWN: E2E gate remains with the coordinating agent. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | UNKNOWN: build gate remains with the coordinating agent. |

The eleven wrapper assertions are supplementary to the child's exit and exact executed-case checks. The original 58 assertion sites and browser loops execute in that child; its complete body is unchanged. The historical 386-assertion capture above remains a separate recorded run, not a newly observed count here. No source edit followed this successful focused run. Lock and all manifests still match main byte for byte; own `node_modules/.bun` is a real directory and workspace links remain local. No dependency setup changes were made.

Frozen-install failure output (entire log, fewer than 20 lines):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Historical hosted Test failure, last 20 command lines before CI cleanup (full excerpt retained in `hosted-before.log`):

```text
2026-10-21T10:19:38.8257313Z (pass) the MCP client > a network failure, a timeout and an oversized answer each have their kind [23.00ms]
2026-10-21T10:19:55.4086099Z
2026-10-21T10:19:55.4086568Z ##[endgroup]
2026-10-21T10:19:55.4097446Z
2026-10-21T10:19:55.4098020Z 3 tests todo:
2026-10-21T10:19:55.4099444Z (todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
2026-10-21T10:19:55.4100998Z (todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
2026-10-21T10:19:55.4102075Z (todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages
2026-10-21T10:19:55.4102474Z
2026-10-21T10:19:55.4102481Z
2026-10-21T10:19:55.4102578Z 1 tests failed:
2026-10-21T10:19:55.4103203Z (fail) hydrated gallery and mounted modal preserve validation, retry, Hebrew links, contrast, and 44 px controls [38.00ms]
2026-10-21T10:19:55.4103673Z
2026-10-21T10:19:55.4103761Z  3436 pass
2026-10-21T10:19:55.4103965Z  3 todo
2026-10-21T10:19:55.4104149Z  1 fail
2026-10-21T10:19:55.4104352Z  81532 expect() calls
2026-10-21T10:19:55.4104659Z Ran 3440 tests across 208 files. [178.97s]
2026-10-21T10:19:55.4628426Z error: script "test" exited with code 1
2026-10-21T10:19:55.4651560Z ##[error]Process completed with exit code 1.
```

Exact logs/exits, `checks.json`, `coverage-audit.json`, the frozen baseline, source SHA manifests and budget ledger remain under ignored `work/kb45-isolation/`. Root handoff: `/workspace/work/kb-finish/kb45/HANDOFF.md`. Hosted CI, final review and integration eligibility remain unverified here. No push, remote mutation, deployment or additional broad check was performed by this worker.
