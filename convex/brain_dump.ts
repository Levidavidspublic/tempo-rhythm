import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, type MutationCtx, mutation } from "./_generated/server";
import {
  AiAuthError,
  AiContextTooLargeError,
  AiRateLimitedError,
  AiUpstreamError,
} from "./lib/ai_errors";
import { callLLM } from "./lib/ai_router";
import { requireApprovedForAi } from "./lib/aiGate";
import { validateBrainDumpInput } from "./lib/brainDumpInput";
import { type BrainDumpPlan, parsePlanFromModelContent } from "./lib/brainDumpParse";
import { requireUser } from "./lib/requireUser";

export type { BrainDumpPlan, BrainDumpPriority } from "./lib/brainDumpParse";
export { parsePlanFromModelContent } from "./lib/brainDumpParse";

const SYSTEM_PROMPT = `You are a calm planning assistant for an ADHD-friendly app. The user pastes a messy brain dump (tasks, worries, reminders mixed together).

Return ONLY a single JSON object (no markdown, no code fences) with this exact shape:
{
  "summary": "string — 1-3 short sentences, supportive and concrete, never shaming",
  "priorities": [
    {
      "title": "string — short actionable item, max ~78 chars",
      "reason": "string — one sentence why this slot",
      "urgency": "now" | "soon" | "later"
    }
  ]
}

Rules:
- "now" = needs attention today or removes urgent pressure (deadlines, people waiting, money, health).
- "soon" = this week / follow-ups that are not on fire.
- "later" = ideas, someday, optional.
- At most 6 priorities, ordered most important first.
- Titles must be practical next moves, not vague ("Reply to Sam" not "Communication").
- Use plain language.`;

/**
 * Preview-only: returns a prioritized plan from messy text. Does not write tasks or persist the dump.
 */
export const prioritize = action({
  args: {
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<BrainDumpPlan> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in to use planning on this device.");
    }
    // Sign-up approval gate: no model call for pending/revoked accounts.
    await requireApprovedForAi(ctx);
    return planBrainDump(args.rawText);
  },
});

/**
 * The planner itself (validate, call the model through the AI seam, parse).
 * Callers must already have passed the approval AI gate. Shared with the MCP `brain_dump` tool.
 */
export async function planBrainDump(rawText: string): Promise<BrainDumpPlan> {
  const validated = validateBrainDumpInput(rawText);
  if (!validated.ok) {
    throw new Error(validated.message);
  }
  const raw = validated.raw;

  try {
    const result = await callLLM({
      tier: "balanced",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Brain dump to prioritize:\n\n${raw}`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.25,
      responseFormat: "json_object",
    });

    return parsePlanFromModelContent(result.content);
  } catch (err) {
    if (err instanceof AiAuthError) {
      throw new Error("Planning is not configured here yet. Use local sorting or try again later.");
    }
    if (err instanceof AiRateLimitedError) {
      throw new Error("Too many requests right now. Pause a moment and try again.");
    }
    if (err instanceof AiContextTooLargeError) {
      throw new Error("That input is too long for one pass. Try a shorter chunk.");
    }
    if (err instanceof AiUpstreamError) {
      throw new Error("The planner had a hiccup. Try again in a moment?");
    }
    if (err instanceof Error && err.message) {
      throw err;
    }
    throw new Error("Something went wrong while planning. Try again?");
  }
}

const PRIORITY_BY_URGENCY = {
  now: "high",
  soon: "medium",
  later: "low",
} as const;
const ACCEPT_MAX_ITEMS = 6;
const ACCEPT_TITLE_MAX = 200;

/**
 * Writes only the items the user accepted, as tasks. The dump itself is not stored.
 */
export const acceptPlan = mutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        urgency: v.union(v.literal("now"), v.literal("soon"), v.literal("later")),
      }),
    ),
  },
  returns: v.object({ created: v.number(), taskIds: v.array(v.id("tasks")) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return acceptPlanForUser(ctx, user._id, args.items);
  },
});

/** Shared by `acceptPlan` and the MCP `brain_dump` tool (`accept: true`). */
export async function acceptPlanForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  items: { title: string; urgency: "now" | "soon" | "later" }[],
): Promise<{ created: number; taskIds: Id<"tasks">[] }> {
  if (items.length < 1 || items.length > ACCEPT_MAX_ITEMS) {
    throw new Error(`Pick 1 to ${ACCEPT_MAX_ITEMS} items to add.`);
  }
  const cleaned = items.map((item) => ({
    title: item.title.trim().slice(0, ACCEPT_TITLE_MAX),
    urgency: item.urgency,
  }));
  if (cleaned.some((item) => !item.title)) {
    throw new Error("Every item needs a title.");
  }
  const now = Date.now();
  const taskIds: Id<"tasks">[] = [];
  for (const item of cleaned) {
    taskIds.push(
      await ctx.db.insert("tasks", {
        userId,
        title: item.title,
        status: "todo",
        priority: PRIORITY_BY_URGENCY[item.urgency],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  return { created: taskIds.length, taskIds };
}
