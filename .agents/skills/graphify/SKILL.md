---
name: graphify
description: Query and refresh this repository's local AST knowledge graph through its safe pinned Graphify adapter.
---

# Graphify project adapter

Graphify 0.9.74 is the official installed CLI (PyPI graphifyy); source: https://github.com/Graphify-Labs/graphify/tree/v0.9.74. This repository replaces the generated semantic recipes with a reviewed project adapter. The official CLI remains available. Apache-2.0 license and adaptation credit are under scripts/code-map/third-party/.

Use scripts/code-map/graphify_safe.py. It invokes the official CLI with an argument array, shell=False and GRAPHIFY_NO_AUTO_REFRESH=1. Never interpolate a user URL, path, node label, question or answer into shell/Python source. Write those values with a structured file tool into .code-map-tools/request.json as JSON data.

Supported request operations: query (question), path (source and target), explain (concept), save-result (question and answer). Run the fixed command `python scripts/code-map/graphify_safe.py request`. See references/query.md. Query text remains data, including quotes, spaces and newlines. Leading CLI-option syntax is rejected rather than reinterpreted. The official CLI handles both raw edges and node-link links graphs.

At each loop start, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/code-map/refresh.ps1`. The adapter builds a fresh AST-only snapshot with one worker, validates the graph and manifest, refuses graph shrink/corrupt previous data, and publishes the graph before its manifest with rollback on publication failure. It never merges leftover chunks, semantic caches or previous run output. No force override is offered by this project adapter.

No semantic/media extraction, URL ingestion, transcription, remote database export, dashboard, model inference, user-profile installation or background watcher was verified or authorized by this configuration task. Those capabilities remain in the official CLI, but their workflow needs its own scoped review before use. Do not copy the superseded generated semantic cookbook back into this repository. This boundary does not replace any CI, review, security or scope gate.

For code exploration, first use the graph adapter when a graph exists. If its runtime is unavailable, report UNKNOWN with the error and use direct source exploration; never treat tool failure as passing verification. Repository HARD_RULES and owner approval govern all changes and merges.
