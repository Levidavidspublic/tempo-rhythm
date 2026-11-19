import type { FirestoreFields } from "./firestore";

export type CommitWrite =
  | {
      kind: "create";
      path: string;
      fields: FirestoreFields;
    }
  | {
      kind: "update";
      path: string;
      fields: FirestoreFields;
      changedFields: string[];
      ifUpdateTime?: string;
    };

type CommitRequest =
  | { ok: true; url: string; body: { writes: Record<string, unknown>[] } }
  | { ok: false; reason: string };

const refuse = (reason: string): CommitRequest => ({ ok: false, reason });

/** Build a Firestore REST commit request without performing any I/O. */
export function buildCommitRequest(projectId: string, writes: CommitWrite[]): CommitRequest {
  if (projectId.trim().length === 0) return refuse("project id is required");
  if (writes.length === 0) return refuse("at least one write is required");
  if (writes.length > 20) return refuse("at most 20 writes are allowed");

  const seenPaths = new Set<string>();
  let batchUid: string | undefined;

  for (const write of writes) {
    const segments = write.path.split("/");
    if (segments.length % 2 !== 0 || segments.some((segment) => segment.length === 0)) {
      return refuse("document path is invalid");
    }
    if (segments[0] !== "users" && segments[0] !== "private") {
      return refuse("document path root is not allowed");
    }

    const uid = segments[1];
    if (batchUid !== undefined && uid !== batchUid) return refuse("writes must share one uid");
    batchUid = uid;

    if (seenPaths.has(write.path)) return refuse("document path is duplicated");
    seenPaths.add(write.path);

    if (write.kind === "update") {
      if (write.changedFields.length === 0) return refuse("update must change at least one field");
      if (write.changedFields.some((field) => !Object.hasOwn(write.fields, field))) {
        return refuse("changed field is missing from fields");
      }
    }
  }

  const project = encodeURIComponent(projectId);
  const database = `projects/${projectId}/databases/(default)/documents`;
  const commitWrites = writes.map((write) => {
    const result: Record<string, unknown> = {
      update: { name: `${database}/${write.path}`, fields: write.fields },
    };
    if (write.kind === "create") {
      result.currentDocument = { exists: false };
    } else {
      result.updateMask = { fieldPaths: write.changedFields };
      result.currentDocument = write.ifUpdateTime
        ? { updateTime: write.ifUpdateTime }
        : { exists: true };
    }
    return result;
  });

  return {
    ok: true,
    url: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`,
    body: { writes: commitWrites },
  };
}
