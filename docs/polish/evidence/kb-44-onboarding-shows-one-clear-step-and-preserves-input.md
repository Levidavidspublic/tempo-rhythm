# KB-44 onboarding progress and input evidence

The existing `/onboarding` flow still uses its five steps, `?step=` address state, and the same backend calls and arguments. The mounted flow now shows a visible and spoken step count with native progress. Opening a later step from the address shows a resume notice that asks the person to review earlier choices; it never claims that unsaved text survived a reload. The review action locks during an in-flight save. Optional steps say they can be changed later.

The [contact sheet](./kb-44-onboarding-shows-one-clear-step-and-preserves-input.jpg) pairs source-derived before views from the original checked-in `OnboardingFlow.tsx` saved before editing with the updated production component and its interactive gallery at 390 and 1280 px in English and Hebrew, light and dark. In the updated mount, the resumed step shows a count, progress bar, optional-step explanation, and review notice; the original mount had its existing step count without the review notice. All 16 mounted before/after frames had one heading and `scrollWidth` equal to the viewport width. The isolated capture applies the same document theme attribute as the app’s pre-hydration script. Fixtures use fictional Maya, Dana, and Yoni data. A mocked query/mutation/router boundary makes the mounted flow inspectable without a live account; it does not prove server behavior.

The hydrated browser test exercises the actual `OnboardingFlow` with its real `NameStep` and controls: Back retains a typed name, Continue moves focus to the new heading, an in-flight Finish locks review, a failed Finish stays on step 5, and review returns to step 1 after the failure. The separate interactive gallery presents empty, loading, error, disabled, long-input, resume, and pending views with the real summary and notice exports. Gallery browser checks cover phone and desktop widths, English/Hebrew direction, light/dark surfaces, reduced motion, touch targets, one heading and main, and horizontal overflow. Its capture run saved all eight width/language/theme frames and passed the gallery case inside the clean child; the outer wrapper then exited 1 on the known Bun second-bundle read error when the child continued to the actual-flow case. The source commit is `4a3b908`.

Hebrew copy is machine-drafted for Amit's native review. Device screen-reader behavior and live-account flows remain UNKNOWN.


Owner-authorized additional repair pass, 21 October 2026 (issue #1154, PR #1158). This pass changes the scoped test harness only; the production component, dictionary, stylesheet, and existing contact sheet remain byte-identical. Product source remains `4a3b908`; repair starts from `cd6909c5ca0d65a75bbed01562964ca33539da07`. Repair test SHA-256: `08d34dce3cf171d8e742b9441d64ff6fab026d6e22041cd6f0fa134e8dda7e28`.

Verified review findings [4335136942](https://github.com/Levidavidspublic/tempo-rhythm/pull/1158#discussion_r4335136942) and [4335136960](https://github.com/Levidavidspublic/tempo-rhythm/pull/1158#discussion_r4335136960). The normal pre-repair scoped run passed 10/10 locally, so the historical second-bundle CSS read failure above was not freshly reproduced. Supplied hosted CI logs separately record later same-process build/server failures (`Unseekable`/`EISDIR` reads and an invalid server port); the coordinating investigation identified process isolation as the repair direction. The repair gives the eight static checks, gallery, and real flow separate clean children; each browser child performs one build and owns one server. The full CSS inputs and reads are unchanged. Each wrapper checks its group's child exit code before its supplementary name assertion. An outer `finally` now encloses browser acquisition and always stops the server; browser close retains its inner `finally`.

All ten named regressions remain mandatory, with the same underlying assertions and existing timeouts: first-step textual/semantic progress; resume explanation/review; optional copy; loading versus error; disabled controls; Hebrew number isolation; named-view/heading/main render; exact English/Hebrew key parity; hydrated gallery input/focus/error/pending/RTL/reduced-motion behavior; hydrated real-flow Back/input/pending-review/error behavior. The gallery still checks 390/1280 px, both locales and themes. An audit retained all 59 `expect` sites, including every underlying assertion line, and both 240-second browser timeouts plus the 300-second wrapper timeout.

Test results (cloud agent sandbox): Bun 1.3.9. Exact commands, exits and logs for this repair are retained in ignored `work/kb44-extra/` and the root handoff. Full-suite, E2E, build, hosted CI and final review remain pending with the coordinating agent; this report does not claim the ticket's complete DONE gate.


| Check | Exit | Result |
| --- | --- | --- |
| `bun --version` | 0 | 1.3.9 |
| `timeout 120s bun install --frozen-lockfile` | 124 | UNKNOWN: stopped at “Resolving dependencies”; no successful installation claimed. Lock and all manifests still match main byte for byte. |
| `bun run lint` | 0 | 5/5 tasks; 0 errors, 10 existing warnings (1 UI, 9 web). |
| `bun run typecheck` | 0 | 5 successful, 5 total. |
| Four unchanged scans: forbidden tech, RAM-only audit, design tokens, notices | 0 | All four OK. |
| Pre-repair `bun test tests/unit/kb-44.test.tsx` | 0 | 10 pass, 0 fail; 10 wrapper assertions; 78.60 seconds. |
| Repaired `bun test tests/unit/kb-44.test.tsx` | 0 | 10 pass, 0 fail; 10 wrapper assertions; 23.93 seconds. Both hydrated fixtures completed separately. |
| `bun run test` | — | UNKNOWN: remaining full-suite gate assigned to coordinating agent. |
| `CI=1 bunx playwright test --reporter=line` | — | UNKNOWN: remaining E2E gate assigned to coordinating agent. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | UNKNOWN: remaining build gate assigned to coordinating agent. |

Frozen-install failure output (entire log, fewer than 20 lines):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```


The ignored launch-rejection preload replaces the installed Chromium launch function with a deliberate rejection while instrumenting the actual Bun builds and servers. Repaired gallery child PID 73857 built once and left port 45383 unreachable; repaired real-flow child PID 73893 built once and left port 37441 unreachable. Both resource assertions passed. The ordinary parent still exited 1 with 8 pass / 2 deliberately failed browser cases (9.37 seconds), despite their names being printed by both children. This verifies cleanup and authoritative child exits; it is an expected-failure diagnostic, not a passing ordinary test.

Command (shared heavy lock omitted here; applied to every browser command): `timeout 120s bun test --preload ./work/kb44-extra/inject-child-launch.ts tests/unit/kb-44.test.tsx`. Log `work/kb44-extra/launch-after.log`, exit 1. Last 20 lines:

```text
12 |   return server;
13 | }) as typeof Bun.serve;
14 | chromium.launch = async () => { throw new Error("KB44_INJECTED_CHROMIUM_LAUNCH_FAILURE"); };
                                               ^
