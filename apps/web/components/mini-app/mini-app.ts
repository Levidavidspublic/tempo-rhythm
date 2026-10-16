/**
 * MiniAppFrame helpers (S24, PRD F-46, HARD_RULES §16): the CSP a widget runs under, the srcdoc
 * it gets, its size cap and the only two messages it may send back. Pure and DOM-free.
 */

/** A widget's HTML may be at most 64 KB (UTF-8 bytes). */
export const MINI_APP_MAX_BYTES = 64 * 1024;

export const MINI_APP_MIN_HEIGHT = 80;
export const MINI_APP_MAX_HEIGHT = 800;

/** The iframe sandbox: scripts only. Never same-origin, top navigation, forms or popups. */
export const MINI_APP_SANDBOX = "allow-scripts";

/**
 * Nothing loads from anywhere: no network, no frames, no fonts. Inline script and style run,
 * and images only from data: URLs. `base-uri` and `form-action` are shut as well.
 */
export const MINI_APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

/** The meta tag that carries the CSP; it must come before anything the widget wrote. */
export function miniAppCspMeta(csp: string = MINI_APP_CSP): string {
  const content = csp.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<meta http-equiv="Content-Security-Policy" content="${content}">`;
}

export function htmlByteLength(html: string): number {
  return new TextEncoder().encode(html).length;
}

export function isTooLarge(html: string): boolean {
  return htmlByteLength(html) > MINI_APP_MAX_BYTES;
}

/**
 * The iframe's srcdoc: a doctype, charset and the CSP meta first, then the widget's own HTML
 * (a leading doctype of its own is dropped, since a second one later would be ignored).
 */
export function buildMiniAppSrcdoc(html: string): string {
  const body = html.replace(/^﻿?\s*<!doctype[^>]*>/i, "");
  return `<!doctype html><meta charset="utf-8">${miniAppCspMeta()}${body}`;
}

export function clampHeight(height: number): number {
  return Math.min(MINI_APP_MAX_HEIGHT, Math.max(MINI_APP_MIN_HEIGHT, Math.round(height)));
}

export type MiniAppMessage = { type: "size"; height: number } | { type: "done" };

/**
 * Reads one `message` event. Only the frame's own window counts, and only
 * `{ type: "tempo:size", height }` (clamped to 80-800) or `{ type: "tempo:done" }`; anything
 * else, from anywhere else, is null.
 */
export function readMiniAppMessage(
  event: { source: unknown; data: unknown },
  frameWindow: unknown,
): MiniAppMessage | null {
  if (!frameWindow || event.source !== frameWindow) return null;
  const data = event.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { type, height } = data as { type?: unknown; height?: unknown };
  if (type === "tempo:done") return { type: "done" };
  if (type === "tempo:size" && typeof height === "number" && Number.isFinite(height)) {
    return { type: "size", height: clampHeight(height) };
  }
  return null;
}
