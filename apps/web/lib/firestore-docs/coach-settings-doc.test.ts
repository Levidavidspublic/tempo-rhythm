import { describe, expect, test } from "bun:test";

import {
  COACH_SETTINGS_DEFAULTS,
  CoachSettingsDocError,
  isPanicActive,
  parseCoachSettingsDoc,
  readCoachSettings,
} from "./coach-settings-doc";

describe("coach settings Firestore document", () => {
  test("parses a valid document", () => {
    const doc = {
      dial: 5,
      taskLoad: 3,
      acceptedStreak: 2,
      updatedAt: 100,
      panicUntil: 200,
    };
    expect(parseCoachSettingsDoc(doc)).toEqual(doc);
  });

  test("refuses dial 11, fractional dial, and task load 5", () => {
    const base = { dial: 5, taskLoad: 2, acceptedStreak: 0, updatedAt: 100 };
<<<<<<< ours
    expect(() => parseCoachSettingsDoc({ ...base, dial: 11 })).toThrow("Invalid field: dial");
    expect(() => parseCoachSettingsDoc({ ...base, dial: 2.5 })).toThrow("Invalid field: dial");
    expect(() => parseCoachSettingsDoc({ ...base, taskLoad: 5 })).toThrow(
      "Invalid field: taskLoad"
=======
    expect(() => parseCoachSettingsDoc({ ...base, dial: 11 })).toThrow(
      "Invalid field: dial",
    );
    expect(() => parseCoachSettingsDoc({ ...base, dial: 2.5 })).toThrow(
      "Invalid field: dial",
    );
    expect(() => parseCoachSettingsDoc({ ...base, taskLoad: 5 })).toThrow(
      "Invalid field: taskLoad",
>>>>>>> theirs
    );
  });

  test("reads a missing document as the defaults", () => {
    expect(readCoachSettings(undefined, 123)).toEqual({
      ...COACH_SETTINGS_DEFAULTS,
      updatedAt: 123,
    });
<<<<<<< ours
    expect(readCoachSettings(null, 456)).toEqual({ ...COACH_SETTINGS_DEFAULTS, updatedAt: 456 });
=======
    expect(readCoachSettings(null, 456)).toEqual({
      ...COACH_SETTINGS_DEFAULTS,
      updatedAt: 456,
    });
>>>>>>> theirs
  });

  test("reads a soft-deleted document as the defaults", () => {
    const deleted = {
      dial: 9,
      taskLoad: 4,
      acceptedStreak: 7,
      updatedAt: 100,
      deletedAt: 200,
    };
    expect(readCoachSettings(deleted, 300)).toEqual({
      ...COACH_SETTINGS_DEFAULTS,
      updatedAt: 300,
    });
  });

  test("drops legacy keys and refuses an unknown key", () => {
    const legacy = {
      dial: 5,
      taskLoad: 2,
      acceptedStreak: 0,
      updatedAt: 100,
      userId: "user-1",
      _id: "settings-1",
      _creationTime: 50,
    };
    expect(parseCoachSettingsDoc(legacy)).toEqual({
      dial: 5,
      taskLoad: 2,
      acceptedStreak: 0,
      updatedAt: 100,
    });
    expect(() => parseCoachSettingsDoc({ ...legacy, surprise: true })).toThrow(
      new CoachSettingsDocError("surprise")
    );
  });

  test("reports panic only before panicUntil", () => {
    const base = { dial: 5, taskLoad: 2, acceptedStreak: 0, updatedAt: 100 };
    expect(isPanicActive({ ...base, panicUntil: 200 }, 199)).toBe(true);
    expect(isPanicActive({ ...base, panicUntil: 200 }, 200)).toBe(false);
    expect(isPanicActive(base, 199)).toBe(false);
  });
});
