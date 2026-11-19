import { expect, test } from "bun:test";
import {
  EMAIL_SIGN_IN_STATES,
  emailSignInCopy,
  nextEmailSignInState,
  normalizeSignInEmail,
  parseEmailSignInLink,
} from "./email-link-sign-in";

test("normalizeSignInEmail trims and lower-cases a good address", () => {
  expect(normalizeSignInEmail("  Person@Example.com  ")).toBe("person@example.com");
});

test("normalizeSignInEmail rejects unusable addresses", () => {
  expect(normalizeSignInEmail("   ")).toBeNull();
  expect(normalizeSignInEmail("person name@example.com")).toBeNull();
  expect(normalizeSignInEmail("person@example")).toBeNull();
  expect(normalizeSignInEmail(`${"a".repeat(243)}@example.com`)).toBeNull();
});

test("parseEmailSignInLink reads secure and local sign-in links", () => {
  expect(
    parseEmailSignInLink(
      "https://example.com/finish?mode=signIn&oobCode=Made_up-123&apiKey=not-used"
    )
  ).toEqual({ oobCode: "Made_up-123" });
  expect(
    parseEmailSignInLink("http://localhost/finish?mode=signIn&oobCode=Local_code-456")
  ).toEqual({ oobCode: "Local_code-456" });
});

test("parseEmailSignInLink rejects links that are not usable for sign-in", () => {
  expect(
    parseEmailSignInLink("https://example.com/finish?mode=resetPassword&oobCode=Reset_123")
  ).toBeNull();
  expect(parseEmailSignInLink("https://example.com/finish?mode=signIn")).toBeNull();
  expect(
    parseEmailSignInLink("https://example.com/finish?mode=signIn&oobCode=bad%20code")
  ).toBeNull();
  expect(parseEmailSignInLink("not a URL")).toBeNull();
  expect(parseEmailSignInLink("http://example.com/finish?mode=signIn&oobCode=Code_123")).toBeNull();

  const result = parseEmailSignInLink(
    "https://example.com/finish?mode=signIn&oobCode=Only_code&apiKey=not-returned"
  );
  expect(Object.keys(result ?? {})).toEqual(["oobCode"]);
});

test("every email sign-in state has calm, non-empty copy", () => {
  const bannedWords = /\b(failed|wrong|invalid|error|must|should|forgot|password)\b/i;

  for (const state of EMAIL_SIGN_IN_STATES) {
    const copy = emailSignInCopy(state);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
    expect(`${copy.title} ${copy.body}`).not.toMatch(bannedWords);
  }
});

test("nextEmailSignInState chooses the state from the link and remembered email", () => {
  const link = { oobCode: "Made_up-123" } as const;

  expect(nextEmailSignInState({ link: null, rememberedEmail: null })).toBe("idle");
  expect(nextEmailSignInState({ link, rememberedEmail: " Person@Example.com " })).toBe(
    "signing_in"
  );
  expect(nextEmailSignInState({ link, rememberedEmail: null })).toBe("confirm_email");
});
