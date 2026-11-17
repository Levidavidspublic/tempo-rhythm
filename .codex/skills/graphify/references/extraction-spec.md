# Extraction contract

This task uses the pinned official CLI's local code AST extraction only. Graph nodes and edges are structural tool output, not proof of semantic completeness, model analysis, clustering or product correctness. The project adapter does not dispatch semantic workers or load their chunk/cache files.

If semantic extraction is separately introduced, require a unique run identifier, explicit expected current-run chunk paths, schema/run validation, materialization of all-cache-hit results, preservation of inline worker JSON, and graph persistence before manifest promotion. Missing or malformed results must fail closed rather than be silently treated as complete. These requirements are not implemented by claiming the present AST graph is semantic.
