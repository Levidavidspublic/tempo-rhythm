/**
 * Profile form checks (docs/design/v3/screens/web/settings-profile.html). On Save, missing fields
 * become a summary at the top that links to each field, plus an error under the field.
 */

export type ProfileFieldId = "profile-name";

export type ProfileError = { field: ProfileFieldId; message: "set.profile.nameErr" };

export type ProfileValues = { fullName: string };

export function profileErrors(values: ProfileValues): ProfileError[] {
  const errors: ProfileError[] = [];
  if (values.fullName.trim().length === 0) {
    errors.push({ field: "profile-name", message: "set.profile.nameErr" });
  }
  return errors;
}
