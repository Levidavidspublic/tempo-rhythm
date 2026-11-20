import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseTemplateList } from "./use-template-list";

describe("useTemplateList", () => {
  test("passes the same arguments to templates:list and returns its result unchanged", () => {
    const args = { scope: "all" } as const;
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useTemplateList = makeUseTemplateList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useTemplateList(args)).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("templates:list");
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to templates:list and returns its result unchanged", () => {
    const marker: never[] = [];
    const calls: Array<{
      reference: Parameters<typeof getFunctionName>[0];
      args: unknown;
    }> = [];
    const useTemplateList = makeUseTemplateList((reference, receivedArgs) => {
      calls.push({ reference, args: receivedArgs });
      return marker;
    });

    expect(useTemplateList("skip")).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]!.reference)).toBe("templates:list");
    expect(calls[0]?.args).toBe("skip");
  });

  test("TemplatesLibrary reads templates through useTemplateList", async () => {
    const source = await readFile(
      new URL("../../../components/templates-library/TemplatesLibrary.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      'import { useTemplateList } from "@/lib/data/templates/use-template-list";'
    );
    expect(source).not.toContain("api.templates.list");
  });
});
