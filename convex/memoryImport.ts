import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireApprovedUser } from "./lib/approval";
import { parseMemoryExport, utf8ByteLength } from "./lib/memoryImport";

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_CONFIRMED_CANDIDATES = 300;
const MAX_CONTENT_CHARS = 2000;
const MAX_TITLE_CHARS = 200;
const MAX_IMPORT_ROWS = 10000;
const confirmedSourceValidator = v.union(v.literal("chatgpt"), v.literal("claude"));
const confirmedCandidateValidator = v.object({
	content: v.string(),
	source: confirmedSourceValidator,
	role: v.union(v.literal("user"), v.literal("assistant")),
	conversationTitle: v.optional(v.string()),
	date: v.optional(v.string()),
	// Optional UI hint only. It never determines identity or stored provenance.
	dedupKey: v.optional(v.string()),
});
const sourceValidator = v.union(
	v.literal("chatgpt"),
	v.literal("claude"),
	v.literal("grok"),
	v.literal("other"),
);

function confirmedDate(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
	if (value.length > 35 || !match) {
		throw new Error("Choose a valid ISO date for this memory.");
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	const zone = match[8];
	if (month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)
		|| Number(match[4] ?? 0) > 23 || Number(match[5] ?? 0) > 59
		|| Number(match[6] ?? 0) > 59
		|| (zone !== undefined && zone !== "Z"
			&& (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) {
		throw new Error("Choose a valid ISO date for this memory.");
	}
	return new Date(value).toISOString();
}

async function importRows(ctx: MutationCtx, userId: Awaited<ReturnType<typeof requireApprovedUser>>["_id"]) {
	// Include tombstones: repeating an import must not resurrect a forgotten item.
	// Without a metadata index, fail closed at a fixed budget rather than dedup only a prefix.
	const rows = await ctx.db.query("memories")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.take(MAX_IMPORT_ROWS + 1);
	if (rows.length > MAX_IMPORT_ROWS) {
		throw new Error("There are too many saved memories for another import right now.");
	}
	return rows;
}

/**
 * Explicit save boundary for #750. The browser parses histories in RAM and sends ONLY
 * the reviewed, selected candidates. No parser, model, scheduler or automatic save here.
 * Source/role are user-supplied attribution, never evidence that a statement is true.
 */
export const saveConfirmed = mutation({
	args: { candidates: v.array(confirmedCandidateValidator) },
	returns: v.object({ added: v.number(), skipped: v.number() }),
	handler: async (ctx, args) => {
		const user = await requireApprovedUser(ctx);
		if (args.candidates.length < 1 || args.candidates.length > MAX_CONFIRMED_CANDIDATES) {
			throw new Error("Choose between 1 and 300 memories to save at a time.");
		}
		// Validate the whole batch before writing anything (also atomic under Convex).
		const candidates = await Promise.all(args.candidates.map(async (candidate) => {
			if (candidate.content.length > MAX_CONTENT_CHARS) {
				throw new Error("Keep each memory to 2000 characters or fewer.");
			}
			const content = candidate.content.replace(/\r\n/g, "\n").trim();
			if (!content) throw new Error("Write something to remember first.");
			if ((candidate.conversationTitle?.length ?? 0) > MAX_TITLE_CHARS
				|| (candidate.dedupKey?.length ?? 0) > 256) {
				throw new Error("Keep the memory attribution short.");
			}
			const conversationTitle = candidate.conversationTitle?.trim() || undefined;
			const date = confirmedDate(candidate.date);
			// Content identity is independent of editable titles/dates and client keys.
			const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
				JSON.stringify(["confirmed-history-v1", candidate.source, candidate.role, content]),
			));
			const dedupKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
			return { content, source: candidate.source, role: candidate.role, conversationTitle, date, dedupKey };
		}));
		const existing = await importRows(ctx, user._id);
		const known = new Set<string>();
		for (const memory of existing) {
			const metadata: unknown = memory.metadata;
			if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
				const fields = metadata as Record<string, unknown>;
				if (fields.kind === "confirmed_history" && typeof fields.dedupKey === "string") {
					known.add(fields.dedupKey);
				}
			}
		}
		const unique = candidates.filter((candidate) => {
			if (known.has(candidate.dedupKey)) return false;
			known.add(candidate.dedupKey);
			return true;
		});
		if (existing.length + unique.length > MAX_IMPORT_ROWS) {
			throw new Error("There are too many saved memories for another import right now.");
		}
		const now = Date.now();
		for (const candidate of unique) {
			await ctx.db.insert("memories", {
				userId: user._id,
				content: candidate.content,
				sector: "general",
				salience: 0.5,
				decayRate: 0.01,
				lastAccessed: now,
				accessCount: 0,
				metadata: {
					kind: "confirmed_history",
					source: candidate.source,
					role: candidate.role,
					...(candidate.conversationTitle === undefined ? {} : { conversationTitle: candidate.conversationTitle }),
					...(candidate.date === undefined ? {} : { date: candidate.date }),
					attribution: candidate.role === "assistant" ? "assistant_context" : "user_statement",
					dedupKey: candidate.dedupKey,
					importedAt: now,
				},
				createdAt: now,
				updatedAt: now,
			});
		}
		return { added: unique.length, skipped: candidates.length - unique.length };
	},
});

export const importMemories = mutation({
	args: { source: sourceValidator, text: v.string() },
	returns: v.object({ added: v.number(), skipped: v.number() }),
	handler: async (ctx, args) => {
		const user = await requireApprovedUser(ctx);
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
