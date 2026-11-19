import { expect, test } from "bun:test";
import { buildBatchGetRequest, buildGetRequest, MAX_BATCH_GET_DOCUMENTS } from "./firestore-get";

const PROJECT_ID = "demo-project";

test("builds the GET address for a document", () => {
  expect(buildGetRequest(PROJECT_ID, "private/u1/account/gate")).toEqual({
    method: "GET",
    url: "https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/private/u1/account/gate",
  });
});

test("encodes each document path segment", () => {
  expect(buildGetRequest(PROJECT_ID, "private/user name").url).toEndWith(
    "/documents/private/user%20name"
  );
});

test("adds unique mask fields in their given order", () => {
  expect(buildGetRequest(PROJECT_ID, "private/u1", ["name", "status", "name"]).url).toEndWith(
    "?mask.fieldPaths=name&mask.fieldPaths=status"
  );
});

test("refuses a collection path", () => {
  expect(() => buildGetRequest(PROJECT_ID, "private/u1/account")).toThrow(
    "documentPath must identify a document"
  );
});

test("refuses empty and dot-dot path segments", () => {
  expect(() => buildGetRequest(PROJECT_ID, "private//account/gate")).toThrow(
    "documentPath must not contain an empty segment"
  );
  expect(() => buildGetRequest(PROJECT_ID, "private/../account/gate")).toThrow(
    "documentPath must not contain dot segments"
  );
});

test("refuses an invalid field path", () => {
  expect(() => buildGetRequest(PROJECT_ID, "private/u1", ["profile.name"])).toThrow(
    "fieldPaths contains an invalid field path"
  );
});

test("builds a batch-get body with full resource names and a mask", () => {
  expect(
    buildBatchGetRequest(PROJECT_ID, ["private/u1", "accounts/a1"], ["name", "status"])
  ).toEqual({
    method: "POST",
    url: "https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents:batchGet",
    body: {
      documents: [
        "projects/demo-project/databases/(default)/documents/private/u1",
        "projects/demo-project/databases/(default)/documents/accounts/a1",
      ],
      mask: { fieldPaths: ["name", "status"] },
    },
  });
});

test("refuses an empty, oversized, or duplicate batch", () => {
  expect(() => buildBatchGetRequest(PROJECT_ID, [])).toThrow(
    "documentPaths must contain at least one path"
  );
  const oversized = Array.from(
    { length: MAX_BATCH_GET_DOCUMENTS + 1 },
    (_, index) => `private/u${index}`
  );
  expect(() => buildBatchGetRequest(PROJECT_ID, oversized)).toThrow(
    `documentPaths must contain at most ${MAX_BATCH_GET_DOCUMENTS} paths`
  );
  expect(() => buildBatchGetRequest(PROJECT_ID, ["private/u1", "private/u1"])).toThrow(
    "documentPaths contains a duplicate path"
  );
});
