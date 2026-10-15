import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { isInactiveAccount, softDeleteUserAccount } from "./lib/accountDeletion";
import { initialApprovalStatus } from "./lib/approval";
import { buildReturningUserPatch, newUserFields } from "./lib/entitlements";
import { requireUser, resolveUserFromIdentity } from "./lib/requireUser";
import { assertClientMaySetUserType } from "./lib/subscriptionGuards";

/** Shared resolver for the authenticated app user document. */
export async function fetchCurrentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await resolveUserFromIdentity(ctx, identity);
  if (!user || isInactiveAccount(user)) {
    return null;
  }
  return user;
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => fetchCurrentUser(ctx),
});

const PLACEHOLDER_NAME = "User";

/** Profile name, else the email prefix, else a calm fallback. Never the placeholder "User". */
function greetingNameFor(user: { fullName?: string; email?: string }): string {
  const name = user.fullName?.trim();
  if (name && name !== PLACEHOLDER_NAME) {
    return name;
  }
  const prefix = user.email?.split("@")[0]?.trim();
  if (prefix) {
    return prefix;
  }
  return "there";
}

function identityDisplayName(identity: {
  name?: string | null;
  nickname?: string | null;
}): string | undefined {
  const raw = (identity.name || identity.nickname || "").trim();
  if (!raw || raw === PLACEHOLDER_NAME) {
    return undefined;
  }
  return raw;
}

async function dropPlaceholderFullName(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const row = await ctx.db.get(userId);
  const current = row?.fullName?.trim();
  if (!row || (current && current !== PLACEHOLDER_NAME)) {
    return;
  }
  await ctx.db.patch(userId, { fullName: undefined });
}

/** Profile for dashboard greeting and header; extends user with `greetingName`. */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await fetchCurrentUser(ctx);
    if (!user) return null;
    return {
      ...user,
      greetingName: greetingNameFor(user),
    };
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const currentUser = await requireUser(ctx);
    if (currentUser._id !== userId && currentUser.role !== "admin") {
      throw new Error("Access denied");
    }
    return ctx.db.get(userId);
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireUser(ctx);
    if (currentUser.role !== "admin") {
      throw new Error("Access denied");
    }
    const rows = await ctx.db
      .query("users")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .collect();
    return rows.filter((user) => user.isActive !== false);
  },
});

/**
 * SECOND write path for the users table (the first is the Convex Auth
 * `createOrUpdateUser` callback in convex/auth.ts). It is a public mutation, so
 * any client can call it.
 *
 * It used to build ONE object with `role: "user"` and `userType: "free"` and
 * patch that onto the existing row, downgrading a granted/paid account back to
 * free every time it ran. The update path now writes identity fields only and
 * shares convex/lib/entitlements.ts with auth.ts so the two cannot drift apart
 * again.
 */
export const createOrUpdateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = identity.email ?? "";
    const now = Date.now();
    const fullName = identityDisplayName(identity);

    const profile = {
      email,
      emailVerified: identity.emailVerified ?? false,
      ...(fullName ? { fullName } : {}),
    };

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      // A leftover session must not clear deletedAt or isActive. Restore
      // happens only in the Convex Auth callback, and only inside 30 days.
      if (isInactiveAccount(existing)) {
        throw new Error(
          "This account is not active. Sign in again within 30 days of deletion to restore it, or contact support.",
        );
      }
      // Identity fields plus self-heal only. This path must never write
      // `role`, and must never write `userType` unconditionally - that was
      // the downgrade.
      await ctx.db.patch(existing._id, buildReturningUserPatch(existing, profile, now));
      if (!fullName) {
        await dropPlaceholderFullName(ctx, existing._id);
      }
      return existing._id;
    }

    const userId = await ctx.db.insert(
      "users",
      newUserFields(profile, now, initialApprovalStatus(profile.email)),
    );
    if (!fullName) {
      await dropPlaceholderFullName(ctx, userId);
    }
    return userId;
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, fullName }) => {
    const currentUser = await requireUser(ctx);
    if (currentUser._id !== userId && currentUser.role !== "admin") {
      throw new Error("Access denied");
    }
    await ctx.db.patch(userId, { fullName, updatedAt: Date.now() });
    return userId;
  },
});

export const updateUserType = mutation({
  args: {
    userType: v.union(v.literal("free"), v.literal("paid")),
  },
  handler: async (ctx, { userType }) => {
    assertClientMaySetUserType(userType);
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { userType, updatedAt: Date.now() });
    return user._id;
  },
});

