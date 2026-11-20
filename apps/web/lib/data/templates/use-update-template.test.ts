import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { makeUseUpdateTemplate } from "./use-update-template";

describe("useUpdateTemplate", () => {
  test("uses templates.update and returns its mutation unchanged", () => {
    const update = async () => "template_marker" as Id<"templates">;
    const useUpdateTemplate = makeUseUpdateTemplate((reference, ...args) => {
      expect(getFunctionName(reference)).toBe("templates:update");
      expect(args).toHaveLength(0);
      return update;
    });

    expect(useUpdateTemplate()).toBe(update);
  });
});
