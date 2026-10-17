import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * User-owned tables that carry `by_userId`, `deletedAt` and `updatedAt`. Account deletion
 * stamps `deletedAt` and `updatedAt` with one timestamp and keeps an earlier `deletedAt`.
 *
 * `chatRequests` links to Agent-component messages by opaque id. Soft delete only tombstones
 * the host row: it never calls an Agent delete API, because component tables have no
 * `deletedAt` and a hard delete would end the 30-day recoverable grace window.
 *
 * `pageOperations`, `pageOperationPayloads` and `pageProposals` (#828) take the same ordinary
 * tombstone. Soft delete only stamps `deletedAt` and `updatedAt`: it never erases inverse
 * fragments, rewrites an `available` payload to `expired`, edits expiry metadata or schedules
 * cleanup. Those belong to a separately reviewed cleanup path, and the 30-day account grace
 * window does not extend an expired Undo or proposal window.
 *
 * A tombstone alone does not stop an endpoint from reading a row. The read side lives in
 * `pagePrivacy.ts` (#808): every page, Undo, proposal and Agent-linked chat path calls one of its
 * guards, which deny a deleted account, note or conversation and any tombstoned row immediately.
 */
export const USER_OWNED_TABLES = [
  "tasks",
  "notes",
  "habits",
  "goals",
  "memories",
  "calendarEvents",
  "taskRepeatCfgs",
  "dayPlans",
  "timeBlocks",
  "habitCheckIns",
  "focusBlocks",
  "templates",
  "userPreferences",
  "notifications",
  "noteBlocks",
  "chatRequests",
  "pageOperations",
  "pageOperationPayloads",
  "pageProposals",
  "voiceSessions",
  // Study layer (kitchen T3): `studySets` is a page child; the rest hang off a set.
  "studySets",
  "studyCardStates",
  "studyReviews",
  "studyAttempts",
  "studyPlans",
  // Record a meeting or lecture (kitchen T8): a content-free lease, like `voiceSessions`.
  "recordingSessions",
] as const;

type UserOwnedTable = (typeof USER_OWNED_TABLES)[number];

export function isInactiveAccount(user: {
  deletedAt?: number;
  isActive?: boolean;
}): boolean {
  return user.deletedAt !== undefined || user.isActive === false;
}

/** HARD_RULES: a deleted account can be restored for 30 days, then not. */
export const ACCOUNT_RESTORE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Patch that a fresh sign-in may apply. Only a soft-delete inside the grace
 * window restores. Admin deactivation (`isActive: false` with no `deletedAt`)
 * and an expired grace window return null so the caller leaves the row inactive.
 */
export function signInRestorePatch(
  user: { deletedAt?: number; isActive?: boolean },
  now: number,
): { deletedAt: undefined; isActive: true } | null {
  if (user.deletedAt === undefined) {
    return null;
  }
  if (now < user.deletedAt) {
    return null;
  }
  if (now - user.deletedAt > ACCOUNT_RESTORE_GRACE_MS) {
    return null;
  }
  return { deletedAt: undefined, isActive: true };
}

/** Prefer a live row, then one still inside the restore window, else the first match. */
export function pickSignInUser<T extends { deletedAt?: number; isActive?: boolean }>(
  matches: readonly T[],
  now: number,
): T | null {
  const live = matches.find((user) => !isInactiveAccount(user));
  if (live) {
    return live;
  }
  const restorable = matches.find((user) => signInRestorePatch(user, now) !== null);
  if (restorable) {
    return restorable;
  }
  return matches[0] ?? null;
}

/** Soft-delete a user account and owned rows (GDPR grace window per HARD_RULES §9). */
export async function softDeleteUserAccount(
  ctx: MutationCtx,
  userId: Id<"users">,
  now = Date.now(),
): Promise<{ deletedCount: number }> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;

  if (user.deletedAt === undefined) {
    await ctx.db.patch(userId, {
      deletedAt: now,
      isActive: false,
      updatedAt: now,
    });
    deletedCount += 1;
  }

  for (const table of USER_OWNED_TABLES) {
    deletedCount += await softDeleteRowsByUserId(ctx, table, userId, now);
  }

  for (const table of ["nags", "coachSettings", "coachProposals"] as const) {
    deletedCount += await softDeleteAdditionalRows(ctx, table, userId, now);
  }

  const tokens = await ctx.db
    .query("mcpTokens")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const token of tokens) {
    if (token.revokedAt === undefined) {
      await ctx.db.patch(token._id, { revokedAt: now });
      deletedCount += 1;
    }
  }

  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const conversation of conversations) {
    if (conversation.deletedAt === undefined) {
      await ctx.db.patch(conversation._id, { deletedAt: now, updatedAt: now });
      deletedCount += 1;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", conversation._id))
      .collect();

    for (const message of messages) {
      if (message.deletedAt === undefined) {
        await ctx.db.patch(message._id, { deletedAt: now });
        deletedCount += 1;
      }
    }
  }

  const subscription = await ctx.db
    .query("subscriptionStates")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (subscription && subscription.status !== "inactive") {
    await ctx.db.patch(subscription._id, {
      status: "inactive",
      updatedAt: now,
    });
    deletedCount += 1;
  }

  return { deletedCount };
}

async function softDeleteAdditionalRows(
  ctx: MutationCtx,
  table: "nags" | "coachSettings" | "coachProposals",
  userId: Id<"users">,
  now: number,
): Promise<number> {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  let count = 0;
  for (const row of rows) {
    if (row.deletedAt === undefined) {
      await ctx.db.patch(
        row._id,
        table === "coachProposals" ? { deletedAt: now } : { deletedAt: now, updatedAt: now },
      );
      count += 1;
    }
  }
  return count;
}

async function softDeleteRowsByUserId(
  ctx: MutationCtx,
  table: UserOwnedTable,
  userId: Id<"users">,
  now: number,
): Promise<number> {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  let count = 0;
  for (const row of rows) {
    if (row.deletedAt === undefined) {
      await ctx.db.patch(row._id, { deletedAt: now, updatedAt: now });
      count += 1;
    }
  }
  return count;
}
