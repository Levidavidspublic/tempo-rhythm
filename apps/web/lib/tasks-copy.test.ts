import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MESSAGES, type MessageKey } from "./i18n";

const screenSource = readFileSync(
  join(import.meta.dir, "../components/tasks/TaskViewsScreen.tsx"),
  "utf8"
);
const editorSource = readFileSync(
  join(import.meta.dir, "../components/tasks/TaskRowEditor.tsx"),
  "utf8"
);

const taskKeys = (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) =>
  key.startsWith("tasks.")
);

/** Same fill as the components: a function replacer keeps "$" in a title literal. */
function fill(template: string, slot: string, value: string): string {
  return template.replace(`{${slot}}`, () => value);
}

describe("tasks copy (en + he)", () => {
  test("the tasks block exists", () => {
    expect(taskKeys.length).toBeGreaterThan(40);
  });

  test("every tasks key has English and Hebrew, and the Hebrew is Hebrew", () => {
    for (const key of taskKeys) {
      const en = MESSAGES.en[key];
      const he = MESSAGES.he[key];
      expect(en.trim().length).toBeGreaterThan(0);
      expect(he.trim().length).toBeGreaterThan(0);
      expect(he).toMatch(/[֐-׿]/);
      expect(he).not.toBe(en);
    }
  });

  test("Hebrew keeps every {slot} the English has", () => {
    for (const key of taskKeys) {
      const slots = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(slots(MESSAGES.he[key])).toEqual(slots(MESSAGES.en[key]));
    }
  });

  test("English stays exactly as e2e specs and the alpha script match it", () => {
    const en = MESSAGES.en;
    expect(en["editor.taskTitle"]).toBe("Task title");
    expect(en["tasks.add"]).toBe("Add task");
    expect(en["tasks.inbox"]).toBe("Inbox");
    expect(en["tasks.project"]).toBe("Project");
    expect(en["tasks.priority"]).toBe("Priority");
    expect(en["tasks.energy"]).toBe("Energy");
    expect(en["tasks.dueDate"]).toBe("Due date");
    expect(en["tasks.titlePh"]).toBe("One small next step");
    expect(en["tasks.titleNeeded"]).toBe("Type a short task name first.");
    expect(en["tasks.group.priority.high"]).toBe("High priority");
    expect(en["tasks.group.energy.low"]).toBe("Low energy");
    expect(en["tasks.chip.priority.high"]).toBe("high priority");
    expect(en["tasks.editTitle"]).toBe("Edit task title");
    expect(en["tasks.editPriority"]).toBe("Edit priority");
    expect(en["tasks.editEnergy"]).toBe("Edit energy");
    expect(en["tasks.editDue"]).toBe("Edit due date");
    expect(en["tasks.newStep"]).toBe("New checklist step");
    expect(en["tasks.addStep"]).toBe("Add step");
    expect(en["tasks.save"]).toBe("Save task");
    expect(en["tasks.checklistSteps"]).toBe("Checklist steps");
    expect(en["tasks.checklistPh"]).toBe("Unpack the bag\nPut the kettle on");
    expect(en["search.status.done"]).toBe("Done");
  });

  test("row templates fill to today's English names", () => {
    const en = MESSAGES.en;
    const title = "Buy milk";
    expect(fill(en["tasks.markDone"], "title", title)).toBe("Mark Buy milk complete");
    expect(fill(en["tasks.markOpen"], "title", title)).toBe("Mark Buy milk not done");
    expect(fill(en["tasks.editName"], "title", title)).toBe("Edit Buy milk");
    expect(fill(en["tasks.deleteName"], "title", title)).toBe("Delete Buy milk");
    expect(fill(en["tasks.confirmDeleteName"], "title", title)).toBe("Confirm delete Buy milk");
    expect(fill(en["tasks.checklistOf"], "title", title)).toBe("Buy milk checklist");
    expect(fill(en["tasks.removeStep"], "step", "First step")).toBe("Remove step First step");
    expect(fill(en["tasks.count.many"], "n", "3")).toBe("3 tasks in this view.");
  });

  test("Hebrew templates fill with the title in place, and a $ in a title stays literal", () => {
    const he = MESSAGES.he;
    expect(fill(he["tasks.markDone"], "title", "לקנות חלב")).toBe("סימון המשימה לקנות חלב כבוצעה");
    expect(fill(he["tasks.deleteName"], "title", "לקנות חלב")).toBe("מחיקת לקנות חלב");
    expect(fill(he["tasks.count.many"], "n", "3")).toBe("3 משימות בתצוגה הזו.");
    expect(fill(MESSAGES.en["tasks.editName"], "title", "Pay $& rent")).toBe("Edit Pay $& rent");
  });

  test("the steps count splits around one {n} in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      const parts = MESSAGES[lang]["tasks.steps"].split("{n}");
      expect(parts.length).toBe(2);
    }
    const [before, after] = MESSAGES.en["tasks.steps"].split("{n}");
    expect(`${before}0/1${after}`).toBe("0/1 steps");
  });

  test("every tasks key is used by a tasks component, and every key they use exists", () => {
    const sources = screenSource + editorSource;
    for (const key of taskKeys) {
      expect(sources.includes(`"${key}"`)).toBe(true);
    }
    const used = [...sources.matchAll(/t\("([\w.]+)"\)/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) {
      expect(key in MESSAGES.en).toBe(true);
    }
  });
});

describe("TaskViewsScreen create area", () => {
  test("is a form: Enter in a field submits through one guarded create", () => {
    expect(screenSource).toContain('<form\n        className="tp-surface tk-create"');
    expect(screenSource).not.toContain('<section className="tp-surface tk-create"');
    expect(screenSource).toMatch(
      /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*void handleCreate\(\);/
    );
    expect(screenSource).toMatch(
      /type="submit"\s+className="tp-btn tp-btn--primary tk-create__add"/
    );
    // The in-flight guard from #965 stays, and the title is read at submit time.
    expect(screenSource).toContain("if (creatingRef.current || !taskStoreReady) return;");
    expect(screenSource).toContain("const title = titleRef.current.trim();");
    expect(screenSource).toContain('titleRef.current = "";');
  });

  test("an empty title shows the hint, tied to the field, and creates nothing", () => {
    expect(screenSource).toMatch(
      /if \(!title\) \{\s*setShowTitleHint\(true\);\s*titleInputRef\.current\?\.focus\(\);\s*return;/
    );
    expect(screenSource).toContain(
      'aria-describedby={titleHintShown ? "tk-title-hint" : undefined}'
    );
    expect(screenSource).toContain('{t("tasks.titleNeeded")}');
  });

  test("forms never nest: the row editor is not a form", () => {
    expect(editorSource).not.toContain("<form");
    expect(screenSource.match(/<form\b/g)?.length).toBe(1);
  });
});
