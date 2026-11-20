import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseNoteTitleSearch } from "./use-note-title-search";

describe("useNoteTitleSearch", () => {
  test("passes the same arguments to notes:searchTitles and returns its result unchanged", () => {
    const args = { query: "plan", limit: 6 };
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNoteTitleSearch = makeUseNoteTitleSearch((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNoteTitleSearch(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:searchTitles");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to notes:searchTitles and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNoteTitleSearch = makeUseNoteTitleSearch((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNoteTitleSearch("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:searchTitles");
    expect(calls[0]?.args).toBe("skip");
  });
});
