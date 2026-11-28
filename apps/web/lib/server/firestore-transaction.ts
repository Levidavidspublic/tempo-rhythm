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

function isStructuredTransactionId(value: string): boolean {
  if (!TRANSACTION_ID.test(value)) return false;
  const pad = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const body = value.slice(0, value.length - pad);
  if (body.includes("=")) return false;
  if (value.length % 4 === 1) return false;
  if (pad === 1 && body.length % 4 !== 3) return false;
  if (pad === 2 && body.length % 4 !== 2) return false;
  return true;
}

function validateTransactionId(transaction: unknown): asserts transaction is string {
  if (typeof transaction !== "string" || !isStructuredTransactionId(transaction)) {
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

  if (options.retryOf !== undefined) validateTransactionId(options.retryOf);
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
