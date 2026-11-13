import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { mapPaddleEvent, verifyPaddleSignature } from "./lib/paddle";

/**
 * Paddle SANDBOX webhook. Endpoint: POST /api/paddle-webhook (#1336).
 * Requires PADDLE_WEBHOOK_SECRET on the Convex deployment.
 * Does not read or change PAYMENT_SYSTEM_ENABLED or MOCK_PAYMENTS.
 */
export const paddleWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const raw = await request.text();
  const ok = await verifyPaddleSignature(request.headers.get("Paddle-Signature"), raw, secret);
  if (!ok) return new Response("Invalid signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const update = mapPaddleEvent(body);
  if (update) {
    try {
      await ctx.runMutation(internal.paddle.applySubscriptionUpdate, update);
    } catch (err) {
      console.error("[Paddle Webhook] update failed:", err);
    }
  }
  return new Response(JSON.stringify({ received: true, handled: !!update }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const applySubscriptionUpdate = internalMutation({
  args: {
    userId: v.string(),
    plan: v.union(v.literal("none"), v.literal("trial"), v.literal("basic"), v.literal("pro"), v.literal("max")),
    billingCycle: v.union(v.literal("none"), v.literal("monthly"), v.literal("annual")),
    status: v.union(v.literal("inactive"), v.literal("active"), v.literal("grace"), v.literal("cancelled")),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId) return null;
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptionStates")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const patch = {
      plan: args.plan,
      billingCycle: args.billingCycle,
      status: args.status,
      source: "paddle",
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, trialUsed: existing.trialUsed || args.plan === "trial" });
    } else {
      await ctx.db.insert("subscriptionStates", { userId, ...patch, trialUsed: args.plan === "trial", createdAt: now });
    }
    return null;
  },
});
