# AT-27 — one authorized Plan heading correction

Amit approved exactly one additional scoped correction on 22 October 2026 in [NEEDS-AMIT](https://github.com/Levidavidspublic/tempo-rhythm/blob/docs/kitchen-kb-plan/docs/kitchen/kb/NEEDS-AMIT.md): “AT-27 / AT-28 / AT-29: one scoped correction each authorized for Plan's hidden heading, hero's regression test and the page-save revision race.” The AT-27 request restores the existing visually hidden Plan heading and retains every assertion and deadline.

## Candidate and review before testing

Base commit: `b77f7c022aec0b236d312f05dd65151599ad136b`. The only product edit changes PlanScreen's h1 class from `tp-pagehead__title` to `tp-sr-only`. Candidate source blob: `e0f79d9d8ec622f5a3c6cd5cc8bc6d16e9a3d892`; unchanged focused test blob: `93efc3b648bd5567553e78dccf439de24b169d91`. See [candidate.patch](candidate.patch).

Before testing, the one-line diff was checked against the unchanged EN/HE exact-class assertions in `tests/unit/one-h1.test.tsx:198`, and the focused suite's one-h1 assertions. No test, assertion, deadline, guard, configuration, dependency, route entry, backend or environment file changed. This uses the one additional authorized source candidate; it is not a general retry exception.

## Test results (cloud agent sandbox)

The lead granted an exclusive short browser slot only. Bun 1.3.9 and the existing Chromium cache were used.

| Command | Result |
| --- | --- |
| `bun --version` | 1.3.9 |
| `bun test tests/unit/one-h1.test.tsx` | PASS, authoritative exit 0; 10 tests, 0 failures, 36 assertions; 2.11s. Both EN/HE Plan heading cases pass. |
| `TEMPO_PLAN_EVIDENCE_DIR=/workspace/work/overnight/plan-gates/at27-20261022/fixture bun test tests/unit/tempo-plan-views.test.tsx` | PASS, authoritative exit 0; 13 child cases, 0 failures, 185 assertions; outer isolation 1/0; 45.73s overall. |
| `git diff --check` | PASS before source commit. |

[Fresh 12 captures](fixture/) show the same controlled before/after fixtures in English/Hebrew and 390/1280 widths. The after images reflect the hidden h1. Phone English/Hebrew Day captures were visually inspected; the screen-reader heading stays out of visual layout, both view controls and mixed agendas remain visible, and RTL is retained. Existing fixture-boundary limitations in [the parent README](../README.md) still apply. No hosted account, live backend, provider call or preview URL was used.

## Pending gates and history

UNKNOWN/PENDING on this corrected candidate: frozen install, lint, typecheck, full tests, all four scans/notices, exact local Playwright, placeholder build, current-head hosted CI, actual CodeRabbit review and all repository guards, and preview behavior. The root requested source plus evidence be pushed after focused success to start CI, then the short browser slot released for Hero. Full mandatory local checks were explicitly deferred until a later slot grant.

The earlier two EN/HE h1 failures and nine local E2E failures on source `d227acd` remain preserved in [gates-d227acd](../gates-d227acd/SUMMARY.md). The corrected heading passes the targeted checks above; the nine unrelated E2E failures were not repaired, retried or classified by this correction. No broader pass, readiness, merge, preview or production claim follows from focused success.

Raw logs and exact exit receipts remain in `/workspace/work/overnight/plan-gates/at27-20261022/`; committed text copies normalize trailing whitespace and final blank lines, with raw SHA-256 values retained. The focused runner has exited, port3000 is unowned, and observed owned Chromium remnants were zombie-only. The short browser slot was released before evidence/commit work. Protected #1193/#1198 and overlapping #1102/#1081 are untouched.
