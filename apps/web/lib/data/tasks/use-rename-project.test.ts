import { afterAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Bun's module mocks are process-wide. Preserve the real modules for tests that run afterward.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

const mutationCalls: unknown[] = [];
const marker = async () => "renamed";

mock.module("convex/react", () => ({
  useMutation: (reference: unknown) => {
    mutationCalls.push(reference);
    return marker;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { renameProject: "tasks.renameProject" } },
}));

const { useRenameProject } = await import("./use-rename-project");

describe("useRenameProject", () => {
  test("uses the renameProject mutation and returns its mutation function", () => {
    mutationCalls.length = 0;

    expect(useRenameProject() as unknown).toBe(marker);
    expect(mutationCalls).toEqual(["tasks.renameProject"]);
  });

  test("ProjectDetailScreen renames projects through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/projects/ProjectDetailScreen.tsx"),
      "utf8",
    );

    expect(source).toContain("useRenameProject()");
    expect(source).not.toContain("useMutation(api.tasks.renameProject)");
  });
});
