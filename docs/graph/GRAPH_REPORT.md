# Graph Report - tempo-rhythm  (2026-10-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 11892 nodes · 25074 edges · 572 communities (494 shown, 78 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 455 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d1a0f69`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update . --no-cluster` after code changes (no API cost).


## God Nodes (most connected - your core abstractions)
1. `useLocale()` - 335 edges
2. `TpIcon()` - 224 edges
3. `requireUser()` - 164 edges
4. `env` - 119 edges
5. `env` - 113 edges
6. `api` - 105 edges
7. `next` - 92 edges
8. `usePrefs()` - 84 edges
9. `MessageKey` - 81 edges
10. `T()` - 75 edges

## Surprising Connections (you probably didn't know these)
- `pageTasks()` --calls--> `parseTempoBlocks()`  [EXTRACTED]
  convex/coach_chat.test.ts → packages/utils/src/blocks.ts
- `tick()` --indirect_call--> `el()`  [INFERRED]
  docs/design/v3/tempo.js → apps/web/components/editor/live-preview.ts
- `@biomejs/biome@2.3.8` --declares--> `@biomejs/biome`  [EXTRACTED]
  apps/mobile/package.json → package.json
- `react-dom@19.2.3` --declares--> `react-dom`  [EXTRACTED]
  packages/ui/package.json → apps/web/package.json

## Import Cycles
- None detected.


_Slim summary of the 2026-10-27 Graphify report (PR #1310). Nothing else is committed: `graph.json` comes from the `graphify-graph` Actions artifact; the full report and wiki pages come from a local rebuild (see README.md)._
