import { FirestoreError } from "./firestore";
import { GcpAuthError } from "./gcp-access-token";

export const FAILURE_COPY_KEYS = [
  "fs.fail.retry",
  "fs.fail.sign-in-again",
  "fs.fail.not-allowed",
  "fs.fail.not-found",
  "fs.fail.conflict",
  "fs.fail.setup",
  "fs.fail.unknown",
] as const;

export type FirestoreFailure = {
  kind: "retry" | "sign-in-again" | "not-allowed" | "not-found" | "conflict" | "setup" | "unknown";
  httpStatus: number;
  retry: boolean;
  copyKey: string;
};

/** Reduces server-only failures to safe values that routes may return to clients. */
export function readFirestoreFailure(error: unknown): FirestoreFailure {
  if (error instanceof GcpAuthError) {
    return { kind: "setup", httpStatus: 503, retry: false, copyKey: "fs.fail.setup" };
  }

  if (error instanceof FirestoreError) {
    switch (error.status) {
      case 401:
        return {
          kind: "sign-in-again",
          httpStatus: 401,
          retry: false,
          copyKey: "fs.fail.sign-in-again",
        };
      case 403:
        return {
          kind: "not-allowed",
          httpStatus: 403,
          retry: false,
          copyKey: "fs.fail.not-allowed",
        };
      case 404:
        return {
          kind: "not-found",
          httpStatus: 404,
          retry: false,
          copyKey: "fs.fail.not-found",
        };
      case 409:
        return {
          kind: "conflict",
          httpStatus: 409,
          retry: error.detail.startsWith("ABORTED"),
          copyKey: "fs.fail.conflict",
        };
      case 429:
        return { kind: "retry", httpStatus: 503, retry: true, copyKey: "fs.fail.retry" };
      default:
        if (error.status >= 500 && error.status <= 599) {
          return { kind: "retry", httpStatus: 503, retry: true, copyKey: "fs.fail.retry" };
        }
    }
  }

  return { kind: "unknown", httpStatus: 500, retry: false, copyKey: "fs.fail.unknown" };
}
