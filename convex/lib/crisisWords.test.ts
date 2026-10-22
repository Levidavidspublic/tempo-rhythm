import { describe, expect, test } from "bun:test";
import { CRISIS_CARD, CRISIS_PHRASES, HEBREW_CRISIS_CANDIDATES, crisisCardText, isCrisisText } from "./crisisWords";

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

describe("Hebrew crisis candidates, clinically unreviewed and OFF by default", () => {
	test("omitted, empty and disabled options never activate Hebrew candidates", () => {
		for (const phrase of HEBREW_CRISIS_CANDIDATES) {
			expect(isCrisisText(phrase)).toBe(false);
			expect(isCrisisText(phrase, {})).toBe(false);
			expect(isCrisisText(phrase, { hebrewEnabled: false })).toBe(false);
		}
	});

	test("explicit opt-in detects direct intent in a longer utterance", () => {
		expect(isCrisisText("אני רוצה למות עכשיו", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("אני רוצה לפגוע בעצמי", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("אין לי סיבה לחיות", { hebrewEnabled: true })).toBe(true);
	});

	test("candidate grammatical variants cover singular and plural forms", () => {
		for (const text of [
			"אני חושב על התאבדות",
			"אני חושבת על התאבדות",
			"אנחנו חושבים על התאבדות",
			"אנחנו חושבות על התאבדות",
			"אנחנו לא רוצים לחיות",
			"אנחנו לא רוצות לחיות",
		]) {
			expect(isCrisisText(text, { hebrewEnabled: true })).toBe(true);
		}
	});

	test("Hebrew niqqud and cantillation do not hide a candidate", () => {
		expect(isCrisisText("אֲנִי רוֹצֶה לָמוּת", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("ר֑וֹצֶה לָמוּת", { hebrewEnabled: true })).toBe(true);
	});

	test("punctuation, maqaf and repeated whitespace act as token separators", () => {
		expect(isCrisisText("אני רוצה—למות!", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("אני רוצה־למות", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("רוצה\n\t  למות", { hebrewEnabled: true })).toBe(true);
	});

	test("directional formatting and Hebrew presentation forms normalize", () => {
		expect(isCrisisText("\u202Bרו\u200Fצה למות\u202C", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("אני ר\uFB35צה למ\uFB35ת", { hebrewEnabled: true })).toBe(true);
	});

	test("whole-token matching does not match a candidate inside another word", () => {
		expect(isCrisisText("רוצה למותם", { hebrewEnabled: true })).toBe(false);
		expect(isCrisisText("לפגוע בעצמיות", { hebrewEnabled: true })).toBe(false);
	});

	test("empty, ordinary and general educational text remains unflagged", () => {
		for (const text of ["", "   ", "שלום, אפשר לעזור לי לתכנן את היום?", "מפגש בנושא מניעת התאבדות", "נפגש אחרי העבודה"]) {
			expect(isCrisisText(text, { hebrewEnabled: true })).toBe(false);
		}
	});

	test("both flag values preserve all existing English phrase detection", () => {
		for (const phrase of CRISIS_PHRASES) {
			expect(isCrisisText(phrase, { hebrewEnabled: false })).toBe(true);
			expect(isCrisisText(phrase, { hebrewEnabled: true })).toBe(true);
		}
		expect(isCrisisText("I don’t want to live", { hebrewEnabled: true })).toBe(true);
	});

	test("lexical limitations remain explicit: negation and quoted phrases can match", () => {
		expect(isCrisisText("אני לא רוצה למות", { hebrewEnabled: true })).toBe(true);
		expect(isCrisisText("בסיפור נכתב: ״אני רוצה למות״", { hebrewEnabled: true })).toBe(true);
	});

	test("a runtime truthy value cannot replace explicit boolean opt-in", () => {
		expect(isCrisisText("רוצה למות", { hebrewEnabled: "true" as unknown as boolean })).toBe(false);
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
