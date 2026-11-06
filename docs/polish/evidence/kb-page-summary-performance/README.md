# Page summary performance — candidate 2 source prepared

Ticket #1301; 22 October 2026. Base integration
`7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Candidate 1 at `1acc05a` completed
the separately recorded quiet and mandatory sequences below. Its focused file
passed, but the full tests and local E2E failed. Candidate 2 is source preparation
only: no candidate-2 test, benchmark, compiler, browser or install has run.
The lead will allocate its validation slot after voice and Executor validation.

## Baseline and boundaries

The unchanged closingTagsOpenOnEveryLine case failed during #1300's full run at
4561.54 ms. One separately authorized quiet diagnostic on the same integration
utility source failed its original `< 3000` assertion at 7016.860641 ms:
0 pass / 1 fail / 297 filtered, 12 assertions, Bun 1.3.9, exit 1. Its existing
30,000 ms test wrapper was unchanged; process wall time was 8.415 seconds.

The baseline stdout and metadata remain intact outside the checkout at
`/workspace/work/overnight/page-summary-isolated-oct22/closing-tags-one-run.log`
and `closing-tags-one-run.json`. That diagnostic does not replace the full-suite
failure or establish a quadratic algorithm or environmental cause. Cgroup
snapshots recorded a four-CPU quota, one additional throttled period (204045 us),
about 4.12 GB memory against a 17.18 GB limit and no OOM event.

Baseline SHA-256:

- page-summary.ts: `5f6de1b90b446f08006fdbbb0c7176c374259897f23c57ce54050aea57dd2d02`
- page-summary.test.ts: `39662caaf53bd5efc5097e9035a49569d2f6f56298beb2b9a477cca33412344d`

Only page-summary.ts, additive tests in page-summary.test.ts and this evidence
directory are changed. The authoritative codec in blocks.ts, index exports,
shared harness, held #803 and protected #1193/#1198 are untouched. There is no
new caller, UI, dependency, provider request, environment access or activation.

## General optimization and semantic argument

The original one-megabyte case has 250,000 short lines. The codec still reads the
complete body first. The projection's second pass repeatedly runs the same
regular expressions and allocates equivalent small tag-scanner states after
those states have stopped changing. No growing rescan was found for this input.

Candidate 1 adds one reader per codec segment. It remembers only the previous
raw line, emit mode and projected text, plus whether that exact line was observed
to leave the complete parser state unchanged. It does not recognize a tag name,
test payload, line count or size threshold.

1. proseLine still runs on the first line and on every different line or emit
   mode. A second identical adjacent line runs the original function too; only
   if its before/after structural state is equal can further identical lines
   reuse the result. Changing fence/container/definition states keep executing.
2. The fingerprint includes every ProseState field and nested scanner/container
   field. HTML end-marker regular expressions include source, flags and lastIndex,
   rather than JSON's ordinary empty-object serialization. All numbers in this
   internal state come from bounded character/container positions or counters.
3. Missing and undefined optional fields are equivalent here: no parser path
   observes own-property presence, enumerates state keys or compares scanner or
   regular-expression identities. State is local structural data, not user objects.
4. Outside state, BLOCK_MARKER and INLINE_DELIMITED are the mutable sticky
   regular expressions: their lastIndex is set explicitly before every use.
   Global replacement expressions reset their own lastIndex before replacing;
   other tested expressions are not global/sticky. Skipping a proved identical
   transition therefore cannot change a later line through a regex cursor.
5. Reused text still passes through out.add for every occurrence. Repeated visible
   text is not deduplicated. When the collector becomes full, the changed emit
   flag forces the original function to run; structural block gating continues.
6. A changed raw line (including line-ending differences) invalidates reuse. The
   reader is recreated at each markdown or block segment, with no cache across
   blocks, projectPageText calls or users. Codec size, validation, broken-block
   counting and block-fence verification remain unchanged.

Unique lines perform no state serialization. Only adjacent repeated lines whose
state is still changing need before/after fingerprints; parser state is bounded
(including at most 16 containers). A proved stable run then needs no more
fingerprints. Memory retains one line/result for that segment only.

## Candidate 1 source ledger

Candidate 1 was initially published with runtime validation pending. Its frozen
implementation SHA-256:

- page-summary.ts: `8470498e2b553da9a62ae2e4a161f36762259192f5066b366f9b59ffe3f1623a`
- page-summary.test.ts: `cbfe57518a4e52a914e6f1adece355b8cdce54ea8176a6967e093f4fa9697636`

The test diff only inserts five semantic cases. Every original case, performance
input, `< 3000` assertion and 30,000 ms wrapper is unchanged. The additions cover
repeated visible Unicode, changing fence state, later completion of malformed
closing tags, raw HTML termination, and a full collector preceding a broken block.
The total was 298 original + 5 new = 303 cases; executed results are below.

At publication, `git diff --check` passed and runtime validation was pending.
The subsequent completed results below retain every full-suite failure; the
quiet focused pass does not clear them.

Primary risk: the fixed-point argument relies on complete internal state and no
untracked observable effects. Review must check those assumptions, evolving
containers/definitions, emit transitions, segment boundaries and every existing
security/Unicode/output regression before treating this as a passing repair.

## Independent source review — 22 October 2026

The assigned peer reviewed the exact candidate hashes above without edits or
runtime checks and reported no actionable correctness defect. The review covered
complete current parser state and aliases, undefined/missing fields, regex
fingerprints and cursors, collector emit changes, segment locality and block-fence
bookkeeping. This is not actual CodeRabbit clearance.

The peer retained one validation risk: identical adjacent lines with changing
state, such as alternating opening/closing fences, take two JSON fingerprints per
transition. All original pathological cases and the full 303-case file must be
run; a passing closing-tag case alone would not establish general performance.
That review applies only to the candidate-1 hashes above. It does not substitute
for actual CodeRabbit or validate candidate 2.

## Candidate 1 completed validation — 22 October 2026

The quiet scoped file passed: **303 pass / 0 fail, 40,582 assertions**, Bun 1.3.9,
17.20 seconds Bun / 17.315 seconds process wall time. The closing-tag elapsed
assertion passed (case runtime 246.29 ms); definitionStarts case runtime was
2724.67 ms. In that same existing quiet run, backslashes, tabs and itemAndTabs
case runtimes were 508.99 ms, 642.95 ms and 270.46 ms. These are case runtimes,
not separately measured assertion elapsed times. Scoped Biome lint (two files)
and the actual utils TypeScript project both passed. No unchanged focused rerun
replaced a failure.

The exact mandatory actual-checkout sequence then ran once, all stages in order,
with DEBUG unset and the same frozen candidate-1 source/test:

| Stage | Result | Process wall time |
| --- | --- | --- |
| Bun 1.3.9 frozen install | PASS, 1033 installs / 1079 packages, no changes | 319.127 s |
| Repository lint | PASS, 5/5 tasks, nine web warnings retained | 9.042 s |
| Repository typecheck | PASS, 5/5 tasks, no diagnostics | 232.831 s |
| Full tests | FAIL, 3489 pass / 3 TODO / 10 fail / 1 error; 81,608 assertions; 3502 tests, 211 files | 2098.221 s |
| Four scans/notices | PASS, all four exact scripts | 2.204 s |
| Local Playwright | FAIL, 11 pass / 89 skip / 17 fail | 828.212 s |
| Placeholder-URL build | PASS, 1/1 task, no cache hit | 747.152 s |

The full run passed the closing-tag case (case runtime 251.77 ms), but the unchanged
3000 ms assertions failed for backslashes (3900.163750000065 ms elapsed) and tabs
(3031.191293000011 ms). It also failed pageCleanup case 12, two KB74 cases, two
KB64 cases and an unnamed cleanup hook, and two history-normalization cases.
All ten failures and the one between-test error remain failures. Local E2E failed
calendar views, local calendar-add, sign-out visibility, core task views and
thirteen wiring cases. Neither narrow nor hosted green results waive these gates.

Root separately verified hosted Test: 3498 pass / 0 fail / 3 TODO, 81,713 assertions,
3501 tests across 211 files, 191.28 seconds (job 119806879297; merge 3e31edd of
candidate 1 plus integration 7d1). Actual CodeRabbit coverage completed at 1acc
with no actionable comments (comment 6340025543); the earlier draft skip was not
clearance. Causes of local timing/browser/hook failures remain UNKNOWN. No
introduced-regression or environmental cause is claimed from timing alone.

Full logs, actual exits, before/after hashes, durations, snapshots and browser
artifacts are retained outside checkout:

- `/workspace/work/overnight/page-summary-perf-gates/1acc05a/` — quiet scoped gates.
- `/workspace/work/overnight/page-summary-perf-mandatory/1acc05a/` — all mandatory
  gates, separate prior-goal/current E2E artifacts and full-suite browser work.
- [PR #1302](https://github.com/Levidavidspublic/tempo-rhythm/pull/1302) and
  [issue report](https://github.com/Levidavidspublic/tempo-rhythm/issues/1301#issuecomment-6341885790)
  preserve exact failures and last-20-line tails. Head 1acc was unchanged and clean
  at report freeze; no evidence-only commit or source repair erased the results.

## Candidate 2 source changes and semantic argument

Candidate 2 retains candidate 1 and changes only two existing operations:

1. `detab` replaces each contiguous tab run together. At raw UTF-16 offset `at`,
   prior replacement expansion is the difference between the expanded prefix
   length and the raw prefix length. Therefore `at + expansion` is exactly the
   former `out.length`, including astral characters, unpaired surrogates and
   control/newline units. The first tab adds `4 - column % 4` spaces; each remaining
   tab in the same run adds four. Adding replacement width minus run length to
   expansion preserves that invariant for the next run. Non-tab text is retained
   verbatim by replacement; no parser input or output is omitted.
2. The second `looksLikeJson` call is unnecessary only when `text === line`.
   JSON_LINE is non-global/non-sticky. ALL_FORMAT replacement is global and resets
   its cursor; trimStart and the classifier read only their string. The repeated
   identical call has the same boolean result and leaves the same regex state.
   If heading/list/checkbox stripping changes text, the second check remains.
   Inline cleanup, the final `isUnsafe` check and every other safety gate remain.

An important source correction: the existing caller already invokes detab only
when `raw.includes("\t")`. The no-tab backslash fixture does not execute detab's
character loop. The tab-run change is relevant to tab input only; the duplicate
JSON check is a separate possible reduction for unchanged text. Neither change
has a measured candidate-2 timing result or established causal attribution yet.

Six additive public-projection regressions cover tab-aligned list/quote fences,
a tab-only quote blank boundary, mixed UTF-16 text and explicit space-column
equivalence, retained-format JSON hiding, JSON revealed by headings/checkboxes,
and visible non-JSON quoted/backslash prose. Expected total: **309 cases**
(298 original + five candidate-1 + six candidate-2). All prior cases, inputs,
assertions, 3000 ms budgets and 30000 ms wrappers remain unchanged.

Candidate 2 is **UNVERIFIED at runtime**. Root and the independent assigned peer
reviewed the exact prepared source/test hashes below and found no actionable
source defect. They confirmed all prior 303 cases and limits were preserved and
the six additive cases were meaningful. This source review is not actual
CodeRabbit coverage or a runtime pass.

The lead authorized publishing candidate 2 of the maximum three source candidates
on the existing branch/PR while the serialized validation slot remains occupied.
All candidate-2 local checks remain UNKNOWN: the expected 309-case file, scoped
lint, actual utils types, frozen install, repository lint/typecheck/full tests,
four scans/notices, local Playwright and placeholder-URL build. A separate quiet
slot will follow voice and Executor validation. No candidate-2 runtime, compiler,
browser, benchmark or install ran during source preparation/publication. No
performance gain is claimed, and no merge or auto-merge is authorized.

Candidate-2 prepared source/test SHA-256:

- page-summary.ts: `db9c392d4c91c37df63155b5f90c99c95536051928b39ea9bcfd1b61508939d2`
- page-summary.test.ts: `b704dc54188bffd447212b73df9b6095a3a37845130c0877a4d648f6f84b8a42`
