import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { makeUseRoutineNotes } from "./use-routine-notes";

describe("useRoutineNotes", () => {
  test("passes the same arguments to notes:listRoutines and returns its result unchanged", () => {
    const args = {};
    const marker: never[] = [];
    const calls: Array<{ name: string; args: unknown }> = [];
    const useRoutineNotes = makeUseRoutineNotes((reference, receivedArgs) => {
      calls.push({ name: getFunctionName(reference), args: receivedArgs });
      return marker;
    });

    expect(useRoutineNotes(args)).toBe(marker);
    expect(calls).toEqual([{ name: "notes:listRoutines", args }]);
    expect(calls[0]?.args).toBe(args);
  });

  test("passes skip to notes:listRoutines and returns its result unchanged", () => {
    const marker = undefined;
    const calls: Array<{ name: string; args: unknown }> = [];
    const useRoutineNotes = makeUseRoutineNotes((reference, receivedArgs) => {
      calls.push({ name: getFunctionName(reference), args: receivedArgs });
      return marker;
    });

    expect(useRoutineNotes("skip")).toBe(marker);
    expect(calls).toEqual([{ name: "notes:listRoutines", args: "skip" }]);
  });

  test("RoutinesScreen reads routines through useRoutineNotes", async () => {
    const source = await readFile(
      new URL("../../../components/routines/RoutinesScreen.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      'import { useRoutineNotes } from "@/lib/data/notes/use-routine-notes";'
    );
    expect(source).not.toContain("api.notes.listRoutines");
  });
});
