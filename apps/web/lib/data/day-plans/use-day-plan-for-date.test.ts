import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getFunctionName } from "convex/server";
import { makeUseDayPlanForDate } from "./use-day-plan-for-date";

describe("useDayPlanForDate", () => {
  test("passes the local date to dayPlans:getForDate and returns its result unchanged", () => {
    const args = { localDate: "2026-11-20" };
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useDayPlanForDate = makeUseDayPlanForDate((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker as never;
    });

    expect(useDayPlanForDate(args) as unknown).toBe(marker);
    expect(calls).toEqual([["dayPlans:getForDate", args]]);
  });

  test("passes skip to dayPlans:getForDate and returns its result unchanged", () => {
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useDayPlanForDate = makeUseDayPlanForDate((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker as never;
    });

    expect(useDayPlanForDate("skip") as unknown).toBe(marker);
    expect(calls).toEqual([["dayPlans:getForDate", "skip"]]);
  });

  test("DayPlanPanel reads the day plan through useDayPlanForDate", () => {
    const source = readFileSync(
      new URL("../../../components/day-plan-panel/DayPlanPanel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("useDayPlanForDate(");
    expect(source).not.toContain("useQuery(api.dayPlans.getForDate");
  });
});
