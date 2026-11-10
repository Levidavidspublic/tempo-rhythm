/**
 * One place for server-side problem logs (Vercel runtime logs).
 * Callers pass a fixed scope and a short message: never an email, a token or a request body.
 */
export function logServerProblem(scope: string, message: string): void {
  // biome-ignore lint/suspicious/noConsole: the runtime log is where a function reports a problem
  console.error(`[${scope}] ${message}`);
}
