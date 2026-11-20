import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { makeUseRenameProject } from "./use-rename-project";

describe("useRenameProject", () => {
  test("uses tasks.renameProject and returns its mutation unchanged", async () => {
    const renameArgs = { projectId: "project-1", name: "New name" };
    const mutationCalls: string[] = [];

    async function renameProject(args: typeof renameArgs) {
      expect(args).toBe(renameArgs);
      return 2;
    }
    renameProject.withOptimisticUpdate = () => renameProject;

    const useRenameProjectWithFakeMutation = makeUseRenameProject((reference, ...args) => {
      mutationCalls.push(getFunctionName(reference));
      expect(args).toHaveLength(0);
      return renameProject;
    });

    const mutation = useRenameProjectWithFakeMutation();
    expect(mutation).toBe(renameProject);
    expect(mutationCalls).toEqual(["tasks:renameProject"]);
    expect(await mutation(renameArgs)).toBe(2);
  });

  test("ProjectDetailScreen renames projects through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/projects/ProjectDetailScreen.tsx"),
      "utf8"
    );

    expect(source).toContain("useRenameProject()");
    expect(source).not.toContain("useMutation(api.tasks.renameProject)");
  });
});
