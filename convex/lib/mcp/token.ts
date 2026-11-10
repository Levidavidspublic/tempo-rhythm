/**
 * Personal MCP tokens (TEMPO-MCP-01).
 *
 * Plaintext format: `tmcp_` + 32 random bytes as base64url. Only the SHA-256 hex
 * of the whole string is stored; the plaintext is returned once, at creation.
 */
export const TOKEN_PREFIX = "tmcp_";
/** First characters kept for display only ("tmcp_Ab3"). */
export const TOKEN_DISPLAY_PREFIX_LENGTH = 8;
export const MAX_ACTIVE_TOKENS_PER_USER = 10;

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return `${TOKEN_PREFIX}${toBase64Url(bytes)}`;
}

export function tokenDisplayPrefix(token: string): string {
	return token.slice(0, TOKEN_DISPLAY_PREFIX_LENGTH);
}

/** SHA-256 hex digest of the plaintext token. */
export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Array.from(new Uint8Array(digest), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}

const TOKEN_SHAPE = /^tmcp_[A-Za-z0-9_-]{43}$/;

/** True when the string looks like a Tempo MCP token (cheap check before hashing). */
export function isTokenShaped(token: string): boolean {
	return TOKEN_SHAPE.test(token);
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function parseBearer(header: string | null | undefined): string | null {
	if (!header) return null;
	const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
	return match ? match[1] : null;
}
