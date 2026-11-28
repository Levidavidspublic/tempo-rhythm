export type CrisisResource = {
  label: string;
  detail: string;
};

export type CrisisCardCopy = {
  title: string;
  body: string;
  resources: CrisisResource[];
};

/** Fixed product line (PRD §1). Not model-written. */
export const COACH_NOT_THERAPIST = "Tempo is a coach, not a therapist or counselor.";

/**
 * Shown while `api.crisis.resourcesCard` has not loaded or has failed.
 * Body text is fixed. The per-country helpline source is UNKNOWN.
 */
export const FALLBACK_CARD: CrisisCardCopy = {
  title: "Help is available",
  body: "If you are in danger or thinking of hurting yourself, contact your local emergency number now. You can also reach out to someone you trust.",
  resources: [],
};

export function formatResource(resource: CrisisResource): string {
  return `${resource.label}: ${resource.detail}`;
}
