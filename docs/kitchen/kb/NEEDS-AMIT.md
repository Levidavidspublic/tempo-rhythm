# Needs Amit

Blocked — These owner actions remain. Decisions recorded below apply from 2026-10-21 (Asia/Jerusalem). The previous twenty-question ledger remains in git history and VALIDATION.md; it is not a pending approval list.

1. AT-21 — Decide whether to authorize one more scoped shared-harness correction in [#1203](https://github.com/Levidavidspublic/tempo-rhythm/pull/1203). Three top-level rounds are consumed: initial implementation, review correction, and OS-exit recovery. On current `2d99c84`, KB-75’s combined proof failed the existing cancellation assertion: the supervisor was killed before supplying the child receipt, so the child signal remains UNKNOWN. Keep every deadline and assertion. The latest CodeRabbit platform finding must also be addressed without its suggested test skips. AGENTS.md says “After the 3rd failure: stop and report `stuck`”; this run does not authorize itself a fourth round or merge the known failure. Hosted green CI does not erase it.
2. AT-02 — Supply the owner-only `convex-arch` gate for KB-01, KB-16 and KB-31 after prerequisites are ready. No label is added by this run; these tickets wait.
3. AT-03 — Provide and validate the existing KA-24 search-service capability configuration before KB-16 can enable supported engines. No service or environment change is authorized.
4. AT-04 — Arrange the Hebrew native read and real-device accessibility checks before production. These do not block preview work.
5. Factory configuration — PR #1198 must remain unmerged until Amit sets `FACTORY_PAUSED=true`. This run does not change that setting or merge that PR.

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
