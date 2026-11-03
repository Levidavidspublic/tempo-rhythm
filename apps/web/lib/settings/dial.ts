/**
 * Coach dial for the v3 settings and onboarding screens (docs/design/v3/tempo.css "Dial"):
 * a whole number from 0 to 10, shown as a number and a word.
 * Words: quiet 0–3, steady 4–7, push 8–10.
 */

export const DIAL_MIN = 0;
export const DIAL_MAX = 10;
/** Where the design starts a new person (settings-prefs.html, onboarding.html). */
export const DIAL_DEFAULT = 4;

export type DialWord = "quiet" | "steady" | "push";

/** A whole number from 0 to 10. Anything that is not a finite number becomes the default. */
export function clampDial(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DIAL_DEFAULT;
  return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(value)));
}

export function dialWord(value: number): DialWord {
  const dial = clampDial(value);
  if (dial <= 3) return "quiet";
  if (dial <= 7) return "steady";
  return "push";
}
