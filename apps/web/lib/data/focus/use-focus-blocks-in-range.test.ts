import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseFocusBlocksInRange } from "./use-focus-blocks-in-range";

describe("useFocusBlocksInRange", () => {
  test("passes the range to focusBlocks:listInRange and returns its result unchanged", () => {
    const args = { startMs: 100, endMs: 200 };
    const result: never[] = [];
    const useFocusBlocksInRange = makeUseFocusBlocksInRange(
      (reference, receivedArgs) => {
        expect(getFunctionName(reference)).toBe("focusBlocks:listInRange");
        expect(receivedArgs).toBe(args);
        return result;
      }
    );

    expect(useFocusBlocksInRange(args)).toBe(result);
  });

  test("passes skip through unchanged and returns undefined", () => {
    const useFocusBlocksInRange = makeUseFocusBlocksInRange(
      (reference, receivedArgs) => {
        expect(getFunctionName(reference)).toBe("focusBlocks:listInRange");
        expect(receivedArgs).toBe("skip");
        return undefined;
      }
    );

    expect(useFocusBlocksInRange("skip")).toBeUndefined();
  });
});
