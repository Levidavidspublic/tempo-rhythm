import { describe, expect, test } from "bun:test";
import { ownerOfDocumentPath, readFirestoreDocument } from "./firestore-document";

const prefix = "projects/tempo/databases/(default)/documents/";
const updateTime = "2026-11-19T10:20:30.123456Z";
const createTime = "2026-11-18T09:00:00Z";

function document(name: string, extra: Record<string, unknown> = {}) {
  return { name: `${prefix}${name}`, createTime, updateTime, ...extra };
}

describe("readFirestoreDocument", () => {
  test("reads an owner task document without decoding its fields", () => {
    const fields = { title: { stringValue: "Make lunch" }, done: { booleanValue: false } };
    const result = readFirestoreDocument(document("users/u1/tasks/t1", { fields }));

    expect(result).toEqual({
      ok: true,
      document: {
        path: "users/u1/tasks/t1",
        segments: ["users", "u1", "tasks", "t1"],
        docId: "t1",
        fields,
        createTime,
        updateTime,
      },
    });
    if (result.ok) expect(ownerOfDocumentPath(result.document.segments)).toBe("u1");
  });

  test("reads a profile document", () => {
    const result = readFirestoreDocument(document("users/u1"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.docId).toBe("u1");
      expect(ownerOfDocumentPath(result.document.segments)).toBe("u1");
    }
  });

  test("finds the owner of a private account gate", () => {
    const result = readFirestoreDocument(document("private/u1/account/gate"));

    expect(result.ok).toBe(true);
    if (result.ok) expect(ownerOfDocumentPath(result.document.segments)).toBe("u1");
    expect(ownerOfDocumentPath(["public", "u1"])).toBeNull();
  });

  test("uses an empty field map when fields are absent", () => {
    const result = readFirestoreDocument(document("users/u1"));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.fields).toEqual({});
  });

  test.each([
    ["a non-object answer", null],
    ["a missing name", { updateTime }],
    ["a non-string name", { name: 42, updateTime }],
    [
      "a name outside the default database",
      { name: "projects/tempo/documents/users/u1", updateTime },
    ],
    ["a collection path", document("users/u1/tasks")],
    ["an empty path segment", document("users/u1//t1")],
    ["non-object fields", document("users/u1", { fields: [] })],
    ["a missing update time", { name: `${prefix}users/u1` }],
  ])("refuses %s without returning document content", (_label, input) => {
    const result = readFirestoreDocument(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result).not.toHaveProperty("document");
      expect(result.reason).not.toContain("u1");
    }
  });
});
