@AGENTS.md

## Claude-only
- To plan a new product, change scope, edit the six docs or update tickets, use the `software-factory` skill. Closing a build ticket doesn't need it: AGENTS.md is enough.
- Claude's enforcement lives in `.claude/settings.json` (`permissions.deny`) and PreToolUse hooks, as listed in `factory/SLOTS.md` → Enforcement. This file only explains the rules.
- Subagents: at most one file-editing subagent per ticket. Read-only subagents (search, code map) are fine.

## graphify

Generate the local structural graph at graphify-out/ before relying on it. A successful CLI run and graph.json are the evidence that it exists.

Rules:
- For codebase questions, first run `uvx --from graphifyy==0.9.74 graphify query "<question>"` when graphify-out/graph.json exists. Use `uvx --from graphifyy==0.9.74 graphify path "<A>" "<B>"` for relationships and `uvx --from graphifyy==0.9.74 graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `uvx --from graphifyy==0.9.74 graphify update . --no-cluster` to keep the graph current (AST-only, no API cost).
