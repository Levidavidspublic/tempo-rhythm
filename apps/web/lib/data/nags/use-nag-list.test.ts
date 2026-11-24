import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseNagList } from "./use-nag-list";

describe("useNagList", () => {
  test("passes the same arguments to nags:list and returns its result unchanged", () => {
    const args = {};
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNagList = makeUseNagList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNagList(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("nags:list");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to nags:list and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useNagList = makeUseNagList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useNagList("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("nags:list");
    expect(calls[0]?.args).toBe("skip");
  });

  test("NagsScreen reads the nag list through useNagList", async () => {
    const source = await readFile(
      new URL("../../../app/(tempo)/settings/nags/NagsScreen.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useNagList } from "@/lib/data/nags/use-nag-list";');
    expect(source).not.toContain("api.nags.list");
  });
});
