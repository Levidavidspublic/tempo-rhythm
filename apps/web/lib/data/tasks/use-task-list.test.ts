import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseTaskList } from "./use-task-list";

describe("useTaskList", () => {
  test("passes the same args to tasks:list and returns its result unchanged", () => {
    expect.assertions(3);
    const args = {};
    const tasks: never[] = [];
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe(args);
      return tasks;
    });

    expect(useTaskList(args)).toBe(tasks);
  });

  test("passes skip to tasks:list and leaves the result undefined", () => {
    expect.assertions(3);
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useTaskList("skip")).toBeUndefined();
  });

  test("leaves a loading query result undefined", () => {
    const useTaskList = makeUseTaskList(() => undefined);

    expect(useTaskList({})).toBeUndefined();
  });

  test("lets query failures reach the screen's error boundary", () => {
    const error = new Error("Task list query failed");
    const useTaskList = makeUseTaskList(() => {
      throw error;
    });

    expect(() => useTaskList({})).toThrow(error);
  });

  test("ProjectsScreen keeps its auth gate when calling useTaskList", async () => {
    const source = await readFile(
      new URL("../../../components/projects/ProjectsScreen.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useTaskList } from "@/lib/data/tasks/use-task-list";');
    expect(source).toContain('useTaskList(signedIn === "ready" ? {} : "skip")');
    expect(source).not.toContain("api.tasks.list");
  });
});
