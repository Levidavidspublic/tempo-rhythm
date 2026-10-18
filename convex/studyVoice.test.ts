import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, ActionCtx } from "./_generated/server";
import * as approval from "./approval";
import { softDeleteUserAccount } from "./lib/accountDeletion";
import { pageReading, speechPieces } from "./lib/studyVoice";
import { VOICE_LIMITS } from "./lib/voicePolicy";
import * as studyVoice from "./studyVoice";
import { CHATTERBOX_URL } from "./voice";

/**
 * Study read-aloud in Tempo's voice: identifiers in (a page, a reading, a piece index), the words
 * resolved on the server from the page, one daily TTS cap shared with the coach's voice, a piece
 * counted first and given back on a failure, transient audio out. In the harness style of
 * voice.test.ts: the db is in memory, `fetch` is a stand-in inside each test, keys are fake names.
 */

type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";

function makeWorld() {
	const tables = new Map<string, Map<string, Row>>();
	let nextId = 1;
	const table = (name: string) => {
		let t = tables.get(name);
		if (!t) {
			t = new Map();
			tables.set(name, t);
		}
		return t;
	};
	const granted = {
		approvalStatus: "approved",
		entitlementTier: "max",
		userType: "paid",
	};
	table("users").set(A, {
		_id: A,
		_creationTime: 0,
		email: "a@example.com",
		...granted,
	});
	table("users").set(B, {
		_id: B,
		_creationTime: 0,
		email: "b@example.com",
		...granted,
	});
	function builder(rows: Row[]) {
		return {
			withIndex: (_name: string, fn: (q: unknown) => unknown) => {
				const conds: Array<{ field: string; value: unknown }> = [];
				const q = {
					eq: (field: string, value: unknown) => {
						conds.push({ field, value });
						return q;
					},
				};
				fn(q);
				return builder(
					rows.filter((row) => conds.every((c) => row[c.field] === c.value)),
				);
			},
			collect: async () => [...rows],
			take: async (n: number) => rows.slice(0, n),
			first: async () => rows[0] ?? null,
			unique: async () => rows[0] ?? null,
		};
	}
	const db = {
		normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
		get: async (id: string) =>
			table(id.split(":")[0] as string).get(id) ?? null,
		insert: async (t: string, doc: Record<string, unknown>) => {
			const id = `${t}:${nextId}`;
			table(t).set(id, { _id: id, _creationTime: nextId, ...doc });
			nextId += 1;
			return id;
		},
		patch: async (id: string, patch: Record<string, unknown>) => {
			const t = table(id.split(":")[0] as string);
			const existing = t.get(id);
			if (!existing) throw new Error(`patch on missing row ${id}`);
			t.set(id, { ...existing, ...patch });
		},
		query: (t: string) => builder(Array.from(table(t).values())),
	};
	const as = (userId: string) =>
		({
			auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) },
			db,
		}) as unknown as MutationCtx;
	const handlers: Record<string, unknown> = {
		"approval:assertApprovedForAi": approval.assertApprovedForAi,
		"studyVoice:admitSentence": studyVoice.admitSentence,
		"studyVoice:releaseSentence": studyVoice.releaseSentence,
	};
	const actionAs = (userId: string) => {
		const dispatch = (ref: unknown, args: unknown) => {
			const handler = handlers[getFunctionName(ref as never)];
			if (!handler)
				throw new Error(`unexpected call ${getFunctionName(ref as never)}`);
			return run(handler, as(userId), args);
		};
		return {
			runQuery: dispatch,
			runMutation: dispatch,
		} as unknown as ActionCtx;
	};
	return {
		db,
		as,
		actionAs,
		rows: (t: string) => Array.from(table(t).values()),
		row: (id: string) => table(id.split(":")[0] as string).get(id),
	};
}

