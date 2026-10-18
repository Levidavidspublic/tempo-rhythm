/**
 * One h1 per page (#1045): /plan and /templates/builder each name themselves with exactly one
 * h1, in English and Hebrew, in every state the builder can show (form, copy, loading, not
 * found). Rendered with react-dom/server, like the first paint a screen reader gets.
 *
 * Mocks and isolation: bun's mock.module is process-global. Inside `bun run test`,
 * tests/unit/releaseOnboardingGate.test.tsx registers partial mocks of convex/react,
 * next/navigation and the locale/theme providers before this file runs, and the modules it
 * imports are then linked against those partial mocks. bun cannot add an export to a module
 * that is already linked (a later mock.module with more exports still fails with "Export named
 * 'useConvexAuth' not found"), and the plan's DayTimeline imports useConvexAuth. So:
 *   - in a clean process (this file alone), it installs complete mocks, renders the routes, and
 *     puts back what was registered before in afterAll;
 *   - when it finds those partial mocks, it runs this same file again in a fresh `bun test`
 *     process (where it is clean) and passes only if that run passes.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement, type ReactElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { type Lang, type MessageKey, translate } from "../../apps/web/lib/i18n";

const CLEAN_RUN = "TEMPO_ONE_H1_CLEAN_RUN";

// Key each mock by the path the app's own imports resolve to (these packages live under apps/web).
const webDir = `${process.cwd()}/apps/web`;
const convexReact = Bun.resolveSync("convex/react", webDir);
const navigation = Bun.resolveSync("next/navigation", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const themeProvider = Bun.resolveSync("@/components/providers/ThemeProvider", webDir);
// One export each real module has and the partial mocks lack.
const REAL_EXPORT: Record<string, string> = {
  [convexReact]: "useConvexAuth",
  [navigation]: "usePathname",
  [localeProvider]: "LocaleProvider",
  [themeProvider]: "ThemeProvider",
};
const MOCKED = Object.keys(REAL_EXPORT);

// What is registered now: the real modules, or another file's partial mocks.
const previous: Record<string, Record<string, unknown>> = {};
for (const key of MOCKED) previous[key] = { ...(await import(key)) };
const partial = MOCKED.filter((key) => !((REAL_EXPORT[key] as string) in (previous[key] ?? {})));

if (partial.length > 0 && process.env[CLEAN_RUN] !== "1") {
  test("one h1 per page: /plan and /templates/builder, en and he (run in a clean bun process)", () => {
    const run = Bun.spawnSync([process.execPath, "test", import.meta.path], {
      cwd: process.cwd(),
      env: { ...process.env, [CLEAN_RUN]: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = `${run.stdout.toString()}${run.stderr.toString()}`;
    if (run.exitCode !== 0)
      throw new Error(`The clean run of ${import.meta.path} failed:\n${output}`);
    expect(output).toMatch(/\b[1-9]\d* pass\b/);
    expect(output).toMatch(/\b0 fail\b/);
  }, 120_000);
} else {
  await defineTests();
}

async function defineTests() {
  const { getFunctionName } = await import(Bun.resolveSync("convex/server", webDir));

  type Template = {
    templateId: string;
    source: "starter" | "user";
    name: string;
    description?: string;
    periodType: "daily" | "weekly" | "monthly" | "none";
    body: string;
  };

  let lang: Lang = "en";
  // templates.get: undefined = still loading, null = not found.
  let templateResult: Template | null | undefined;

  const QUERIES: Record<string, () => unknown> = {
    "users:getProfile": () => ({ greetingName: "Sam" }),
    "timeBlocks:listForDate": () => [],
    "calendar_events:listInRange": () => [],
    "templates:get": () => templateResult,
  };

  const noop = async () => null;

  function installModuleMocks() {
    mock.module(convexReact, () => ({
      useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
      useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
        if (args === "skip") return undefined;
        return QUERIES[getFunctionName(ref)]?.();
      },
      useMutation: () => noop,
      useAction: () => noop,
      useConvex: () => ({ query: noop, mutation: noop, action: noop }),
    }));
    mock.module(navigation, () => ({
      useRouter: () => ({
        push() {},
        replace() {},
        back() {},
        forward() {},
        refresh() {},
        prefetch() {},
      }),
      usePathname: () => "/",
      useSearchParams: () => new URLSearchParams(),
      useParams: () => ({}),
    }));
    mock.module(localeProvider, () => ({
      LocaleProvider: ({ children }: { children: unknown }) => children,
      useLocale: () => ({
        lang,
        dir: lang === "he" ? "rtl" : "ltr",
        setLang() {},
        t: (key: MessageKey) => translate(lang, key),
      }),
    }));
    mock.module(themeProvider, () => ({
      ThemeProvider: ({ children }: { children: unknown }) => children,
      useTheme: () => ({
        theme: "light",
        resolvedTheme: "light",
        setTheme() {},
        dyslexia: false,
        setDyslexia() {},
      }),
    }));
  }

  installModuleMocks();
  // The query suffix gives this file its own instances of the two route modules.
  const { default: PlanPage } = await import("../../apps/web/app/(tempo)/plan/page?one-h1");
  const { default: BuilderPage } = await import(
    "../../apps/web/app/(bare)/templates/builder/page?one-h1"
  );

  beforeAll(installModuleMocks);
  afterAll(() => {
    for (const key of MOCKED) mock.module(key, () => previous[key]);
  });

  type Heading = { level: number; className: string; name: string };
  type Rendered = { html: string; found: Heading[] };

  function headings(html: string): Heading[] {
    const found: Heading[] = [];
    for (const match of html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g)) {
      const className = /\bclass="([^"]*)"/.exec(match[2] ?? "")?.[1] ?? "";
      const name = (match[3] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim();
      found.push({ level: Number(match[1]), className, name });
    }
    return found;
  }

  function render(element: ReactElement): Rendered {
    const html = renderToStaticMarkup(element);
    return { html, found: headings(html) };
  }

  async function renderBuilder(params: { id?: string; from?: string }): Promise<Rendered> {
    const element = await BuilderPage({ searchParams: Promise.resolve(params) });
    return render(element as ReactElement);
  }

  function onlyH1(found: Heading[]): Heading {
    const h1s = found.filter((heading) => heading.level === 1);
    expect(h1s).toHaveLength(1);
    return h1s[0] as Heading;
  }

  const daily: Template = {
    templateId: "starter:daily-page",
    source: "starter",
    name: "Daily page",
    periodType: "daily",
    body: "## Intention\nOne line.\n",
  };

  for (const language of ["en", "he"] as const) {
    describe(`one h1 per page (${language})`, () => {
      beforeAll(() => {
        lang = language;
      });

      test("/plan names itself once, visually hidden", () => {
        const { html, found } = render(createElement(PlanPage));
        expect(html).toContain('data-testid="day-timeline"');
        const h1 = onlyH1(found);
        expect(h1.name).toBe(translate(language, "nav.plan"));
        expect(h1.className).toBe("tp-sr-only");
      });

      test("/templates/builder (blank form) names itself once, visually hidden", async () => {
        templateResult = undefined;
        const { html, found } = await renderBuilder({});
        expect(html).toContain('id="template-name"');
        const h1 = onlyH1(found);
        expect(h1.name).toBe(translate(language, "tb.title"));
        expect(h1.className).toBe("tp-sr-only");
      });

      test("/templates/builder?from=<template> (copy form) names itself once", async () => {
        templateResult = daily;
        const { html, found } = await renderBuilder({ from: daily.templateId });
        expect(html).toContain('value="Daily page"');
        expect(onlyH1(found).name).toBe(translate(language, "tb.title"));
      });

      test("/templates/builder while the template loads names itself once", async () => {
        templateResult = undefined;
        const { html, found } = await renderBuilder({ id: "loading" });
        expect(html).toContain('data-component="StateLoading"');
        expect(onlyH1(found).name).toBe(translate(language, "tb.title"));
      });

      test("/templates/builder not found: one h1, and the error title keeps its look as an h2", async () => {
        templateResult = null;
        const { html, found } = await renderBuilder({ id: "missing" });
        expect(html).toContain('data-component="StateError"');
        expect(onlyH1(found).name).toBe(translate(language, "tb.title"));
        const error = found.find((heading) => heading.name === translate(language, "tb.missing"));
        expect(error).toEqual({
          level: 2,
          className: "tp-state__title",
          name: translate(language, "tb.missing"),
        });
      });
    });
  }
}
