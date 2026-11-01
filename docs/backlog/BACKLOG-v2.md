# Tempo Flow — Backlog v2 (ticket standard v2)

Written 1 Nov 2026 · Branch `docs/source-2026-11-01` · Draft PR #1352 into `integration`.

This is the **v2** backlog: every Tempo Flow ticket written to
[`docs/backlog/TICKET-STANDARD.md`](./TICKET-STANDARD.md) (v2, 1 Nov 2026). It supersedes the earlier
thin-format rewrite (`docs/backlog/BACKLOG.md`, tickets TRW-1001…TRW-1232) and the plan
`docs/backlog/REWRITE-PLAN.md`, both marked superseded and kept for history.

The plan, inventory, chunk layout, conflict list and fold-in map live in
[`docs/backlog/REWRITE-PLAN-v2.md`](./REWRITE-PLAN-v2.md). This file holds the ticket text only.

## How to read a ticket
Every ticket carries: `ID`, `Title`, `Stage`, `Pass`, `Depends`, `Folds-in`, then the 11 `AGENTS.md`
fields (`FOR`, `WHEN`, `WHY`, `GOAL`, `SCOPE`, `MUTATES`, `STEPS`, `DONE`, `EVIDENCE`, `DO NOT`,
`REPORT`) plus `SPEC`, `TESTS` (Given/When/Then), `NUMBERS` (range + source, or `UNKNOWN`),
`GATES`, and `OPEN`. The authority for what each field must contain is `TICKET-STANDARD.md`.

Ticket IDs are `TFV2-0001` upward, one per screen / component / backend function-table-endpoint, in
build order. `Pass` 1 = clunky (every state works); `Pass` 2 = matches v3 tokens/motion exactly.

## Chunk progress

| Chunk | Stage | Ticket IDs | Count | Status |
|---|---|---|---|---|
| 1 | MVP · Core (chat-first) | TFV2-0001 … TFV2-0064 | 64 | todo |
| 2 | MVP · Planning surface | TFV2-0065 … TFV2-0148 | 84 | todo |
| 3 | MVP · Coach & memory | TFV2-0149 … TFV2-0232 | 84 | todo |
| 4 | MVP · Modules, jobs, billing, language, polish | TFV2-0233 … TFV2-0316 | 84 | todo |
| 5 | Gen 1 | TFV2-0317 … TFV2-0396 | 80 | todo |
| 6 | Gen 2 (later) | TFV2-0397 … TFV2-0456 | 60 | todo |

<!-- Each chunk's tickets are appended below under a `## Chunk N — …` heading as they are written. -->