// biome-ignore lint/suspicious/noExplicitAny: handler results are inspected field by field below.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<any> };
const run = (fn: unknown, ctx: unknown, args: unknown) =>
	(fn as Handler)._handler(ctx, args);
type World = ReturnType<typeof makeWorld>;

// Fictional pages.
const PAGE = `# Cells

Cells divide in two ways. Each has its own job.

Mitosis: cell division that makes two identical cells
`;
const PAGE_HE = `# תאים

תאים מתחלקים בשתי דרכים. לכל אחת תפקיד משלה.
`;

async function page(world: World, body = PAGE, userId = A) {
	return (await world.db.insert("notes", {
		userId,
		title: "Cells",
		body,
		createdAt: 1,
		updatedAt: 1,
	})) as string;
}

const WAV = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
const today = () => new Date().toISOString().slice(0, 10);

const KEY = "di-test-key-not-real";
let savedKey: string | undefined;
let errorLog: ReturnType<typeof spyOn>;
beforeEach(() => {
	savedKey = process.env.DEEPINFRA_API_KEY;
	process.env.DEEPINFRA_API_KEY = KEY;
	errorLog = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	if (savedKey === undefined) delete process.env.DEEPINFRA_API_KEY;
	else process.env.DEEPINFRA_API_KEY = savedKey;
	errorLog.mockRestore();
});

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const spy = spyOn(globalThis, "fetch").mockImplementation((async (
		input: unknown,
		init?: RequestInit,
	) => {
		const url = String(input);
		calls.push({ url, init: init ?? {} });
		return respond(url, init ?? {});
	}) as typeof fetch);
	return { calls, restore: () => spy.mockRestore() };
}
const audioReply = () =>
	new Response(WAV, { headers: { "content-type": "audio/wav" } });

/** The pieces the player builds for a page, the same way the server does. */
const piecesOf = (body: string, mode: "recap" | "full" = "recap") =>
	speechPieces(pageReading(body, mode).sentences);

describe("availability", () => {
	test("off with no key, available with the day's characters, budget once the shared cap is spent", async () => {
		const world = makeWorld();
		delete process.env.DEEPINFRA_API_KEY;
		expect(await run(studyVoice.availability, world.as(A), {})).toEqual({
			status: "off",
			charsLeft: 0,
		});
		process.env.DEEPINFRA_API_KEY = KEY;
		expect(await run(studyVoice.availability, world.as(A), {})).toEqual({
			status: "available",
			charsLeft: VOICE_LIMITS.dailyTtsCharsPerUser,
		});

		// The coach's voice used most of today; study read-aloud used the rest.
		await world.db.insert("voiceSessions", {
			userId: A,
			dateKey: today(),
			ttsChars: VOICE_LIMITS.dailyTtsCharsPerUser - 100,
			status: "ended",
		});
		expect(await run(studyVoice.availability, world.as(A), {})).toEqual({
			status: "available",
			charsLeft: 100,
		});
		await world.db.insert("studyVoiceUsage", {
			userId: A,
			dateKey: today(),
			chars: 100,
			sentences: 4,
			createdAt: 1,
			updatedAt: 1,
		});
		expect(await run(studyVoice.availability, world.as(A), {})).toEqual({
			status: "budget",
			charsLeft: 0,
		});
		// Someone else's day is their own.
		expect((await run(studyVoice.availability, world.as(B), {})).status).toBe(
			"available",
		);
	});

	test("a pending account is off", async () => {
		const world = makeWorld();
		await world.db.patch(A, { approvalStatus: "pending" });
		expect((await run(studyVoice.availability, world.as(A), {})).status).toBe(
			"off",
		);
	});
});

