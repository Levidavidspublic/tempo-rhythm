type Refusal = {
  status: number;
  code: string;
  copyKey: string;
  retry?: boolean;
};

/** Builds a successful JSON response that must not be cached. */
export function okReply(data: unknown, status = 200): Response {
  if (!Number.isInteger(status) || status < 200 || status > 299) {
    throw new TypeError("Successful reply status must be between 200 and 299");
  }

  return Response.json({ ok: true, data }, { status, headers: { "cache-control": "no-store" } });
}

/** Builds a client-safe refusal without exposing server error details. */
export function refusalReply({ status, code, copyKey, retry }: Refusal): Response {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new TypeError("Refusal reply status must be between 400 and 599");
  }
  if (!code.trim() || !copyKey.trim()) {
    throw new TypeError("Refusal reply code and copy key must not be blank");
  }

  const headers = new Headers({ "cache-control": "no-store" });
  if (status === 401) {
    headers.set("www-authenticate", "Bearer");
  }
  if (retry === true && status === 503) {
    headers.set("retry-after", "1");
  }

  return Response.json(
    { ok: false, code, copyKey, ...(retry === true ? { retry: true } : {}) },
    { status, headers }
  );
}
