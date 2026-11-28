export type PasskeysView = "loading" | "signed-out" | "coming-soon" | "enabled";

/**
 * Which passkeys screen to show. Signed-out redirects belong to the server
 * proxy, so this never navigates: a lost client session shows a way back
 * instead of bouncing to /sign-in (which loops while the server cookie is valid).
 */
export function passkeysView(opts: {
  isLoading: boolean;
  isAuthenticated: boolean;
  passkeysEnabled: boolean;
}): PasskeysView {
  if (opts.isLoading) return "loading";
  if (!opts.isAuthenticated) return "signed-out";
  return opts.passkeysEnabled ? "enabled" : "coming-soon";
}
