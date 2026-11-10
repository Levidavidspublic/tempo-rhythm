/**
 * Step logic for v3 onboarding (docs/design/v3/screens/web/onboarding.html): five steps, one per
 * view, `?step=1..5` opens a step, steps 2 (name) and 4 (brain dump) can be skipped.
 */

export const ONBOARDING_STEPS = 5;

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

/** Steps with a "Skip for now" button. */
export function isOptionalStep(step: number): boolean {
  return step === 2 || step === 4;
}

/** `?step=` → a step from 1 to 5. Anything else opens step 1. */
export function parseStep(raw: string | null | undefined): OnboardingStep {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(ONBOARDING_STEPS, Math.max(1, n)) as OnboardingStep;
}

/** The name to start the field with: the profile's greeting name, never the "there" fallback. */
export function prefillName(greetingName: string | undefined): string {
  if (!greetingName || greetingName === "there") return "";
  return greetingName;
}

/**
 * Arguments for `users.completeOnboarding`. A skipped name step saves no name; a skipped later
 * step keeps the name that was entered. An empty or blank name is never sent.
 */
export function finishArgs(name: string, nameSkipped: boolean): { fullName?: string } {
  const trimmed = name.trim();
  if (nameSkipped || trimmed.length === 0) return {};
  return { fullName: trimmed };
}
