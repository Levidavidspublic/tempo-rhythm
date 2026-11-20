import { describe, expect, test } from "bun:test";
import { FirestoreError } from "./firestore";
import { readFirestoreFailure } from "./firestore-failure";

describe("readFirestoreFailure", () => {
  test("maps 401 to sign-in-again", () => {
    expect(readFirestoreFailure(new FirestoreError(401))).toEqual({
      kind: "sign-in-again",
      httpStatus: 401,
      retry: false,
      copyKey: "fs.fail.sign-in-again",
    });
  });

  test("maps 403 to not-allowed", () => {
    expect(readFirestoreFailure(new FirestoreError(403))).toEqual({
      kind: "not-allowed",
      httpStatus: 403,
      retry: false,
      copyKey: "fs.fail.not-allowed",
    });
  });

  test("only retries an ABORTED 409 conflict", () => {
    expect(readFirestoreFailure(new FirestoreError(409, "ABORTED: contention"))).toEqual({
      kind: "conflict",
      httpStatus: 409,
      retry: true,
      copyKey: "fs.fail.conflict",
    });
    expect(readFirestoreFailure(new FirestoreError(409, "ALREADY_EXISTS"))).toEqual({
      kind: "conflict",
      httpStatus: 409,
      retry: false,
      copyKey: "fs.fail.conflict",
    });
  });

  test("maps 503 to retry with a client-safe 503", () => {
    expect(readFirestoreFailure(new FirestoreError(503))).toEqual({
      kind: "retry",
      httpStatus: 503,
      retry: true,
      copyKey: "fs.fail.retry",
    });
  });

  test("maps a plain Error to unknown", () => {
    expect(readFirestoreFailure(new Error("private failure"))).toEqual({
      kind: "unknown",
      httpStatus: 500,
      retry: false,
      copyKey: "fs.fail.unknown",
    });
  });

  test("does not copy Firestore detail into the result", () => {
    const detail = "ABORTED: private Google detail";

    expect(JSON.stringify(readFirestoreFailure(new FirestoreError(409, detail)))).not.toContain(
      detail
    );
  });
});
