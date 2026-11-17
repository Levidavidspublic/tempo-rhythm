# Fresh AST snapshots

Use `python scripts/code-map/graphify_safe.py refresh`, or scripts/code-map/refresh.ps1 for Graphify plus the Understand-Anything inventory/import map. The official pinned CLI extracts code locally with --code-only --no-cluster --max-workers 1 into a unique .code-map-tools/runs/ directory.

Only that run's validated graph.json, saved corpus root and manifest.json are eligible for publication. There is no semantic chunk glob, cached/new semantic merge or stale deletion-only extraction reuse. A smaller replacement graph is refused by the project adapter, matching the pinned upstream shrink guard; malformed previous graphs are also preserved. No force retry is advertised. Keep the error and obtain a separate reviewed recovery decision.

Graph publication precedes manifest publication. A command, validation or publication failure leaves the prior graph/manifest intact; immutable run output and backups remain for investigation. A full fresh extraction handles source changes instead of marking hashes current before persistence. Tests cover stale run isolation and injected publication failure.
