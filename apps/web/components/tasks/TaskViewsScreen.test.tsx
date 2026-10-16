/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * new-task Project field: it starts empty, says it's optional, and a blank
 * field gives a task no project.
 */
import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang } from "@/lib/i18n";

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useQuery: () => undefined,
  useMutation: () => async () => null,
}));
mock.module("next/link", () => ({
  default: (props: { href: string; children?: unknown }) =>
    createElement("a", { href: props.href }, props.children as never),
}));
mock.module("@/convex/_generated/api", () => ({
  api: {
    tasks: {
      list: "tasks.list",
      create: "tasks.create",
      createRepeatCfg: "tasks.createRepeatCfg",
      setTaskRepeatCfg: "tasks.setTaskRepeatCfg",
      update: "tasks.update",
      remove: "tasks.remove",
      toggleCompletion: "tasks.toggleCompletion",
    },
  },
}));

let lang: Lang = "en";
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: Parameters<typeof translate>[1]) => translate(lang, key),
  }),
}));

const { TaskViewsScreen, projectForCreate } = await import("./TaskViewsScreen");

/** The new-task form's Project input, as rendered. */
function projectInput(props: Parameters<typeof TaskViewsScreen>[0]): string {
  const html = renderToStaticMarkup(createElement(TaskViewsScreen, props));
  const input = html.match(/<input[^>]*aria-label="(?:Project|פרויקט)"[^>]*>/)?.[0];
  expect(input).toBeDefined();
  return input ?? "";
}

describe("projectForCreate", () => {
  test("a blank or whitespace name gives no project, never an empty string", () => {
    for (const name of ["", "   ", "\t\n"]) {
      const project = projectForCreate(name);
      expect(project).toEqual({});
      expect(project.projectId).toBeUndefined();
      expect(project.projectName).toBeUndefined();
    }
  });

  test("a typed name is kept, trimmed, with its slug as the id", () => {
    expect(projectForCreate("  Garden  ")).toEqual({ projectId: "garden", projectName: "Garden" });
    expect(projectForCreate("Home reset")).toEqual({
      projectId: "home-reset",
      projectName: "Home reset",
    });
  });

  test("a name with no slug-safe letters keeps its name and sends no empty id", () => {
    const project = projectForCreate(" גינה ");
    expect(project.projectName).toBe("גינה");
    expect(project.projectId).toBeUndefined();
  });
});

describe("TaskViewsScreen Project field", () => {
  test("starts empty, with an optional placeholder (en)", () => {
    lang = "en";
    const input = projectInput({ view: "inbox" });
    expect(input).toContain('value=""');
    expect(input).toContain('placeholder="Optional"');
    expect(input).not.toContain("Home reset");
  });

  test("starts empty on Today too, with the Hebrew placeholder (he)", () => {
    lang = "he";
    const input = projectInput({ view: "today" });
    expect(input).toContain('value=""');
    expect(input).toContain('placeholder="לא חובה"');
    lang = "en";
  });

  test("a project view still fills in its own project", () => {
    lang = "en";
    const input = projectInput({ view: "project", projectSlug: "garden-day" });
    expect(input).toContain('value="Garden Day"');
    expect(input).toContain("disabled");
  });
});
