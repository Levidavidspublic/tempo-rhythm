import { describe, expect, test } from "bun:test";

import {
  restorePatch,
  softDeletePatch,
  stampCreate,
  stampUpdate,
  WriteStampError,
} from "./write-stamps";

describe("Firestore write stamps", () => {
  test("create sets both times without changing the input", () => {
    const fields = { title: "Plan the day" };

    expect(stampCreate(fields, 100)).toEqual({
      title: "Plan the day",
      createdAt: 100,
      updatedAt: 100,
    });
    expect(fields).toEqual({ title: "Plan the day" });
  });

  test("create drops deletedAt and overwrites passed times", () => {
    const fields: Record<string, unknown> = {
      createdAt: 1,
      updatedAt: 2,
      deletedAt: 3,
    };

    expect(stampCreate(fields, 100)).toEqual({
      createdAt: 100,
      updatedAt: 100,
    });
  });

  test("update sets updatedAt and refuses createdAt and deletedAt", () => {
    expect(stampUpdate({ title: "Revised" }, 200)).toEqual({
      title: "Revised",
      updatedAt: 200,
    });
    expect(() => stampUpdate({ createdAt: 1 }, 200)).toThrow(WriteStampError);
    expect(() => stampUpdate({ deletedAt: 1 }, 200)).toThrow(WriteStampError);
  });

  test("owner and Convex fields are refused by create and update", () => {
    for (const key of ["userId", "uid", "ownerId", "_id"]) {
      expect(() => stampCreate({ [key]: "value" }, 100)).toThrow(
        WriteStampError,
      );
      expect(() => stampUpdate({ [key]: "value" }, 100)).toThrow(
        WriteStampError,
      );
    }
  });

  test("soft-delete and restore patches have exact SDK-neutral shapes", () => {
    expect(softDeletePatch(300)).toEqual({ deletedAt: 300, updatedAt: 300 });
    expect(restorePatch(300)).toEqual({
      set: { updatedAt: 300 },
      remove: ["deletedAt"],
    });
  });

  test("invalid timestamps are refused", () => {
    for (const now of [Number.NaN, 0, -1]) {
      expect(() => stampCreate({}, now)).toThrow(WriteStampError);
      expect(() => stampUpdate({}, now)).toThrow(WriteStampError);
      expect(() => softDeletePatch(now)).toThrow(WriteStampError);
      expect(() => restorePatch(now)).toThrow(WriteStampError);
    }
  });
});
