import { describe, expect, test } from "bun:test";
import {
  checkCoachWebSearchDoc,
  countSearchesOn,
  softDeleteCoachWebSearch,
  utcDateKeyFor,
  type CoachWebSearchDoc,
} from "./coach-web-search-doc";

describe("coach web search documents", () => {
  test("accepts a valid record", () => {
    const input = { utcDateKey: "2026-11-19", createdAt: 10, updatedAt: 11 };
    expect(checkCoachWebSearchDoc(input)).toEqual({ ok: true, doc: input });
  });

  test("rejects the unknown userId key", () => {
    expect(checkCoachWebSearchDoc({ utcDateKey: "2026-11-19", createdAt: 10, updatedAt: 10, userId: "user" })).toEqual({
      ok: false,
      reason: "Unknown key: userId",
    });
  });

  test("rejects an impossible date", () => {
    expect(checkCoachWebSearchDoc({ utcDateKey: "2026-02-30", createdAt: 10, updatedAt: 10 }).ok).toBe(false);
  });

  test("rejects a non-integer createdAt", () => {
    expect(checkCoachWebSearchDoc({ utcDateKey: "2026-11-19", createdAt: 10.5, updatedAt: 11 }).ok).toBe(false);
  });

  test("utcDateKeyFor follows the UTC day around midnight", () => {
    expect(utcDateKeyFor(Date.UTC(2026, 10, 18, 23, 59, 59, 999))).toBe("2026-11-18");
    expect(utcDateKeyFor(Date.UTC(2026, 10, 19, 0, 0, 0, 0))).toBe("2026-11-19");
  });

  test("soft delete sets deletedAt", () => {
    const doc: CoachWebSearchDoc = { utcDateKey: "2026-11-19", createdAt: 10, updatedAt: 10 };
    expect(softDeleteCoachWebSearch(doc, 20)).toEqual({ ...doc, deletedAt: 20, updatedAt: 20 });
  });

  test("countSearchesOn counts only the requested day and skips soft-deleted records", () => {
    const docs: CoachWebSearchDoc[] = [
      { utcDateKey: "2026-11-19", createdAt: 1, updatedAt: 1 },
      { utcDateKey: "2026-11-19", createdAt: 2, updatedAt: 3, deletedAt: 3 },
      { utcDateKey: "2026-11-18", createdAt: 4, updatedAt: 4 },
    ];
    expect(countSearchesOn(docs, "2026-11-19")).toBe(1);
  });
});
