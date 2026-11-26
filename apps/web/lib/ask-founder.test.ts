/**
 * TEMPO-B07-19: /ask-founder is a plain page with one real way to reach Amit, and /daily-note
 * sends people to Today's daily page. Neither shows ScaffoldScreen's developer copy any more.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AskFounderPage from "@/app/(tempo)/ask-founder/page";
import { dirFor, type Lang, type MessageKey, translate } from "@/lib/i18n";

const WEB = join(import.meta.dir, "..");
const ASK_FOUNDER = "app/(tempo)/ask-founder/page.tsx";
const DAILY_NOTE = "app/(bare)/daily-note/page.tsx";
const SCAFFOLD_COPY = ["Reference:", "screens-", "hierarchy validation", "Beta preview", "ScaffoldScreen"];

let lang: Lang = "en";

// bun's mock.module is process-global and other test files mock LocaleProvider too. Keep what is
// registered when these tests start, swap in ours, and put the earlier one back afterwards.
const LOCALE = "@/components/providers/LocaleProvider";
let previous: Record<string, unknown> = {};

beforeAll(async () => {
  previous = { ...(await import(LOCALE)) };
  mock.module(LOCALE, () => ({
    ...previous,
    useLocale: () => ({ lang, dir: dirFor(lang), setLang() {}, t: (key: MessageKey) => translate(lang, key) }),
  }));
});

afterAll(() => {
  mock.module(LOCALE, () => previous);
});

function renderAskFounder(next: Lang): string {
  lang = next;
  return renderToStaticMarkup(createElement(AskFounderPage) as ReactElement);
}

/**
 * Where /daily-note sends each set of search params, from the real route and Next's real
 * `redirect` (it throws an error whose digest is "NEXT_REDIRECT;replace;<url>;307;"). This runs
 * in a child bun: tests/unit/releaseOnboardingGate.test.tsx mocks next/navigation without
 * `redirect` for the whole test process, so the route can't be imported in this one.
 */
function dailyNoteTargets(cases: readonly Record<string, string | string[]>[]): (string | null)[] {
  const script = `
    const { default: Page } = await import(${JSON.stringify(join(WEB, DAILY_NOTE))});
    const targets = [];
    for (const params of ${JSON.stringify(cases)}) {
      try {
        await Page({ searchParams: Promise.resolve(params) });
        targets.push(null);
      } catch (error) {
        targets.push(String(error?.digest).split(";")[2] ?? null);
      }
    }
    console.log(JSON.stringify(targets));
  `;
  const run = spawnSync(process.execPath, ["-e", script], { cwd: WEB, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr || String(run.error));
  return JSON.parse(run.stdout);
}

describe("/ask-founder", () => {
  test("one heading, calm copy and the founder's email address as the only control", () => {
    const html = renderAskFounder("en");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(`>${translate("en", "set.founder.title")}</h1>`);
    for (const key of ["set.founder.sub", "set.founder.mail", "set.founder.mailHelp"] as const) {
      expect(html).toContain(translate("en", key));
    }

    const links = html.match(/<a\b[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    const address = /href="mailto:([^"]+)"/.exec(links[0] ?? "")?.[1];
    expect(address).toBe("amit@tempoflow.app");
    expect(html).toContain(`<span dir="ltr">${address}</span>`);
    // No form and no buttons that do nothing.
    expect(html).not.toMatch(/<(form|button|input|textarea)\b/);
  });

  test("Hebrew shows the Hebrew copy and keeps the address left-to-right", () => {
    const html = renderAskFounder("he");
    expect(html).toContain(`>${translate("he", "set.founder.title")}</h1>`);
    for (const key of ["set.founder.sub", "set.founder.mail", "set.founder.mailHelp"] as const) {
      expect(html).toContain(translate("he", key));
      expect(html).not.toContain(translate("en", key));
    }
    expect(html).toContain('<span dir="ltr">amit@tempoflow.app</span>');
  });

  test("no scaffold copy in either language", () => {
    for (const next of ["en", "he"] as const) {
      const html = renderAskFounder(next);
      for (const words of SCAFFOLD_COPY) expect(html).not.toContain(words);
    }
  });
});

describe("/daily-note", () => {
  test("goes to /today, where today's daily page is drawn, and keeps the query string", () => {
    expect(dailyNoteTargets([{}, { lang: "he" }, { lang: "en", tag: ["a", "b"] }])).toEqual([
      "/today",
      "/today?lang=he",
      "/today?lang=en&tag=a&tag=b",
    ]);
  });
});

describe("route sources", () => {
  test("neither route renders ScaffoldScreen or its reference copy", () => {
    for (const route of [ASK_FOUNDER, DAILY_NOTE]) {
      const source = readFileSync(join(WEB, route), "utf8");
      for (const words of SCAFFOLD_COPY) expect(source).not.toContain(words);
    }
  });
});
