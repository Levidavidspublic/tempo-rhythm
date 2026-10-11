import { type Infer, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";

const SECTORS = ["semantic", "episodic", "procedural", "emotional", "general"] as const;
type Sector = (typeof SECTORS)[number];

const sectorValidator = v.union(
  v.literal("semantic"),
  v.literal("episodic"),
  v.literal("procedural"),
  v.literal("emotional"),
  v.literal("general"),
);

const provenanceValidator = v.object({
  source: v.union(v.literal("chatgpt"), v.literal("claude")),
  role: v.union(v.literal("user"), v.literal("assistant")),
  attribution: v.union(v.literal("user_statement"), v.literal("assistant_context")),
  conversationTitle: v.optional(v.string()),
  date: v.optional(v.string()),
  importedAt: v.number(),
});

const memoryValidator = v.object({
  _id: v.id("memories"),
  content: v.string(),
  sector: sectorValidator,
  salience: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastAccessed: v.number(),
  provenance: v.optional(provenanceValidator),
});

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CONTENT_MAX = 2000;
const MAX_EXPORT_ROWS = 10000;

function clampLimit(limit: number | undefined, fallback = DEFAULT_LIMIT): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return fallback;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function provenanceOf(metadata: unknown): Infer<typeof provenanceValidator> | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const fields = metadata as Record<string, unknown>;
  if (fields.kind !== "confirmed_history"
    || (fields.source !== "chatgpt" && fields.source !== "claude")
    || (fields.role !== "user" && fields.role !== "assistant")
    || typeof fields.importedAt !== "number" || !Number.isFinite(fields.importedAt)
    || fields.importedAt < 0) {
    return undefined;
  }
  return {
    source: fields.source,
    role: fields.role,
    // Never trust a stored claim that an assistant suggestion is a user fact.
    attribution: fields.role === "assistant" ? "assistant_context" as const : "user_statement" as const,
    ...(typeof fields.conversationTitle === "string" && fields.conversationTitle.length <= 200
      ? { conversationTitle: fields.conversationTitle } : {}),
    ...(typeof fields.date === "string" && fields.date.length <= 35
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fields.date)
      && Number.isFinite(Date.parse(fields.date))
      && new Date(fields.date).toISOString() === fields.date ? { date: fields.date } : {}),
    importedAt: fields.importedAt,
  };
}

function toMemory(m: Doc<"memories">) {
  const provenance = provenanceOf(m.metadata);
  return {
    _id: m._id,
    content: m.content,
    sector: m.sector,
    salience: m.salience,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    lastAccessed: m.lastAccessed,
    // Preserve the exact legacy row shape for unattributed memories.
    ...(provenance === undefined ? {} : { provenance }),
  };
}

async function liveMemories(ctx: QueryCtx, userId: Doc<"users">["_id"], limit = MAX_LIMIT) {
  return ctx.db
    .query("memories")
    .withIndex("by_userId_deletedAt_salience_updatedAt", (q) =>
      q.eq("userId", userId).eq("deletedAt", undefined))
    .order("desc")
    .take(limit);
}

function contentForContext(m: Doc<"memories">) {
  const provenance = provenanceOf(m.metadata);
  if (!provenance) return m.content;
  const source = provenance.source === "chatgpt" ? "ChatGPT" : "Claude";
  const label = provenance.role === "assistant"
    ? "assistant context, not a fact about you"
    : "user statement, not a verified fact";
  // Prefix every line so imported instructions remain attributed, quoted source data.
  return `Imported ${source} ${label} (quoted):\n${m.content.split("\n").map((line) => `  > ${line}`).join("\n")}`;
}

export const remember = mutation({
  args: { content: v.string(), sector: v.optional(sectorValidator) },
  returns: v.id("memories"),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const content = args.content.trim();
    if (!content) {
      throw new Error("Write something to remember first.");
    }
    if (content.length > CONTENT_MAX) {
      throw new Error(`Keep a memory to ${CONTENT_MAX} characters or fewer.`);
    }
    const now = Date.now();
    return ctx.db.insert("memories", {
      userId: user._id,
      content,
      sector: args.sector ?? "general",
      salience: 0.5,
      decayRate: 0.01,
      lastAccessed: now,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recall = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(memoryValidator),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const needle = args.query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const rows = await liveMemories(ctx, user._id);
    return rows
      .filter((m) => m.content.toLowerCase().includes(needle))
      .slice(0, clampLimit(args.limit))
      .map(toMemory);
  },
});

export const list = query({
  args: { sector: v.optional(sectorValidator), limit: v.optional(v.number()) },
  returns: v.array(memoryValidator),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const rows = await liveMemories(ctx, user._id);
    return rows
      .filter((m) => args.sector === undefined || m.sector === args.sector)
      .slice(0, clampLimit(args.limit))
      .map(toMemory);
  },
});

export const context = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ text: v.string(), count: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const rows = await liveMemories(ctx, user._id, clampLimit(args.limit, 10));
    return { text: rows.map((m) => `- ${contentForContext(m)}`).join("\n"), count: rows.length };
  },
});

/** Edit content without changing import identity or source/role attribution. */
export const update = mutation({
  args: { memoryId: v.id("memories"), content: v.string() },
  returns: memoryValidator,
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== user._id || memory.deletedAt !== undefined) {
      throw new Error("Memory not found");
    }
    const content = args.content.trim();
    if (!content) throw new Error("Write something to remember first.");
    if (args.content.length > CONTENT_MAX) {
      throw new Error("Keep a memory to 2000 characters or fewer.");
    }
    const updatedAt = Date.now();
    await ctx.db.patch(memory._id, { content, updatedAt });
    return toMemory({ ...memory, content, updatedAt });
  },
});

/** Soft delete (HARD_RULES §9). */
export const forget = mutation({
  args: { memoryId: v.id("memories") },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.memoryId);
    if (!m || m.userId !== user._id || m.deletedAt !== undefined) {
      throw new Error("Memory not found");
    }
    const now = Date.now();
    await ctx.db.patch(m._id, { deletedAt: now, updatedAt: now });
    return { success: true as const };
  },
});

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Markdown, one section per sector. The person never sees JSON. */
export const exportAll = query({
  args: {},
  returns: v.object({
    filename: v.string(),
    exportedAt: v.number(),
    count: v.number(),
    markdown: v.string(),
  }),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    const exportedAt = Date.now();
    // Explicit full export has a separate budget; never silently truncate the legacy API.
    const rows = await liveMemories(ctx, user._id, MAX_EXPORT_ROWS + 1);
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new Error("There are too many memories to export at once right now.");
    }
    const sections: string[] = ["# Tempo memories", ""];
    for (const sector of SECTORS as readonly Sector[]) {
      const inSector = rows.filter((m) => m.sector === sector);
      if (inSector.length === 0) {
        continue;
      }
      sections.push(`## ${sector[0]?.toUpperCase()}${sector.slice(1)}`, "");
      for (const m of inSector) {
        sections.push(`- ${contentForContext(m).replace(/\s*\n\s*/g, " ")}`);
      }
      sections.push("");
    }
    if (rows.length === 0) {
      sections.push("No memories saved yet.", "");
    }
    return {
      filename: `tempo-memories-${isoDate(exportedAt)}.md`,
      exportedAt,
      count: rows.length,
      markdown: sections.join("\n"),
    };
  },
});
