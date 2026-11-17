# graphify
- Use `.claude/skills/graphify/SKILL.md` and the reviewed local AST adapter for `/graphify`.

## graphify

Use the reviewed local AST adapter in scripts/code-map/graphify_safe.py and its installed project skill. Write query/path/explain values as JSON data to .code-map-tools/request.json, then run the fixed adapter request command. Never interpolate corpus or user text into shell/Python source. Refresh via scripts/code-map/refresh.ps1 at each loop start; it stages a fresh snapshot and publishes graph before manifest with rollback. The pinned official CLI remains available; semantic/media/remote-export workflows are unproved outside this configuration. If the runtime is unavailable, report UNKNOWN and use read-only source exploration while preserving all actual checks. An unavailable required tool still blocks its dependent edits under the C-3 policy.
