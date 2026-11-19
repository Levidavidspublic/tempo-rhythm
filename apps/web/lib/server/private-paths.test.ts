import { expect, test } from "bun:test";
import {
  PrivatePathError,
  privateCollectionPath,
  privateDocPath,
  sharedOauthClientPath,
} from "./private-paths";

test("builds a private document path", () => {
  expect(privateDocPath("user-1", "connections", "connection-1")).toBe(
    "private/user-1/connections/connection-1"
  );
});

test("builds a private collection path", () => {
  expect(privateCollectionPath("user-1", "voiceLeases")).toBe(
    "private/user-1/voiceLeases"
  );
});

test("builds the shared OAuth client path", () => {
  expect(sharedOauthClientPath("google")).toBe(
    "private/shared/oauthClients/google"
  );
});

test("refuses unknown and account collections", () => {
  for (const collection of ["unknown", "account"]) {
    expect(() =>
      privateDocPath("user-1", collection as "connections", "doc-1")
    ).toThrow(PrivatePathError);
  }
});

test("refuses invalid path segments", () => {
  for (const segment of ["", "has/slash", "..", "__name__"]) {
    expect(() => privateDocPath(segment, "connections", "doc-1")).toThrow(
      PrivatePathError
    );
    expect(() => privateDocPath("user-1", "connections", segment)).toThrow(
      PrivatePathError
    );
    expect(() => sharedOauthClientPath(segment)).toThrow(PrivatePathError);
  }
});

test("refuses the shared uid without exposing it as user data", () => {
  expect(() => privateCollectionPath("shared", "connections")).toThrow(
    PrivatePathError
  );
});
