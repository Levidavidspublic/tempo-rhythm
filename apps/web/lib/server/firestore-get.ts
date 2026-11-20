const FIRESTORE_API_ROOT = "https://firestore.googleapis.com/v1/projects";
const SIMPLE_FIELD_PATH = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_SEGMENT = /^__.*__$/;

export const MAX_BATCH_GET_DOCUMENTS = 20;

function checkProjectId(projectId: string): void {
  if (projectId.trim() === "") {
    throw new Error("projectId must not be empty");
  }
}

function checkDocumentPath(path: string): string[] {
  const segments = path.split("/");
  if (
    path === "" ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    segments.length < 2 ||
    segments.length % 2 !== 0
  ) {
    throw new Error("documentPath must identify a document");
  }

  for (const segment of segments) {
    if (segment === "") {
      throw new Error("documentPath must not contain an empty segment");
    }
    if (segment === "." || segment === "..") {
      throw new Error("documentPath must not contain dot segments");
    }
    if (RESERVED_SEGMENT.test(segment)) {
      throw new Error("documentPath must not contain a reserved segment");
    }
  }

  return segments;
}

function uniqueFieldPaths(fieldPaths: string[] = []): string[] {
  const unique = new Set<string>();
  for (const fieldPath of fieldPaths) {
    if (!SIMPLE_FIELD_PATH.test(fieldPath)) {
      throw new Error(`fieldPaths contains an invalid field path: ${fieldPath}`);
    }
    unique.add(fieldPath);
  }
  return [...unique];
}

function databaseRoot(projectId: string): string {
  return `${FIRESTORE_API_ROOT}/${encodeURIComponent(projectId)}/databases/(default)`;
}

/** Builds a Firestore REST document GET request without performing any I/O. */
export function buildGetRequest(
  projectId: string,
  documentPath: string,
  fieldPaths?: string[]
): { method: "GET"; url: string } {
  checkProjectId(projectId);
  const segments = checkDocumentPath(documentPath);
  const mask = uniqueFieldPaths(fieldPaths);
  const url = new URL(
    `${databaseRoot(projectId)}/documents/${segments.map(encodeURIComponent).join("/")}`
  );
  for (const fieldPath of mask) {
    url.searchParams.append("mask.fieldPaths", fieldPath);
  }

  return { method: "GET", url: url.toString() };
}

/** Builds a Firestore documents:batchGet request without performing any I/O. */
export function buildBatchGetRequest(
  projectId: string,
  documentPaths: string[],
  fieldPaths?: string[]
): {
  method: "POST";
  url: string;
  body: { documents: string[]; mask?: { fieldPaths: string[] } };
} {
  checkProjectId(projectId);
  if (documentPaths.length === 0) {
    throw new Error("documentPaths must contain at least one path");
  }
  if (documentPaths.length > MAX_BATCH_GET_DOCUMENTS) {
    throw new Error(`documentPaths must contain at most ${MAX_BATCH_GET_DOCUMENTS} paths`);
  }

  const seen = new Set<string>();
  for (const path of documentPaths) {
    checkDocumentPath(path);
    if (seen.has(path)) {
      throw new Error(`documentPaths contains a duplicate path: ${path}`);
    }
    seen.add(path);
  }

  const mask = uniqueFieldPaths(fieldPaths);
  const body: { documents: string[]; mask?: { fieldPaths: string[] } } = {
    documents: documentPaths.map(
      (path) => `projects/${projectId}/databases/(default)/documents/${path}`
    ),
  };
  if (mask.length > 0) {
    body.mask = { fieldPaths: mask };
  }

  return {
    method: "POST",
    url: `${databaseRoot(projectId)}/documents:batchGet`,
    body,
  };
}
