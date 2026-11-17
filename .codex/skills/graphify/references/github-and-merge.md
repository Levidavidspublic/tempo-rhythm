# Repository isolation

Repository checkout and PR work use Git/gh under the repository rules. This adapter does not clone remote repositories, infer clone paths from progress output, merge graph snapshots from other checkouts or merge PRs.

Run setup, refresh and query inside each repository's own isolated checkout. Each publishes only its own graphify-out/graph.json. A future multi-repository workflow must validate each clone path separately, keep progress output separate from data and build each graph from its own working directory before any reviewed graph merge. No repeated runs from a shared working directory may overwrite another repository's output.
