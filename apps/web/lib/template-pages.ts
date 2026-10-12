/**
 * Templates are Markdown with {{tokens}} (v3 OVERNIGHT-RUN.md decision 6). Using one makes an
 * ordinary page at /notes/[id] whose body is the template with today's tokens filled.
 */
import { applyTemplateTokens, dayTokens } from "@/lib/editor/markdown-model";
import type { Lang } from "@/lib/i18n";

export type TemplateScope = "all" | "starter" | "mine";

export type TemplateLike = { source: "starter" | "user"; name: string; description?: string };

/** The templates a scope and a search show, in their listed order. */
export function filterTemplates<T extends TemplateLike>(templates: readonly T[], scope: TemplateScope, query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  return templates.filter((template) => {
    if (scope === "starter" && template.source !== "starter") return false;
    if (scope === "mine" && template.source !== "user") return false;
    if (!q) return true;
    return `${template.name} ${template.description ?? ""}`.toLocaleLowerCase().includes(q);
  });
}

/** Page titles are capped like other titles the app writes. */
const TITLE_MAX = 200;

/**
 * The new page made from a template on `isoDate` (the person's local day): the typed title, or
 * the template's name; the body with date tokens filled. Unknown tokens stay as typed, and tokens
 * inside Tempo blocks are never touched.
 */
export function templatePageDraft(
  template: { name: string; body: string },
  options: { title: string; isoDate: string; lang?: Lang },
): { title: string; body: string } {
  const tokens = dayTokens(options.isoDate, options.lang ?? "en");
  const typed = options.title.replace(/\s+/g, " ").trim();
  const title = (typed || template.name.trim() || tokens.title || options.isoDate).slice(0, TITLE_MAX);
  return { title, body: applyTemplateTokens(template.body, tokens) };
}
