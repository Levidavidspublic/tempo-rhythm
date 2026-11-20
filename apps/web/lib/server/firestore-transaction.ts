export class FirestoreTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirestoreTransactionError";
  }
}

const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const TRANSACTION_ID = /^[A-Za-z0-9+/]+={0,2}$/;

function transactionUrl(projectId: string, operation: "beginTransaction" | "rollback"): string {
  if (!PROJECT_ID.test(projectId)) {
    throw new FirestoreTransactionError("Invalid project id");
  }

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:${operation}`;
}

function validateTransactionId(transaction: unknown): asserts transaction is string {
  if (typeof transaction !== "string" || !TRANSACTION_ID.test(transaction)) {
    throw new FirestoreTransactionError("Invalid transaction id");
  }
}

export function buildBeginTransaction(
  projectId: string,
  options: { readOnly?: boolean; retryOf?: string } = {}
): {
  url: string;
  body: {
    options: { readOnly: Record<string, never> } | { readWrite: { retryTransaction?: string } };
  };
} {
  if (options.readOnly && options.retryOf !== undefined) {
    throw new FirestoreTransactionError("A read-only transaction cannot retry a transaction");
  }

  const url = transactionUrl(projectId, "beginTransaction");
  if (options.readOnly) {
    return { url, body: { options: { readOnly: {} } } };
  }

  const readWrite = options.retryOf === undefined ? {} : { retryTransaction: options.retryOf };
  return { url, body: { options: { readWrite } } };
}

export function readTransactionId(answer: unknown): string {
  const transaction =
    typeof answer === "object" && answer !== null && "transaction" in answer
      ? answer.transaction
      : undefined;
  validateTransactionId(transaction);
  return transaction;
}

export function buildRollback(
  projectId: string,
  transaction: string
): { url: string; body: { transaction: string } } {
  validateTransactionId(transaction);
  return {
    url: transactionUrl(projectId, "rollback"),
    body: { transaction },
  };
}
