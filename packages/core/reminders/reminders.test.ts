import { describe, expect, test } from "bun:test";
import {
	createReminderRegistry,
	notConnectedChannel,
	REMINDER_CHANNEL_IDS,
	type ReminderNag,
	reminderRegistry,
	reminderText,
} from "./index";

const nag: ReminderNag = {
	phrases: [
		{
			id: "p1",
			text: "  Water the plants, you like them green  ",
			source: "user",
			status: "accepted",
		},
		{
			id: "p2",
			text: "Plants are thirsty",
			source: "derived",
			status: "proposed",
		},
		{ id: "p3", text: "Old words", source: "derived", status: "rejected" },
		{ id: "p4", text: "Grab the keys", source: "derived", status: "accepted" },
		{
			id: "p5",
			text: "Party time \u{1F389}",
			source: "user",
			status: "accepted",
		},
		{ id: "p6", text: "   ", source: "user", status: "accepted" },
		{ id: "p7", text: "להשקות את העציצים", source: "user", status: "accepted" },
	],
};

describe("reminderText", () => {
	test("returns an accepted phrase, trimmed", () => {
		expect(reminderText(nag, "p1")).toBe(
			"Water the plants, you like them green",
		);
		expect(reminderText(nag, "p4")).toBe("Grab the keys");
		expect(reminderText(nag, "p7")).toBe("להשקות את העציצים");
	});

	test("never returns a proposed or rejected phrase", () => {
		expect(reminderText(nag, "p2")).toBeNull();
		expect(reminderText(nag, "p3")).toBeNull();
	});

	test("no stock fallback: a missing phrase or a nag with no phrases gives null", () => {
		expect(reminderText(nag, "nope")).toBeNull();
		expect(reminderText({ phrases: [] }, "p1")).toBeNull();
	});

	test("an emoji or blank text never goes out", () => {
		expect(reminderText(nag, "p5")).toBeNull();
		expect(reminderText(nag, "p6")).toBeNull();
	});
});

describe("reminder channels", () => {
	test("the registry lists the candidates and none is connected", () => {
		const list = reminderRegistry.list();
		expect(list.map((c) => c.id)).toEqual([...REMINDER_CHANNEL_IDS]);
		for (const channel of list) {
			expect(channel.connected).toBe(false);
			expect(channel.kind).toBe("messaging");
			expect(channel.label.length).toBeGreaterThan(0);
			expect(reminderRegistry.has(channel.id)).toBe(true);
			expect(reminderRegistry.live(channel.id)).toBeNull();
		}
		expect(reminderRegistry.has("pigeon")).toBe(false);
		expect(reminderRegistry.live("pigeon")).toBeNull();
	});

	test("a placeholder can never connect or send", async () => {
		const channel = notConnectedChannel("x", "X");
		expect(await channel.connect()).toEqual({
			ok: false,
			reason: "not_available",
		});
		expect(await channel.send("+972000000000", "Grab the keys")).toEqual({
			ok: false,
			reason: "not_connected",
		});
	});

	test("live() only hands out a channel marked connected", () => {
		const fake = notConnectedChannel("fake", "Fake");
		const registry = createReminderRegistry([
			{ channel: fake, connected: true },
			{ channel: notConnectedChannel("off", "Off"), connected: false },
		]);
		expect(registry.live("fake")).toBe(fake);
		expect(registry.live("off")).toBeNull();
		expect(registry.list()).toEqual([
			{ id: "fake", label: "Fake", kind: "messaging", connected: true },
			{ id: "off", label: "Off", kind: "messaging", connected: false },
		]);
	});
});
