@AGENTS.md

## Claude-only
- To plan a new product, change scope, edit the six docs or update tickets, use the `software-factory` skill. Closing a build ticket doesn't need it: AGENTS.md is enough.
- Claude's enforcement lives in `.claude/settings.json` (`permissions.deny`) and PreToolUse hooks, as listed in `factory/SLOTS.md` → Enforcement. This file only explains the rules.
- Subagents: at most one file-editing subagent per ticket. Read-only subagents (search, code map) are fine.

## graphify

Use the reviewed local AST adapter in scripts/code-map/graphify_safe.py and its installed project skill. Write query/path/explain values as JSON data to .code-map-tools/request.json, then run the fixed adapter request command. Never interpolate corpus or user text into shell/Python source. Refresh via scripts/code-map/refresh.ps1 at each loop start; it stages a fresh snapshot and publishes graph before manifest with rollback. The pinned official CLI remains available; semantic/media/remote-export workflows are unproved outside this configuration. If the runtime is unavailable, report UNKNOWN and use read-only source exploration while preserving all actual checks. An unavailable required tool still blocks its dependent edits under the C-3 policy.

<!-- TEMPLATE PUBLIC BEGIN -->
Public template rules are generated into the managed block in AGENTS.md. Read that block together with this repository's HARD_RULES.md and factory/SLOTS.md; repository law wins.
<!-- TEMPLATE PUBLIC END -->
