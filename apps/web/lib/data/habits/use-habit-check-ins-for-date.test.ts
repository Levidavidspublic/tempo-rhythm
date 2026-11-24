import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getFunctionName } from "convex/server";
import { makeUseHabitCheckInsForDate } from "./use-habit-check-ins-for-date";

describe("useHabitCheckInsForDate", () => {
  test("passes the date to habitCheckIns:listForDate and returns its result unchanged", () => {
    const args = { localDate: "2026-11-20" };
    const marker = [{ marker: true }];
    const calls: unknown[][] = [];
    const useHabitCheckInsForDate = makeUseHabitCheckInsForDate((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker as never;
    });

    expect(useHabitCheckInsForDate(args) as unknown).toBe(marker);
    expect(calls).toEqual([["habitCheckIns:listForDate", { localDate: "2026-11-20" }]]);
  });

  test("passes skip to habitCheckIns:listForDate and returns its result unchanged", () => {
    const marker = [{ marker: true }];
    const calls: unknown[][] = [];
    const useHabitCheckInsForDate = makeUseHabitCheckInsForDate((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker as never;
    });

    expect(useHabitCheckInsForDate("skip") as unknown).toBe(marker);
    expect(calls).toEqual([["habitCheckIns:listForDate", "skip"]]);
  });

  test("HabitCheckInStrip reads check-ins through useHabitCheckInsForDate", () => {
    const source = readFileSync(
      new URL("../../../components/habit-checkin-strip/HabitCheckInStrip.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("useHabitCheckInsForDate(");
    expect(source).not.toContain("useQuery(api.habitCheckIns.listForDate");
  });
});
