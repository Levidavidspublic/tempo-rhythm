# Code-map tools

Use structural code maps before editing and refresh Graphify at the start of each loop. Repository HARD_RULES and the skills overlay win over upstream examples. No dashboard or localhost UI is part of this setup.

## Graphify

Official source: [Graphify-Labs/graphify v0.9.74](https://github.com/Graphify-Labs/graphify/tree/v0.9.74). The repository's existing Graphify workflow already pins `graphifyy==0.9.74`; this config installs that same release for the local agent harnesses.

Project-scoped installs were executed with `uvx --from graphifyy==0.9.74 graphify install --project --platform codex`, the same command for `agents` and `claude`, and `uvx --from graphifyy==0.9.74 graphify cursor install`. Generated hook commands are pinned through uvx. Existing Claude permissions were preserved. Installer backups are outside the worktree.

Refresh locally with `uvx --from graphifyy==0.9.74 graphify extract . --code-only --no-cluster --max-workers 1`. For later incremental updates use `uvx --from graphifyy==0.9.74 graphify update . --no-cluster`. Query the resulting graph with the same pinned command prefix. Code-only extraction makes no model call; semantic extraction and hosted service trials are not authorized by this setup.

Verification on this config worktree: 9,599 nodes and 23,798 edges after the portable setup/refresh completed. Non-code content and unsupported or potentially sensitive files were excluded by the official extractor. This is a structural map, not a semantic security audit. `graphify-out/` remains ignored and is regenerated locally.

## Understand-Anything

Official source: [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything/tree/b861852dda79273bd9d2e01c3160d42e2df510d2), MIT. Follow its [README installation instructions](https://github.com/Egonex-AI/Understand-Anything/blob/b861852dda79273bd9d2e01c3160d42e2df510d2/README.md#-multi-platform-installation). The repository includes the public template's portable `code-map-tools.json`, `scripts/code-map/setup.ps1`, `scripts/code-map/refresh.ps1` and usage adapter. The generic upstream installer changes the user's profile; this project setup instead keeps the official pinned source and MIT license in ignored `.code-map-tools/` and does not alter the shared plugin cache. User-level plugin activation remains UNKNOWN until checked in that harness.

The actual repo-local command `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/code-map/setup.ps1` completed successfully. It verifies the clean pinned source and MIT license, installs only the official core dependencies with a frozen lockfile and dependency lifecycle scripts disabled, then builds the core package. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/code-map/refresh.ps1` also completed successfully. Use that refresh command at every loop start. No dashboard was started.

Use the official plugin's `skills/understand/scan-project.mjs` with the repository root, an output path under `.understand-anything/intermediate/`, `--exclude-analysis-data`, and exclusions for `convex/**,packages/backend/convex/**,.env*,**/.env*,.git/**,graphify-out/**`. Add `projectRoot` with the repository's absolute path to the scanner output, then pass that file and an output path to `skills/understand/extract-import-map.mjs`.

Verification on this worktree: 1,898 files scanned, 504 files with imports, 1,378 import edges. These deterministic outputs are not a complete semantic knowledge graph. No model inference, dashboard, external embedding, or full `/understand` agent pipeline was run. The intermediate directory remains ignored.

## GitNexus

Skipped. The [official license](https://github.com/abhigyanpatwari/GitNexus/blob/main/LICENSE) is PolyForm Noncommercial 1.0.0. Commercial permission for this product is UNKNOWN. Amit must supply compatible commercial permission before use. No `gitnexus analyze`, `clean`, `wiki` or embedding job was run.

## Skills and remaining limits

The nine tstack skills retain their upstream MIT LICENSE and credit under `.agents/skills/t3dotgg-tstack/`. The template's attributed local adaptations strengthen skill authority and fail-closed PR-watcher readiness. Its 13 regression tests passed here. The real Windows command `python .agents/skills/babysit-pr/scripts/pr-wait --help` failed before startup with `ModuleNotFoundError: No module named 'fcntl'`; the regression test's isolated import shim does not prove Windows monitoring works. Windows monitoring through this helper remains UNKNOWN. Use read-only GitHub statuses, required checks and review threads; a helper exit code never proves merge readiness.

Legacy `batch/*` automation, scope-guard batch recognition, fallback-review jobs and existing `greptile.json` have not been disabled or weakened. Compatibility with the requested lane-loop process is UNKNOWN until separately reconciled and tested. All required checks and owner approval remain mandatory; no loop execution or automatic sync is enabled by these documents.

Product check defects remain separate: [unit-test discovery #1382](https://github.com/Levidavidspublic/tempo-rhythm/issues/1382) and [missing Playwright browser #1383](https://github.com/Levidavidspublic/tempo-rhythm/issues/1383). They are not fixed or bypassed here. Documentation sync is tracked in [#1385](https://github.com/Levidavidspublic/tempo-rhythm/issues/1385).
