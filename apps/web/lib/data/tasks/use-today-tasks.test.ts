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
  api: { tasks: { listToday: "tasks.listToday" } },
}));

const { useTodayTasks } = await import("./use-today-tasks");

describe("useTodayTasks", () => {
  beforeEach(() => calls.splice(0));

  test("passes today's bounds to tasks.listToday and returns its result unchanged", () => {
    const args = { dueFrom: 1, dueTo: 2 };

    expect(useTodayTasks(args)).toBe(marker);
    expect(calls).toEqual([["tasks.listToday", args]]);
  });

  test("passes skip through unchanged", () => {
    useTodayTasks("skip");

    expect(calls).toEqual([["tasks.listToday", "skip"]]);
  });

  test("TodayScreen uses the hook instead of calling tasks.listToday directly", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/today/TodayScreen.tsx"),
      "utf8"
    );

    expect(source).toContain('import { useTodayTasks } from "@/lib/data/tasks/use-today-tasks";');
    expect(source).not.toContain("api.tasks.listToday");
  });
});
