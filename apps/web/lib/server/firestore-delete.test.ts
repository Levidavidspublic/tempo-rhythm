import { describe, expect, test } from "bun:test";
import { buildDeleteRequest } from "./firestore-delete";

describe("buildDeleteRequest", () => {
  const baseInput = {
    projectId: "tempo-preview",
    documentPath: "users/u1",
  };

  test("builds an owner document DELETE address without a query string", () => {
    expect(buildDeleteRequest(baseInput)).toEqual({
      ok: true,
      method: "DELETE",
      url: "https://firestore.googleapis.com/v1/projects/tempo-preview/databases/(default)/documents/users/u1",
    });
  });

  test("builds a private document address and encodes each path segment", () => {
    expect(
      buildDeleteRequest({
        projectId: "tempo preview",
        documentPath: "users/user name/private/task?1",
      })
    ).toEqual({
      ok: true,
      method: "DELETE",
      url: "https://firestore.googleapis.com/v1/projects/tempo%20preview/databases/(default)/documents/users/user%20name/private/task%3F1",
    });
  });

  test("adds an exists precondition", () => {
    const result = buildDeleteRequest({ ...baseInput, precondition: { exists: true } });
    expect(result.ok && result.url).toEndWith("?currentDocument.exists=true");
  });

  test("adds an update-time precondition and refuses a blank update time", () => {
    const result = buildDeleteRequest({
      ...baseInput,
      precondition: { updateTime: "2026-11-19T12:34:56.000Z" },
    });
    expect(result.ok && result.url).toEndWith(
      "?currentDocument.updateTime=2026-11-19T12%3A34%3A56.000Z"
    );
    expect(buildDeleteRequest({ ...baseInput, precondition: { updateTime: "  " } })).toEqual({
      ok: false,
      reason: "precondition updateTime must not be blank",
    });
  });

  test("refuses a collection path", () => {
    expect(buildDeleteRequest({ ...baseInput, documentPath: "users/u1/private" })).toEqual({
      ok: false,
      reason: "documentPath must identify a document",
    });
  });

  test("refuses a blank project ID or an empty path segment", () => {
    expect(buildDeleteRequest({ ...baseInput, projectId: "  " })).toEqual({
      ok: false,
      reason: "projectId must not be blank",
    });
    expect(buildDeleteRequest({ ...baseInput, documentPath: "users//private/item" })).toEqual({
      ok: false,
      reason: "documentPath must identify a document",
    });
  });
});
