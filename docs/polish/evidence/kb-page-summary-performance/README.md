# Page summary performance — candidate 1 prepared

Ticket #1301; 22 October 2026. Base integration
`7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Source preparation only: no candidate
test, benchmark, compiler, browser, install or mandatory sequence has run yet.
The root will allocate the quiet validation slot after hero validation finishes.

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

## Candidate ledger and pending validation

Candidate 1 is prepared, not verified. Implementation SHA-256:

- page-summary.ts: `8470498e2b553da9a62ae2e4a161f36762259192f5066b366f9b59ffe3f1623a`
- page-summary.test.ts: `cbfe57518a4e52a914e6f1adece355b8cdce54ea8176a6967e093f4fa9697636`

The test diff only inserts five semantic cases. Every original case, performance
input, `< 3000` assertion and 30,000 ms wrapper is unchanged. The additions cover
repeated visible Unicode, changing fence state, later completion of malformed
closing tags, raw HTML termination, and a full collector preceding a broken block.
The expected total is 298 original + 5 new = 303 cases; no executed count is claimed.

`git diff --check` passes. All candidate runtime results are UNKNOWN until run:
the complete scoped file (including every original pathological body), strict
repository lint/typecheck, frozen install, full tests, four scans/notices, exact
local Playwright and placeholder-URL build. A narrow pass will not clear retained
full-suite failures. No current hosted CI or actual CodeRabbit clearance is claimed.

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
Source/test remain frozen at the supplied hashes. Publication as a draft starts
hosted checks; every local runtime gate remains UNKNOWN pending the root's quiet slot.
