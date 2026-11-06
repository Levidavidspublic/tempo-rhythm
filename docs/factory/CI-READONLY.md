# CI, read only

Read on 2026-11-05. Nothing under `.github/` was edited.

The loop asks for 9 machine checks. All 9 pass, or the change is rejected. Source: [FACTORY-LOOP.md](./FACTORY-LOOP.md) section 2.

| Loop check | Where it lives in this repo | Seen on `integration` `5504fc40` |
|---|---|---|
| Build | `CI` job `build` | CI succeeded, 2026-11-03 |
| Own tests | `CI` jobs `test` and `e2e` | CI succeeded, 2026-11-03. Workflow `e2e-preview` also succeeded |
| Numbers in range | UNKNOWN as its own workflow | Not a named workflow in `.github/workflows` |
| Style | `format-naming`, `google-style` | `format-naming` failed, 2026-11-03. `google-style` was not in the last 15 runs |
| Secret scan | `Security` | succeeded, 2026-11-03 |
| Banned tech | `CI` job `scan` (`scan:forbidden-tech`) | Inside the CI run that succeeded, 2026-11-03 |
| Scope | `scope-guard` | failed, 2026-11-03 |
| Config guard | `config-guard` | succeeded, 2026-11-03 |
| Tests not weakened | UNKNOWN as its own workflow | Not a named workflow |

Judge score, separate from the 9: `jev-judge` succeeded on that commit.

Also succeeded that day: `Graphify`, `Archify`. `release-go` failed on 2026-11-03 and was skipped on 2026-11-05. `Claude` was skipped on 2026-11-05.

## What Cursor can do from here

- Read workflow files.
- Read run conclusions with `gh run list`.
- Say which named check is red.

## What Cursor does not do from this file

- Edit `.github/**`.
- Rerun, cancel, or merge a run.
- Turn on a label that starts a loop, an agent, or a paid review.

A full pass/fail for every workflow file on `5504fc40` is not in the last 15 runs. The missing ones stay UNKNOWN until someone lists that commit's checks again.

## Sources

`.github/workflows/*.yml` names and `ci.yml` job ids, read 2026-11-05. `gh run list` for `integration` at `5504fc40`. [FACTORY-LOOP.md](./FACTORY-LOOP.md).
