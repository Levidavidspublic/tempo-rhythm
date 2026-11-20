import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseNoteList } from "./use-note-list";

describe("useNoteList", () => {
  test("passes the same arguments to notes:list and returns its result unchanged", () => {
    const args = { search: "a", pinnedOnly: true };
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNoteList = makeUseNoteList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNoteList(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:list");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to notes:list and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNoteList = makeUseNoteList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNoteList("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:list");
    expect(calls[0]?.args).toBe("skip");
  });
});
