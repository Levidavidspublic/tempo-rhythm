import { describe, expect, test } from "bun:test";
import {
  buildBeginTransaction,
  buildRollback,
  FirestoreTransactionError,
  readTransactionId,
} from "./firestore-transaction";

const projectId = "tempo-test";
const documentsUrl =
  "https://firestore.googleapis.com/v1/projects/tempo-test/databases/(default)/documents";

describe("Firestore transaction request builders", () => {
  test("builds a read-write begin request", () => {
    expect(buildBeginTransaction(projectId)).toEqual({
      url: `${documentsUrl}:beginTransaction`,
      body: { options: { readWrite: {} } },
    });
  });

  test("builds a read-only begin request", () => {
    expect(buildBeginTransaction(projectId, { readOnly: true }).body).toEqual({
      options: { readOnly: {} },
    });
  });

  test("adds a retry transaction only to read-write requests", () => {
    expect(buildBeginTransaction(projectId, { retryOf: "cmV0cnk=" }).body).toEqual({
      options: { readWrite: { retryTransaction: "cmV0cnk=" } },
    });
    expect(() => buildBeginTransaction(projectId, { readOnly: true, retryOf: "cmV0cnk=" })).toThrow(
      FirestoreTransactionError
    );
  });

  test("rejects invalid project ids for both builders", () => {
    expect(() => buildBeginTransaction("Bad/project")).toThrow(FirestoreTransactionError);
    expect(() => buildRollback("short", "dHg=")).toThrow(FirestoreTransactionError);
  });

  test("reads and validates a transaction id from the begin answer", () => {
    expect(readTransactionId({ transaction: "dHJhbnNhY3Rpb24=" })).toBe("dHJhbnNhY3Rpb24=");
    for (const answer of [
      {},
      { transaction: "" },
      { transaction: 3 },
      { transaction: "not_base64" },
    ]) {
      expect(() => readTransactionId(answer)).toThrow(FirestoreTransactionError);
    }
  });

  test("builds a rollback request and rejects an invalid transaction id", () => {
    expect(buildRollback(projectId, "dHJhbnNhY3Rpb24=")).toEqual({
      url: `${documentsUrl}:rollback`,
      body: { transaction: "dHJhbnNhY3Rpb24=" },
    });
    expect(() => buildRollback(projectId, "bad-id")).toThrow(FirestoreTransactionError);
  });
});

test("rejects a transaction id that cannot encode a byte", () => {
  expect(() => readTransactionId({ transaction: "A" })).toThrow(FirestoreTransactionError);
  expect(() => buildRollback(projectId, "A===")).toThrow(FirestoreTransactionError);
  expect(readTransactionId({ transaction: "YQ" })).toBe("YQ");
  expect(readTransactionId({ transaction: "YQ==" })).toBe("YQ==");
});

test("rejects a malformed retryOf before building the request", () => {
  expect(() => buildBeginTransaction(projectId, { retryOf: "bad-id" })).toThrow(
    FirestoreTransactionError
  );
  expect(() => buildBeginTransaction(projectId, { retryOf: "" })).toThrow(
    FirestoreTransactionError
  );
});
