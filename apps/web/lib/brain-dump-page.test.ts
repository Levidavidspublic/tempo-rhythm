import { describe, expect, test } from "bun:test";
import { brainDumpPageBody } from "./brain-dump-page";

const labels = { now: "Now", soon: "Soon", later: "Later" };

describe("brainDumpPageBody", () => {
  const plan = {
    summary: "Three things,\nthen rest.",
    priorities: [
      { title: "Call the bank", reason: "You wrote “card thing”", urgency: "now" as const },
      { title: "Boxes", reason: "", urgency: "later" as const },
      { title: "Slides for Thursday", reason: "Due soon", urgency: "soon" as const },
      { title: "   ", reason: "blank", urgency: "now" as const },
      { title: "Dentist", reason: "Moved to 4", urgency: "now" as const },
    ],
  };

  test("groups by urgency in Now, Soon, Later order with plain checkboxes", () => {
    expect(brainDumpPageBody(plan, { labels })).toBe(
      "Three things, then rest.\n\n## Now\n\n- [ ] Call the bank — You wrote “card thing”\n- [ ] Dentist — Moved to 4\n\n## Soon\n\n- [ ] Slides for Thursday — Due soon\n\n## Later\n\n- [ ] Boxes\n",
    );
  });

  test("set-aside items are left out, and empty groups vanish", () => {
    const body = brainDumpPageBody(plan, { labels, skip: [1, 2] });
    expect(body).not.toContain("## Soon");
    expect(body).not.toContain("## Later");
    expect(body).toContain("- [ ] Dentist");
  });

  test("Hebrew labels; no summary still gives a page", () => {
    const body = brainDumpPageBody(
      { summary: "", priorities: [{ title: "להתקשר לבנק", reason: "", urgency: "now" }] },
      { labels: { now: "עכשיו", soon: "בקרוב", later: "אחר כך" } },
    );
    expect(body).toBe("## עכשיו\n\n- [ ] להתקשר לבנק\n");
  });

  test("an item title with line breaks stays one list line", () => {
    const body = brainDumpPageBody(
      { summary: "s", priorities: [{ title: "a\n# not a heading", reason: "x\ny", urgency: "soon" }] },
      { labels },
    );
    expect(body).toBe("s\n\n## Soon\n\n- [ ] a # not a heading — x y\n");
  });
});
