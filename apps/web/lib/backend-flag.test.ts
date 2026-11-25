import { describe, expect, test } from "bun:test";
import { parseDataBackend } from "./backend-flag";

const convexDefaults = [undefined, "", "convex", "Firebase", "other", "InsForge", "insforge2"];

describe("parseDataBackend", () => {
  test.each(convexDefaults)("defaults %p to convex", (raw) => {
    expect(parseDataBackend(raw)).toBe("convex");
  });

  test.each(["firebase", " firebase "])("accepts %p as firebase", (raw) => {
    expect(parseDataBackend(raw)).toBe("firebase");
  });

  test.each(["insforge", " insforge "])("accepts %p as insforge", (raw) => {
    expect(parseDataBackend(raw)).toBe("insforge");
  });
});
