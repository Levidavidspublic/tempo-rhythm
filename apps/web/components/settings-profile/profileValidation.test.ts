import { describe, expect, test } from "bun:test";
import { FULL_NAME_MAX_LENGTH, validateFullName } from "./profileValidation";

describe("validateFullName", () => {
  test("trims surrounding whitespace", () => {
    expect(validateFullName("  Ada Lovelace  ")).toEqual({
      ok: true,
      fullName: "Ada Lovelace",
    });
  });

  test("empty or whitespace-only input clears the name", () => {
    expect(validateFullName("")).toEqual({ ok: true, fullName: undefined });
    expect(validateFullName("   ")).toEqual({ ok: true, fullName: undefined });
  });

  test("accepts exactly the max length, even with padding", () => {
    const name = "a".repeat(FULL_NAME_MAX_LENGTH);
    expect(validateFullName(name)).toEqual({ ok: true, fullName: name });
    expect(validateFullName(` ${name} `)).toEqual({ ok: true, fullName: name });
  });

  test("rejects names longer than the max", () => {
    const result = validateFullName("a".repeat(FULL_NAME_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
  });
});
