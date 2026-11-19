import { describe, expect, test } from "bun:test";

import { readListenError } from "./listen-error";

describe("readListenError", () => {
  test("reads an unauthenticated error as sign-in-again", () => {
    expect(readListenError({ code: "firestore/unauthenticated" })).toEqual({
      kind: "sign-in-again",
      retry: false,
      copyKey: "fs.listen.sign-in-again",
    });
  });

  test("reads a permission error as not-allowed", () => {
    expect(readListenError({ code: "permission-denied" })).toEqual({
      kind: "not-allowed",
      retry: false,
      copyKey: "fs.listen.not-allowed",
    });
  });

  test("reads transient errors as retryable offline failures", () => {
    for (const code of [
      "unavailable",
      "deadline-exceeded",
      "resource-exhausted",
      "aborted",
      "cancelled",
    ]) {
      expect(readListenError({ code: `firestore/${code}` })).toEqual({
        kind: "offline",
        retry: true,
        copyKey: "fs.listen.offline",
      });
    }
  });

  test("reads configuration errors as setup failures", () => {
    for (const code of [
      "failed-precondition",
      "invalid-argument",
      "not-found",
      "unimplemented",
    ]) {
      expect(readListenError({ code })).toEqual({
        kind: "setup",
        retry: false,
        copyKey: "fs.listen.setup",
      });
    }
  });

  test("reads an unrecognized code as unknown without exposing it", () => {
    expect(
      readListenError({ code: "internal", message: "private details" }),
    ).toEqual({
      kind: "unknown",
      retry: false,
      copyKey: "fs.listen.unknown",
    });
  });

  test("reads values without a string code as unknown", () => {
    for (const error of [null, "unavailable", { code: 503 }]) {
      expect(readListenError(error)).toEqual({
        kind: "unknown",
        retry: false,
        copyKey: "fs.listen.unknown",
      });
    }
  });
});
