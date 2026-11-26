/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the same checks.
 *
 * A built-in (starter) template's card reads in the app language: its name, description and
 * outline headings come from lib/i18n-groups/starter-templates.ts, keyed by the starter's id,
 * whose English is word for word the catalog's (convex/lib/templateCatalog.ts).
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type StarterTemplate,
  sectionsFromBody,
  STARTER_TEMPLATES,
} from "@/convex/lib/templateCatalog";
import { type Lang, type MessageKey, translate } from "@/lib/i18n";
import { en as starterEn, he as starterHe } from "@/lib/i18n-groups/starter-templates";

let lang: Lang = "en";

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
  "next/link": { ...(await import("next/link")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

mock.module("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const { TemplateCard } = await import("./TemplateCard");
type Model = Parameters<typeof TemplateCard>[0]["template"];

const LATIN = /[A-Za-z]/;
const PREVIEW_LIMIT = 4;

/** What the server's templates.list sends for a starter (convex/templates.ts viewFromStarter). */
function starterView(template: StarterTemplate): Model {
  return {
    templateId: template.templateId,
    source: "starter",
    name: template.name,
    description: template.description,
    periodType: template.periodType,
    sections: sectionsFromBody(template.body),
  };
}

function idOf(template: { templateId: string }): string {
  return template.templateId.slice("starter:".length);
}

// Plain string maps, so a key built from a catalog id can be looked up, and can be missing.
const EN: Readonly<Record<string, string>> = starterEn;
const HE: Readonly<Record<string, string>> = starterHe;
const KEYS = Object.keys(EN);

function headingKeys(id: string): string[] {
  return KEYS.filter((key) => key.startsWith(`st.${id}.h.`));
}

function render(template: Model, as: Lang): string {
  lang = as;
  return renderToStaticMarkup(
    createElement(TemplateCard, {
      template,
      confirming: false,
      deleting: false,
      onAskDelete() {},
      onConfirmDelete() {},
      onCancelDelete() {},
    }) as ReactElement
  );
}

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every piece of text a person sees or hears on the card: text nodes and aria-labels. */
function readable(html: string): string[] {
  const text = html
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map((line) => decode(line).trim())
    .filter(Boolean);
  const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((match) => decode(match[1] ?? ""));
  return [...text, ...labels];
}

/** The opening tag of the element whose whole text is `text`, e.g. `<li dir="auto">`. */
function tagAround(html: string, text: string): string | undefined {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(<[a-z0-9]+\\b[^>]*>)${escaped}</`, "i").exec(html)?.[1];
}

describe("starter-templates copy", () => {
  test("every starter has a name and a description key whose English is the catalog's, word for word", () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThan(0);
    for (const starter of STARTER_TEMPLATES) {
      const id = idOf(starter);
      expect(EN[`st.${id}.name`]).toBe(starter.name);
      expect(EN[`st.${id}.desc`]).toBe(starter.description);
    }
  });

  test("every outline heading the card derives from a starter body has a key with that English", () => {
    for (const starter of STARTER_TEMPLATES) {
      const id = idOf(starter);
      const english = headingKeys(id).map((key) => EN[key]);
      for (const heading of sectionsFromBody(starter.body)) {
        expect({ id, heading, keyed: english.includes(heading) }).toEqual({
          id,
          heading,
          keyed: true,
        });
      }
    }
  });

  test("no key is left over: each belongs to a starter in the catalog and matches its words", () => {
    const words = new Map<string, Set<string>>();
    for (const starter of STARTER_TEMPLATES) {
      words.set(
        idOf(starter),
        new Set([starter.name, starter.description, ...sectionsFromBody(starter.body)])
      );
    }
    for (const key of KEYS) {
      const id = /^st\.([^.]+)\.(name|desc|h\.[A-Za-z0-9]+)$/.exec(key)?.[1];
      expect({ key, inCatalog: Boolean(id && words.get(id)?.has(EN[key])) }).toEqual({
        key,
        inCatalog: true,
      });
    }
  });

  test("the Hebrew copy is all Hebrew and is wired into the app's messages", () => {
    for (const key of KEYS) {
      expect(HE[key].trim().length).toBeGreaterThan(0);
      expect({ key, latin: LATIN.test(HE[key]) }).toEqual({ key, latin: false });
      expect(translate("en", key as MessageKey)).toBe(EN[key]);
      expect(translate("he", key as MessageKey)).toBe(HE[key]);
    }
  });
});

describe("TemplateCard", () => {
  test("a starter card in English reads exactly as the catalog", () => {
    for (const starter of STARTER_TEMPLATES) {
      const html = render(starterView(starter), "en");
      const seen = readable(html);
      expect(seen).toContain(starter.name);
      expect(seen).toContain(starter.description);
      for (const heading of sectionsFromBody(starter.body).slice(0, PREVIEW_LIMIT)) {
        expect(seen).toContain(heading);
      }
      expect(seen).toContain(`Use ${starter.name}`);
      expect(seen).toContain(`${starter.name} sections`);
    }
  });

  test("a starter card in Hebrew has no Latin letters", () => {
    for (const starter of STARTER_TEMPLATES) {
      const id = idOf(starter);
      const html = render(starterView(starter), "he");
      const seen = readable(html);
      const latin = seen.filter((piece) => LATIN.test(piece));
      expect({ id, latin }).toEqual({ id, latin: [] });

      const name = HE[`st.${id}.name`];
      expect(seen).toContain(name);
      expect(seen).toContain(HE[`st.${id}.desc`]);
      expect(seen).toContain(translate("he", "tpl.useName").replace("{name}", name));
      // Copy from a key follows the page's direction; only words shown as written use dir="auto".
      expect(tagAround(html, name)).toBe('<h3 class="tp-card__title">');
    }
  });

  test("a heading without a key, and a starter id without keys, show as written in dir=auto", () => {
    const daily = STARTER_TEMPLATES.find((starter) => starter.templateId === "starter:daily-page");
    if (!daily) throw new Error("no daily starter");
    const extra = render({ ...starterView(daily), sections: ["Intention", "Gratitude"] }, "he");
    expect(readable(extra)).toContain(HE["st.daily-page.h.intention"]);
    expect(tagAround(extra, "Gratitude")).toBe('<li dir="auto">');

    const unknown = render(
      {
        templateId: "starter:not-in-catalog",
        source: "starter",
        name: "Garden log",
        description: "What grew this week.",
        periodType: "none",
        sections: ["Notes"],
      },
      "he"
    );
    expect(tagAround(unknown, "Garden log")).toBe('<h3 class="tp-card__title" dir="auto">');
    expect(tagAround(unknown, "What grew this week.")).toBe('<p class="tp-small" dir="auto">');
    expect(tagAround(unknown, "Notes")).toBe('<li dir="auto">');
  });

  test("a user template shows as written in dir=auto, even with a starter's words", () => {
    const own: Model = {
      templateId: "jd72usertemplate01",
      source: "user",
      name: "Daily page",
      description: "A short outline for one day.",
      periodType: "daily",
      sections: ["Intention", "Notes"],
    };
    for (const as of ["en", "he"] as const) {
      const html = render(own, as);
      expect(tagAround(html, "Daily page")).toBe('<h3 class="tp-card__title" dir="auto">');
      expect(tagAround(html, "A short outline for one day.")).toBe(
        '<p class="tp-small" dir="auto">'
      );
      expect(tagAround(html, "Intention")).toBe('<li dir="auto">');
      expect(tagAround(html, "Notes")).toBe('<li dir="auto">');
      expect(readable(html)).toContain(
        translate(as, "tpl.useName").replace("{name}", "Daily page")
      );
    }
  });
});
