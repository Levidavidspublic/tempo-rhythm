import { describe, expect, test } from "bun:test";
import { buildPatchRequest, buildSoftDeleteRequest } from "./firestore-patch";

describe("buildPatchRequest", () => {
  const baseInput = {
    projectId: "tempo-preview",
    documentPath: "users/u1/tasks/t1",
    fields: { title: { stringValue: "Write" }, updatedAt: { timestampValue: "now" } },
    updateMask: ["title", "updatedAt"] as const,
  };

  test("builds the address and body with repeated mask parameters", () => {
    expect(buildPatchRequest(baseInput)).toEqual({
      ok: true,
      url: "https://firestore.googleapis.com/v1/projects/tempo-preview/databases/(default)/documents/users/u1/tasks/t1?updateMask.fieldPaths=title&updateMask.fieldPaths=updatedAt",
      body: { fields: baseInput.fields },
    });
  });

  test("URL-encodes each document path segment", () => {
    const result = buildPatchRequest({ ...baseInput, documentPath: "users/user name/tasks/task?1" });
    expect(result.ok && result.url).toContain("/users/user%20name/tasks/task%3F1?");
  });

  test("adds an exists precondition", () => {
    const result = buildPatchRequest({ ...baseInput, precondition: { exists: true } });
    expect(result.ok && result.url).toEndWith("&currentDocument.exists=true");
  });

  test("adds an update-time precondition", () => {
    const result = buildPatchRequest({
      ...baseInput,
      precondition: { updateTime: "2026-11-19T12:34:56.000Z" },
    });
    expect(result.ok && result.url).toEndWith(
      "&currentDocument.updateTime=2026-11-19T12%3A34%3A56.000Z"
    );
  });

  test("rejects a collection path", () => {
    expect(buildPatchRequest({ ...baseInput, documentPath: "users/u1/tasks" })).toEqual({
      ok: false,
      reason: "documentPath must identify a document",
    });
  });

  test("rejects an empty update mask", () => {
    const result = buildPatchRequest({ ...baseInput, fields: {}, updateMask: [] });
    expect(result.ok).toBe(false);
  });

  test("rejects a field not named in the mask", () => {
    const result = buildPatchRequest({ ...baseInput, updateMask: ["title"] });
    expect(result.ok).toBe(false);
  });

  test("rejects mask entries containing a dot or backtick", () => {
    for (const fieldName of ["profile.name", "`profile`"]) {
      const result = buildPatchRequest({ ...baseInput, fields: {}, updateMask: [fieldName] });
      expect(result.ok).toBe(false);
    }
  });
});

test("buildSoftDeleteRequest masks only its timestamps and requires the document to exist", () => {
  const result = buildSoftDeleteRequest({
    projectId: "tempo-preview",
    documentPath: "users/u1/tasks/t1",
    nowIso: "2026-11-19T12:34:56.000Z",
  });

  expect(result).toEqual({
    ok: true,
    url: "https://firestore.googleapis.com/v1/projects/tempo-preview/databases/(default)/documents/users/u1/tasks/t1?updateMask.fieldPaths=deletedAt&updateMask.fieldPaths=updatedAt&currentDocument.exists=true",
    body: {
      fields: {
        deletedAt: { timestampValue: "2026-11-19T12:34:56.000Z" },
        updatedAt: { timestampValue: "2026-11-19T12:34:56.000Z" },
      },
    },
  });
});
