import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseTemplateProposal } from "./use-template-proposal";

describe("useTemplateProposal", () => {
  test("passes arguments to templates:proposeForPage and returns its result unchanged", () => {
    const args = { periodType: "daily" as const, title: "Monday" };
    const marker = {
      templateId: "starter:daily" as const,
      name: "Daily plan",
      reason: "Matches Monday",
    };
    const calls: Array<{ reference: Parameters<typeof getFunctionName>[0]; args: unknown }> = [];
    const useTemplateProposal = makeUseTemplateProposal((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useTemplateProposal(args)).toBe(marker);
    expect(useTemplateProposal("skip")).toBe(marker);
    expect(getFunctionName(calls[0]!.reference)).toBe("templates:proposeForPage");
    expect(calls[0]!.args).toBe(args);
    expect(getFunctionName(calls[1]!.reference)).toBe("templates:proposeForPage");
    expect(calls[1]!.args).toBe("skip");
  });
});
