# Ingestion and watching

This configuration provides local AST graph refresh and query operations. It starts no URL ingestion or background watcher. Never place a URL, attribution value or filesystem path into shell/Python source. Unsupported URL/media operations require a separate reviewed workflow using structured data and argv, not literal substitution.

The corpus root is the repository root saved as data by the adapter. It is never changed to raw/ after ingestion. Run each repository's adapter from that repository's own checkout. No interpreter path is read from an untrusted graph file, and paths with spaces remain single argv items.

The upstream CLI's automatic audio dispatch is limited to its supported YouTube hosts; a video extra does not make arbitrary webpage URLs transcribable. Media dispatch, changed-media cache invalidation and transcript hints are unverified outside this AST configuration. A later media workflow must define a missing-analysis fallback and refresh changed recordings rather than reuse stale transcripts.
