import { describe, expect, test } from "bun:test";
import { TELEGRAM_FIRST_NAME_MAX, telegramFirstName } from "./telegramName";

const update = (from: unknown) => ({ message: { text: "/start x", from } });

describe("telegramFirstName", () => {
	test("trims the sender's first name and keeps at most 64 characters", () => {
		expect(telegramFirstName(update({ first_name: "  Dana " }))).toBe("Dana");
		// Code points, so an emoji or Hebrew letter is never cut in half.
		const long = "😀".repeat(TELEGRAM_FIRST_NAME_MAX + 5);
		expect(
			Array.from(telegramFirstName(update({ first_name: long })) ?? ""),
		).toHaveLength(TELEGRAM_FIRST_NAME_MAX);
	});

	test("no name, an empty one or a non-string is null", () => {
		expect(telegramFirstName(update({ language_code: "en" }))).toBeNull();
		expect(telegramFirstName(update({ first_name: "   " }))).toBeNull();
		expect(telegramFirstName(update({ first_name: 7 }))).toBeNull();
		expect(telegramFirstName(update(null))).toBeNull();
		expect(telegramFirstName({ update_id: 1 })).toBeNull();
		expect(telegramFirstName(null)).toBeNull();
	});
});
