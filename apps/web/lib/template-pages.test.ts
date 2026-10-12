import { describe, expect, test } from "bun:test";
import { filterTemplates, templatePageDraft } from "./template-pages";

const templates = [
  { source: "starter" as const, name: "Daily page", description: "Next up, tasks and an energy check-in." },
  { source: "starter" as const, name: "Weekly page" },
  { source: "user" as const, name: "Talk prep", description: "Outline and three slides." },
  { source: "user" as const, name: "רשימת מעבר" },
];

describe("filterTemplates", () => {
  test("scope picks built-in or own templates, in order", () => {
    expect(filterTemplates(templates, "all", "").map((t) => t.name)).toEqual([
      "Daily page",
      "Weekly page",
      "Talk prep",
      "רשימת מעבר",
    ]);
    expect(filterTemplates(templates, "starter", "").map((t) => t.name)).toEqual(["Daily page", "Weekly page"]);
    expect(filterTemplates(templates, "mine", "").map((t) => t.name)).toEqual(["Talk prep", "רשימת מעבר"]);
  });

  test("search matches name or description, any case, Hebrew too", () => {
    expect(filterTemplates(templates, "all", "  PAGE ").map((t) => t.name)).toEqual(["Daily page", "Weekly page"]);
    expect(filterTemplates(templates, "all", "slides").map((t) => t.name)).toEqual(["Talk prep"]);
    expect(filterTemplates(templates, "mine", "מעבר").map((t) => t.name)).toEqual(["רשימת מעבר"]);
    expect(filterTemplates(templates, "starter", "talk")).toEqual([]);
  });
});

describe("templatePageDraft", () => {
  const body = "# {{title}}\n\nDate: {{date}} ({{weekday}})\n\n- [ ] {{unknown}}\n";

  test("fills the day's tokens and keeps unknown ones as typed", () => {
    const draft = templatePageDraft({ name: "Daily page", body }, { title: "", isoDate: "2026-10-13" });
    expect(draft.title).toBe("Daily page");
    expect(draft.body).toBe("# Tuesday, 13 October\n\nDate: 2026-10-13 (Tuesday)\n\n- [ ] {{unknown}}\n");
  });

  test("a typed title wins, with spaces tidied and a length cap", () => {
    expect(templatePageDraft({ name: "Daily page", body }, { title: "  Big   day ", isoDate: "2026-10-13" }).title).toBe(
      "Big day",
    );
    const long = "x".repeat(500);
    expect(templatePageDraft({ name: "n", body: "" }, { title: long, isoDate: "2026-10-13" }).title).toHaveLength(200);
  });

  test("Hebrew tokens", () => {
    const draft = templatePageDraft({ name: "יומי", body: "{{weekday}}" }, { title: "", isoDate: "2026-10-13", lang: "he" });
    expect(draft.body).toBe("יום שלישי");
  });

  test("tokens inside a Tempo block are left alone", () => {
    const fence =
      '```json tempo\n{"v":1,"id":"blk_aaaaaaaaaaaa","type":"task","data":{"title":"{{date}}","status":"later","order":1,"inelastic":false}}\n```\n';
    const draft = templatePageDraft({ name: "n", body: `{{date}}\n\n${fence}` }, { title: "", isoDate: "2026-10-13" });
    expect(draft.body).toBe(`2026-10-13\n\n${fence}`);
  });
});
