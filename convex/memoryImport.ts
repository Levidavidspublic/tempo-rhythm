import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { cleanImportItem, parseMemoryExport, utf8ByteLength } from "./lib/memoryImport";
import { requireUser } from "./lib/requireUser";

const MAX_IMPORT_BYTES =1024 * 1024;
const MAX_REVIEWED_ITEMS = 300;
const sourceValidator = v.union(
	v.literal("chatgpt"),
	v.literal("claude"),
	v.literal("grok"),
	v.literal("other"),
);

export const importMemories = mutation({
	args: { source: sourceValidator, text: v.string() },
	returns: v.object({ added: v.number(), skipped: v.number() }),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		if (utf8ByteLength(args.text) > MAX_IMPORT_BYTES) {
			throw new Error("That memory import is too large. Keep it under 1 MB.");
		}

		const candidates = parseMemoryExport(args.text, args.source);
		const existing = await ctx.db
			.query("memories")
			.withIndex("by_userId_deletedAt", (q) =>
				q.eq("userId", user._id).eq("deletedAt", undefined),
			)
			.collect();
		const known = new Set(existing.map((memory) => memory.content.trim().toLocaleLowerCase()));
		let added = 0;
		let skipped = 0;
		for (const content of candidates) {
			const key = content.toLocaleLowerCase();
			if (known.has(key)) {
				skipped++;
				continue;
			}
			known.add(key);
			const now = Date.now();
			await ctx.db.insert("memories", {
				userId: user._id,
				content,
				sector: "general",
				salience: 0.5,
				decayRate: 0.01,
				lastAccessed: now,
				accessCount: 0,
				metadata: { source: args.source, importedAt: now },
				createdAt: now,
				updatedAt: now,
			});
			added++;
		}
		return { added, skipped };
	},
});

/**
 * RAM-ONLY: the import screen parses the pasted text in the browser and sends only the items the
 * person kept or edited on the review step. The raw text never reaches Convex; only these
 * approved, derived records are stored (HARD_RULES §6.4). Returns the new ids so the screen's
 * 5-minute Undo can forget exactly this batch (memory.forgetAll).
 */
export const saveReviewed = mutation({
	args: { source: sourceValidator, items: v.array(v.string()) },
	returns: v.object({
		added: v.number(),
		skipped: v.number(),
		memoryIds: v.array(v.id("memories")),
	}),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		if (args.items.length > MAX_REVIEWED_ITEMS) {
			throw new Error(`Save up to ${MAX_REVIEWED_ITEMS} items at a time.`);
		}
		if (utf8ByteLength(args.items.join("\n")) > MAX_IMPORT_BYTES) {
			throw new Error("That memory import is too large. Keep it under 1 MB.");
		}

		const existing = await ctx.db
			.query("memories")
			.withIndex("by_userId_deletedAt", (q) =>
				q.eq("userId", user._id).eq("deletedAt", undefined),
			)
			.collect();
		const known = new Set(existing.map((memory) => memory.content.trim().toLocaleLowerCase()));
		const memoryIds: Id<"memories">[] = [];
		let skipped = 0;
		const now = Date.now();
		for (const item of args.items) {
			const content = cleanImportItem(item);
			const key = content?.toLocaleLowerCase();
			if (!content || !key || known.has(key)) {
				skipped++;
				continue;
			}
			known.add(key);
			memoryIds.push(
				await ctx.db.insert("memories", {
					userId: user._id,
					content,
					sector: "general",
					salience: 0.5,
					decayRate: 0.01,
					lastAccessed: now,
					accessCount: 0,
					metadata: { source: args.source, importedAt: now },
					createdAt: now,
					updatedAt: now,
				}),
			);
		}
		return { added: memoryIds.length, skipped, memoryIds };
	},
});
