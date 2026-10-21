import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { layoutItems, localMinuteOfDay } from "./timelineLayout";

describe("layoutItems", () => {
  test("single block sits in one column", () => {
    const [item] = layoutItems([{ id: "a", kind: "focus", startMinute: 540, durationMinutes: 60 }]);

    expect(item).toMatchObject({
      id: "a",
      kind: "focus",
      startMinute: 540,
      durationMinutes: 60,
      top: 540,
      height: 60,
      column: 0,
      columns: 1,
    });
  });

  test("overlap into 2 columns", () => {
    const items = layoutItems([
      { id: "a", kind: "task", startMinute: 540, durationMinutes: 60 },
      { id: "b", kind: "habit", startMinute: 570, durationMinutes: 60 },
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.get("a")).toMatchObject({ column: 0, columns: 2, top: 540, height: 60 });
    expect(byId.get("b")).toMatchObject({ column: 1, columns: 2, top: 570, height: 60 });
  });

  test("clamp at midnight", () => {
    const [late] = layoutItems([
      { id: "late", kind: "break", startMinute: 1400, durationMinutes: 80 },
    ]);
    const [early] = layoutItems([
      { id: "early", kind: "focus", startMinute: -30, durationMinutes: 90 },
    ]);

    expect(late?.startMinute).toBe(1400);
    expect(late?.top).toBe(1400);
    expect(late?.height).toBe(40);
    expect(late?.durationMinutes).toBe(40);
    expect((late?.startMinute ?? 0) + (late?.height ?? 0)).toBeLessThanOrEqual(1440);

    expect(early?.startMinute).toBe(0);
    expect(early?.top).toBe(0);
    expect(early?.height).toBe(60);
    expect((early?.startMinute ?? 0) + (early?.height ?? 0)).toBeLessThanOrEqual(1440);
  });

  test("minimum rendered height is 15 minutes", () => {
    const [item] = layoutItems([
      { id: "short", kind: "other", startMinute: 600, durationMinutes: 5 },
    ]);

    expect(item?.height).toBe(15);
    expect(item?.durationMinutes).toBe(15);
    expect(item?.top).toBe(600);
  });
});

describe("localMinuteOfDay", () => {
  test("uses the local clock, not elapsed time since midnight", () => {
    expect(localMinuteOfDay(new Date(2026, 9, 5, 9, 30).getTime())).toBe(570);
    expect(localMinuteOfDay(new Date(2026, 9, 5, 0, 0).getTime())).toBe(0);
    expect(localMinuteOfDay(new Date(2026, 9, 5, 23, 59).getTime())).toBe(1439);
  });

  test("stays on the clock when the local day is not 24 hours", () => {
    const layoutUrl = new URL("./timelineLayout.ts", import.meta.url).href;
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `const { localMinuteOfDay } = await import(${JSON.stringify(layoutUrl)});
const cases = [
  { month: 2, day: 8 },
  { month: 10, day: 1 },
];
const out = cases.map(({ month, day }) => {
  const event = new Date(2026, month, day, 15, 0, 0, 0);
  const midnight = new Date(2026, month, day, 0, 0, 0, 0);
  return {
    clock: localMinuteOfDay(event.getTime()),
    elapsed: Math.floor((event.getTime() - midnight.getTime()) / 60000),
  };
});
console.log(JSON.stringify(out));`,
      ],
      {
        env: { ...process.env, TZ: "America/New_York" },
        encoding: "utf8",
      }
    );

    expect(result.status, result.stderr).toBe(0);
    const [spring, fall] = JSON.parse(result.stdout) as Array<{
      clock: number;
      elapsed: number;
    }>;
    expect(spring?.clock).toBe(15 * 60);
    expect(spring?.elapsed).toBe(14 * 60);
    expect(fall?.clock).toBe(15 * 60);
    expect(fall?.elapsed).toBe(16 * 60);
  });
});
