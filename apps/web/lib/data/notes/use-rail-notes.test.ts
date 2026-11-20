import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseRailNotes } from "./use-rail-notes";

describe("useRailNotes", () => {
  test("passes the same arguments to notes:listForRail and returns its result unchanged", () => {
    const args = { limit: 7 };
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useRailNotes = makeUseRailNotes((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useRailNotes(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:listForRail");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to notes:listForRail and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useRailNotes = makeUseRailNotes((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useRailNotes("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("notes:listForRail");
    expect(calls[0]?.args).toBe("skip");
  });

  test("Sidebar reads rail notes through useRailNotes", async () => {
    const source = await readFile(
      new URL("../../../components/tempo/Sidebar.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useRailNotes } from "@/lib/data/notes/use-rail-notes";');
    expect(source).not.toContain("api.notes.listForRail");
  });
});
