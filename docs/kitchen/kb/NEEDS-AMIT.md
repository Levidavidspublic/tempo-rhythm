# Needs Amit

## Amit's answers — 2026-10-22

WALK — These answers supersede the corresponding pending decisions below. The earlier ledger remains as history, not a renewed permission request.

- AT-21: one additional scoped shared-harness pass authorized for #1203, including the preserved portability and process-signal fixes. Existing checks and deadlines remain unchanged.
- AT-22: a fresh clean replacement PR for KB-67 #1197 is authorized. Keep #1197 open and link both PRs; delete nothing.
- AT-27 / AT-28 / AT-29: one scoped correction each authorized for Plan's hidden heading, hero's regression test and the page-save revision race.
- AT-02: KB-01, KB-16 and KB-31 architecture implementation is approved. Prepare their PRs and document every schema change in DECISIONS; Amit supplies the convex-arch labels himself before any label-gated merge.
- AT-03: implement a small Vercel search service with a maximum $10/month hosting budget. Default Together and DeepInfra usage is authorized. No production release or manual deployment is authorized by this run.
- AT-23: Lane 2 owns chat research and cancellation. Implement use-the-web, think-hard and cancel; protected PRs #1193 and #1198 remain untouched.
- AT-24: default requested model is GLM 5.3 Flash with medium reasoning, escalating to high when needed. Think hard requests GLM 5.3 (not Flash), high reasoning, maximum ten minutes. Model identifiers come from Convex settings. Verify provider support; do not invent unavailable identifiers or substitute silently.
- AT-25: Resend magic-link email is the only sign-in method. No free plan; every plan starts with a $1 trial. Beta requests require Amit's approval; approved and existing testers receive Max free. RevenueCat/provider identifiers remain pending and checkout stays OFF.
- Hebrew voice: imperfect phonetic Hebrew is acceptable; native review is later. A researched Hebrew crisis keyword list must stay behind a flag and its live voice crisis path stays OFF until Amit's clinical review.
- Executor: implement an Integrations screen and server connection behind a flag using the documented MCP endpoint. Environment connection setup remains recorded once below if unavailable.
- New authorized kitchen-kb tickets: researched Hebrew crisis phrases; Deepgram Voice Agent voice-to-voice with GLM brain (key already in Convex; no value access); and a no-spend comparison of Deepgram, Inworld, ElevenLabs and open-weight voice options in docs/research/voice.md.
- Preserve both lanes, maximum four parallel worktrees, one draft PR per ticket, disjoint writers, green CI plus addressed CodeRabbit and all guards before integration merge. No production, protected-PR edits, secrets or spending beyond the stated authorizations.

## AT — Remaining owner actions, 22 October 2026

The approvals above are applied. This is the current list; the old numbered ledger below is historical.

1. **Architecture labels:** add `convex-arch` to KB-01 #1262 and the eventual KB-16/KB-31 PRs when their dependencies and guards are ready. Preparation is already authorized.
2. **Shared harness retry boundary:** the one additional AT-21 candidate `be1fec2` in #1203 failed 4 focused cases plus 1 error after the Linux process-tree optimization. It is pushed and frozen. A further scoped source correction requires another explicit exception to AGENTS' attempt limit; checks remain unchanged.
3. **Model deployment settings:** configure verified DeepInfra serving identifiers for `TEMPO_AI_MODEL` (GLM 5.3 Flash) and `TEMPO_AI_THINK_HARD_MODEL` (GLM 5.3), distinct as requested. #1260 reads settings and never substitutes a hard-coded model. No values are requested in public.
4. **Search setup:** once #1259 and its Convex adapter pass, provide a supported SearXNG upstream plus dedicated server credential through the existing configurator, and verify the Vercel hosting stop at $10/month. The gateway alone proves neither retrieval availability nor a global spend cap. No manual deploy is performed here.
5. **Payment identifiers:** provide RevenueCat/provider product and entitlement identifiers later. All checkout/charge paths stay OFF; ordinary signup and beta approval preparation continue.
6. **Hebrew clinical review:** review the machine-drafted crisis candidates in #1261 and obtain the primary-source grounding that this environment could not fetch. Hebrew crisis matching and live voice crisis routing remain OFF. Imperfect Hebrew pronunciation itself is not a blocker.
7. **Executor environment connection:** use the exact setup step already recorded once under historical item 7 below. The documented endpoint is not reachable here; implementation can continue against its contract.
8. **Before production only:** Hebrew native copy read and real-device accessibility verification. These do not block authorized preparation or preview eligibility.

