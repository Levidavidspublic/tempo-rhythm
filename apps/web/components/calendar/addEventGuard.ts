export const SIGNED_OUT_MESSAGE = "Sign in to add calendar events.";
export const SERVER_ERROR_MESSAGE = "We could not add that event yet. Please try again in a moment.";

/** What the Add event form should do given the Convex auth state at submit time. */
export type AddEventAuthState = "wait" | "signed-out" | "ready";

export function getAddEventAuthState(auth: {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: unknown | null | undefined;
}): AddEventAuthState {
  if (auth.isLoading) return "wait";
  if (!auth.isAuthenticated) return "signed-out";
  return auth.profile == null ? "wait" : "ready";
}

/** Calm copy for a failed create; never surfaces raw Convex text or JSON. */
export function toAddEventErrorMessage(_err: unknown): string {
  return SERVER_ERROR_MESSAGE;
}
