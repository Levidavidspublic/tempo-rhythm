# Hooks and runtime

Project hooks call the fixed Python adapter. Codex's hook emits graph-orientation guidance when a local graph exists; it is advisory and is not a merge/check pass. Claude's existing hook-guard read/search checks are retained through the pinned official CLI with GRAPHIFY_NO_AUTO_REFRESH=1. Existing permissions.deny entries stay intact.

The adapter disables upstream user-scope auto-refresh only in each child process environment. Setup similarly saves/restores the prior process environment value. No global configuration is changed. If Python/uvx/Graphify cannot run, record UNKNOWN and continue independent source exploration while retaining every actual repository gate.
