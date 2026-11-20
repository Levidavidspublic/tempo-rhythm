export const MAX_BEARER_TOKEN_LENGTH = 4096;

export type BearerTokenResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: "missing" | "not-bearer" | "empty" | "too-long" | "malformed";
    };

const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function readBearerToken(header: string | null | undefined): BearerTokenResult {
  const value = header?.trim();

  if (!value) {
    return { ok: false, reason: "missing" };
  }

  const separatorIndex = value.search(/\s/);
  const scheme = separatorIndex === -1 ? value : value.slice(0, separatorIndex);

  if (scheme.toLowerCase() !== "bearer") {
    return { ok: false, reason: "not-bearer" };
  }

  const token = separatorIndex === -1 ? "" : value.slice(separatorIndex).trim();

  if (!token) {
    return { ok: false, reason: "empty" };
  }

  if (token.length > MAX_BEARER_TOKEN_LENGTH) {
    return { ok: false, reason: "too-long" };
  }

  if (!BEARER_TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "malformed" };
  }

  return { ok: true, token };
}

export function readBearerTokenFromHeaders(headers: {
  get(name: string): string | null;
}): BearerTokenResult {
  return readBearerToken(headers.get("authorization"));
}
