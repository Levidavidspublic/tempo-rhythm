import { describe, expect, test } from "bun:test";
import { parseMemoryExport } from "./lib/memoryImport";
import * as memoryImport from "./memoryImport";

type Row = Record<string, unknown>;

function makeFakeCtx(signedIn = true) {
	const user = { _id: "users:a", email: "a@example.com" };
	const tables = new Map<string, Map<string, Row>>([["users", new Map([[user._id, user]])]]);
	let nextId = 1;
	const table = (name: string) => {
		let rows = tables.get(name);
		if (!rows) {
			rows = new Map();
			tables.set(name, rows);
		}
		return rows;
	};
	const query = (rows: Row[]) => ({
		withIndex: (_name: string, build: (q: unknown) => unknown) => {
			const filters: [string, unknown][] = [];
			const q = {
				eq: (field: string, value: unknown) => {
					filters.push([field, value]);
					return q;
				},
			};
			build(q);
			return query(rows.filter((row) => filters.every(([key, value]) => row[key] === value)));
		},
		collect: async () => rows,
	});
	const db = {
		normalizeId: (name: string, id: string) => (table(name).has(id) ? id : null),
		get: async (id: string) => table(id.split(":")[0] ?? "").get(id) ?? null,
		query: (name: string) => query(Array.from(table(name).values())),
		insert: async (name: string, doc: Row) => {
			const id = `${name}:${nextId++}`;
			table(name).set(id, { _id: id, ...doc });
			return id;
		},
	};
	return {
		ctx: {
			auth: { getUserIdentity: async () => (signedIn ? { subject: user._id } : null) },
			db,
		} as any,
		db,
	};
}

const run = (ctx: unknown, args: unknown) => (memoryImport.importMemories as any)._handler(ctx, args);

describe("parseMemoryExport", () => {
	test("parses plain, bulleted, numbered, and heading-prefixed lines", () => {
		expect(
			parseMemoryExport(
				"Likes tea\n- Works remotely\n* Has a dog\n• Runs weekly\n1. Calls Mum",
				"chatgpt",
			),
		).toEqual(["Likes tea", "Works remotely", "Has a dog", "Runs weekly", "Calls Mum"]);
		expect(parseMemoryExport("# Work\n- Prefers focus time\n## Food\nVegetarian", "claude")).toEqual([
			"Work: Prefers focus time",
			"Food: Vegetarian",
		]);
	});

	test("parses supported JSON strings and object fields", () => {
		expect(parseMemoryExport('["Likes tea", "Uses dark mode"]', "grok")).toEqual([
			"Likes tea",
			"Uses dark mode",
		]);
		expect(
			parseMemoryExport(
				JSON.stringify({
					memories: [{ content: "A" }, { text: "Enjoys jazz" }, { memory: "Lives in Haifa" }],
				}),
				"chatgpt",
			),
		).toEqual(["Enjoys jazz", "Lives in Haifa"]);
		expect(parseMemoryExport(JSON.stringify({ items: ["Reads nightly"] }), "other")).toEqual([
			"Reads nightly",
		]);
	});

	test("parses nested Claude account memory content without importing account metadata", () => {
		const fixture = [
			{
				account_uuid: "not-a-memory",
				conversations_memory: "# Preferences\n- Likes tea\n- Uses dark mode",
				project_memories: {
					"project-1": "# Work\nPrefers focus time",
					"project-2": 42,
				},
				memory_files: [
					{
						path: "not-a-memory.md",
						content: "# Personal\n- Lives in Haifa",
						updated_at: "2026-01-01T00:00:00Z",
					},
					{ path: "ignored.md", content: null },
				],
				profile: { name: "Also not a memory" },
			},
		];

		expect(parseMemoryExport(JSON.stringify(fixture), "claude")).toEqual([
			"Preferences: Likes tea",
			"Preferences: Uses dark mode",
			"Work: Prefers focus time",
			"Personal: Lives in Haifa",
		]);
	});

	test("ignores empty or malformed Claude account structures", () => {
		expect(
			parseMemoryExport(
				JSON.stringify([
					{
						account_uuid: "account-only",
						conversations_memory: null,
						project_memories: [],
						memory_files: [{ path: "empty.md" }, "bad-file"],
					},
				]),
				"claude",
			),
		).toEqual([]);
		expect(parseMemoryExport(JSON.stringify([{ account_uuid: "account-only" }]), "claude")).toEqual(
			[],
		);
	});

	test("deduplicates and caps nested Claude account memories", () => {
		const nestedLines = ["- Likes tea", "- likes tea", `- ${"z".repeat(1100)}`];
		for (let index = 0; index < 350; index++) nestedLines.push(`- memory ${index}`);
		const result = parseMemoryExport(
			JSON.stringify([{ conversations_memory: nestedLines.join("\n") }]),
			"claude",
		);

		expect(result).toHaveLength(300);
		expect(result[0]).toBe("Likes tea");
		expect(result[1]).toHaveLength(1000);
	});

	test("cleans, truncates, deduplicates case-insensitively, and caps items", () => {
		const lines = ["  Likes   tea  ", "likes tea", "x", "z".repeat(1100)];
		for (let index = 0; index < 350; index++) lines.push(`memory ${index}`);
		const result = parseMemoryExport(lines.join("\n"), "other");
		expect(result).toHaveLength(300);
		expect(result[0]).toBe("Likes tea");
		expect(result[1]).toHaveLength(1000);
	});

	test("returns nothing for valid JSON in an unsupported shape", () => {
		const metadata = { account_uuid: "abc-123", email: "someone@example.com", name: "Not a memory" };
		for (const source of ["chatgpt", "claude", "grok", "other"] as const) {
			expect(parseMemoryExport(JSON.stringify(metadata), source)).toEqual([]);
			expect(
				parseMemoryExport(JSON.stringify({ profile: metadata, memories: "text" }), source),
			).toEqual([]);
			expect(parseMemoryExport(JSON.stringify([metadata]), source)).toEqual([]);
			expect(parseMemoryExport('"Likes tea"', source)).toEqual([]);
			expect(parseMemoryExport("12345", source)).toEqual([]);
			expect(parseMemoryExport("null", source)).toEqual([]);
		}
		expect(parseMemoryExport("Likes tea 2024", "other")).toEqual(["Likes tea 2024"]);
	});

	test("falls back from bad JSON and ignores empty or garbled input", () => {
		expect(parseMemoryExport("[not valid\n- Still usable", "chatgpt")).toEqual([
			"[not valid",
			"Still usable",
		]);
		expect(parseMemoryExport(" \n- --\n\u0000broken", "other")).toEqual([]);
	});
});

