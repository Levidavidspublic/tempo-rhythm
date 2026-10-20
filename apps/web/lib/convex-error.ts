/** Convex public error data is safe copy; its wrapped message can contain a server trace. */
export function convexErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null || !("data" in error)) return fallback;
  const data = error.data;
  return typeof data === "string" && data.trim() && data.length <= 1000 ? data.trim() : fallback;
}
