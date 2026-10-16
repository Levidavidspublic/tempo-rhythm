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
 *
 * A CSP can't stop the frame navigating itself (`location.href = …`, a clicked link): browsers
 * don't support `navigate-to`, so nothing here relies on it. MiniAppFrame counts the frame's load
 * events instead and takes the frame down on any load after the first (`isNavigationLoad`).
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

/**
 * True for a frame load that isn't the widget's own srcdoc: the first load is the srcdoc, any
 * later one means the widget navigated its frame somewhere else. `loads` counts this load too.
 */
export function isNavigationLoad(loads: number): boolean {
  return loads > 1;
}

/**
 * A stable fingerprint of a widget's code, so an approval holds for this exact HTML only: two
 * independent 53-bit string hashes (cyrb53 with two seeds) plus the length, as text. Not a
 * cryptographic hash; it ties the person's yes to the code they were shown.
 */
export function miniAppFingerprint(html: string): string {
  const hash = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < html.length; i += 1) {
      const ch = html.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  return `w1-${html.length.toString(36)}-${hash(0)}-${hash(0x9e3779b9)}`;
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
