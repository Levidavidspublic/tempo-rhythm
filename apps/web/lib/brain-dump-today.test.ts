import { describe, expect, test } from "bun:test";
import { addedNotice, nowTaskIds } from "./brain-dump-today";
import { translate } from "./i18n";

describe("brain dump → Today", () => {
  test("only the Now lines' ids are picked, by position", () => {
    const items = [
      { title: "Reply to Dana", urgency: "now" as const },
      { title: "Groceries", urgency: "soon" as const },
      { title: "Book the dentist", urgency: "now" as const },
      { title: "Tax form", urgency: "later" as const },
    ];
    expect(nowTaskIds(items, ["t1", "t2", "t3", "t4"])).toEqual(["t1", "t3"]);
    expect(nowTaskIds(items.slice(1, 2), ["t2"])).toEqual([]);
    // Fewer ids than items (never expected) picks nothing it can't match.
    expect(nowTaskIds(items, ["t1"])).toEqual(["t1"]);
  });

  test("the notice says the Now ones are on Today only when some are", () => {
    const en = (key: "bd.added" | "bd.addedToday") => translate("en", key);
    expect(addedNotice(3, 2, en)).toBe("3 added to your tasks. The Now ones are on Today.");
    expect(addedNotice(2, 0, en)).toBe("2 added to your tasks");
    const he = (key: "bd.added" | "bd.addedToday") => translate("he", key);
    expect(addedNotice(3, 1, he)).toContain("3");
    expect(addedNotice(3, 1, he)).not.toContain("{n}");
  });
});
