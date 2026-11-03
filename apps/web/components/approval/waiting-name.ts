/**
 * The optional "What should Tempo call you?" field on the waiting-for-approval screen
 * (TEMPO-B07-14). It saves through `users.updateMyProfile`, which only refuses a blank name, so
 * the length cap lives here. Today's greeting reads the same `fullName` once the account is open.
 */

/** No backend cap exists, so the screen keeps names to this many characters. */
export const WAITING_NAME_MAX = 60;

/** The placeholder some sign-in paths used to store; never offered back as a name. */
const PLACEHOLDER_NAME = "User";

export type WaitingNameProblem = "empty" | "tooLong";

export type WaitingNameCheck = { ok: true; name: string } | { ok: false; problem: WaitingNameProblem };

/** The kind hint shown under the field for each problem (keys in lib/i18n.ts). */
export const WAITING_NAME_HINT = {
  empty: "approval.nameEmpty",
  tooLong: "approval.nameTooLong",
} as const satisfies Record<WaitingNameProblem, string>;

/** Characters as a person counts them, so a Hebrew name or an emoji counts once per letter. */
function charCount(text: string): number {
  return Array.from(text).length;
}

/** Trims the typed name, then refuses an empty one or one longer than WAITING_NAME_MAX. */
export function checkWaitingName(raw: string): WaitingNameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, problem: "empty" };
  if (charCount(name) > WAITING_NAME_MAX) return { ok: false, problem: "tooLong" };
  return { ok: true, name };
}

/**
 * The name to start the field with: the profile's own name, never the old "User" placeholder and
 * never a copy of the email or its handle (the part before "@"), which is not a name the person chose.
 */
export function prefillWaitingName(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim() ?? "";
  if (name.length === 0 || name === PLACEHOLDER_NAME) return "";
  const mail = email?.trim().toLowerCase() ?? "";
  const handle = mail.split("@")[0] ?? "";
  const lower = name.toLowerCase();
  if (lower === mail || (handle.length > 0 && lower === handle)) return "";
  return name;
}
