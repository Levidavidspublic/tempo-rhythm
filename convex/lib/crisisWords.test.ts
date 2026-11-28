import { describe, expect, test } from "bun:test";
import { CRISIS_CARD, CRISIS_PHRASES, crisisCardText, isCrisisText } from "./crisisWords";

describe("isCrisisText", () => {
	test("flags a crisis phrase, ignoring case and spacing", () => {
		expect(isCrisisText("I want to   DIE")).toBe(true);
		expect(isCrisisText("thinking about suicide")).toBe(true);
	});

	test("handles a curly apostrophe", () => {
		expect(isCrisisText("I don’t want to live")).toBe(true);
	});

	test("does not flag ordinary text or empty text", () => {
		expect(isCrisisText("Finish the report and call Sam")).toBe(false);
		expect(isCrisisText("   ")).toBe(false);
	});

	test("every listed phrase is lower-case", () => {
		for (const phrase of CRISIS_PHRASES) {
			expect(phrase).toBe(phrase.toLowerCase());
		}
	});
});

describe("crisis card", () => {
	test("says plainly that country numbers are not set up", () => {
		expect(CRISIS_CARD.body).toContain("not set up");
	});

	test("text form carries the title and every resource", () => {
		const text = crisisCardText();
		expect(text).toContain(CRISIS_CARD.title);
		for (const r of CRISIS_CARD.resources) {
			expect(text).toContain(r.label);
		}
	});
});
