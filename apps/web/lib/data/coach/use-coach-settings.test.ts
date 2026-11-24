import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseCoachSettings } from "./use-coach-settings";

const marker = { dial: 5, taskLoad: 1, panicUntil: null, acceptedStreak: 0 };

describe("useCoachSettings", () => {
  test("passes the same arguments to coach:getSettings and returns its result unchanged", () => {
    const args = {};
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useCoachSettings = makeUseCoachSettings((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useCoachSettings(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("coach:getSettings");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to coach:getSettings and returns its result unchanged", () => {
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useCoachSettings = makeUseCoachSettings((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useCoachSettings("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("coach:getSettings");
    expect(calls[0]?.args).toBe("skip");
  });

  test("CoachControls reads coach settings through useCoachSettings", async () => {
    const source = await readFile(
      new URL("../../../components/coach-controls/CoachControls.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useCoachSettings } from "@/lib/data/coach/use-coach-settings";');
    expect(source).not.toContain("api.coach.getSettings");
  });
});
