# Cursor agents (outlines only)

Written 2026-11-05. Nothing here is switched on. Cursor automations bill per use. Amit turns one on, and he sets the dollar cap first. Every cap below is UNKNOWN. Do not invent one.

No label on a GitHub issue may start a factory loop, an agent, or a paid review.

## Ticket builder

- Trigger: Amit asks, or a manual run. Not a schedule.
- Scope: read `docs/product/` and write the next batch into `docs/backlog/`. Do not open GitHub issues.
- Model: a mid-tier model (Grok, DeepSeek, GLM, or Sonnet).
- Dollar cap: UNKNOWN.

## PR fixer

- Trigger: a pull request check fails on a branch Amit named.
- Scope: only the files that ticket already lists in SCOPE and MUTATES. If the fix needs another file, stop.
- Model: mid-tier.
- Dollar cap: UNKNOWN.
- Do not merge.

## Docs updater

- Trigger: Amit says a decision changed.
- Scope: `docs/product/` only. Newest decision wins. Older text stays marked as history.
- Model: mid-tier.
- Dollar cap: UNKNOWN.

## Security check

- Trigger: Amit asks. Not automatic.
- Scope: read-only review of the diff. No edits to `.github/**`, `convex/schema.ts`, `convex/auth*`, or any `.env` file.
- Model: mid-tier.
- Dollar cap: UNKNOWN.

## What already runs without these outlines

The repo already has factory workflows under `.github/workflows/`. This outline does not add to them and does not turn them off. See the CI note in the session report. Changing those files is out of scope.