Historical decision ledger — Superseded entries below are resolved by the dated answers above; only unresolved setup, labels, provider identifiers and clinical review remain owner actions. Decisions recorded below apply from 2026-10-21 (Asia/Jerusalem). The previous twenty-question ledger remains in git history and VALIDATION.md; it is not a pending approval list.

1. AT-21 — Decide whether to authorize one more scoped shared-harness correction in [#1203](https://github.com/Levidavidspublic/tempo-rhythm/pull/1203). Three top-level rounds are consumed: initial implementation, review correction, and OS-exit recovery. On current `2d99c84`, KB-75’s combined proof failed the existing cancellation assertion: the supervisor was killed before supplying the child receipt, so the child signal remains UNKNOWN. Keep every deadline and assertion. The latest CodeRabbit platform finding must also be addressed without its suggested test skips; the child fixtureCleanup signal handler must preserve termination semantics (open finding on #1204). Parent signal propagation is already corrected and verified. AGENTS.md says “After the 3rd failure: stop and report `stuck`”; this run does not authorize itself a fourth round or merge the known failure. Hosted green CI does not erase it.
2. AT-22 — Authorize a history-remediation path for [KB-67 #1197](https://github.com/Levidavidspublic/tempo-rhythm/pull/1197), such as a clean replacement PR. The current file and PR body redact the synthetic fixture UUID, but gitleaks on current `2279764` still flags its addition in commit `7095f66`. It is a generated test receipt, not a credential. A normal follow-up commit cannot remove it from the scan’s history range; shared force-pushes, scope/baseline exceptions and bypassing the scan are not authorized. Preserve the existing review and failure receipts when choosing a replacement path.
3. AT-02 — Supply the owner-only `convex-arch` gate for KB-01, KB-16 and KB-31 after prerequisites are ready. No label is added by this run; these tickets wait.
4. AT-03 — Provide and validate the existing KA-24 search-service capability configuration before KB-16 can enable supported engines. No service or environment change is authorized.
5. AT-04 — Arrange the Hebrew native read and real-device accessibility checks before production. These do not block preview work.
6. Factory configuration — PR #1198 must remain unmerged until Amit sets `FACTORY_PAUSED=true`. This run does not change that setting or merge that PR.
## Parallel lane requests (reported separately)

These requests are preserved from the separate feature lane; they are not additional KB implementation approvals.

7. Executor connection (parallel lane, reported separately) — Add Executor as a remote MCP server for this Codex environment using `https://executor.sh/aa/mcp?search_tools=true`, complete its authentication in the host connection settings, and enable its tools for the task. The environment proxy must allow `executor.sh`; the supplied endpoint currently returns CONNECT 403 and no Executor tool is exposed. Do not paste credentials into an issue or comment. Work continues with available tools.

8. AT-23 — Assign narrow chat research/cancellation ownership after protected #1193 is resolved, while keeping persona #1110, memory #1112 and council #1129 held. The remaining composer and transport implementation overlaps their reserved files; this run does not release them.
9. AT-24 — Approve the actual “think hard” model capability/request and bounded runtime budget before enabling it. Current fast/balanced/deep routes resolve to the same model; selecting a tier alone does not implement stronger reasoning. No new paid call is authorized or made.
10. AT-25 — Confirm the regular-signup entitlement policy, treatment of existing automatic tester/Max grants, and RevenueCat product/entitlement identifiers mapped to the existing catalog. Protected #1193 owns admission files; public pricing #1208 can proceed with checkout off. No new Premium identifier or paid-access promise is invented.
11. Hebrew live voice — Supply the approved Hebrew crisis phrase list before that locale is enabled. Existing English voice remains separate; provider-backed behavior is UNKNOWN under this run’s no-spending rule.

12. AT-27 — Authorize one scoped correction for Plan #1211 after its three focused candidates: restore the existing visually hidden Plan heading required by both EN/HE one-h1 tests, retaining all assertions and deadlines. Hosted Test reports 3,492 pass / 2 fail / 3 todo; both failures are this heading regression. No test is weakened and no fourth source candidate is made without authorization.

13. AT-28 — Authorize one scoped regression-test correction for hero #1210 after its three implementation candidates: assert the desktop examples' initial animation state and stable geometry directly in `tests/e2e/landing-motion.spec.ts`, before awaiting the copy animation. Actual EN/HE supplementary observations pass, but CodeRabbit on `204bb59` retains the committed-test gap. Preserve every existing case, assertion and deadline; no product change or fourth source/test candidate is made without authorization.

14. AT-29 — Authorize one scoped page-save correction in draft [#1250](https://github.com/Levidavidspublic/tempo-rhythm/pull/1250) after three source candidates: make dirty-field clearing revision-owned and add a deferred A → B → A regression. Source inspection and actual mounted-editor comparison find the race in both baseline and current `4d183cd`: final typed A, submitted [A, B], stored B. Both scratch runs exit 0 because they assert defect reproduction; this is not acceptance success. Evidence-only `7c59ad1` preserves the logs. It limits the promised newer-draft guarantee, so completion/merge is blocked. Preserve existing 30 cases, assertions and deadlines. The first two source designs' distinct outgoing-write/reopen review failures remain recorded.

The retry boundary comes from [AGENTS.md — Failing and stuck](https://github.com/Levidavidspublic/tempo-rhythm/blob/integration/AGENTS.md): “A ticket gets 3 attempts in total, including review-fix rounds” and “Don't make a 4th attempt.” The feature requests above ask only for the named additional correction; no general exception is inferred.

WALK — Applicability correction: the earlier extra label hold for feature #1246 was lead-inferred, not an owner requirement. Amit explicitly authorized payment-provider wiring behind an OFF flag; #1246 is a scoped data ticket. AGENTS rule 4 and the unchanged scope-guard require the architecture exception for component/backend edits, not this data ticket. KB-01/16/31 retain their explicit owner gates. All payment validation, review and repository guards remain required; activation remains separate.

## Amit's answers — 2026-10-21

- AT-01: Keep #1110, #1112 and #1129 held. Preserve their reserved files and work around them; do not release them.
- AT-02 and AT-03: Not given. KB-01, KB-16 and KB-31 wait. No `convex-arch` label, search-service or environment changes.
- AT-04: Hebrew native read and real-device verification happen before production and do not block preview work.
- AT-05–AT-20: Authorized. First create one shared test-harness fix ticket and draft PR: isolate Bun fixture builds to fix hosted scheduler/index.js EISDIR; bound and cancel the isolated child, stream phase evidence, reap owned server/browser/process groups and report authoritative exit; wait on real committed focus/onReady/settled-transition signals. Preserve every case, assertion, timeout and deadline; never weaken, skip or delete a test.
- After that shared fix, rerun KB-03 #1162, KB-05 #1149, KB-06 #1151, KB-45 #1163, KB-66 (reopen #1165 if necessary), KB-67 #1197, KB-75 #1179, KB-77 #1186 and KB-78 #1190 on top of it.
- Then one additional scoped pass each: KB-76 #1183 completion/expiry layout effects and replacement-toast regression; KB-02 #1160 rejected-edit reset and accurate per-case child reporting; KB-09 #1150 separate logical gallery state and literal accessible-title interpolation; KB-61 #1199 preserve descendant and process-group cleanup errors; KB-04 #1147 committed focus/onReady waits; KB-70 #1196 wait for matching row focus; KB-74 #1200 wait for settled geometry. Existing scope, assertions and deadlines stay intact.
- Read and fix the causes for reopened KB-61, KB-66, KB-67, KB-70 and KB-74, linking each corrective PR. Authorization is scoped and does not imply unlimited retries.
- Continue other ready KB work and file the 34 remaining written specifications before implementation, in dependency order, with `kitchen-kb` labels. Dependency-blocked tickets remain blocked.
- Up to four independent ticket worktrees; one branch and draft PR per ticket. Merge only into integration after green current CI, addressed CodeRabbit findings and every repository guard. No production/live changes, deploys, deletes, shared force-pushes, spending or billing changes. Do not touch #1193; never merge #1198 in this run.
