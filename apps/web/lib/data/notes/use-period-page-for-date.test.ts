import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUsePeriodPageForDate } from "./use-period-page-for-date";

describe("usePeriodPageForDate", () => {
  test("passes the dated page arguments to notes:getPeriodPage and returns null unchanged", () => {
    const args = { pageType: "daily" as const, date: "2026-11-20" };
    const calls: unknown[][] = [];
    const usePeriodPageForDate = makeUsePeriodPageForDate((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return null;
    });

    expect(usePeriodPageForDate(args)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "notes:getPeriodPage"
    );
    expect(calls[0]?.[1]).toBe(args);
  });

  test("passes skip to notes:getPeriodPage and returns undefined unchanged", () => {
    const calls: unknown[][] = [];
    const usePeriodPageForDate = makeUsePeriodPageForDate((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return undefined;
    });

    expect(usePeriodPageForDate("skip")).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "notes:getPeriodPage"
    );
    expect(calls[0]?.[1]).toBe("skip");
  });
});
