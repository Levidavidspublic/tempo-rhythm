import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseConnectionStatus } from "./use-connection-status";

describe("useConnectionStatus", () => {
  test("passes the same arguments to connections:status and returns its result unchanged", () => {
    const args = { provider: "executor" } as const;
    const marker = { status: "connected", enabled: true } as const;
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useConnectionStatus = makeUseConnectionStatus((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useConnectionStatus(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("connections:status");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to connections:status and returns its result unchanged", () => {
    const marker = { status: "connected", enabled: true } as const;
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useConnectionStatus = makeUseConnectionStatus((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useConnectionStatus("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("connections:status");
    expect(calls[0]?.args).toBe("skip");
  });

  test("ExecutorLookup reads connection status through useConnectionStatus", async () => {
    const source = await readFile(
      new URL("../../../components/coach/ExecutorLookup.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      'import { useConnectionStatus } from "@/lib/data/connections/use-connection-status";'
    );
    expect(source).not.toContain("api.connections.status");
  });
});
