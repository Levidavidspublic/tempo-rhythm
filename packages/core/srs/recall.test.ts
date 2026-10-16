import { describe, expect, test } from "bun:test";
import { normalizeAnswer } from "./plugins";
import {
	closeAllowance,
	compareRecall,
	editDistance,
	type RecallResult,
	suggestedButton,
} from "./recall";

const result = (typed: string, expected: string) =>
	compareRecall(typed, expected).result;

describe("editDistance", () => {
	test.each([
		["", "", 0],
		["", "abc", 3],
		["abc", "", 3],
		["nucleus", "nucleus", 0],
		["nucleas", "nucleus", 1],
		["nucleu", "nucleus", 1],
		["nnucleus", "nucleus", 1],
		["recieve", "receive", 1],
		["ca", "abc", 3],
		["kitten", "sitting", 3],
	] as const)("%p ↔ %p = %p", (a, b, expected) => {
		expect(editDistance(a, b)).toBe(expected);
		expect(editDistance(b, a)).toBe(expected);
	});

	test("counts code points, so Hebrew letters and astral characters are one edit each", () => {
		expect(editDistance("שלום", "שלם")).toBe(1);
		expect(editDistance("a𝑥b", "ab")).toBe(1);
	});
});

describe("closeAllowance", () => {
	test("one edit per four characters of the longer answer", () => {
		expect([0, 1, 3, 4, 7, 8, 11, 12, 40].map(closeAllowance)).toEqual([
			0, 0, 0, 1, 1, 2, 2, 3, 10,
		]);
	});
});

describe("compareRecall", () => {
	test("exact, and the same after folding case, spaces and punctuation", () => {
		expect(compareRecall("Mitochondria", "Mitochondria")).toEqual({
			result: "matches",
			distance: 0,
			allowed: 0,
		});
		expect(result("  makes   ATP. ", "Makes ATP")).toBe("matches");
		expect(result("Makes, ATP!", "makes atp")).toBe("matches");
		expect(result("don't", "dont")).toBe("matches");
		expect(result("3.5", "3.5")).toBe("matches");
	});

	test("close: a letter or two off, relative to the length", () => {
		expect(compareRecall("mitocondria", "Mitochondria")).toEqual({
			result: "close",
			distance: 1,
			allowed: 3,
		});
		expect(result("nucleas", "Nucleus")).toBe("close");
		expect(result("recieve", "receive")).toBe("close");
		expect(
			result(
				"Cell divison that makes two identical cells",
				"Cell division that makes two identical cells",
			),
		).toBe("close");
	});

	test("different: too many edits for the length, and short answers must match", () => {
		expect(result("Ribosome", "Mitochondria")).toBe("different");
		expect(result("nucelsu", "nucleus")).toBe("different");
		expect(result("ADP", "ATP")).toBe("different");
		expect(result("cat", "car")).toBe("different");
		expect(result("Makes ATP", "Makes proteins from amino acids")).toBe(
			"different",
		);
	});

	test("lengths far apart are different without measuring every edit", () => {
		expect(
			compareRecall("a", "a very long answer about the cell membrane"),
		).toEqual({
			result: "different",
			distance: -1,
			allowed: 10,
		});
	});

	test("nothing typed is its own result, not an error", () => {
		for (const typed of ["", "   ", "\n\t"])
			expect(compareRecall(typed, "Nucleus")).toEqual({
				result: "empty",
				distance: -1,
				allowed: 0,
			});
	});

	test("only punctuation typed is different from a real answer", () => {
		expect(result("?!", "Nucleus")).toBe("different");
	});

	test("Hebrew: niqqud, maqaf and gershayim fold away as in the short-answer questions", () => {
		expect(result("שָׁלוֹם", "שלום")).toBe("matches");
		expect(result("בֵּית־סֵפֶר", "בית ספר")).toBe("matches");
		expect(result('צה"ל', "צה״ל")).toBe("matches");
		expect(result("נִכְתַּב", "נכתב")).toBe("matches");
		expect(result("מיטוכונדריה", "מיטוכנדריה")).toBe("close");
		expect(result("גרעין", "ריבוזום")).toBe("different");
	});

	test.each([
		["1945", "1954"],
		["1000", "2000"],
		["3.14", "3.15"],
		["2x+3", "2x-3"],
		["The war ended in 1945", "The war ended in 1954"],
		["x = 12", "x < 12"],
		["1066 and 1215", "1215 and 1066"],
		["Hastings", "Hastings 1066"],
	] as const)("numbers and signs must match exactly: %p for %p is different", (typed, expected) => {
		expect(compareRecall(typed, expected)).toMatchObject({
			result: "different",
			distance: -1,
		});
		expect(result(expected, typed)).toBe("different");
	});

	test("with the same numbers and signs in the same order, the letters around them may still be close", () => {
		expect(result("Battle of Hastngs, 1066", "Battle of Hastings, 1066")).toBe(
			"close",
		);
		expect(result("Mitosis makes 2 cels", "Mitosis makes 2 cells")).toBe(
			"close",
		);
	});

	test("spaces around a sign, and a minus sign or en dash for the hyphen, are not a difference", () => {
		expect(result("2x + 3 = 11, so x = 4", "2x+3=11, so x=4")).toBe("matches");
		expect(result("2x - 3", "2x-3")).toBe("matches");
		expect(result("2x \u2212 3", "2x-3")).toBe("matches");
		expect(result("1939\u20131945", "1939-1945")).toBe("matches");
		expect(result("(2x)+3", "2x+3")).toBe("matches");
	});

	test("Hebrew final letters count as their plain forms, here only (test scoring is unchanged)", () => {
		expect(result("אמ", "אם")).toBe("matches");
		expect(result("ארצ", "ארץ")).toBe("matches");
		expect(result("מלכ", "מלך")).toBe("matches");
		expect(result("בנ", "בן")).toBe("matches");
		expect(result("כפ", "כף")).toBe("matches");
		expect(result("שלום", "שלומ")).toBe("matches");
		expect(result("ארצ ישראל", "ארץ ישראל")).toBe("matches");
		expect(normalizeAnswer("אמ")).not.toBe(normalizeAnswer("אם"));
	});

	test("Hebrew and English mixed in one answer", () => {
		expect(result("Passive of pa'al: נִכְתַּב", "passive of paal נכתב")).toBe(
			"matches",
		);
	});
});

describe("suggestedButton", () => {
	test("a hint for each result, never Easy, nothing for an empty answer", () => {
		const all: RecallResult[] = ["matches", "close", "different", "empty"];
		expect(all.map(suggestedButton)).toEqual(["good", "hard", "again", null]);
	});
});
