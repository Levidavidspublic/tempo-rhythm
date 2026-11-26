import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addAcceptedToToday, addedNotice, nowTaskIds, sortDump } from "./brain-dump-today";
import { MESSAGES, type MessageKey, translate } from "./i18n";

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

describe("addAcceptedToToday", () => {
  const dump = [
    { title: "Reply to Dana", urgency: "now" as const },
    { title: "Groceries", urgency: "soon" as const },
    { title: "Someday: learn the cello", urgency: "later" as const },
  ];

  test("adds every accepted line, and puts only the Now ones on today", async () => {
    const accepted: { title: string; urgency: string }[][] = [];
    const putOnToday: string[] = [];
    const result = await addAcceptedToToday(dump, {
      acceptPlan: async (items) => {
        accepted.push(items);
        return { created: items.length, taskIds: ["t1", "t2", "t3"] };
      },
      putOnToday: async (taskId) => {
        putOnToday.push(taskId);
      },
    });
    expect(accepted).toEqual([dump]);
    // Soon and Later are added without a date: they never reach putOnToday.
    expect(putOnToday).toEqual(["t1"]);
    expect(result).toEqual({ created: 3, onToday: 1 });
  });

  test("no Now lines: nothing goes on today and the plain notice is used", async () => {
    const putOnToday: string[] = [];
    const result = await addAcceptedToToday(dump.slice(1), {
      acceptPlan: async (items) => ({ created: items.length, taskIds: ["t2", "t3"] }),
      putOnToday: async (taskId) => {
        putOnToday.push(taskId);
      },
    });
    expect(putOnToday).toEqual([]);
    expect(result).toEqual({ created: 2, onToday: 0 });
    expect(addedNotice(result.created, result.onToday, (key) => translate("en", key))).toBe("2 added to your tasks");
  });

  test("a Now line that cannot move stays in Tasks and is not counted", async () => {
    const items = [
      { title: "Pay rent", urgency: "now" as const },
      { title: "Call the bank", urgency: "now" as const },
    ];
    const result = await addAcceptedToToday(items, {
      acceptPlan: async () => ({ created: 2, taskIds: ["t1", "t2"] }),
      putOnToday: async (taskId) => {
        if (taskId === "t2") throw new Error("offline");
      },
    });
    expect(result).toEqual({ created: 2, onToday: 1 });
  });

  test("the Now lines are moved at the same time, not one after another", async () => {
    const items = [
      { title: "Pay rent", urgency: "now" as const },
      { title: "Call the bank", urgency: "now" as const },
    ];
    let started = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = addAcceptedToToday(items, {
      acceptPlan: async () => ({ created: 2, taskIds: ["t1", "t2"] }),
      putOnToday: async () => {
        started += 1;
        await gate;
      },
    });
    // Let every queued step run: both moves have started while neither has finished.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(2);
    release();
    expect(await pending).toEqual({ created: 2, onToday: 2 });
  });

  test("when adding fails, nothing is put on today and the error reaches the caller", async () => {
    const putOnToday: string[] = [];
    await expect(
      addAcceptedToToday(dump, {
        acceptPlan: async () => {
          throw new Error("Pick 1 to 6 items to add.");
        },
        putOnToday: async (taskId: string) => {
          putOnToday.push(taskId);
        },
      }),
    ).rejects.toThrow("Pick 1 to 6 items to add.");
    expect(putOnToday).toEqual([]);
  });
});

describe("sortDump", () => {
  test("crisis words get the resources card and never reach the sorter", async () => {
    const sorted: string[] = [];
    const outcome = await sortDump("I want to die", {
      isCrisis: async () => true,
      crisisCard: async () => ({ title: "Help is available" }),
      sort: async (text) => {
        sorted.push(text);
        return { summary: "", priorities: [] };
      },
    });
    expect(outcome).toEqual({ kind: "crisis", card: { title: "Help is available" } });
    expect(sorted).toEqual([]);
  });

  test("any other dump is sorted, and the card is not fetched", async () => {
    let cardFetched = false;
    const outcome = await sortDump("pay rent, call Dana", {
      isCrisis: async () => false,
      crisisCard: async () => {
        cardFetched = true;
        return { title: "Help is available" };
      },
      sort: async (text) => ({ summary: text, priorities: [] }),
    });
    expect(outcome).toEqual({ kind: "plan", plan: { summary: "pay rent, call Dana", priorities: [] } });
    expect(cardFetched).toBe(false);
  });

  test("when the safety check fails, nothing is sorted", async () => {
    let sortedCount = 0;
    await expect(
      sortDump("pay rent", {
        isCrisis: async () => {
          throw new Error("offline");
        },
        crisisCard: async () => ({}),
        sort: async () => {
          sortedCount += 1;
          return {};
        },
      }),
    ).rejects.toThrow("offline");
    expect(sortedCount).toBe(0);
  });
});

describe("Today's brain-dump panel", () => {
  const panel = readFileSync(join(import.meta.dir, "..", "components", "today", "TodayBrainDumpPanel.tsx"), "utf8");
  const todayKeys = (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) => key.startsWith("bd.today."));

  test("goes through the shared helper, so Soon and Later are never dated today", () => {
    expect(panel).toContain("addAcceptedToToday(");
    expect(panel).toContain("sortDump<");
    expect(panel).toContain("addedNotice(");
    // The old path dated every ticked line today.
    expect(panel).not.toContain("createQuick");
  });

  test("starts with nothing accepted, like /brain-dump", () => {
    expect(panel).toContain("useState<number[]>([])");
    expect(panel).not.toMatch(/priorities\.map\(\(_, i\) => i\)/);
  });

  test("links to the full brain dump", () => {
    expect(panel).toContain('href="/brain-dump"');
    expect(translate("en", "bd.today.full")).toBe("Open the full brain dump");
  });

  test("has no hard-coded English on screen: every visible string goes through t()", () => {
    // JSX text right before a closing tag, and text attributes, must not hold Latin words.
    expect(panel.match(/>\s*[A-Za-z][^<>{}]*<\//g)).toBeNull();
    expect(panel.match(/(?:placeholder|aria-label|title|alt)="[^"]*[A-Za-z]/g)).toBeNull();
    expect(panel).not.toContain("planning pass");
  });

  test("its own strings exist in both languages, calm and with no English in Hebrew", () => {
    expect(todayKeys.length).toBeGreaterThan(0);
    for (const key of todayKeys) {
      const en = translate("en", key);
      const he = translate("he", key);
      expect(en.length).toBeGreaterThan(0);
      expect(he).not.toBe(en);
      expect(he).not.toMatch(/[A-Za-z]/);
      expect(`${en} ${he}`).not.toContain("!");
    }
  });
});
