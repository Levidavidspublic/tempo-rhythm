import { describe, expect, test } from "bun:test";
import { readQueryResult } from "./firestore-query-result";

describe("readQueryResult", () => {
  test("reads an empty result", () => {
    expect(readQueryResult([{ readTime: "2026-11-19T00:00:00Z" }], 20)).toEqual({
      ok: true,
      documents: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  test("reads a full page and returns the last document as its cursor", () => {
    const json = [
      {
        document: {
          name: "projects/demo/databases/(default)/documents/tasks/one",
          fields: { title: { stringValue: "First" } },
          createTime: "2026-11-18T10:00:00Z",
          updateTime: "2026-11-18T11:00:00Z",
        },
      },
      {
        document: {
          name: "projects/demo/databases/(default)/documents/tasks/two",
          fields: { done: { booleanValue: false } },
          createTime: "2026-11-18T12:00:00Z",
          updateTime: "2026-11-18T13:00:00Z",
        },
      },
    ];

    expect(readQueryResult(json, 2)).toEqual({
      ok: true,
      documents: [
        {
          name: "projects/demo/databases/(default)/documents/tasks/one",
          fields: { title: { stringValue: "First" } },
          createTime: "2026-11-18T10:00:00Z",
          updateTime: "2026-11-18T11:00:00Z",
        },
        {
          name: "projects/demo/databases/(default)/documents/tasks/two",
          fields: { done: { booleanValue: false } },
          createTime: "2026-11-18T12:00:00Z",
          updateTime: "2026-11-18T13:00:00Z",
        },
      ],
      nextCursor: "projects/demo/databases/(default)/documents/tasks/two",
      hasMore: true,
    });
  });

  test("reads a short page and supplies empty fields when they are absent", () => {
    expect(
      readQueryResult(
        [
          { skippedResults: 2 },
          {
            document: {
              name: "projects/demo/databases/(default)/documents/tasks/one",
              createTime: "2026-11-18T10:00:00Z",
              updateTime: "2026-11-18T11:00:00Z",
            },
          },
        ],
        2
      )
    ).toEqual({
      ok: true,
      documents: [
        {
          name: "projects/demo/databases/(default)/documents/tasks/one",
          fields: {},
          createTime: "2026-11-18T10:00:00Z",
          updateTime: "2026-11-18T11:00:00Z",
        },
      ],
      nextCursor: "projects/demo/databases/(default)/documents/tasks/one",
      hasMore: false,
    });
  });

  test("refuses an error entry without exposing its detail", () => {
    const result = readQueryResult(
      [{ error: { code: 403, message: "private document name and field value" } }],
      20
    );
    expect(result).toEqual({ ok: false, reason: "Firestore query failed" });
    expect(JSON.stringify(result)).not.toContain("private document name");
  });

  test("refuses a non-array answer", () => {
    expect(readQueryResult({ document: {} }, 20)).toEqual({
      ok: false,
      reason: "Invalid query response",
    });
  });

  test("refuses a document with no name", () => {
    expect(readQueryResult([{ document: { fields: {} } }], 20)).toEqual({
      ok: false,
      reason: "Query document has no valid name",
    });
  });

  test("refuses page sizes outside the supported integer range", () => {
    for (const pageSize of [0, 1.5, 501, Number.NaN]) {
      expect(readQueryResult([], pageSize)).toEqual({
        ok: false,
        reason: "Invalid page size",
      });
    }
  });
});
