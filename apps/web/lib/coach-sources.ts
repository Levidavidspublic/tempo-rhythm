/**
 * Coach web search on the client (TEMPO-B07-06): the rows of the sources card under a reply that
 * searched the web, its OpenUI program, and the UTC day the settings row counts searches on.
 * Pure: no React, no Convex.
 *
 * A searched reply (#976, `messages.sources`) cites its sources as [1], [2] in the order they are
 * stored. Rows keep those numbers and are never renumbered, so [3] in the reply is [3] on the card.
 * When the reply cites some of them, the card lists those; when it cites none, it lists all.
 * Links are http(s) only and drop any user name or password, the same rule as the server
 * (convex/lib/webSearch.ts); a source with any other link is listed without one. The site label
 * comes from the link itself when there is one, so it always names where the link goes.
 */

/** One web page a searched reply cites, as `messages.sources` stores it. */
export type CoachSource = { title: string; site: string; url: string };

/** One row of the sources card. `numbers` are the reply's [n] for this page (more than one when the same page came back twice). */
export type SourceRow = { numbers: number[]; title: string; site: string; href: string | null };

/** Most sources read from one message: the server stores at most 5. */
export const MAX_SOURCES = 20;
const MAX_TITLE_CHARS = 200;
const MAX_SITE_CHARS = 100;
const MAX_URL_CHARS = 2048;
const DAY_MS = 86_400_000;

/** Text on one line: runs of spaces, tabs and line breaks become one space. */
function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** The link to open for a source, or null: an absolute http(s) URL with a host, credentials removed. */
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_URL_CHARS) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  url.username = "";
  url.password = "";
  return url.href.length <= MAX_URL_CHARS ? url.href : null;
}

/** The site to show: the link's host without "www.", or the stored site when there is no link. */
export function siteLabel(site: unknown, href: string | null): string {
  if (href) {
    try {
      return new URL(href).hostname.replace(/^www\./i, "");
    } catch {
      /* not a URL: fall back to the stored site */
    }
  }
  return oneLine(site).replace(/^www\./i, "").slice(0, MAX_SITE_CHARS);
}

/**
 * The source numbers a reply cites, between 1 and `count`: `[2]`, `[1, 3]`, `[1][2]` and `[1-3]`.
 * Anything else in square brackets is ignored.
 */
export function citedNumbers(reply: string, count: number): Set<number> {
  const cited = new Set<number>();
  for (const match of reply.matchAll(/\[(\d{1,3}(?:\s*[-–,،]\s*\d{1,3})*)\]/g)) {
    for (const part of (match[1] ?? "").split(/\s*[,،]\s*/)) {
      const [first, last] = part.split(/\s*[-–]\s*/);
      const from = Number(first);
      const to = last === undefined ? from : Number(last);
      if (!Number.isInteger(from) || !Number.isInteger(to) || to < from || to - from > MAX_SOURCES) continue;
      for (let n = from; n <= to; n += 1) if (n >= 1 && n <= count) cited.add(n);
    }
  }
  return cited;
}

/**
 * The card's rows for a message's `sources` and its reply text: numbered by their stored order,
 * only the cited ones when the reply cites any, one row per link (a repeated link adds its number
 * to the first row). A source with neither a title nor a site is left out.
 */
export function sourceRows(sources: unknown, reply: unknown = ""): SourceRow[] {
  if (!Array.isArray(sources)) return [];
  const list: unknown[] = sources.slice(0, MAX_SOURCES);
  const cited = citedNumbers(typeof reply === "string" ? reply : "", list.length);
  const rows: SourceRow[] = [];
  const byHref = new Map<string, SourceRow>();
  list.forEach((raw, index) => {
    const n = index + 1;
    if (cited.size > 0 && !cited.has(n)) return;
    if (!raw || typeof raw !== "object") return;
    const source = raw as Record<string, unknown>;
    const href = safeSourceUrl(source.url);
    const earlier = href ? byHref.get(href) : undefined;
    if (earlier) {
      earlier.numbers.push(n);
      return;
    }
    const site = siteLabel(source.site, href);
    const title = oneLine(source.title).slice(0, MAX_TITLE_CHARS) || site;
    if (!title) return;
    const row: SourceRow = { numbers: [n], title, site, href };
    if (href) byHref.set(href, row);
    rows.push(row);
  });
  return rows;
}

/** A row's number as the reply writes it: `[1]`, or `[1, 3]` for a page cited twice. */
export function rowLabel(numbers: readonly number[]): string {
  return `[${numbers.join(", ")}]`;
}

const str = (value: string) => JSON.stringify(value);

/**
 * The OpenUI Lang program that draws these rows with the sources library
 * (components/coach/openui/CoachSourcesLibrary.tsx). Built from the stored sources, never from
 * model text. Strings are JSON string literals, which OpenUI Lang reads back unchanged.
 */
export function sourcesProgram(rows: readonly SourceRow[]): string {
  const names = rows.map((_, index) => `row${index + 1}`);
  const lines = [`root = SourcesCard([${names.join(", ")}])`];
  rows.forEach((row, index) => {
    const href = row.href ? str(row.href) : "null";
    lines.push(`${names[index]} = SourceRow(${str(rowLabel(row.numbers))}, ${str(row.title)}, ${str(row.site)}, ${href})`);
  });
  return lines.join("\n");
}

/** The UTC date of a moment, `YYYY-MM-DD`: the day `coach.webSearchStatus` counts searches on. */
export function utcDayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** When the UTC day after `day` (`YYYY-MM-DD`) starts, in ms: the count starts again then. NaN for a bad day. */
export function nextUtcDayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) + DAY_MS;
}

/** Searches left today, never below 0 or above the limit. */
export function searchesLeft(usedToday: number, dailyLimit: number): number {
  const limit = Math.max(0, Math.floor(dailyLimit));
  return Math.min(limit, Math.max(0, limit - Math.floor(usedToday)));
}
