/**
 * Feature flag `openui`: coach proposals, decision cards and Undo render through OpenUI
 * (`@openuidev/react-lang`) with Tempo's own components. Off, the same cards render directly
 * (components/coach/ChatProposal.tsx). Either way the card shows the server's stored proposal,
 * and Accept / Save / Not now / Undo run the same Convex mutations.
 *
 * Default: ON on preview and local builds, OFF on production, so a promotion to tempoflow.dev
 * doesn't switch it on by itself. Per device it can be forced with `?openui=on` or `?openui=off`
 * (kept in localStorage as `tempo-openui`).
 */

export const OPENUI_FLAG_PARAM = "openui";
export const OPENUI_STORAGE_KEY = "tempo-openui";

/** The production domains, for builds where Vercel's environment name isn't available. */
const PRODUCTION_HOSTS = new Set(["tempoflow.dev", "www.tempoflow.dev"]);

type Choice = "on" | "off";

function asChoice(value: string | null | undefined): Choice | null {
  return value === "on" || value === "off" ? value : null;
}

/** The default for this build: Vercel's environment name first, then the host. */
export function openUiDefault(vercelEnv: string | undefined, hostname: string): boolean {
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  return !PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

/** The URL parameter wins, then this device's stored choice, then the build default. */
export function resolveOpenUi(param: string | null, stored: string | null, fallback: boolean): boolean {
  const choice = asChoice(param) ?? asChoice(stored);
  return choice ? choice === "on" : fallback;
}

/** The choice to store on this device when the URL carries one, else null. */
export function choiceToStore(param: string | null): Choice | null {
  return asChoice(param);
}
