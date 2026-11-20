import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

const themeValidator = v.union(v.literal("system"), v.literal("light"), v.literal("dark"));
const localeValidator = v.union(v.literal("en"), v.literal("he"));
const weekStartsOnValidator = v.union(v.literal(0), v.literal(1), v.literal(6));

const preferencesValidator = v.object({
  theme: themeValidator,
  locale: localeValidator,
  weekStartsOn: weekStartsOnValidator,
  timeZone: v.string(),
  emailReminders: v.boolean(),
  inAppNotifications: v.boolean(),
  /** The coach may search the web (TEMPO-B07-01, #976). Off unless the person turns it on. */
  coachWebSearch: v.boolean(),
});

type Theme = "system" | "light" | "dark";
type Locale = "en" | "he";
type WeekStartsOn = 0 | 1 | 6;

export type Preferences = {
  theme: Theme;
  locale: Locale;
  weekStartsOn: WeekStartsOn;
  timeZone: string;
  emailReminders: boolean;
  inAppNotifications: boolean;
  coachWebSearch: boolean;
};

export const PREFERENCE_DEFAULTS: Preferences = {
  theme: "system",
  locale: "en",
  weekStartsOn: 1,
  timeZone: "UTC",
  emailReminders: true,
  inAppNotifications: true,
  coachWebSearch: false,
};

/** The fields of a stored row as preferences; a row written before a field existed reads its default. */
function fromRow(row: {
  theme: Theme;
  locale: Locale;
  weekStartsOn: WeekStartsOn;
  timeZone: string;
  emailReminders: boolean;
  inAppNotifications: boolean;
  coachWebSearch?: boolean;
}): Preferences {
  return {
    theme: row.theme,
    locale: row.locale,
    weekStartsOn: row.weekStartsOn,
    timeZone: row.timeZone,
    emailReminders: row.emailReminders,
    inAppNotifications: row.inAppNotifications,
    coachWebSearch: row.coachWebSearch ?? PREFERENCE_DEFAULTS.coachWebSearch,
  };
}

/**
 * The person's live preferences, or the defaults when they have none. Server-side readers (the
 * coach's web search) use this, so a missing or deleted row reads exactly as `get` does.
 */
export async function preferencesFor(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Preferences> {
  const row = await ctx.db
    .query("userPreferences")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .first();
  return row ? fromRow(row) : PREFERENCE_DEFAULTS;
}

export const get = query({
  args: {},
  returns: preferencesValidator,
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!row || row.deletedAt !== undefined) {
      return PREFERENCE_DEFAULTS;
    }
    return fromRow(row);
  },
});

export const update = mutation({
  args: {
    theme: v.optional(themeValidator),
    locale: v.optional(localeValidator),
    weekStartsOn: v.optional(weekStartsOnValidator),
    timeZone: v.optional(v.string()),
    emailReminders: v.optional(v.boolean()),
    inAppNotifications: v.optional(v.boolean()),
    coachWebSearch: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const base: Preferences =
      existing && existing.deletedAt === undefined ? fromRow(existing) : PREFERENCE_DEFAULTS;

    const timeZone = args.timeZone === undefined ? base.timeZone : args.timeZone.trim();
    if (!timeZone) {
      throw new Error("Time zone is required");
    }

    const next: Preferences = {
      theme: args.theme ?? base.theme,
      locale: args.locale ?? base.locale,
      weekStartsOn: args.weekStartsOn ?? base.weekStartsOn,
      timeZone,
      emailReminders: args.emailReminders ?? base.emailReminders,
      inAppNotifications: args.inAppNotifications ?? base.inAppNotifications,
      coachWebSearch: args.coachWebSearch ?? base.coachWebSearch,
    };
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...next,
        updatedAt: now,
        deletedAt: undefined,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: user._id,
        ...next,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});
