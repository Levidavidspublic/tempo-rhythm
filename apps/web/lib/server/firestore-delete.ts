type DeletePrecondition = { exists: true } | { updateTime: string };

type DeleteRequestInput = {
  projectId: string;
  documentPath: string;
  precondition?: DeletePrecondition;
};

type DeleteRequestResult =
  | { ok: true; method: "DELETE"; url: string }
  | { ok: false; reason: string };

/** Builds a Firestore REST DELETE request without performing any I/O. */
export function buildDeleteRequest(input: DeleteRequestInput): DeleteRequestResult {
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

  if (
    input.precondition &&
    "updateTime" in input.precondition &&
    input.precondition.updateTime.trim() === ""
  ) {
    return { ok: false, reason: "precondition updateTime must not be blank" };
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/(default)/documents`;
  const encodedPath = pathSegments.map(encodeURIComponent).join("/");
  const query = new URLSearchParams();

  if (input.precondition) {
    if ("exists" in input.precondition) {
      query.set("currentDocument.exists", "true");
    } else {
      query.set("currentDocument.updateTime", input.precondition.updateTime);
    }
  }

  const queryString = query.toString();
  return {
    ok: true,
    method: "DELETE",
    url: `${baseUrl}/${encodedPath}${queryString === "" ? "" : `?${queryString}`}`,
  };
}
