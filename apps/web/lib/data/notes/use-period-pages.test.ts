import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { makeUsePeriodPages } from "./use-period-pages";

describe("usePeriodPages", () => {
  test("passes period page arguments to the query and returns its value unchanged", () => {
    const args = { pageType: "daily" as const, before: 5, limit: 10 };
    const marker: never[] = [];
    const usePeriodPages = makeUsePeriodPages((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("notes:listPeriodPages");
      expect(receivedArgs as unknown).toBe(args);
      return marker;
    });

    expect(usePeriodPages(args as unknown as Parameters<typeof usePeriodPages>[0])).toBe(marker);
  });

  test("passes skip through unchanged", () => {
    expect.assertions(3);
    const usePeriodPages = makeUsePeriodPages((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("notes:listPeriodPages");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(usePeriodPages("skip")).toBeUndefined();
  });

  test("JournalScreen reads period pages through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/journal/JournalScreen.tsx"),
      "utf8"
    );

    expect(source).toContain('import { usePeriodPages } from "@/lib/data/notes/use-period-pages";');
    expect(source).not.toContain("api.notes.listPeriodPages");
  });
});
