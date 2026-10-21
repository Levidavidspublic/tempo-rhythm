/**
 * The daily page for a local date (OVERNIGHT-RUN.md decision 6), made the way the web makes it
 * (apps/web/lib/period-pages.ts `periodPageDraft`): a page-meta block that says what the page is
 * (`notes.ensurePeriodPage` checks it), then the starter template's prose with {{tokens}} filled.
 * Pure: no React Native imports.
 */
import { splitTempoFences } from "./markdown";
import type { Lang } from "./i18n";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A block id the codec accepts: `blk_` + 10 time characters + 16 random ones (Crockford base 32). */
export function newBlockId(now: number = Date.now(), random: () => number = Math.random): string {
  let time = "";
  let t = Math.max(0, Math.floor(now));
  for (let i = 0; i < 10; i += 1) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i += 1) rand += CROCKFORD[Math.floor(random() * 32) % 32];
  return `blk_${time}${rand}`;
}

/** The page-meta fence that marks a body as the daily page for `iso`. */
export function dailyPageMeta(iso: string, now: number = Date.now(), random: () => number = Math.random): string {
  const block = { id: newBlockId(now, random), v: 1, type: "page-meta", data: { pageType: "daily", date: iso, tags: [] } };
  return `\`\`\`json tempo\n${JSON.stringify(block)}\n\`\`\`\n`;
}

/** Token values for a day: {{date}}, {{weekday}}, {{day}}, {{title}}. */
export function dayTokens(iso: string, lang: Lang): Record<string, string> {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
  const long = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  return { date: iso, weekday, day: long, title: `${weekday}, ${long}` };
}

/** Drops the template's own top heading: the page title already names the day. */
function withoutTopHeading(body: string): string {
  const m = /^(?:[ \t]*\n)*# [^\n]*(?:\n|$)(?:[ \t]*\n)?/.exec(body);
  return m ? body.slice(m[0].length) : body;
}

/** The template's own page-meta and template blocks describe the template, not the new page. */
function withoutTemplateBlocks(body: string): string {
  return splitTempoFences(body)
    .filter((s) => !(s.kind === "tempo" && (s.info.type === "page-meta" || s.info.type === "template")))
    .map((s) => s.source)
    .join("");
}

/** Fills known {{tokens}} outside Tempo blocks; unknown ones stay as typed. */
export function applyTokens(text: string, values: Readonly<Record<string, string>>): string {
  return splitTempoFences(text)
    .map((s) =>
      s.kind === "tempo"
        ? s.source
        : s.source.replace(/\{\{\s*([a-zA-Z][\w-]*)\s*\}\}/g, (whole, name: string) =>
            Object.hasOwn(values, name) ? (values[name] as string) : whole,
          ),
    )
    .join("");
}

/** Title and body of a new daily page made from `templateBody`. */
export function dailyPageDraft(
  iso: string,
  templateBody: string,
  lang: Lang,
  now: number = Date.now(),
  random: () => number = Math.random,
): { title: string; body: string } {
  const tokens = dayTokens(iso, lang);
  const prose = applyTokens(withoutTopHeading(withoutTemplateBlocks(templateBody)), tokens);
  return { title: tokens.title ?? iso, body: `${dailyPageMeta(iso, now, random)}${prose}` };
}
