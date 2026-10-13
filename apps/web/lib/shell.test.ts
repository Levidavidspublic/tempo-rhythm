import { describe, expect, test } from "bun:test";
import { crumbKey, initialsFor, isCurrent } from "./shell";

describe("isCurrent", () => {
  test("matches the route and the routes below it, not siblings", () => {
    expect(isCurrent("/notes", "/notes")).toBe(true);
    expect(isCurrent("/notes/abc", "/notes")).toBe(true);
    expect(isCurrent("/notes-old", "/notes")).toBe(false);
    expect(isCurrent(null, "/notes")).toBe(false);
  });
});

describe("crumbKey", () => {
  test("uses the longest matching prefix for settings sub-pages", () => {
    expect(crumbKey("/settings/memory")).toBe("nav.memory");
    expect(crumbKey("/settings/profile")).toBe("nav.settings");
  });
  test("pages under /notes read as Pages", () => {
    expect(crumbKey("/notes/k17abc")).toBe("rail.pages");
  });
  test("unknown routes fall back to null", () => {
    expect(crumbKey("/somewhere")).toBeNull();
  });
});

describe("initialsFor", () => {
  test("two initials from a two-word name", () => {
    expect(initialsFor({ greetingName: "Maya Ronen" })).toBe("MR");
  });
  test("falls back to the email name and never shows the User placeholder", () => {
    expect(initialsFor({ greetingName: "User", email: "dana.levi@example.com" })).toBe("DL");
    expect(initialsFor({ email: "yoni@example.com" })).toBe("YO");
  });
  test("no profile gives no initials", () => {
    expect(initialsFor(null)).toBe("");
    expect(initialsFor(undefined)).toBe("");
  });
});
