# Local output and remote export boundary

The reviewed project adapter publishes only local graph.json, its corpus-root data and manifest.json. No remote database/export command or dashboard is run. Official CLI capabilities remain available for a separately reviewed workflow.

Never put a Neo4j password in --password or any process argument. If separately authorized, use the supported NEO4J_PASSWORD environment mechanism through the approved dev-vault connector, without printing/storing values. Graphify 0.9.74 does not infer FalkorDB TLS from a rediss URI scheme; do not send credentials to a remote instance without a separately verified encrypted channel. No credential-bearing URI appears in a project command example.
