# Tempo Flow — Firebase backend, run 2

Updated: 2026-11-09 (UTC)

## Todo

- [x] PHASE 0 — Confirm google-style parses `.ts` with the JS parser (`Unexpected token` / missing root `tsconfig.json`).
- [x] PHASE 0 — Parser-fix PR opened: https://github.com/Levidavidspublic/tempo-rhythm/pull/1369
- [x] PHASE 0 — #1369, #1365, and #1370 are on integration. google-style eslint now runs from the repo directory.
- [ ] PHASE 0 — #1368 head `d64bb4b4` has `config` re-added and config-guard green. Do not merge it: merge-gate "2 checks" (run 42585789312) still fails because it counts older failed and cancelled config-guard and scope-guard runs on that same SHA. Latest config-guard, scope-guard, ci, google-style, and jev-judge are green. Do not push to #1368.
- [x] PHASE 0 — #1366 merged 2026-11-09T08:33:57Z. Queue CI run 42586248245, e2e-preview, and Security succeeded. Preview project only. #1361 still overlaps those files.
- [x] PHASE 1 — Map written: `docs/backlog/FIREBASE-DATA-MODEL.md`. #1371 is on integration. The rules file landed with #1366. The inactive-account replacement is not deployed.
- [ ] PHASE 1 — Map correction: authorization fields, voice leases, and the shared OAuth client document sit under `private/`, on even segment counts. This branch.
- [ ] PHASE 2 — Firebase Auth email-link behind a flag. Record authorized domains and the mail sender.
- [ ] PHASE 3 — Port one area at a time to Firestore / Vercel routes.
- [ ] PHASE 4 — Preview deploy, flag on and flag off.
- [ ] PHASE 5 — `REPORT.md`.

## Checkpoint

- WALK. Branch `cursor/google-style-ts-parser-7959`. PR #1369. Author Division6066.
- google-style run 42497494168 succeeded. Log: `typescript parser: @typescript-eslint/parser`, `ts files: 1` (`scripts/google-style-parser-smoke.ts`). No parse error.
- config-guard failed: `Guarded files need the "config" label.` `gh pr edit --add-label` and the labels REST API both returned 403 `Resource not accessible by integration`.
- AT: Amit (Division6066) adds the `config` label on #1369. A CI run for that head SHA must already exist. Do not push after the label without removing and re-adding it.
- Cause: gts sets `parserOptions.project` to `./tsconfig.json`. This repo has no root tsconfig, so `@typescript-eslint/parser` does not load.
- Fix: workflow builds a project from `tsconfig.base.json` plus the changed TS files and sets the parser explicitly. Rules unchanged. No files skipped.
- Local proof: parser is `@typescript-eslint/parser`, project `/tmp/gts-lint.tsconfig.json`. `scripts/scan-design-tokens.ts` and `apps/web/app/sign-in/page.tsx` parse. The only error on that pair is the existing `n/no-process-exit` in the scan script, not a parse error.
- #1365 latest real `scope-guard` is success, but merge-gate "2 checks" still fails because GitHub `filter=latest` returns older cancelled runs on the same SHA. Not fixed in this PR.
- #1366 checks are green. Auto-merge job is skipped because `MERGE_GATE_ENABLED` is not true. Merge by hand only after the parser PR is in and checks are re-run.
- #1368 `google-style` fails first on Prettier for `scripts/scan-forbidden-tech.ts`, before eslint. Parser fix does not clear that. Fix formatting on that branch after this workflow is on `integration`.
- 2026-11-08 later: #1369, #1365, and #1370 are merged. #1370 google-style run 42501102512 logged the TypeScript parser.
- #1368 is gts-formatted and throws instead of `process.exit`. It is being re-run on top of #1370. The existing `config` label does not cover the new head.
- Phase 1 map is `docs/backlog/FIREBASE-DATA-MODEL.md`. No Convex edits. No rules deploy. `private/` holds ciphertext because an owner allow on `users/{uid}/**` cannot be narrowed by a later deny.
- 2026-11-08 later: #1371 merged (`a35ce0c5`). Queue CI, config-guard, scope-guard, e2e-preview, and Security succeeded.
- Map correction: `role`, `email`, `approvalStatus`, and the other authorization fields are `private/{uid}/account/gate`. Voice leases that feed `usedGlobalMs` are `private/{uid}/voiceLeases/{docId}`. Shared OAuth clients are `private/shared/oauthClients/{docId}` (four segments). `subscriptionStates` and `connectionLimits` are private. The RevenueCat webhook patches `userType` on the gate, not `subscriptionStates`. The owner allow that follows #1366 must itself check the gate (`deletedAt` unset and `isActive != false`). A second allow cannot narrow #1366's rule. This correction does not edit `firestore.rules`.
- 2026-11-09: Division6066 removed and re-added `config` on #1368 for head `d64bb4b4bc0bef9d354e2ccccc53464fddbd5e01`. config-guard run 42585605843 passed, and the later edit re-ran it green at 2026-11-09T08:25:08Z. This token still gets HTTP 403 on labels. Do not push another commit to #1368.
- #1368 "2 checks" run 42585789312 failed only on historical config-guard and scope-guard conclusions (`failure` and `cancelled`) that `filter=latest` still returns. The newest of each name is success. Not merged. The gate script is not changed here.
- #1366 (`131f1f0c`) merged 2026-11-09T08:33:57Z. Every current check on the PR was green, including "2 checks", CodeRabbit, config-guard, and scope-guard. Queue CI run 42586248245 succeeded (Test, Lint, Typecheck, Build, E2E, Scans, notices, ci). e2e-preview run 42586248174 and Security run 42586248163 succeeded. `.firebaserc` names only `tempo-flow-preview-20261106`. Rules are deny-by-default plus a uid check. The inactive-account replacement stays a later preview rules change. No rules deploy from this step.
- AT: close or supersede draft #1361. It overlaps #1366 on `firebase.json`, `.firebaserc`, `firestore.rules`, and `firestore.indexes.json`. #1366 is the copy that matches the preview rules already deployed. This token gets HTTP 403 on close.
- Map correction, same day: `accountIsActive` uses `gate.get('deletedAt', null)` and `gate.get('isActive', true)`, so an active gate that omits those fields is not denied. `connections` and `connectionCalls` are private. `secretsForCall` treats `connected` and `unavailable` as usable, and `confirmStaged` requires `pending_confirm`, so a client write of status would skip confirm.
