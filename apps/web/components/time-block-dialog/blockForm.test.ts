import { describe, expect, test } from "bun:test";
import { type BlockFormInput, parseBlockForm, profileGatedArgs } from "./blockForm";

const base: BlockFormInput = {
  localDate: "2026-10-05",
  title: "  Deep work ",
  start: "09:30",
  durationMinutes: 60,
  kind: "focus",
};

describe("parseBlockForm", () => {
  test("accepts a valid block and trims the title", () => {
    const result = parseBlockForm(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Deep work");
      expect(result.value.startMinute).toBe(570);
      expect(result.value.endsAtMs - result.value.startsAtMs).toBe(3_600_000);
    }
  });

  test("rejects bad durations and empty titles", () => {
    for (const durationMinutes of [4, 721, 30.5]) {
      const result = parseBlockForm({ ...base, durationMinutes });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.durationMinutes).toBeDefined();
    }
    const empty = parseBlockForm({ ...base, title: "   " });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors.title).toBeDefined();
  });

  test("rejects bad start times", () => {
    for (const start of ["24:00", "9", "12:60", ""]) {
      const result = parseBlockForm({ ...base, start });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.start).toBeDefined();
    }
  });

  test("rejects a block that crosses local midnight, allows one ending at it", () => {
    const crossing = parseBlockForm({ ...base, start: "23:30", durationMinutes: 45 });
    expect(crossing.ok).toBe(false);
    if (!crossing.ok) expect(crossing.errors.durationMinutes).toContain("midnight");
    expect(parseBlockForm({ ...base, start: "23:30", durationMinutes: 30 }).ok).toBe(true);
  });

  test("builds startsAtMs from the local date, not UTC", () => {
    const result = parseBlockForm({ ...base, start: "07:05" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startsAtMs).toBe(new Date(2026, 9, 5, 7, 5).getTime());
    }
  });

  test("passes task and habit links through", () => {
    const result = parseBlockForm({ ...base, taskId: "t1", habitId: "h1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.taskId).toBe("t1");
      expect(result.value.habitId).toBe("h1");
    }
  });
});

describe("profileGatedArgs", () => {
  const args = { localDate: "2026-10-05" };

  test("skips when the user is not authenticated", () => {
    expect(profileGatedArgs(false, { _id: "user-1" }, args)).toBe("skip");
  });

  test("skips while the profile is loading or missing", () => {
    expect(profileGatedArgs(true, undefined, args)).toBe("skip");
    expect(profileGatedArgs(true, null, args)).toBe("skip");
  });

  test("returns the query arguments when the profile is ready", () => {
    expect(profileGatedArgs(true, { _id: "user-1" }, args)).toBe(args);
  });
});