describe("importMemories", () => {
	test("refuses a signed-out user", async () => {
		const { ctx } = makeFakeCtx(false);
		await expect(run(ctx, { source: "chatgpt", text: "Likes tea" })).rejects.toThrow(
			"Not authenticated",
		);
	});

	test("stores source metadata and skips the same import", async () => {
		const { ctx, db } = makeFakeCtx();
		expect(await run(ctx, { source: "claude", text: "- Likes tea\n- Works remotely" })).toEqual({
			added: 2,
			skipped: 0,
		});
		expect(await run(ctx, { source: "claude", text: "likes tea\nWorks remotely" })).toEqual({
			added: 0,
			skipped: 2,
		});
		const rows = await db.query("memories").collect();
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			sector: "general",
			salience: 0.5,
			decayRate: 0.01,
			metadata: { source: "claude" },
		});
		expect(typeof (rows[0].metadata as Row).importedAt).toBe("number");
	});

	test("isolates duplicate detection to the signed-in user", async () => {
		const { ctx, db } = makeFakeCtx();
		await db.insert("memories", {
			userId: "users:foreign",
			content: "Likes tea",
			deletedAt: undefined,
		});

		expect(await run(ctx, { source: "chatgpt", text: "Likes tea" })).toEqual({
			added: 1,
			skipped: 0,
		});
		const rows = await db.query("memories").collect();
		expect(rows.filter((row: Row) => row.userId === "users:foreign")).toHaveLength(1);
		expect(rows.filter((row: Row) => row.userId === "users:a")).toHaveLength(1);
	});

	test("does not write unsupported valid JSON", async () => {
		const { ctx, db } = makeFakeCtx();
		const text = JSON.stringify({ account_uuid: "abc-123", name: "Not a memory" });
		expect(await run(ctx, { source: "claude", text })).toEqual({ added: 0, skipped: 0 });
		expect(await db.query("memories").collect()).toHaveLength(0);
	});

	test("enforces the one megabyte limit on UTF-8 bytes", async () => {
		const limit = 1024 * 1024;
		const cases: [string, string, boolean][] = [
			["ascii at limit", "x".repeat(limit), true],
			["ascii over limit", "x".repeat(limit + 1), false],
			["multibyte at limit", "é".repeat(limit / 2), true],
			["multibyte over limit", `${"é".repeat(limit / 2)}x`, false],
			["multibyte over by bytes only", "é".repeat(limit / 2 + 10), false],
			["emoji at limit", "😀".repeat(limit / 4), true],
			["emoji over limit", `${"😀".repeat(limit / 4)}x`, false],
			["cjk over by bytes only", "日".repeat(Math.floor(limit / 3) + 1), false],
		];
		for (const [label, text, ok] of cases) {
			const { ctx, db } = makeFakeCtx();
			const attempt = run(ctx, { source: "other", text });
			if (ok) await expect(attempt).resolves.toBeDefined();
			else await expect(attempt).rejects.toThrow("under 1 MB");
			if (!ok) expect(await db.query("memories").collect(), label).toHaveLength(0);
		}
	});
});
