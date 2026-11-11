import { describe, expect, test } from "bun:test";
import * as notes from "./notes";

type FakeIdentity = {
	subject: string;
	email?: string;
};

type FakeUser = {
	_id: string;
	email: string;
};

/**
 * Minimal in-memory Convex ctx, mirroring the fake-ctx pattern in
 * `convex/conversations.test.ts`: `withIndex` callbacks only ever call
 * `q.eq(field, value)` once, so the matcher resolves straight to an
 * equality filter without modelling the full Convex query builder.
 */
function makeFakeCtx({
	identity,
	users = [],
}: {
	identity: FakeIdentity | null;
	users?: FakeUser[];
}) {
	const tables = new Map<string, Map<string, Record<string, unknown>>>();
	let nextId = 1;

	function table(name: string) {
		let t = tables.get(name);
		if (!t) {
			t = new Map();
			tables.set(name, t);
		}
		return t;
	}

	for (const user of users) {
		table("users").set(user._id, user as unknown as Record<string, unknown>);
	}

	function matchQuery(rows: Record<string, unknown>[]) {
		return {
			withIndex: (
				_indexName: string,
				matcher: (q: { eq: (field: string, value: unknown) => { field: string; value: unknown } }) => {
					field: string;
					value: unknown;
				},
			) => {
				const { field, value } = matcher({ eq: (field, value) => ({ field, value }) });
				return matchQuery(rows.filter((row) => row[field] === value));
			},
			order: (_direction: "asc" | "desc") => matchQuery(rows),
			collect: async () => rows,
			first: async () => rows[0] ?? null,
			unique: async () => rows[0] ?? null,
		};
	}

	const db = {
		normalizeId: (tableName: string, id: string) => (table(tableName).has(id) ? id : null),
		get: async (id: string) => {
			const [tableName] = id.split(":");
			return table(tableName).get(id) ?? null;
		},
		insert: async (tableName: string, doc: Record<string, unknown>) => {
			const id = `${tableName}:${nextId++}`;
			table(tableName).set(id, { _id: id, ...doc });
			return id;
		},
		patch: async (id: string, patch: Record<string, unknown>) => {
			const [tableName] = id.split(":");
			const existing = table(tableName).get(id);
			table(tableName).set(id, { ...existing, ...patch });
		},
		delete: async (id: string) => {
			const [tableName] = id.split(":");
			table(tableName).delete(id);
		},
		query: (tableName: string) => matchQuery(Array.from(table(tableName).values())),
	};

	return {
		auth: { getUserIdentity: async () => identity },
		db,
	} as any;
}

describe("notes soft delete", () => {
	test("remove patches deletedAt instead of deleting the row", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});

		await (notes.remove as any)._handler(ctx, { noteId });

		const stored = await ctx.db.get(noteId);
		expect(stored).not.toBeNull();
		expect(typeof stored.deletedAt).toBe("number");
	});

	test("list excludes a soft-deleted note", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});
		await (notes.remove as any)._handler(ctx, { noteId });

		const result = await (notes.list as any)._handler(ctx, {});
		expect(result).toHaveLength(0);
	});

	test("get returns null for a soft-deleted note", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});
		await (notes.remove as any)._handler(ctx, { noteId });

		const result = await (notes.get as any)._handler(ctx, { noteId });
		expect(result).toBeNull();
	});

	test("update throws Note not found for a soft-deleted note", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});
		await (notes.remove as any)._handler(ctx, { noteId });

		await expect(
			(notes.update as any)._handler(ctx, { noteId, title: "New title" }),
		).rejects.toThrow("Note not found");
	});

	test("togglePin throws Note not found for a soft-deleted note", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});
		await (notes.remove as any)._handler(ctx, { noteId });

		await expect(
			(notes.togglePin as any)._handler(ctx, { noteId }),
		).rejects.toThrow("Note not found");
	});

	test("get returns null for a malformed id", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });

		const result = await (notes.get as any)._handler(ctx, { noteId: "not-a-note-id" });
		expect(result).toBeNull();
	});

	test("another user's remove throws Note not found", async () => {
		const userA = { _id: "users:a", email: "a@example.com" };
		const userB = { _id: "users:b", email: "b@example.com" };
		const ctx = makeFakeCtx({
			identity: { subject: userB._id },
			users: [userA, userB],
		});

		const noteId = await ctx.db.insert("notes", {
			userId: userA._id,
			title: "Not mine",
			body: "body",
			pinned: false,
			periodType: "none",
			createdAt: 1,
			updatedAt: 1,
		});

		await expect(
			(notes.remove as any)._handler(ctx, { noteId }),
		).rejects.toThrow("Note not found");

		const stored = await ctx.db.get(noteId);
		expect(stored.deletedAt).toBeUndefined();
	});
});
