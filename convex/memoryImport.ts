import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { parseMemoryExport, utf8ByteLength } from "./lib/memoryImport";
import { requireUser } from "./lib/requireUser";

const MAX_IMPORT_BYTES =1024 * 1024;
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
