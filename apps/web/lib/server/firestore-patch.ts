type PatchPrecondition = { exists: boolean } | { updateTime: string };

type PatchRequestInput = {
  projectId: string;
  documentPath: string;
  fields: Record<string, unknown>;
  updateMask: readonly string[];
  precondition?: PatchPrecondition;
};

type PatchRequestResult =
  | { ok: true; url: string; body: { fields: Record<string, unknown> } }
  | { ok: false; reason: string };

const SIMPLE_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Builds a Firestore REST PATCH request without performing any I/O. */
export function buildPatchRequest(input: PatchRequestInput): PatchRequestResult {
  if (input.projectId.trim() === "") {
    return { ok: false, reason: "projectId must not be blank" };
  }

  const pathSegments = input.documentPath.split("/");
  if (
    input.documentPath.trim() === "" ||
    pathSegments.some((segment) => segment === "") ||
    pathSegments.length % 2 !== 0
  ) {
    return { ok: false, reason: "documentPath must identify a document" };
  }

  if (input.updateMask.length === 0) {
    return { ok: false, reason: "updateMask must not be empty" };
  }

  const maskFields = new Set<string>();
  for (const fieldName of input.updateMask) {
    if (!SIMPLE_FIELD_NAME.test(fieldName)) {
      return { ok: false, reason: `updateMask contains an invalid field name: ${fieldName}` };
    }
    if (maskFields.has(fieldName)) {
      return { ok: false, reason: `updateMask contains a duplicate field name: ${fieldName}` };
    }
    maskFields.add(fieldName);
  }

  for (const fieldName of Object.keys(input.fields)) {
    if (!maskFields.has(fieldName)) {
      return { ok: false, reason: `fields contains a key not named in updateMask: ${fieldName}` };
    }
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/(default)/documents`;
  const encodedPath = pathSegments.map(encodeURIComponent).join("/");
  const query = new URLSearchParams();
  for (const fieldName of input.updateMask) {
    query.append("updateMask.fieldPaths", fieldName);
  }
  if (input.precondition) {
    if ("exists" in input.precondition) {
      query.set("currentDocument.exists", String(input.precondition.exists));
    } else {
      query.set("currentDocument.updateTime", input.precondition.updateTime);
    }
  }

  return {
    ok: true,
    url: `${baseUrl}/${encodedPath}?${query.toString()}`,
    body: { fields: input.fields },
  };
}

/** Builds the standard two-timestamp soft-delete update. */
export function buildSoftDeleteRequest(input: {
  projectId: string;
  documentPath: string;
  nowIso: string;
}): PatchRequestResult {
  return buildPatchRequest({
    projectId: input.projectId,
    documentPath: input.documentPath,
    fields: {
      deletedAt: { timestampValue: input.nowIso },
      updatedAt: { timestampValue: input.nowIso },
    },
    updateMask: ["deletedAt", "updatedAt"],
    precondition: { exists: true },
  });
}
