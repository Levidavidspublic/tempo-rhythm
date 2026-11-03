/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * new-task Project field (it starts empty, says it's optional, and a blank
 * field gives a task no project), the row editor's Enter and Escape rules, and
 * the Undo toast a delete shows.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang } from "@/lib/i18n";
import type { TaskViewRecord } from "@/lib/task-view-filters";

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "next/link": { ...(await import("next/link")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

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
      restore: "tasks.restore",
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

const { TaskViewsScreen, deletedTaskToast, projectForCreate, restoreLocalTask } = await import(
  "./TaskViewsScreen"
);
const { TaskRowEditor, isEditorEnter, shouldCancelOnEscape, shouldSaveOnEnter } = await import(
  "./TaskRowEditor"
);
const { UNDO_WINDOW_MS, UndoToast } = await import("@/components/goals/shared");

const screenSource = readFileSync(join(import.meta.dir, "TaskViewsScreen.tsx"), "utf8");

/** A keydown as the editor reads it. */
function key(name: string, extra: { isComposing?: boolean; keyCode?: number } = {}) {
  return { key: name, isComposing: false, ...extra };
}

/** The Undo toast a delete shows, as rendered in the given language. */
function deletedToastHtml(language: Lang): string {
  lang = language;
  const toast = deletedTaskToast(
    translate(language, "tasks.deleted"),
    Date.now() + UNDO_WINDOW_MS,
    async () => {}
  );
  const html = renderToStaticMarkup(createElement(UndoToast, { toast, onClose() {} }));
  lang = "en";
  return html;
}

const editedTask: TaskViewRecord = {
  id: "task-1",
  title: "Water the plants",
  status: "todo",
  priority: "medium",
  energy: "low",
  updatedAt: 0,
};

function editorHtml(): string {
  return renderToStaticMarkup(
    createElement(TaskRowEditor, {
      task: editedTask,
      disabled: false,
      onSave() {},
      onCancel() {},
    })
  );
}

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

describe("row editor keys", () => {
  test("Enter saves from a one-line field and from a select", () => {
    expect(shouldSaveOnEnter(key("Enter"), "line")).toBe(true);
    expect(shouldSaveOnEnter(key("Enter"), "select")).toBe(true);
  });

  test("Enter in the new-step field adds the step and never saves", () => {
    expect(shouldSaveOnEnter(key("Enter"), "step")).toBe(false);
    expect(isEditorEnter(key("Enter"))).toBe(true);
  });

  test("an Enter that ends an IME composition does nothing, Safari's keyCode 229 included", () => {
    for (const composing of [key("Enter", { isComposing: true }), key("Enter", { keyCode: 229 })]) {
      expect(shouldSaveOnEnter(composing, "line")).toBe(false);
      expect(shouldSaveOnEnter(composing, "select")).toBe(false);
      expect(isEditorEnter(composing)).toBe(false);
    }
  });

  test("other keys do not save", () => {
    for (const name of ["a", "Tab", " ", "Escape", "ArrowDown"]) {
      expect(shouldSaveOnEnter(key(name), "line")).toBe(false);
    }
  });

  test("Escape cancels, but not while an IME is composing", () => {
    expect(shouldCancelOnEscape(key("Escape"))).toBe(true);
    expect(shouldCancelOnEscape(key("Escape", { isComposing: true }))).toBe(false);
    expect(shouldCancelOnEscape(key("Escape", { keyCode: 229 }))).toBe(false);
    expect(shouldCancelOnEscape(key("Enter"))).toBe(false);
  });

  test("the editor has Save task and Cancel, in English and Hebrew", () => {
    lang = "en";
    const en = editorHtml();
    expect(en).toContain(">Save task</button>");
    expect(en).toMatch(/<button type="button" class="tp-btn tp-btn--ghost">Cancel<\/button>/);
    lang = "he";
    const he = editorHtml();
    expect(he).toContain(">שמירת המשימה</button>");
    expect(he).toContain(">ביטול</button>");
    lang = "en";
  });

  test("the editor is still not a form, and its Escape is taken before the shell's", () => {
    expect(editorHtml()).not.toContain("<form");
    const editorSource = readFileSync(join(import.meta.dir, "TaskRowEditor.tsx"), "utf8");
    expect(editorSource).toMatch(
      /if \(!shouldCancelOnEscape\(editorKey\(event\)\)\) return;[\s\S]*?event\.preventDefault\(\);\s*onCancel\(\);/
    );
  });
});

describe("delete Undo", () => {
  test("the toast lasts until the server's undoUntilMs and undoes through its callback", async () => {
    let undone = 0;
    const toast = deletedTaskToast("Task deleted", 1_700_000_300_000, async () => {
      undone += 1;
    });
    expect(toast.title).toBe("Task deleted");
    expect(toast.undoUntilMs).toBe(1_700_000_300_000);
    await toast.onUndo?.();
    expect(undone).toBe(1);
  });

  test("the screen undoes with tasks.restore and shows one toast at a time", () => {
    expect(screenSource).toContain("useMutation(api.tasks.restore)");
    expect(screenSource).toContain("const { undoUntilMs } = await removeTask({ taskId });");
    expect(screenSource.match(/<UndoToast\b/g)?.length).toBe(1);
    expect(screenSource).toContain("key={toast.id}");
  });

  test("the toast is announced and reads in English", () => {
    const html = deletedToastHtml("en");
    expect(html).toContain("<output");
    expect(html).toContain("Task deleted");
    expect(html).toContain("You can undo for");
    expect(html).toContain("5:00");
    expect(html).toContain("<span>Undo</span>");
    expect(html).toContain('aria-label="Dismiss"');
  });

  test("the toast reads in Hebrew", () => {
    const html = deletedToastHtml("he");
    expect(html).toContain("<output");
    expect(html).toContain("המשימה נמחקה");
    expect(html).toContain("אפשר לבטל עוד");
    expect(html).toContain("<span>ביטול</span>");
    expect(html).toContain('aria-label="סגירה"');
  });

  test("local Undo puts the task back where it was, and only once", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const c = { id: "c" };
    expect(restoreLocalTask([a, c], b, 1)).toEqual([a, b, c]);
    expect(restoreLocalTask([a, c], b, 0)).toEqual([b, a, c]);
    expect(restoreLocalTask([a], c, 5)).toEqual([a, c]);
    const already = [a, b, c];
    expect(restoreLocalTask(already, b, 1)).toBe(already);
  });
});
