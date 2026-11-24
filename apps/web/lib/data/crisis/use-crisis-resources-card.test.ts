import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseCrisisResourcesCard } from "./use-crisis-resources-card";

describe("useCrisisResourcesCard", () => {
  test.each([
    ["the same arguments", {}],
    ["skip", "skip" as const],
  ])("passes %s to crisis:resourcesCard and returns its result unchanged", (_description, args) => {
    const marker = { title: "Test title", body: "Test body", resources: [] };
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useCrisisResourcesCard = makeUseCrisisResourcesCard((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useCrisisResourcesCard(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("crisis:resourcesCard");
    expect(calls[0]?.args).toBe(args);
  });

  test("CrisisResourcesCard reads the card through useCrisisResourcesCard", async () => {
    const source = await readFile(
      new URL("../../../components/coach-crisis/CrisisResourcesCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      'import { useCrisisResourcesCard } from "@/lib/data/crisis/use-crisis-resources-card";'
    );
    expect(source).not.toContain("api.crisis.resourcesCard");
  });
});
