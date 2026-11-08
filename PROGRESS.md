# Tempo Flow — Firebase backend, run 2

Updated: 2026-11-08 (UTC)

## Todo

- [x] PHASE 0 — Confirm google-style parses `.ts` with the JS parser (`Unexpected token` / missing root `tsconfig.json`).
- [x] PHASE 0 — Parser-fix PR opened: https://github.com/Levidavidspublic/tempo-rhythm/pull/1369
- [x] PHASE 0 — #1369 merged to integration (2026-11-08). The printed parser line was not proof: the smoke file is valid JavaScript, and `bunx --cwd /tmp/gts` kept the JS parser (`Unexpected token as` on #1368).
- [ ] PHASE 0 — AT: Division6066 adds `config` on the eslint-cwd follow-up after CI has started on that head SHA. This token cannot add labels (HTTP 403).
- [ ] PHASE 0 — #1365 is in the integration merge queue. #1368 is formatted and throws instead of `process.exit`, but google-style still fails until eslint runs from the repo directory. Re-add `config` on #1368 only after that follow-up is on integration and #1368's checks have been re-run. Then #1366. #1361 still overlaps #1366.
- [ ] PHASE 1 — `docs/backlog/FIREBASE-DATA-MODEL.md` and owner-only rules.
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
- 2026-11-08 later: #1369 merged. #1365 enqueued (UNSTABLE only because merge-gate "2 checks" still counts a cancelled scope-guard on the same SHA; latest scope-guard, config-guard, CI, CodeRabbit, jev-judge, google-style are success). #1368 commit 94fc5f17 formats the scanner with gts prettier and throws instead of `process.exit`. Prettier passed in CI. eslint still reported `Unexpected token as` because `bunx --cwd /tmp/gts` leaves the JS parser in charge. config-guard on that SHA failed: the existing `config` label does not cover the new commit.
- Follow-up: run `/tmp/gts/node_modules/.bin/eslint` with cwd at the workspace, clear the inherited `**/*.d.ts` exclude, and put `as const` on the smoke export so a JS parser fails the job.
