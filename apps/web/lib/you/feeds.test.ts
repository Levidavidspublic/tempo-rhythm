import { describe, expect, test } from "bun:test";
import { activityActionKey, firstRows, groupByDay, splitByToday } from "./feeds";
import { daysBefore, deriveScreenState, fill, formatCountdown, localDayStart } from "./screenState";

const at = (day: number, hour = 9) => new Date(2026, 9, day, hour).getTime();
const today = localDayStart(at(12));

describe("groupByDay", () => {
  const rows = [
    { id: "a", occurredAt: at(12, 8) },
    { id: "b", occurredAt: at(12, 10) },
    { id: "c", occurredAt: at(11, 19) },
    { id: "d", occurredAt: at(6, 12) },
    { id: "e", occurredAt: at(5, 12) },
  ];

  test("newest first, one group per local day, last seven days only", () => {
    const groups = groupByDay(rows, today);
    expect(groups.map((g) => [g.daysAgo, g.items.map((i) => i.id)])).toEqual([
      [0, ["b", "a"]],
      [1, ["c"]],
      [6, ["d"]],
    ]);
    expect(groups[1]?.dayStartMs).toBe(new Date(2026, 9, 11).getTime());
  });

  test("a row stamped later today still counts as today", () => {
    expect(groupByDay([{ occurredAt: at(13, 1) }], today)[0]?.daysAgo).toBe(0);
  });

  test("firstRows keeps the headings of the rows that show", () => {
    const limited = firstRows(groupByDay(rows, today), 2);
    expect(limited.shown).toBe(2);
    expect(limited.total).toBe(4);
    expect(limited.groups.map((g) => g.items.length)).toEqual([2]);
    expect(firstRows(groupByDay(rows, today), 50).shown).toBe(4);
  });
});

describe("activityActionKey", () => {
  test("maps the backend's words to translations and leaves the rest alone", () => {
    expect(activityActionKey("Completed task")).toBe("act.do.taskDone");
    expect(activityActionKey("Focused")).toBe("act.do.focus");
    expect(activityActionKey("toString")).toBeNull();
    expect(activityActionKey("Something new")).toBeNull();
  });
});

describe("splitByToday", () => {
  test("puts today's notices first and the rest under Earlier, newest first", () => {
    const split = splitByToday(
      [
        { id: 1, createdAt: at(10) },
        { id: 2, createdAt: at(12, 7) },
        { id: 3, createdAt: at(12, 10) },
      ],
      today
    );
    expect(split.today.map((n) => n.id)).toEqual([3, 2]);
    expect(split.earlier.map((n) => n.id)).toEqual([1]);
  });
});

describe("screen helpers", () => {
  test("formatCountdown shows minutes and seconds, never below zero", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
    expect(formatCountdown(252_000)).toBe("4:12");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  test("fill replaces known placeholders only", () => {
    expect(fill("{a} of {b} {c}", { a: 3, b: "5" })).toBe("3 of 5 {c}");
  });

  test("daysBefore counts calendar days", () => {
    expect(daysBefore(today, at(12, 23))).toBe(0);
    expect(daysBefore(today, at(11, 0))).toBe(1);
    expect(daysBefore(today, at(1, 0))).toBe(11);
  });

  test("deriveScreenState never leaves a signed-out person on a skeleton", () => {
    const base = {
      isAuthLoading: false,
      isAuthenticated: true,
      profile: {},
      data: [],
      failed: false,
    };
    expect(deriveScreenState(base)).toBe("ready");
    expect(deriveScreenState({ ...base, data: undefined })).toBe("loading");
    expect(deriveScreenState({ ...base, profile: null, data: undefined })).toBe("signed-out");
    expect(deriveScreenState({ ...base, isAuthenticated: false })).toBe("signed-out");
    expect(deriveScreenState({ ...base, isAuthLoading: true })).toBe("loading");
    expect(deriveScreenState({ ...base, data: undefined, failed: true })).toBe("error");
  });
});
