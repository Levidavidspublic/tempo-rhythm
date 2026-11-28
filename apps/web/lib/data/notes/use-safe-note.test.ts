import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getFunctionName } from "convex/server";
import { makeUseSafeNote } from "./use-safe-note";

describe("useSafeNote", () => {
  test("passes the note id to notes:getSafe and returns its result unchanged", () => {
    const args = { noteId: "n1" };
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useSafeNote = makeUseSafeNote((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return marker as never;
    });

    expect(useSafeNote(args) as unknown).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "notes:getSafe"
    );
    expect(calls[0]?.[1]).toBe(args);
  });

  test("passes skip to notes:getSafe and returns its result unchanged", () => {
    const marker = { marker: true };
    const calls: unknown[][] = [];
    const useSafeNote = makeUseSafeNote((reference, receivedArgs) => {
      calls.push([reference, receivedArgs]);
      return marker as never;
    });

    expect(useSafeNote("skip") as unknown).toBe(marker);
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "notes:getSafe"
    );
    expect(calls[0]?.[1]).toBe("skip");
  });

  test("RoutineGuide reads the note through useSafeNote", () => {
    const source = readFileSync(
      new URL("../../../components/routines/RoutineGuide.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useSafeNote } from "@/lib/data/notes/use-safe-note";');
    expect(source).not.toContain("api.notes.getSafe");
  });
});

test("useSafeNote calls useQuery at call time instead of capturing it at load", () => {
  const source = readFileSync(new URL("./use-safe-note.ts", import.meta.url), "utf8");
  expect(source).not.toContain("makeUseSafeNote(useQuery)");
  expect(source).toContain("export function useSafeNote");
  expect(source).toContain("return useQuery(api.notes.getSafe, args)");
});
