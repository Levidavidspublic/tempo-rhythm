/**
 * "Look in my apps" (TEMPO-B07-07, #989; research doc §4.3): what is kept of an Executor
 * `search` answer, and the coach's templated reply about it.
 *
 * - The shape of Executor's search answer is UNKNOWN (doc §1.3: "paths, one-line descriptions,
 *   input types, apps and linked accounts"; hosted may differ, §7.1 item 11). So it is read
 *   defensively: app names and per-app counts when the answer states them, else the total only,
 *   else nothing (the lookup then reports `unavailable` instead of guessing).
 * - Only `{ apps: [{ name, toolCount }], total }` is kept. No paths, descriptions, inputs or
 *   accounts are stored or shown (doc §4.3 step 6).
 * - App names come from Executor, so they are cut to plain words (letters, digits and a few
 *   marks), one line, at most 40 characters, at most 10 apps.
 * - The reply is Tempo's own words in the person's app language; no model writes it.
 */

export const LOOKUP_LIMITS = {
  /** Longest query sent to Executor. */
  queryChars: 200,
  /** Most apps kept and named. */
  maxApps: 10,
  appNameChars: 40,
} as const;

export type LookupApp = { name: string; toolCount: number };
export type LookupSummary = { apps: LookupApp[]; total: number };

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** The query as sent: one line, at most `queryChars`; null when there is nothing to look for. */
export function lookupQuery(value: unknown): string | null {
  const text = oneLine(value);
  if (!text) return null;
  if (text.length <= LOOKUP_LIMITS.queryChars) return text;
  let end = LOOKUP_LIMITS.queryChars;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return text.slice(0, end).trim();
}

/** An app name as shown: plain words only, one line, at most `appNameChars`; "" when nothing is left. */
export function cleanAppName(value: unknown): string {
  const text = oneLine(value)
    .replace(/[^\p{L}\p{N} .\-_&+'()/]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(text).slice(0, LOOKUP_LIMITS.appNameChars).join("").trim();
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

const NAME_KEYS = ["name", "title", "label", "displayName", "slug", "id"] as const;

function nameOf(value: unknown): string {
  if (typeof value === "string") return cleanAppName(value);
  if (isObj(value)) {
    for (const key of NAME_KEYS) {
      const name = cleanAppName(value[key]);
      if (name) return name;
    }
  }
  return "";
}

/** EXTRAPOLATED field names an item may carry its app under. */
const ITEM_APP_KEYS = ["app", "appName", "app_name", "integration", "source"] as const;
/** EXTRAPOLATED keys a search answer may list its items under. */
const LIST_KEYS = ["items", "results", "tools", "matches", "data"] as const;
const TOTAL_KEYS = ["total", "totalCount", "total_count", "count"] as const;

function appOfItem(item: unknown): string {
  if (!isObj(item)) return "";
  for (const key of ITEM_APP_KEYS) {
    const name = nameOf(item[key]);
    if (name) return name;
  }
  return "";
}

function finish(counts: Map<string, number>, total: number): LookupSummary {
  const apps = [...counts.entries()]
    .map(([name, toolCount]) => ({ name, toolCount }))
    .sort((a, b) => b.toolCount - a.toolCount || a.name.localeCompare(b.name))
    .slice(0, LOOKUP_LIMITS.maxApps);
  return { apps, total };
}

/** A summary from one parsed JSON value, or null when it is not a list of tools Tempo can read. */
function summarizeValue(value: unknown): LookupSummary | null {
  // An answer that already groups by app: `apps: [{ name, toolCount | tools }]`.
  if (isObj(value) && Array.isArray(value.apps)) {
    const counts = new Map<string, number>();
    for (const app of value.apps) {
      const name = nameOf(app);
      if (!name || !isObj(app)) continue;
      const n =
        count(app.toolCount) ??
        count(app.tool_count) ??
        count(app.count) ??
        (Array.isArray(app.tools) ? app.tools.length : null);
      if (n !== null) counts.set(name, (counts.get(name) ?? 0) + n);
    }
    if (counts.size > 0) {
      const summed = [...counts.values()].reduce((a, b) => a + b, 0);
      const stated = TOTAL_KEYS.map((key) => count(value[key])).find((n) => n !== null) ?? null;
      return finish(counts, Math.max(summed, stated ?? 0));
    }
  }

  let items: unknown[] | null = Array.isArray(value) ? value : null;
  let stated: number | null = null;
  if (isObj(value)) {
    for (const key of LIST_KEYS) {
      if (Array.isArray(value[key])) {
        items = value[key] as unknown[];
        break;
      }
    }
    stated = TOTAL_KEYS.map((key) => count(value[key])).find((n) => n !== null) ?? null;
  }
  if (items === null) {
    return stated === null ? null : { apps: [], total: stated };
  }
  const counts = new Map<string, number>();
  for (const item of items) {
    const app = appOfItem(item);
    if (app) counts.set(app, (counts.get(app) ?? 0) + 1);
  }
  return finish(counts, Math.max(items.length, stated ?? 0));
}

/**
 * What Tempo keeps of an Executor `search` result (`tools/call` result object): its structured
 * content if it has any, else the first text block that is JSON. Null when neither can be read.
 */
export function summarizeSearchResult(result: Record<string, unknown>): LookupSummary | null {
  if (result.structuredContent !== undefined) {
    const summary = summarizeValue(result.structuredContent);
    if (summary) return summary;
  }
  const content = Array.isArray(result.content) ? result.content : [];
  for (const block of content) {
    if (!isObj(block) || block.type !== "text" || typeof block.text !== "string") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      continue;
    }
    const summary = summarizeValue(parsed);
    if (summary) return summary;
  }
  return null;
}

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}${and}${items[items.length - 1]}`;
}

/** The coach's templated reply to a lookup, in the person's app language. */
export function lookupReplyText(summary: LookupSummary, locale: "en" | "he"): string {
  if (locale === "he") {
    if (summary.apps.length > 0) {
      const list = summary.apps.map(
        (app) => `${app.name} (${app.toolCount === 1 ? "כלי אחד" : `${app.toolCount} כלים`})`,
      );
      return `דרך Executor יש לי גישה אל ${joinList(list, " ו-")}. אבקש אישור לפני כל שימוש בהם.`;
    }
    if (summary.total > 0) {
      const found = summary.total === 1 ? "כלי אחד מתאים" : `${summary.total} כלים מתאימים`;
      return `Executor מצא ${found}. אבקש אישור לפני כל שימוש בהם.`;
    }
    return "Executor לא מצא שום דבר כזה באפליקציות שלך. אפשר להוסיף אפליקציות ב-Executor ולשאול אותי שוב.";
  }
  if (summary.apps.length > 0) {
    const list = summary.apps.map(
      (app) => `${app.name} (${app.toolCount} ${app.toolCount === 1 ? "tool" : "tools"})`,
    );
    return `Through Executor I can reach ${joinList(list, " and ")}. I'll ask before I use any of them.`;
  }
  if (summary.total > 0) {
    return `Executor found ${summary.total} matching ${summary.total === 1 ? "tool" : "tools"}. I'll ask before I use any of them.`;
  }
  return "Executor didn't find anything like that in your apps. You can add apps in Executor, then ask me again.";
}
