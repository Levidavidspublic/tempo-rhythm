import { describe, expect, test } from "bun:test";
import { buildCountRequest, readCountResult } from "./firestore-count";

describe("buildCountRequest", () => {
  test("builds an exact request without filters", () => {
    expect(buildCountRequest("tempo project", "user@example.com", "notifications", [])).toEqual({
      ok: true,
      url: "https://firestore.googleapis.com/v1/projects/tempo%20project/databases/(default)/documents/users/user%40example.com:runAggregationQuery",
      body: {
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: "notifications" }] },
          aggregations: [{ alias: "count", count: {} }],
        },
      },
    });
  });

  test("uses one fieldFilter", () => {
    const result = buildCountRequest("tempo", "user", "notifications", [
      { field: "read", value: { booleanValue: false } },
    ]);
    expect(result.ok && result.body).toEqual({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: "notifications" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "read" },
              op: "EQUAL",
              value: { booleanValue: false },
            },
          },
        },
        aggregations: [{ alias: "count", count: {} }],
      },
    });
  });

  test("joins two field filters with AND and stringifies upTo", () => {
    const result = buildCountRequest(
      "tempo",
      "user",
      "coachWebSearches",
      [
        { field: "day", value: { stringValue: "2026-11-19" } },
        { field: "deleted", value: { nullValue: null } },
      ],
      25
    );
    expect(result.ok && result.body).toEqual({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: "coachWebSearches" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "day" },
                    op: "EQUAL",
                    value: { stringValue: "2026-11-19" },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "deleted" },
                    op: "EQUAL",
                    value: { nullValue: null },
                  },
                },
              ],
            },
          },
        },
        aggregations: [{ alias: "count", count: { upTo: "25" } }],
      },
    });
  });

  test.each([
    ["empty project", "", "user", "items", [], undefined],
    ["empty uid", "project", "", "items", [], undefined],
    ["empty collection", "project", "user", "", [], undefined],
    ["slash in uid", "project", "user/other", "items", [], undefined],
    ["slash in collection", "project", "user", "items/other", [], undefined],
    [
      "empty field",
      "project",
      "user",
      "items",
      [{ field: "", value: { nullValue: null } }],
      undefined,
    ],
    [
      "invalid field",
      "project",
      "user",
      "items",
      [{ field: "bad.field", value: { nullValue: null } }],
      undefined,
    ],
    [
      "more than five filters",
      "project",
      "user",
      "items",
      Array.from({ length: 6 }, (_, index) => ({
        field: `field${index}`,
        value: { nullValue: null } as const,
      })),
      undefined,
    ],
    [
      "duplicate field",
      "project",
      "user",
      "items",
      [
        { field: "same", value: { booleanValue: true } },
        { field: "same", value: { booleanValue: false } },
      ],
      undefined,
    ],
    ["upTo zero", "project", "user", "items", [], 0],
    ["upTo over limit", "project", "user", "items", [], 1001],
    ["upTo fractional", "project", "user", "items", [], 1.5],
  ])("refuses %s", (_name, projectId, uid, collection, filters, upTo) => {
    expect(buildCountRequest(projectId, uid, collection, filters, upTo).ok).toBe(false);
  });
});

describe("readCountResult", () => {
  test.each([
    ["3", 3],
    ["0", 0],
  ])("reads %s", (integerValue, count) => {
    expect(readCountResult([{ result: { aggregateFields: { count: { integerValue } } } }])).toEqual(
      { ok: true, count }
    );
  });

  test("refuses an error entry", () => {
    expect(readCountResult([{ error: { code: 403, message: "denied" } }]).ok).toBe(false);
  });

  test.each([
    [null],
    [{}],
    [[]],
    [[{}]],
    [[{ result: {} }]],
    [[{ result: { aggregateFields: { count: { integerValue: "-1" } } } }]],
    [[{ result: { aggregateFields: { count: { integerValue: "9007199254740992" } } } }]],
  ])("refuses malformed answer %#", (answer) => {
    expect(readCountResult(answer).ok).toBe(false);
  });
});

test("quotes a digit-leading field name", () => {
  const built = buildCountRequest("tempo-test", "owner1", "tasks", [
    { field: "2026", value: { stringValue: "1" } },
  ]);
  expect(built.ok).toBe(true);
  if (!built.ok) return;
  expect(JSON.stringify(built.body)).toContain('"fieldPath":"`2026`"');
  const ordinary = buildCountRequest("tempo-test", "owner1", "tasks", [
    { field: "read", value: { stringValue: "1" } },
  ]);
  expect(ordinary.ok).toBe(true);
  if (!ordinary.ok) return;
  expect(JSON.stringify(ordinary.body)).toContain('"fieldPath":"read"');
});

test("reads a count that follows a progress entry and rejects any error", () => {
  expect(
    readCountResult([
      { readTime: "t" },
      { result: { aggregateFields: { count: { integerValue: "4" } } } },
    ])
  ).toEqual({ ok: true, count: 4 });
  expect(
    readCountResult([
      { readTime: "t" },
      { error: { code: 7 } },
      { result: { aggregateFields: { count: { integerValue: "4" } } } },
    ]).ok
  ).toBe(false);
});
