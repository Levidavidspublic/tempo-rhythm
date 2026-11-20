const MAX_NEXT_PATH_LENGTH = 512;

function hasUnsafePathCharacter(path: string): boolean {
  return Array.from(path).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127;
  });
}

export function safeNextPath(raw: string | null | undefined): string | null {
  const path = raw?.trim();

  if (
    !path ||
    path.length > MAX_NEXT_PATH_LENGTH ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    hasUnsafePathCharacter(path) ||
    path.includes("://")
  ) {
    return null;
  }

  return path;
}

export type EmailLinkSettings = Readonly<{ url: string; handleCodeInApp: true }>;

export function buildEmailLinkSettings(input: {
  origin: string;
  next?: string | null;
}): EmailLinkSettings | null {
  let origin: URL;

  try {
    origin = new URL(input.origin);
  } catch {
    return null;
  }

  const isAllowedProtocol =
    origin.protocol === "https:" ||
    (origin.protocol === "http:" && origin.hostname === "localhost");

  if (
    !isAllowedProtocol ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    return null;
  }

  const nextPath = safeNextPath(input.next);
  const url = `${origin.origin}/sign-in${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  return Object.freeze({ url, handleCodeInApp: true });
}
