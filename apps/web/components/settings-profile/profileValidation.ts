export const FULL_NAME_MAX_LENGTH = 80;

export type FullNameResult =
  | { ok: true; fullName: string | undefined }
  | { ok: false; error: string };

/** Trims the name; an empty result clears the stored name (`undefined`). */
export function validateFullName(input: string): FullNameResult {
  const trimmed = input.trim();
  if (trimmed.length > FULL_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Name can be at most ${FULL_NAME_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, fullName: trimmed === "" ? undefined : trimmed };
}
