import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import appSchema from "./schema";

/**
 * S14 reminders seam (kitchen T10) on `convex-test` with the real schema. No channel is
 * connected, so `deliver` must refuse every time; these tests pin the order of its checks and
 * that it never sends. All ids and phrases are synthetic.
 */

const modules: Record<string, () => Promise<unknown>> = {
	"./_generated/api.js": () => import("./_generated/api.js"),
	"./_generated/server.js": () => import("./_generated/server.js"),
	"./reminders.ts": () => import("./reminders"),
};

const NOW = Date.UTC(2026, 9, 16, 9, 0, 0);

function setup() {
	return convexTest(appSchema, modules);
}
type T = ReturnType<typeof setup>;

async function addUser(t: T, email: string) {
	return t.run((ctx) =>
		ctx.db.insert("users", {
			email,
			approvalStatus: "approved",
			createdAt: NOW,
			updatedAt: NOW,
		}),
	);
}

async function addNag(
	t: T,
	userId: Id<"users">,
	extra: { enabled?: boolean; deletedAt?: number } = {},
) {
	return t.run((ctx) =>
		ctx.db.insert("nags", {
			userId,
			label: "Plants",
			enabled: extra.enabled ?? true,
			phrases: [
				{
					id: "mine",
					text: "Water the plants",
					source: "user",
					status: "accepted",
				},
				{
					id: "maybe",
					text: "Plants are thirsty",
					source: "derived",
					status: "proposed",
				},
				{ id: "no", text: "Old words", source: "derived", status: "rejected" },
			],
			createdAt: NOW,
			updatedAt: NOW,
			...(extra.deletedAt === undefined ? {} : { deletedAt: extra.deletedAt }),
		}),
	);
}

describe("reminders.channels", () => {
	test("lists the candidate channels, none connected", async () => {
		const t = setup();
		const list = await t.query(api.reminders.channels, {});
		expect(list.map((c) => c.id)).toEqual(["whatsapp", "telegram", "sms"]);
		expect(
			list.every((c) => c.connected === false && c.kind === "messaging"),
		).toBe(true);
	});
});

describe("reminders.deliver", () => {
	test("an accepted phrase on an enabled nag still refuses: no channel is connected", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		const result = await t
			.withIdentity({ subject: userId })
			.action(internal.reminders.deliver, {
				nagId,
				phraseId: "mine",
				channelId: "whatsapp",
			});
		expect(result).toEqual({ ok: false, reason: "no_channel" });
	});

	test("refuses a phrase that isn't accepted, before anything else about sending", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		const as = t.withIdentity({ subject: userId });
		for (const phraseId of ["maybe", "no", "missing"]) {
			expect(
				await as.action(internal.reminders.deliver, {
					nagId,
					phraseId,
					channelId: "sms",
				}),
			).toEqual({
				ok: false,
				reason: "not_accepted",
			});
		}
	});

	test("refuses another person's nag and a deleted nag as not found", async () => {
		const t = setup();
		const owner = await addUser(t, "a@example.test");
		const other = await addUser(t, "b@example.test");
		const nagId = await addNag(t, owner);
		const gone = await addNag(t, owner, { deletedAt: NOW });
		expect(
			await t
				.withIdentity({ subject: other })
				.action(internal.reminders.deliver, {
					nagId,
					phraseId: "mine",
					channelId: "sms",
				}),
		).toEqual({ ok: false, reason: "not_found" });
		expect(
			await t
				.withIdentity({ subject: owner })
				.action(internal.reminders.deliver, {
					nagId: gone,
					phraseId: "mine",
					channelId: "sms",
				}),
		).toEqual({ ok: false, reason: "not_found" });
	});

	test("refuses an unknown channel and a switched-off nag", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const on = await addNag(t, userId);
		const off = await addNag(t, userId, { enabled: false });
		const as = t.withIdentity({ subject: userId });
		expect(
			await as.action(internal.reminders.deliver, {
				nagId: on,
				phraseId: "mine",
				channelId: "pigeon",
			}),
		).toEqual({ ok: false, reason: "unknown_channel" });
		expect(
			await as.action(internal.reminders.deliver, {
				nagId: off,
				phraseId: "mine",
				channelId: "telegram",
			}),
		).toEqual({ ok: false, reason: "nag_off" });
	});

	test("needs a signed-in person", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await expect(
			t.action(internal.reminders.deliver, {
				nagId,
				phraseId: "mine",
				channelId: "sms",
			}),
		).rejects.toThrow();
	});

	test("never calls the network", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		const realFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async () => {
			calls += 1;
			throw new Error("no network in reminders");
		}) as unknown as typeof fetch;
		try {
			await t
				.withIdentity({ subject: userId })
				.action(internal.reminders.deliver, {
					nagId,
					phraseId: "mine",
					channelId: "whatsapp",
				});
		} finally {
			globalThis.fetch = realFetch;
		}
		expect(calls).toBe(0);
	});
});
