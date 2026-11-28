import { describe, expect, test } from "bun:test";
import { NAG_PHRASE_MAX, parseProposals, validatePhrase } from "./nagPhrase";

describe("validatePhrase", () => {
	test("accepts and trims plain text", () => {
		expect(validatePhrase("  Water first  ")).toEqual({ ok: true, text: "Water first" });
	});

	test("rejects empty text", () => {
		expect(validatePhrase("   ").ok).toBe(false);
	});

	test("rejects text over 140 characters but allows exactly 140", () => {
		expect(validatePhrase("a".repeat(NAG_PHRASE_MAX)).ok).toBe(true);
		expect(validatePhrase("a".repeat(NAG_PHRASE_MAX + 1)).ok).toBe(false);
	});

	test("rejects emoji", () => {
		expect(validatePhrase("Go now \u{1F680}").ok).toBe(false);
	});
});

describe("parseProposals", () => {
	test("returns at most 3 valid distinct strings", () => {
		const out = parseProposals(JSON.stringify({ proposals: ["a", "b", "b", "c", "d"] }));
		expect(out).toEqual(["a", "b", "c"]);
	});

	test("drops emoji, non-strings and existing phrases", () => {
		const out = parseProposals(JSON.stringify(["ok \u{1F600}", 5, "Mine", "fresh"]), ["mine"]);
		expect(out).toEqual(["fresh"]);
	});

	test("returns [] for invalid JSON", () => {
		expect(parseProposals("not json")).toEqual([]);
	});
});
