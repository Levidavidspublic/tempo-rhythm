import { describe, expect, test } from "bun:test";
import { checkProfilePatch } from "./profile-doc";

describe("checkProfilePatch", () => {
  test("fullName is trimmed and passes", () => {
    expect(checkProfilePatch({ fullName: "  Tempo Worker  " })).toEqual({
      ok: true,
      patch: { fullName: "Tempo Worker" },
    });
  });

  test("role is refused as a gate field", () => {
    expect(checkProfilePatch({ role: "admin" })).toEqual({
      ok: false,
      reason: "gate-field",
      field: "role",
    });
  });

  test("approvalStatus is refused as a gate field", () => {
    expect(checkProfilePatch({ approvalStatus: "approved" })).toEqual({
      ok: false,
      reason: "gate-field",
      field: "approvalStatus",
    });
  });

  test("an unknown key is refused", () => {
    expect(checkProfilePatch({ nickname: "Tempo" })).toEqual({
      ok: false,
      reason: "unknown-field",
      field: "nickname",
    });
  });

  test("a 121-character name is refused", () => {
    expect(checkProfilePatch({ name: "x".repeat(121) })).toEqual({
      ok: false,
      reason: "invalid-value",
      field: "name",
    });
  });

  test("an empty object is refused", () => {
    expect(checkProfilePatch({})).toEqual({ ok: false, reason: "empty-patch" });
  });
});
