# Tempo Flow — Firebase backend, run 2

Updated: 2026-11-08 (UTC)

## Todo

- [x] PHASE 0 — Confirm google-style parses `.ts` with the JS parser (`Unexpected token` / missing root `tsconfig.json`).
- [ ] PHASE 0 — Parser-fix PR green, labelled `config`, merged.
- [ ] PHASE 0 — Re-run checks on #1365, #1368, #1366. Merge #1368 and #1365, then #1366. Note #1361 only if it conflicts.
- [ ] PHASE 1 — `docs/backlog/FIREBASE-DATA-MODEL.md` and owner-only rules.
- [ ] PHASE 2 — Firebase Auth email-link behind a flag. Record authorized domains and the mail sender.
- [ ] PHASE 3 — Port one area at a time to Firestore / Vercel routes.
- [ ] PHASE 4 — Preview deploy, flag on and flag off.
- [ ] PHASE 5 — `REPORT.md`.

## Checkpoint

- WALK. Branch `cursor/google-style-ts-parser-7959`.
- Cause: gts sets `parserOptions.project` to `./tsconfig.json`. This repo has no root tsconfig, so `@typescript-eslint/parser` does not load.
- Fix: workflow builds a project from `tsconfig.base.json` plus the changed TS files and sets the parser explicitly. Rules unchanged. No files skipped.
- Local proof: parser is `@typescript-eslint/parser`, project `/tmp/gts-lint.tsconfig.json`. `scripts/scan-design-tokens.ts` and `apps/web/app/sign-in/page.tsx` parse. The only error on that pair is the existing `n/no-process-exit` in the scan script, not a parse error.
- #1365 latest real `scope-guard` is success, but merge-gate "2 checks" still fails because GitHub `filter=latest` returns older cancelled runs on the same SHA. Not fixed in this PR.
- #1366 checks are green. Auto-merge job is skipped because `MERGE_GATE_ENABLED` is not true. Merge by hand only after the parser PR is in and checks are re-run.
- #1368 `google-style` fails first on Prettier for `scripts/scan-forbidden-tech.ts`, before eslint. Parser fix does not clear that. Fix formatting on that branch after this workflow is on `integration`.
