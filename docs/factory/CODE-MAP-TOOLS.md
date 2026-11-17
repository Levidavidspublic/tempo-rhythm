# Code-map tools

Repository HARD_RULES and the completed-loop aggregate contract remain authoritative. Refresh the configured tools at loop start. No dashboard or localhost UI is part of this setup; unavailable required tools block dependent edits.

## Pinned project setup

`code-map-tools.json` pins Graphify `graphifyy==0.9.74` and the MIT Understand-Anything source at `b861852dda79273bd9d2e01c3160d42e2df510d2`. The portable `scripts/code-map/setup.ps1` provisions the official core under ignored `.code-map-tools/`, verifies the source/license and builds the tool with its frozen lockfile and dependency lifecycle scripts disabled. It does not alter user-profile installations or shared plugin caches.

Sources: [Graphify v0.9.74](https://github.com/Graphify-Labs/graphify/tree/v0.9.74), [Understand-Anything pinned README](https://github.com/Egonex-AI/Understand-Anything/blob/b861852dda79273bd9d2e01c3160d42e2df510d2/README.md).

Actual repo-local `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/code-map/setup.ps1` completed successfully. The current worktree's official core is built at the pinned revision. Global/cloud harness activation and semantic graph generation are not proved by this local result.

## Safe Graphify adapter

All three project skill mirrors and their eight references use `scripts/code-map/graphify_safe.py`. Query/path/explain values are JSON data in `.code-map-tools/request.json`; the adapter passes them as separate argv values to the pinned CLI with shell evaluation disabled. Quotes, multiline corpus text and backticks never enter executable shell or Python source. Unknown operations and leading option syntax fail closed.

`scripts/code-map/refresh.ps1` runs local AST extraction without clustering or model inference. Each refresh stages a fresh snapshot and publishes the validated graph before its manifest, with rollback and retained prior artifacts on failure. It never relabels a failed extraction as current or silently replaces a shrinking graph. Existing hook matchers, timeouts, other hooks and all Claude permission denies are retained; only Graphify routing changes to the local adapter. Upstream license, MIT license and notice files are preserved in `scripts/code-map/third-party/`.

The actual pinned CLI smoke on a tiny local source fixture produced three nodes/two edges and answered the short `UI` label through the adapter. The final repo-local refresh also completed: **9,663 nodes and 23,896 edges**. This is structural evidence. No dashboard, semantic inference, remote export, media transcription or database push was run.

## Understand-Anything

The same actual refresh ran the official deterministic scanner and import-map extractor: **1,906 files**, **505 files with imports**, **1,379 import edges**. Environment files, analysis output and the frozen Convex folders are excluded by the scanner command. Outputs remain local under ignored `.understand-anything/intermediate/`; `.ua/intermediate/` is also ignored.

These outputs are an inventory/import map, not the full semantic knowledge graph. The official semantic skill remains a separate subscription-agent task with its own authorization. No model or embedding call was made here. Full cloud-agent availability remains UNKNOWN until verified there.

## Review and guard boundaries

The template's canonical source commit is `a6b20883a3a9dd32cab16360b7a60a48e967f590`; all 45 supplied file hashes and committed blobs match it. Its latest upstream natural CodeRabbit review was rate-limited, so this is source provenance, not upstream approval. This PR requires its own review and all current-head gates.

Local focused checks passed: 16 watcher regressions, 10 adapter regressions, five completed-loop contract tests against the unchanged scope guard, and setup retry/environment-restoration control-flow tests. The mock control-flow tests do not replace the actual CLI and repo-local setup/refresh results above. Python uses four-space/80-column pyink and the unmodified official Google pylintrc; both checks passed.

The watcher still fails real Windows startup with `ModuleNotFoundError: No module named 'fcntl'`. Windows monitoring remains UNKNOWN; the isolated test import shim does not prove startup. Use read-only GitHub checks/review tools and never treat a watcher exit code as merge approval.

Both `batch/**` and `loop/**` PR bases retain all eight existing check workflows. A completed loop links an ordinary aggregate issue with valid type and explicit combined scope under the unchanged guard. There is no guard exemption, config-label substitute, controller activation or automatic merge. All existing pauses remain. Legacy reviewer configuration and merge-gate source remain unchanged; runtime controller compatibility is still UNKNOWN.

## GitNexus and follow-up work

GitNexus was skipped after checking its [PolyForm Noncommercial license](https://github.com/abhigyanpatwari/GitNexus/blob/main/LICENSE). Compatible commercial permission is UNKNOWN. No analyze, clean, wiki or embedding job was run.

Product check defects remain separate: [unit-test discovery #1382](https://github.com/Levidavidspublic/tempo-rhythm/issues/1382) and [missing Playwright browser #1383](https://github.com/Levidavidspublic/tempo-rhythm/issues/1383). No product code or check bypass is included. Documentation sync is tracked in [#1385](https://github.com/Levidavidspublic/tempo-rhythm/issues/1385).
