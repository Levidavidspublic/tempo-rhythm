@AGENTS.md

## Claude-only
- To plan a new product, change scope, edit the six docs or update tickets, use the `software-factory` skill. Closing a build ticket doesn't need it: AGENTS.md is enough.
- Claude's enforcement lives in `.claude/settings.json` (`permissions.deny`) and PreToolUse hooks, as listed in `factory/SLOTS.md` → Enforcement. This file only explains the rules.
- Subagents: at most one file-editing subagent per ticket. Read-only subagents (search, code map) are fine.
