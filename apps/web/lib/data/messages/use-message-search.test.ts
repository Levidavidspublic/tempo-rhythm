import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseMessageSearch } from "./use-message-search";

describe("useMessageSearch", () => {
  test("passes the same arguments to messages:searchMine and returns its result unchanged", () => {
    const args = { query: "plan" };
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useMessageSearch = makeUseMessageSearch((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useMessageSearch(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("messages:searchMine");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to messages:searchMine and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useMessageSearch = makeUseMessageSearch((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useMessageSearch("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("messages:searchMine");
    expect(calls[0]?.args).toBe("skip");
  });

  test("CoachThreads searches messages through useMessageSearch", async () => {
    const source = await readFile(
      new URL("../../../components/coach/CoachThreads.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useMessageSearch } from "@/lib/data/messages/use-message-search";');
    expect(source).not.toContain("api.messages.searchMine");
  });
});
