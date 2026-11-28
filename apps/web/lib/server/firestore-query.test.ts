import { describe, expect, test } from "bun:test";
import { buildListQuery, FirestoreQueryError } from "./firestore-query";

describe("Firestore list query builder", () => {
  test("builds a bare owner-scoped collection query", () => {
    expect(buildListQuery({ uid: "owner1", collection: "tasks" })).toEqual({
      parent: "users/owner1",
      body: {
        structuredQuery: { from: [{ collectionId: "tasks" }], limit: 50 },
      },
    });
  });

  test("encodes one filter as a field filter", () => {
    expect(
      buildListQuery({
        uid: "owner1",
        collection: "tasks",
        filters: [{ field: "priority", op: ">=", value: 2 }],
      }).body.structuredQuery.where
    ).toEqual({
      fieldFilter: {
        field: { fieldPath: "priority" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { integerValue: "2" },
      },
    });
  });

  test("joins two filters with AND", () => {
    expect(
      buildListQuery({
        uid: "owner1",
        collection: "tasks",
        filters: [
          { field: "done", op: "==", value: false },
          { field: "score", op: "<", value: 2.5 },
        ],
      }).body.structuredQuery.where
    ).toEqual({
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "done" },
              op: "EQUAL",
              value: { booleanValue: false },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "score" },
              op: "LESS_THAN",
              value: { doubleValue: 2.5 },
            },
          },
        ],
      },
    });
  });

  test("encodes ordering and a start-after cursor", () => {
    expect(
      buildListQuery({
        uid: "owner1",
        collection: "notes",
        orderBy: { field: "title", direction: "desc" },
        startAfter: "later",
      }).body.structuredQuery
    ).toMatchObject({
      orderBy: [{ field: { fieldPath: "title" }, direction: "DESCENDING" }],
      startAt: { values: [{ stringValue: "later" }], before: false },
    });
  });

  test("requires ordering to start with the inequality filter field", () => {
    const base = {
      uid: "owner1",
      collection: "tasks",
      filters: [{ field: "priority", op: ">=" as const, value: 2 }],
    };

    expect(() =>
      buildListQuery({
        ...base,
        orderBy: { field: "title", direction: "asc" },
      })
    ).toThrow(FirestoreQueryError);

    expect(
      buildListQuery({
        ...base,
        orderBy: { field: "priority", direction: "asc" },
      }).body.structuredQuery.orderBy
    ).toEqual([{ field: { fieldPath: "priority" }, direction: "ASCENDING" }]);
  });

  test("refuses unsafe owner and collection segments", () => {
    for (const request of [
      { uid: "two/owners", collection: "tasks" },
      { uid: "owner1", collection: "task/list" },
      { uid: "__name__", collection: "tasks" },
      { uid: "owner1", collection: "__name__" },
    ]) {
      expect(() => buildListQuery(request)).toThrow(FirestoreQueryError);
    }
  });

  test("refuses invalid fields, numbers, and filter counts", () => {
    const base = { uid: "owner1", collection: "tasks" };
    expect(() =>
      buildListQuery({
        ...base,
        filters: [{ field: "bad.name", op: "==", value: "x" }],
      })
    ).toThrow(FirestoreQueryError);
    expect(() =>
      buildListQuery({
        ...base,
        filters: [{ field: "score", op: "==", value: Infinity }],
      })
    ).toThrow(FirestoreQueryError);
    expect(() =>
      buildListQuery({
        ...base,
        filters: Array.from({ length: 6 }, () => ({
          field: "done",
          op: "==" as const,
          value: true,
        })),
      })
    ).toThrow(FirestoreQueryError);
  });

  test("refuses invalid limits and an unordered cursor", () => {
    const base = { uid: "owner1", collection: "tasks" };
    for (const limit of [0, 201, 1.5]) {
      expect(() => buildListQuery({ ...base, limit })).toThrow(FirestoreQueryError);
    }
    expect(() => buildListQuery({ ...base, startAfter: 1 })).toThrow(FirestoreQueryError);
  });
});
