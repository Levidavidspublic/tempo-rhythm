import { expect, test } from "bun:test";
import {
  OWNER_COLLECTIONS,
  OwnerPathError,
  ownerCollectionPath,
  ownerDocPath,
  userDocPath,
} from "./owner-paths";

test("lists the 25 unique owner collections", () => {
  expect(OWNER_COLLECTIONS).toHaveLength(25);
  expect(new Set(OWNER_COLLECTIONS).size).toBe(25);
  expect(OWNER_COLLECTIONS).toContain("tasks");
  expect(OWNER_COLLECTIONS).toContain("messages");
});

test("builds user, owner collection, and owner document paths", () => {
  expect(userDocPath("user-1")).toBe("users/user-1");
  expect(ownerCollectionPath("user-1", "tasks")).toBe("users/user-1/tasks");
  expect(ownerDocPath("user-1", "tasks", "task-1")).toBe("users/user-1/tasks/task-1");
});

test("rejects every private collection", () => {
  const privateCollections = [
    "connections",
    "connectionCalls",
    "connectionLimits",
    "connectionSecrets",
    "oauthPending",
    "mcpTokens",
    "oauthClients",
    "subscriptionStates",
    "voiceSessions",
    "voiceLeases",
    "account",
  ];

  for (const collection of privateCollections) {
    expect(() => ownerDocPath("user-1", collection as "tasks", "doc-1")).toThrow(OwnerPathError);
  }
});

test("rejects an unknown collection", () => {
  expect(() => ownerCollectionPath("user-1", "tasks_v2" as "tasks")).toThrow(OwnerPathError);
});

test("rejects invalid uid and document id segments", () => {
  const invalidSegments = ["", "has/slash", ".", "..", "__x__"];

  for (const segment of invalidSegments) {
    expect(() => userDocPath(segment)).toThrow(OwnerPathError);
    expect(() => ownerDocPath("user-1", "tasks", segment)).toThrow(OwnerPathError);
  }
});

test("does not include rejected uid or document id values in errors", () => {
  const uid = "private/user-value";
  const docId = "private/document-value";

  for (const build of [() => userDocPath(uid), () => ownerDocPath("user-1", "tasks", docId)]) {
    try {
      build();
      throw new Error("Expected path validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OwnerPathError);
      expect(String(error)).not.toContain(uid);
      expect(String(error)).not.toContain(docId);
    }
  }
});
