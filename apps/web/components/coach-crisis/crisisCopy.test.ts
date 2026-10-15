import { describe, expect, test } from "bun:test";
import { COACH_NOT_THERAPIST, FALLBACK_CARD, formatResource } from "./crisisCopy";

const FALLBACK_BODY =
  "If you are in danger or thinking of hurting yourself, contact your local emergency number now. You can also reach out to someone you trust.";

describe("formatResource", () => {
  test("joins label and detail with a colon", () => {
    expect(
      formatResource({
        label: "Emergency services",
        detail: "Call your local emergency number if you are in immediate danger.",
      }),
    ).toBe("Emergency services: Call your local emergency number if you are in immediate danger.");
  });

  test("keeps an empty detail after the colon", () => {
    expect(formatResource({ label: "Someone you trust", detail: "" })).toBe("Someone you trust: ");
  });
});

describe("FALLBACK_CARD", () => {
  test("uses the fixed safety sentence as the body", () => {
    expect(FALLBACK_CARD.body).toBe(FALLBACK_BODY);
  });

  test("is never an empty card", () => {
    expect(FALLBACK_CARD.title.length).toBeGreaterThan(0);
    expect(FALLBACK_CARD.body.length).toBeGreaterThan(0);
  });
});

describe("COACH_NOT_THERAPIST", () => {
  test("states the product is a coach, not a therapist or counselor", () => {
    expect(COACH_NOT_THERAPIST).toBe("Tempo is a coach, not a therapist or counselor.");
  });
});
