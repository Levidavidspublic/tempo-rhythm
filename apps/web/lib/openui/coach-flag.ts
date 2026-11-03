/**
 * Feature flag `openui`: coach proposals, decision cards and Undo render through OpenUI
 * (`@openuidev/react-lang`) with Tempo's own components. Off, the same cards render directly
 * (components/coach/ChatProposal.tsx). Either way the card shows the server's stored proposal,
 * and Accept / Save / Not now / Undo run the same Convex mutations.
 *
 * Default: ON everywhere (production, preview and local builds, on any host) since 16 Oct 2026,
 * per Amit's beta brief. Per device, `?openui=off` switches it off and is remembered in
 * localStorage as `tempo-openui`; `?openui=on` switches it back on.
 */

export const OPENUI_FLAG_PARAM = "openui";
export const OPENUI_STORAGE_KEY = "tempo-openui";

type Choice = "on" | "off";

function asChoice(value: string | null | undefined): Choice | null {
  return value === "on" || value === "off" ? value : null;
}

/**
 * The default for this build: on for every Vercel environment and every host. The arguments
 * stay so callers don't change if a rollout ever needs to narrow it again.
 */
export function openUiDefault(_vercelEnv: string | undefined, _hostname: string): boolean {
  return true;
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
