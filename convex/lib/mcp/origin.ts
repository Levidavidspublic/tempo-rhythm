/**
 * Origin check for the MCP endpoint (DNS-rebinding guard from the Streamable HTTP spec).
 * Non-browser MCP clients send no Origin header: those pass. A browser Origin must be
 * localhost or listed in the Convex env var TEMPO_MCP_ALLOWED_ORIGINS (comma separated).
 */
export function parseOriginList(raw: string | undefined | null): string[] {
	return (raw ?? "")
		.split(/[,\s]+/)
		.map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
		.filter(Boolean);
}

export function isOriginAllowed(
	origin: string | null,
	allowed: string[],
): boolean {
	if (origin === null || origin === "") return true;
	const normalized = origin.trim().replace(/\/+$/, "").toLowerCase();
	if (allowed.includes(normalized)) return true;
	try {
		const host = new URL(normalized).hostname;
		return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
	} catch {
		return false;
	}
}
