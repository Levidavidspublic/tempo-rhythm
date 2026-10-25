/**
 * Paddle webhook signature check. Docs: https://developer.paddle.com/webhooks/about/signature-verification/
 * Header `Paddle-Signature: ts=<unix>;h1=<hex>`; h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`).
 * Pure Web Crypto (Convex default runtime + tests). Never logs or returns secrets.
 */

const enc = new TextEncoder();

async function hmac(
	algo: "SHA-256" | "SHA-512",
	key: Uint8Array,
	message: string,
): Promise<Uint8Array> {
	const k = await crypto.subtle.importKey(
		"raw",
		key as BufferSource,
		{ name: "HMAC", hash: algo },
		false,
		["sign"],
	);
	return new Uint8Array(
		await crypto.subtle.sign("HMAC", k, enc.encode(message)),
	);
}

function toHex(b: Uint8Array): string {
	return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function toBase64(b: Uint8Array): string {
	let s = "";
	for (const x of b) s += String.fromCharCode(x);
	return btoa(s);
}

function fromBase64(s: string): Uint8Array {
	const bin = atob(s);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const DEFAULT_TOLERANCE_S = 300;

function fresh(tsSeconds: number, nowMs: number, toleranceS: number): boolean {
	return (
		Number.isFinite(tsSeconds) &&
		Math.abs(nowMs / 1000 - tsSeconds) <= toleranceS
	);
}

export async function verifyPaddle(
	rawBody: string,
	header: string | null,
	secret: string,
	nowMs = Date.now(),
	toleranceS = DEFAULT_TOLERANCE_S,
): Promise<boolean> {
	if (!header || !secret) return false;
	const parts = header.split(";").map((p) => p.trim());
	const ts = parts.find((p) => p.startsWith("ts="))?.slice(3);
	const sigs = parts
		.filter((p) => p.startsWith("h1="))
		.map((p) => p.slice(3).toLowerCase());
	if (!ts || sigs.length === 0 || !fresh(Number(ts), nowMs, toleranceS))
		return false;
	const expected = toHex(
		await hmac("SHA-256", enc.encode(secret), `${ts}:${rawBody}`),
	);
	// More than one h1 during secret rotation.
	return sigs.some((s) => safeEqual(expected, s));
}

export async function signPaddle(
	rawBody: string,
	secret: string,
	tsSeconds: number,
): Promise<string> {
	const h1 = toHex(
		await hmac("SHA-256", enc.encode(secret), `${tsSeconds}:${rawBody}`),
	);
	return `ts=${tsSeconds};h1=${h1}`;
}
