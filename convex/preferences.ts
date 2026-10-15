import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
};

export const PREFERENCE_DEFAULTS: Preferences = {
  theme: "system",
  locale: "en",
  weekStartsOn: 1,
  timeZone: "UTC",
  emailReminders: true,
  inAppNotifications: true,
};

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
    return {
      theme: row.theme,
      locale: row.locale,
      weekStartsOn: row.weekStartsOn,
      timeZone: row.timeZone,
      emailReminders: row.emailReminders,
      inAppNotifications: row.inAppNotifications,
    };
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const base: Preferences =
      existing && existing.deletedAt === undefined
        ? {
            theme: existing.theme,
            locale: existing.locale,
            weekStartsOn: existing.weekStartsOn,
            timeZone: existing.timeZone,
            emailReminders: existing.emailReminders,
            inAppNotifications: existing.inAppNotifications,
          }
        : PREFERENCE_DEFAULTS;

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