error: KB44_INJECTED_CHROMIUM_LAUNCH_FAILURE
      at <anonymous> (/workspace/work/kb-44/work/kb44-extra/fail-launch-preload.ts:14:43)
      at <anonymous> (/workspace/work/kb-44/tests/unit/kb-44.test.tsx:275:38)
(fail) hydrated OnboardingFlow: Back retains input, resume review locks during save, error keeps step [160.56ms]

 0 pass
 1 fail
Ran 1 test across 1 file. [3.87s]

      at <anonymous> (/workspace/work/kb-44/tests/unit/kb-44.test.tsx:39:107)
(fail) KB-44 isolated: hydrated OnboardingFlow: Back retains input, resume review locks during save, error keeps step [3921.42ms]

 8 pass
 2 fail
 8 expect() calls
Ran 10 tests across 1 file. [9.37s]
```

Initial frozen-baseline diagnostic discovery attempt exited 1 before executing tests: its filename was treated as a Bun filter. The exact frozen source was preserved and the invocation corrected to use an explicit `./work/...` path. This setup failure remains in `launch-before-unmatched.log`; its entire output is:

```text
bun test v1.3.9 (cf6cdbbb)
The following filters did not match any test files:
 work/kb44-extra/before-test.tsx
1670 files were searched [182.00ms]

note: Tests need ".test", "_test_", ".spec" or "_spec_" in the filename (ex: "MyApp.test.ts")
note: To treat the "work/kb44-extra/before-test.tsx" filter as a path, run "bun test ./work/kb44-extra/before-test.tsx"

Learn more about bun test: https://bun.com/docs/cli/test
```


The corrected frozen-baseline command completed before a later cancellation request could apply; no active or queued command was killed. `KB44_ISOLATED=1 timeout 120s bun test --preload ./work/kb44-extra/fail-launch-preload.ts ./work/kb44-extra/before-test.tsx -t hydrated` exited 1 in 3.59 seconds: 0 pass, 8 filtered out, 3 deliberately failed checks (two injected launch failures plus the expected cleanup assertion failure). The original child built twice and left **both** servers reachable on ports 46331 and 46575. The preload always stopped those servers after recording the defect. This directly reproduces review 4335136960. Only this diagnostic filters the static checks; ordinary scoped verification executes all ten cases. Log `launch-before.log`; last 20 lines:

```text
22 |       resources.push({ port, reachableAfterLaunchFailure: reachable });
23 |     }
24 |     console.log("KB44_LAUNCH_FAILURE_RESOURCES " + JSON.stringify({ pid: process.pid, fixture: process.env.KB44_FIXTURE ?? "legacy-both", buildCount, resources }));
25 |     expect(buildCount).toBe(process.env.KB44_FIXTURE ? 1 : 2);
26 |     expect(resources.length).toBe(process.env.KB44_FIXTURE ? 1 : 2);
27 |     expect(resources.every((resource) => !resource.reachableAfterLaunchFailure)).toBe(true);
                                                                                      ^
error: expect(received).toBe(expected)

Expected: true
Received: false

      at <anonymous> (/workspace/work/kb-44/work/kb44-extra/fail-launch-preload.ts:27:82)
(fail) (unnamed) [8.12ms]

 0 pass
 8 filtered out
 3 fail
 3 expect() calls
Ran 3 tests across 1 file. [3.59s]
```

Compatibility verification: `bun test work/kb44-extra/combined-isolation.test.ts` (separate shared heavy lock), exit 0, **11 pass / 0 fail**, 14 assertions, 61.35 seconds. It imports the actual scoped wrapper, runs all ten cases unchanged, then builds an entry importing `react-dom/client` (including scheduler) and starts a native Bun server in the same parent process. The subsequent build succeeded; port 34147 was positive and returned the expected response. Log `combined-after.log`. This targeted compatibility probe does not replace the pending full suite with the latest integration changes.

All temporary native/browser resources have stopped. No source edit followed the successful repaired scoped run. Frozen original test SHA-256 `18f3cce2ee7cedd8d01fa823f76f566d8b347cf62313c1c40d6d4194e4ee847e`; repair hash above matches the verified test. `coverage-audit.json`, `verified-proof.json`, SHA manifests, command logs and exits are retained under ignored `work/kb44-extra/`. The three production files and original JPG remain unchanged. No new screenshot is claimed for this test-only repair. Root handoff: `/workspace/work/kb-finish/kb44/HANDOFF.md`.
