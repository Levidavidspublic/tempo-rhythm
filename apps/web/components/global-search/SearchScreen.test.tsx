/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * render states: skipped query, grouped links, and "No matches".
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let queryParam = "";
let result: unknown;
const useQueryCalls: unknown[][] = [];

mock.module("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    useQueryCalls.push(args);
    return args[1] === "skip" ? undefined : result;
  },
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams(queryParam ? `q=${queryParam}` : ""),
}));
mock.module("next/link", () => ({
  default: (props: { href: string; children?: unknown }) =>
    createElement("a", { href: props.href }, props.children as never),
}));
mock.module("@/convex/_generated/api", () => ({
  api: { search: { all: "search.all" } },
}));

// The screen reads its copy from the locale context; English, as the app's default.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));

// SearchScreen renders its body once mounted (after hydration); the body is what these
// static renders check.
const { SearchScreenBody } = await import("./SearchScreen");
const render = () => renderToStaticMarkup(createElement(SearchScreenBody));

beforeEach(() => {
  queryParam = "";
  result = undefined;
  useQueryCalls.length = 0;
});

describe("SearchScreen", () => {
  test("skips the query and shows a prompt when empty", () => {
    const html = render();
    expect(useQueryCalls.at(-1)?.[1]).toBe("skip");
    expect(html).toContain("Type to search");
  });

  test("reads ?q= and renders grouped results with links", () => {
    queryParam = "plan";
    result = {
      notes: [{ _id: "n1", title: "Plan note", snippet: "a plan" }],
      tasks: [{ _id: "t1", title: "Plan task", status: "todo" }],
      habits: [],
      goals: [{ _id: "g1", title: "Plan goal" }],
    };
    const html = render();
    expect(useQueryCalls.at(-1)?.[1]).toEqual({ query: "plan" });
    expect(html).toContain('data-group="notes"');
    expect(html).toContain(">Notes</h2>");
    expect(html).toContain("3 results");
    expect(html).toContain('href="/notes/n1"');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('href="/goals"');
    expect(html).not.toContain('data-group="habits"');
  });

  test("shows No matches when every group is empty", () => {
    queryParam = "zzz";
    result = { notes: [], tasks: [], habits: [], goals: [] };
    expect(render()).toContain("No matches");
  });

  test("isolates the typed query in the empty state", () => {
    queryParam = "zzz";
    result = { notes: [], tasks: [], habits: [], goals: [] };
    expect(render()).toContain('No matches for “<bdi dir="auto">zzz</bdi>”.');
  });
});
