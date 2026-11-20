import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

const calls: Array<[unknown, unknown]> = [];
const marker: never[] = [];
mock.module("convex/react", () => ({
  ...realModules["convex/react"],
  useQuery: (query: unknown, args: unknown) => {
    calls.push([query, args]);
    return marker;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { notes: { listPeriodPages: "notes.listPeriodPages" } },
}));

const { usePeriodPages } = await import("./use-period-pages");

describe("usePeriodPages", () => {
  beforeEach(() => calls.splice(0));

  test("passes period page arguments to the query and returns its value unchanged", () => {
    const args = { pageType: "daily" as const, before: 5, limit: 10 };

    expect(usePeriodPages(args as unknown as Parameters<typeof usePeriodPages>[0])).toBe(marker);
    expect(calls).toEqual([["notes.listPeriodPages", args]]);
  });

  test("passes skip through unchanged", () => {
    usePeriodPages("skip");

    expect(calls).toEqual([["notes.listPeriodPages", "skip"]]);
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
