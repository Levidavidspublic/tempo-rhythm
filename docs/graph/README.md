# Code graph

The Graphify graph is the Actions artifact `graphify-graph`, produced by `.github/workflows/graphify.yml` on every push to `integration` (graphifyy 0.9.74, local tree-sitter AST, no API key).

The job is pause-gated: a push run skips while `FACTORY_PAUSED_ALL` or `FACTORY_PAUSED` is `true`. While paused, a person can still run it with `force=true` (Actions → Graphify → Run workflow).

`graph.json` is not committed. It is about 7 MB and changes on almost every push.

Download the latest artifact:

```
gh run download -R Levidavidspublic/tempo-rhythm -n graphify-graph -D graphify-out
```

Rebuild locally:

```
uv tool install graphifyy==0.9.74 && graphify update . --no-cluster
```

An older committed snapshot is `docs/graphs/tempo-rhythm.json`.

The ticket writer and the lanes build `graphify-out/graph.json` themselves (AGENTS.md).
