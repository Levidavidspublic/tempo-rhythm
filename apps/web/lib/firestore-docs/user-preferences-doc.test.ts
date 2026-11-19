import { describe, expect, test } from "bun:test";
import {
  checkUserPreferencesDoc,
  defaultUserPreferences,
  type UserPreferencesDoc,
} from "./user-preferences-doc";

const validDocument: UserPreferencesDoc = {
  theme: "system",
  locale: "en",
  weekStartsOn: 1,
  timeZone: "UTC",
  emailReminders: true,
  inAppNotifications: true,
  createdAt: 100,
  updatedAt: 200,
};

describe("checkUserPreferencesDoc", () => {
  test("accepts a valid preferences document", () => {
    expect(checkUserPreferencesDoc(validDocument)).toEqual({
      ok: true,
      doc: validDocument,
    });
  });

  test("refuses a userId because ownership comes from the document path", () => {
    expect(
      checkUserPreferencesDoc({ ...validDocument, userId: "user-1" }),
    ).toMatchObject({ ok: false });
  });

  test("refuses an unknown theme", () => {
    expect(
      checkUserPreferencesDoc({ ...validDocument, theme: "sepia" }),
    ).toMatchObject({ ok: false });
  });

  test("refuses an unsupported week start", () => {
    expect(
      checkUserPreferencesDoc({ ...validDocument, weekStartsOn: 2 }),
    ).toMatchObject({ ok: false });
  });

  test("refuses an invalid time zone", () => {
    expect(
      checkUserPreferencesDoc({ ...validDocument, timeZone: "Mars/Olympus" }),
    ).toMatchObject({ ok: false });
  });

  test("accepts the Jerusalem time zone with Hebrew locale", () => {
    const document = {
      ...validDocument,
      locale: "he" as const,
      timeZone: "Asia/Jerusalem",
    };
    expect(checkUserPreferencesDoc(document)).toEqual({
      ok: true,
      doc: document,
    });
  });

  test("builds valid defaults with the supplied creation time", () => {
    const defaults = defaultUserPreferences(1000);
    expect(checkUserPreferencesDoc(defaults).ok).toBe(true);
    expect(defaults.createdAt).toBe(1000);
  });
});
