import { describe, expect, test } from "bun:test";
import {
  addLocalDays,
  countLogged,
  daysInclusive,
  detailSummary,
  easiestWeekday,
  fillTemplate,
  formatCountdown,
  lastLocalDays,
  parseLocalDate,
  settlePending,
  splitTemplate,
  toLocalDateKey,
  withPending,
} from "./habits-view";

describe("local days", () => {
  test("keys follow the local calendar day, including just after midnight", () => {
    expect(toLocalDateKey(new Date(2026, 9, 12, 0, 5))).toBe("2026-10-12");
    expect(toLocalDateKey(new Date(2026, 9, 11, 23, 59))).toBe("2026-10-11");
  });

  test("parse rejects malformed and impossible dates", () => {
    expect(parseLocalDate("2026-10-12")?.getDate()).toBe(12);
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(parseLocalDate("12/10/2026")).toBeNull();
  });

  test("adding days crosses months and years", () => {
    expect(addLocalDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysInclusive("2026-09-07", "2026-10-12")).toBe(36);
    expect(daysInclusive("2026-10-12", "2026-10-12")).toBe(1);
    expect(daysInclusive("2026-10-13", "2026-10-12")).toBe(0);
  });

  test("the last 7 days end today, oldest first, Tue 6 to Mon 12 Oct", () => {
    const days = lastLocalDays(new Date(2026, 9, 12, 9));
    expect(days.map((d) => d.localDate)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(days[0]).toMatchObject({ weekday: 2, day: 6, isToday: false });
    expect(days[6]).toMatchObject({ weekday: 1, day: 12, isToday: true });
  });

  test("counts only logged days in the window", () => {
    const days = lastLocalDays(new Date(2026, 9, 12));
    expect(countLogged(days, new Set(["2026-10-06", "2026-10-12", "2026-10-01"]))).toBe(2);
  });
});

describe("habit detail summary", () => {
  test("the easiest weekday needs a clear lead", () => {
    // Three Thursdays and one Monday.
    expect(easiestWeekday(["2026-10-08", "2026-10-01", "2026-09-24", "2026-10-05"])).toBe(4);
    // A tie says nothing.
    expect(easiestWeekday(["2026-10-08", "2026-10-01", "2026-10-05", "2026-09-28"])).toBeNull();
    // Too little to go on.
    expect(easiestWeekday(["2026-10-08", "2026-10-01"])).toBeNull();
  });

  test("counts from the grid start for an older habit", () => {
    const summary = detailSummary({
      gridStartKey: "2026-09-07",
      todayKey: "2026-10-12",
      createdKey: "2026-01-01",
      logged: new Set(["2026-09-10", "2026-10-08", "2026-10-01", "2026-09-24", "2026-08-01"]),
    });
    expect(summary).toEqual({ logged: 4, total: 36, easiestWeekday: 4, todayLogged: false });
  });

  test("a new habit counts from its first day, or an earlier logged day", () => {
    const fresh = detailSummary({
      gridStartKey: "2026-09-07",
      todayKey: "2026-10-12",
      createdKey: "2026-10-10",
      logged: new Set(["2026-10-12"]),
    });
    expect(fresh).toMatchObject({ logged: 1, total: 3, todayLogged: true });
    const backfilled = detailSummary({
      gridStartKey: "2026-09-07",
      todayKey: "2026-10-12",
      createdKey: "2026-10-10",
      logged: new Set(["2026-10-05"]),
    });
    expect(backfilled).toMatchObject({ logged: 1, total: 8 });
  });
});

describe("optimistic toggles", () => {
  test("pending entries clear once the server agrees", () => {
    const pending = new Map([
      ["a", true],
      ["b", false],
    ]);
    const server = new Set(["a", "b"]);
    const next = settlePending(pending, (key) => server.has(key));
    expect([...next.entries()]).toEqual([["b", false]]);
    expect(settlePending(next, (key) => server.has(key))).toBe(next);
  });

  test("pending toggles sit on top of the server's days", () => {
    const shown = withPending(
      ["2026-10-11"],
      new Map([
        ["2026-10-12", true],
        ["2026-10-11", false],
      ])
    );
    expect([...shown]).toEqual(["2026-10-12"]);
  });
});

describe("copy helpers", () => {
  test("templates split around slots and fill plain values", () => {
    expect(splitTemplate("You did it on {n} of the last {total} days.")).toEqual([
      { text: "You did it on " },
      { slot: "n" },
      { text: " of the last " },
      { slot: "total" },
      { text: " days." },
    ]);
    expect(splitTemplate("{n}")).toEqual([{ slot: "n" }]);
    expect(fillTemplate("counts for {day}.", { day: "Monday" })).toBe("counts for Monday.");
    expect(fillTemplate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });

  test("the Undo countdown reads minutes and seconds", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
    expect(formatCountdown(299_001)).toBe("5:00");
    expect(formatCountdown(61_000)).toBe("1:01");
    expect(formatCountdown(-10)).toBe("0:00");
  });
});
