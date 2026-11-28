import { afterAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const realConvexReact = { ...(await import("convex/react")) };
const realApi = { ...(await import("@/convex/_generated/api")) };
afterAll(() => {
  mock.module("convex/react", () => realConvexReact);
  mock.module("@/convex/_generated/api", () => realApi);
});

const mutationReferences: unknown[] = [];
const markerMutation = async () => ({ success: true });

mock.module("convex/react", () => ({
  ...realConvexReact,
  useMutation: (reference: unknown) => {
    mutationReferences.push(reference);
    return markerMutation;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { restore: "tasks.restore" } },
}));

const { useRestoreTask } = await import("./use-restore-task");

describe("useRestoreTask", () => {
  test("binds tasks.restore and returns its mutation unchanged", () => {
    const mutation = useRestoreTask();

    expect(mutationReferences).toEqual(["tasks.restore"]);
    expect(mutation as unknown).toBe(markerMutation);
  });

  test("PriorityBoard restores tasks through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/tasks-priority/PriorityBoard.tsx"),
      "utf8"
    );

    expect(source).toContain("useRestoreTask()");
    expect(source).not.toContain("useMutation(api.tasks.restore)");
  });
});