/**
 * Called by the RevenueCat webhook (convex/revenuecat.ts) to sync subscription status.
 * Uses appUserId (RevenueCat user ID = Convex user email or subject) to find and update the user.
 */
export const updateSubscriptionStatus = internalMutation({
  args: {
    userId: v.string(),
    userType: v.union(v.literal("free"), v.literal("paid")),
    activeEntitlements: v.array(v.string()),
    revenueCatEvent: v.string(),
  },
  handler: async (ctx, { userId, userType, activeEntitlements: _entitlements, revenueCatEvent: _event }) => {
    // Try to find user by email (RevenueCat appUserId is typically the user's email)
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", userId))
      .unique();

    // Fallback: try to find by ID if userId looks like a Convex ID
    if (!user) {
      try {
        user = await ctx.db.get(userId as import("./_generated/dataModel").Id<"users">);
      } catch {
        // Not a valid Convex ID — user not found
      }
    }

    if (!user) {
      console.warn(`[RevenueCat] User not found for appUserId: ${userId}`);
      return { updated: false };
    }

    await ctx.db.patch(user._id, { userType, updatedAt: Date.now() });
    return { updated: true, userId: user._id };
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const currentUser = await requireUser(ctx);
    if (currentUser._id !== userId && currentUser.role !== "admin") {
      throw new Error("Access denied");
    }
    await ctx.db.delete(userId);
  },
});

export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const { deletedCount } = await softDeleteUserAccount(ctx, user._id);
    return { success: true, deletedCount };
  },
});

export const updateMyProfile = mutation({
  args: { fullName: v.string() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const fullName = args.fullName.trim();
    if (!fullName) {
      throw new Error("Name is required");
    }
    await ctx.db.patch(user._id, { fullName, updatedAt: Date.now() });
    return user._id;
  },
});

export const completeOnboarding = mutation({
  args: { fullName: v.optional(v.string()) },
  returns: v.object({ onboardedAt: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const fullName = args.fullName?.trim();
    const now = Date.now();
    if (user.onboardedAt !== undefined) {
      if (fullName) {
        await ctx.db.patch(user._id, { fullName, updatedAt: now });
      }
      return { onboardedAt: user.onboardedAt };
    }
    await ctx.db.patch(user._id, {
      onboardedAt: now,
      updatedAt: now,
      ...(fullName ? { fullName } : {}),
    });
    return { onboardedAt: now };
  },
});

const subscriptionPlanValidator = v.union(
  v.literal("none"),
  v.literal("trial"),
  v.literal("basic"),
  v.literal("pro"),
  v.literal("max"),
);

const subscriptionStatusValidator = v.union(
  v.literal("inactive"),
  v.literal("active"),
  v.literal("grace"),
  v.literal("cancelled"),
);

const myPlanValidator = v.object({
  plan: subscriptionPlanValidator,
  status: subscriptionStatusValidator,
  label: v.string(),
  betaAccess: v.union(v.literal("none"), v.literal("tester"), v.literal("founder")),
  entitlementTier: v.union(
    v.literal("none"),
    v.literal("basic"),
    v.literal("pro"),
    v.literal("max"),
    v.literal("god"),
  ),
  userType: v.union(v.literal("free"), v.literal("paid")),
  isBeta: v.boolean(),
});

function planLabel(
  betaAccess: "none" | "tester" | "founder",
  plan: "none" | "trial" | "basic" | "pro" | "max",
  status: "inactive" | "active" | "grace" | "cancelled",
): string {
  if (betaAccess === "founder") {
    return "Founder";
  }
  if (betaAccess === "tester") {
    return "Beta tester";
  }
  if (status === "active" || status === "grace") {
    if (plan === "trial") return "Trial";
    if (plan === "basic") return "Basic";
    if (plan === "pro") return "Pro";
    if (plan === "max") return "Max";
  }
  return "Free";
}

export const getMyPlan = query({
  args: {},
  returns: v.union(myPlanValidator, v.null()),
  handler: async (ctx) => {
    const user = await fetchCurrentUser(ctx);
    if (!user) {
      return null;
    }
    const subscription = await ctx.db
      .query("subscriptionStates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const plan = subscription?.plan ?? "none";
    const status = subscription?.status ?? "inactive";
    const betaAccess = user.betaAccess ?? "none";
    const entitlementTier = user.entitlementTier ?? "none";
    const userType = user.userType ?? "free";
    return {
      plan,
      status,
      label: planLabel(betaAccess, plan, status),
      betaAccess,
      entitlementTier,
      userType,
      isBeta: betaAccess === "tester" || betaAccess === "founder",
    };
  },
});