describe("speak: one piece of a page's reading, resolved on the server", () => {
	test("sends the server's words to Chatterbox in the page's language and counts them; past the end is done", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		const pieces = piecesOf(PAGE);
		const net = fakeFetch(audioReply);
		try {
			const first = await run(studyVoice.speak, world.actionAs(A), {
				noteId,
				mode: "recap",
				index: 0,
			});
			expect(first.status).toBe("audio");
			expect(first.count).toBe(pieces.length);
			expect(new Uint8Array(first.audio)).toEqual(WAV);
			expect(net.calls[0]?.url).toBe(CHATTERBOX_URL);
			expect(JSON.parse(String(net.calls[0]?.init.body))).toEqual({
				text: pieces[0]?.text,
				language_id: "en",
			});
			await run(studyVoice.speak, world.actionAs(A), {
				noteId,
				mode: "recap",
				index: 1,
			});
			expect(
				await run(studyVoice.speak, world.actionAs(A), {
					noteId,
					mode: "recap",
					index: pieces.length,
				}),
			).toEqual({ status: "done" });
			expect(net.calls).toHaveLength(2);
			const usage = world.rows("studyVoiceUsage");
			expect(usage).toHaveLength(1);
			expect(usage[0]).toMatchObject({
				userId: A,
				dateKey: today(),
				sentences: 2,
				chars: (pieces[0]?.text.length ?? 0) + (pieces[1]?.text.length ?? 0),
			});
			// Counts only: no words, no page.
			expect(JSON.stringify(usage)).not.toContain("Cells");
			expect(JSON.stringify(usage)).not.toContain(noteId);
		} finally {
			net.restore();
		}
	});

	test("a Hebrew page is read in Hebrew", async () => {
		const world = makeWorld();
		const noteId = await page(world, PAGE_HE);
		const net = fakeFetch(audioReply);
		try {
			await run(studyVoice.speak, world.actionAs(A), {
				noteId,
				mode: "full",
				index: 0,
			});
			expect(JSON.parse(String(net.calls[0]?.init.body)).language_id).toBe(
				"he",
			);
		} finally {
			net.restore();
		}
	});

	test("someone else's page, a deleted page, an unknown id or a bad index is refused with no provider call", async () => {
		const world = makeWorld();
		const theirs = await page(world, PAGE, B);
		const gone = await page(world);
		await world.db.patch(gone, { deletedAt: 5 });
		const mine = await page(world);
		const net = fakeFetch(audioReply);
		try {
			for (const args of [
				{ noteId: theirs, mode: "recap", index: 0 },
				{ noteId: gone, mode: "recap", index: 0 },
				{ noteId: "notes:404", mode: "recap", index: 0 },
				{ noteId: mine, mode: "recap", index: -1 },
				{ noteId: mine, mode: "recap", index: 0.5 },
			]) {
				const error = await run(
					studyVoice.speak,
					world.actionAs(A),
					args,
				).catch((e: unknown) => e);
				expect(error).toBeInstanceOf(ConvexError);
				expect((error as ConvexError<{ code: string }>).data.code).toBe(
					"study_voice_gone",
				);
			}
			expect(net.calls).toHaveLength(0);
			expect(world.rows("studyVoiceUsage")).toHaveLength(0);
		} finally {
			net.restore();
		}
	});

	test("no key: refused before anything is counted or sent", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		delete process.env.DEEPINFRA_API_KEY;
		const net = fakeFetch(audioReply);
		try {
			await expect(
				run(studyVoice.speak, world.actionAs(A), {
					noteId,
					mode: "recap",
					index: 0,
				}),
			).rejects.toThrow("isn't switched on");
			expect(net.calls).toHaveLength(0);
			expect(world.rows("studyVoiceUsage")).toHaveLength(0);
		} finally {
			net.restore();
		}
	});

	test("a pending account gets no audio and no provider call", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		await world.db.patch(A, { approvalStatus: "pending" });
		const net = fakeFetch(audioReply);
		try {
			await expect(
				run(studyVoice.speak, world.actionAs(A), {
					noteId,
					mode: "recap",
					index: 0,
				}),
			).rejects.toThrow();
			expect(net.calls).toHaveLength(0);
		} finally {
			net.restore();
		}
	});

	test("the cap is shared with the coach's voice: past it is exhausted, with no provider call", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		const first = piecesOf(PAGE)[0]?.text ?? "";
		await world.db.insert("voiceSessions", {
			userId: A,
			dateKey: today(),
			ttsChars: VOICE_LIMITS.dailyTtsCharsPerUser - first.length + 1,
			status: "ended",
		});
		const net = fakeFetch(audioReply);
		try {
			expect(
				await run(studyVoice.speak, world.actionAs(A), {
					noteId,
					mode: "recap",
					index: 0,
				}),
			).toEqual({ status: "exhausted" });
			expect(net.calls).toHaveLength(0);
			expect(world.rows("studyVoiceUsage")).toHaveLength(0);
		} finally {
			net.restore();
		}
	});

	test("a piece that brings no audio is given back, so an outage can't use up the day", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		let calls = 0;
		const net = fakeFetch(() => {
			calls += 1;
			if (calls === 1) throw new TypeError("network down");
			if (calls === 2)
				return new Response("busy, key di-secret-in-body", { status: 503 });
			if (calls === 3) return Response.json({ nothing: true });
			return audioReply();
		});
		try {
			for (let attempt = 0; attempt < 3; attempt += 1) {
				await expect(
					run(studyVoice.speak, world.actionAs(A), {
						noteId,
						mode: "recap",
						index: 0,
					}),
				).rejects.toThrow("couldn't connect");
				expect(world.rows("studyVoiceUsage")[0]).toMatchObject({
					chars: 0,
					sentences: 0,
				});
			}
			expect(
				(
					await run(studyVoice.speak, world.actionAs(A), {
						noteId,
						mode: "recap",
						index: 0,
					})
				).status,
			).toBe("audio");
			expect(world.rows("studyVoiceUsage")[0]).toMatchObject({
				chars: piecesOf(PAGE)[0]?.text.length,
				sentences: 1,
			});
			// Nothing of the page, the provider's body or the key reaches the logs.
			const logged = JSON.stringify(errorLog.mock.calls);
			expect(logged).not.toContain("di-secret");
			expect(logged).not.toContain(KEY);
			expect(logged).not.toContain("Cells");
		} finally {
			net.restore();
		}
	});

	test("a release only gives back the caller's own row", async () => {
		const world = makeWorld();
		const usageId = await world.db.insert("studyVoiceUsage", {
			userId: B,
			dateKey: today(),
			chars: 50,
			sentences: 2,
			createdAt: 1,
			updatedAt: 1,
		});
		await run(studyVoice.releaseSentence, world.as(A), { usageId, chars: 50 });
		expect(world.row(usageId)).toMatchObject({ chars: 50, sentences: 2 });
	});
});

describe("account deletion", () => {
	test("today's usage row is tombstoned with the account, and still counts toward the day", async () => {
		const world = makeWorld();
		const noteId = await page(world);
		const net = fakeFetch(audioReply);
		try {
			await run(studyVoice.speak, world.actionAs(A), {
				noteId,
				mode: "recap",
				index: 0,
			});
		} finally {
			net.restore();
		}
		const [row] = world.rows("studyVoiceUsage");
		await world.db.insert("studyVoiceUsage", {
			userId: A,
			dateKey: today(),
			chars: VOICE_LIMITS.dailyTtsCharsPerUser,
			sentences: 1,
			createdAt: 1,
			updatedAt: 1,
			deletedAt: 1,
		});
		await softDeleteUserAccount(world.as(A), A as never, 7);
		expect(world.row(row?._id as string)?.deletedAt).toBe(7);
		// Restored within the grace period: the tombstoned characters still count.
		await world.db.patch(A, { deletedAt: undefined, isActive: true });
		expect((await run(studyVoice.availability, world.as(A), {})).status).toBe(
			"budget",
		);
	});
});
