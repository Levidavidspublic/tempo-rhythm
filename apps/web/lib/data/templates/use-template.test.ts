import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseTemplate } from "./use-template";

describe("useTemplate", () => {
  test("passes the template id to templates:get and returns its result unchanged", () => {
    const args = { templateId: "daily" };
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useTemplate = makeUseTemplate((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return marker as never;
    });

    expect(useTemplate(args) as unknown).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "templates:get"
    );
    expect(calls[0]?.[1]).toBe(args);
  });

  test("passes skip to templates:get and returns its result unchanged", () => {
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useTemplate = makeUseTemplate((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return marker as never;
    });

    expect(useTemplate("skip") as unknown).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "templates:get"
    );
    expect(calls[0]?.[1]).toBe("skip");
  });
});
