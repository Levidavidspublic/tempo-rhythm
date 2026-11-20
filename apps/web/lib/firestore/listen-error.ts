export const LISTEN_COPY_KEYS = [
  "fs.listen.sign-in-again",
  "fs.listen.not-allowed",
  "fs.listen.offline",
  "fs.listen.setup",
  "fs.listen.unknown",
] as const;

export type ListenFailure = {
  kind: "sign-in-again" | "not-allowed" | "offline" | "setup" | "unknown";
  retry: boolean;
  copyKey: (typeof LISTEN_COPY_KEYS)[number];
};

const unknownFailure: ListenFailure = {
  kind: "unknown",
  retry: false,
  copyKey: "fs.listen.unknown",
};

export function readListenError(error: unknown): ListenFailure {
  let code: string | undefined;

  try {
    if ((typeof error === "object" && error !== null) || typeof error === "function") {
      const candidate = (error as { code?: unknown }).code;
      code = typeof candidate === "string" ? candidate : undefined;
    }
  } catch {
    return unknownFailure;
  }

  const normalizedCode = code?.replace(/^firestore\//, "");

  switch (normalizedCode) {
    case "unauthenticated":
      return {
        kind: "sign-in-again",
        retry: false,
        copyKey: "fs.listen.sign-in-again",
      };
    case "permission-denied":
      return {
        kind: "not-allowed",
        retry: false,
        copyKey: "fs.listen.not-allowed",
      };
    case "unavailable":
    case "deadline-exceeded":
    case "resource-exhausted":
    case "aborted":
    case "cancelled":
      return {
        kind: "offline",
        retry: true,
        copyKey: "fs.listen.offline",
      };
    case "failed-precondition":
    case "invalid-argument":
    case "not-found":
    case "unimplemented":
      return {
        kind: "setup",
        retry: false,
        copyKey: "fs.listen.setup",
      };
    default:
      return unknownFailure;
  }
}
