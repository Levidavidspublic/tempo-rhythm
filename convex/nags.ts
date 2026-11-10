import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { AiAuthError, AiRateLimitedError, AiUpstreamError } from "./lib/ai_errors";
import { requireApprovedForAi } from "./lib/aiGate";
import { callLLM } from "./lib/ai_router";
import { parseProposals, validatePhrase } from "./lib/nagPhrase";
import { requireUser } from "./lib/requireUser";

const LABEL_MAX = 60;

const phraseValidator = v.object({
  id: v.string(),
  text: v.string(),
  source: v.union(v.literal("user"), v.literal("derived")),
  status: v.union(v.literal("proposed"), v.literal("accepted"), v.literal("rejected")),
});

const nagValidator = v.object({
  _id: v.id("nags"),
  label: v.string(),
  enabled: v.boolean(),
  phrases: v.array(phraseValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function toNag(n: Doc<"nags">) {
  return {
    _id: n._id,
    label: n.label,
    enabled: n.enabled,
    phrases: n.phrases,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

async function ownedNag(
  ctx: { db: { get: (id: Doc<"nags">["_id"]) => Promise<Doc<"nags"> | null> } },
  nagId: Doc<"nags">["_id"],
  userId: Doc<"users">["_id"],
) {
  const nag = await ctx.db.get(nagId);
  if (!nag || nag.userId !== userId || nag.deletedAt !== undefined) {
    throw new Error("Nag not found");
  }
  return nag;
}

export const list = query({
  args: {},
  returns: v.array(nagValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("nags")
      .withIndex("by_userId_deletedAt", (q) => q.eq("userId", user._id).eq("deletedAt", undefined))
      .collect();
    return rows
      .filter((n) => n.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toNag);
  },
});

export const create = mutation({
  args: { label: v.string() },
  returns: v.id("nags"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const label = args.label.trim();
    if (!label || label.length > LABEL_MAX) {
      throw new Error(`Give the nag a name of 1 to ${LABEL_MAX} characters.`);
    }
    const now = Date.now();
    return ctx.db.insert("nags", {
      userId: user._id,
      label,
      enabled: false,
      phrases: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addPhrase = mutation({
  args: {
    nagId: v.id("nags"),
    text: v.string(),
    source: v.union(v.literal("user"), v.literal("derived")),
  },
  returns: v.object({ phraseId: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const nag = await ownedNag(ctx, args.nagId, user._id);
    const check = validatePhrase(args.text);
    if (!check.ok) {
      throw new Error(check.message);
    }
    const phraseId = crypto.randomUUID();
    await ctx.db.patch(nag._id, {
      phrases: [
        ...nag.phrases,
        {
          id: phraseId,
          text: check.text,
          source: args.source,
          status: args.source === "user" ? ("accepted" as const) : ("proposed" as const),
        },
      ],
      updatedAt: Date.now(),
    });
    return { phraseId };
  },
});

export const decidePhrase = mutation({
  args: {
    nagId: v.id("nags"),
    phraseId: v.string(),
    decision: v.union(v.literal("accept"), v.literal("reject")),
  },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const nag = await ownedNag(ctx, args.nagId, user._id);
    if (!nag.phrases.some((p) => p.id === args.phraseId)) {
      throw new Error("Phrase not found");
    }
    const status = args.decision === "accept" ? ("accepted" as const) : ("rejected" as const);
    const phrases = nag.phrases.map((p) => (p.id === args.phraseId ? { ...p, status } : p));
    // A nag with no accepted phrase can't stay on (PRD §5).
    const stillValid = phrases.some((p) => p.status === "accepted");
    await ctx.db.patch(nag._id, {
      phrases,
      enabled: nag.enabled && stillValid,
      updatedAt: Date.now(),
    });
    return { success: true as const };
  },
});

export const setEnabled = mutation({
  args: { nagId: v.id("nags"), enabled: v.boolean() },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const nag = await ownedNag(ctx, args.nagId, user._id);
    if (args.enabled && !nag.phrases.some((p) => p.status === "accepted")) {
      throw new Error("Add a phrase you accept first.");
    }
    await ctx.db.patch(nag._id, { enabled: args.enabled, updatedAt: Date.now() });
    return { success: true as const };
  },
});

/** Soft delete (HARD_RULES §9). */
export const remove = mutation({
  args: { nagId: v.id("nags") },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const nag = await ownedNag(ctx, args.nagId, user._id);
    const now = Date.now();
    await ctx.db.patch(nag._id, { deletedAt: now, enabled: false, updatedAt: now });
    return { success: true as const };
  },
});

export const getForProposal = internalQuery({
  args: { nagId: v.id("nags") },
  returns: v.union(
    v.null(),
    v.object({ label: v.string(), phrases: v.array(phraseValidator) }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const nag = await ctx.db.get(args.nagId);
    if (!nag || nag.userId !== user._id || nag.deletedAt !== undefined) {
      return null;
    }
    return { label: nag.label, phrases: nag.phrases };
  },
});

const PROPOSE_SYSTEM_PROMPT = `You help a person write reminder phrases in their own voice.
You are given a reminder label and phrases the person wrote themselves.
Return ONLY a JSON object: {"proposals": ["...", "...", "..."]}
Rules:
- At most 3 proposals, each under 140 characters.
- Reuse the person's own words and tone. Do not invent a new voice.
- Plain text only: no emoji, no hashtags, no quotes.
- Never shame, scold, or imply the person is behind or failing.`;

/** Proposes phrases only. Writes nothing; the user adds one through `addPhrase`. */
export const proposePhrases = action({
  args: { nagId: v.id("nags") },
  returns: v.object({ proposals: v.array(v.string()) }),
  handler: async (ctx, args): Promise<{ proposals: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in to use phrase suggestions.");
    }
    // Sign-up approval gate: no model call for pending/revoked accounts.
    await requireApprovedForAi(ctx);
    const nag = await ctx.runQuery(internal.nags.getForProposal, { nagId: args.nagId });
    if (!nag) {
      throw new Error("Nag not found");
    }
    const own = nag.phrases.filter((p) => p.source === "user" && p.status === "accepted");
    if (own.length === 0) {
      return { proposals: [] };
    }

    try {
      const result = await callLLM({
        tier: "fast",
        messages: [
          { role: "system", content: PROPOSE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Label: ${nag.label}\nThe person's own phrases:\n${own.map((p) => `- ${p.text}`).join("\n")}`,
          },
        ],
        maxTokens: 256,
        temperature: 0.5,
        responseFormat: "json_object",
      });
      return {
        proposals: parseProposals(
          result.content,
          nag.phrases.map((p) => p.text),
        ),
      };
    } catch (err) {
      if (err instanceof AiAuthError) {
        throw new Error("Suggestions are not configured here yet. You can still write your own.");
      }
      if (err instanceof AiRateLimitedError) {
        throw new Error("Too many requests right now. Pause a moment and try again.");
      }
      if (err instanceof AiUpstreamError) {
        throw new Error("The suggester had a hiccup. Try again in a moment?");
      }
      if (err instanceof Error && err.message) {
        throw err;
      }
      throw new Error("Something went wrong while suggesting phrases. Try again?");
    }
  },
});
