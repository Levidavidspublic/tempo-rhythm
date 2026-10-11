import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// HARD_RULES §9 — every user-owned table must carry `deletedAt: v.optional(v.number())`
// for soft-delete. `undefined` means the row is live; a number is the epoch-ms the row was
// soft-deleted at. Hard deletes are forbidden for user-visible data (§9, §6 DSR grace window).
//
// `userId` is intentionally `v.id("users")` in this repo until the migration to
// `v.optional(v.string())` lands (see docs/brain/TASKS.md for the migration ticket).
// HARD_RULES §9 "Current repository" explicitly permits this transitional state.
//
// Every table queried by userId carries a compound `by_userId_deletedAt` index so active
// rows can be streamed without a full scan.

export default defineSchema({
  ...authTables,

  users: defineTable({
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    emailVerified: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    userType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    betaAccess: v.optional(v.union(v.literal("none"), v.literal("tester"), v.literal("founder"))),
    entitlementTier: v.optional(
      v.union(
        v.literal("none"),
        v.literal("basic"),
        v.literal("pro"),
        v.literal("max"),
        v.literal("god"),
      ),
    ),
    isGodTier: v.optional(v.boolean()),
    betaApprovedAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    /** Set when the person finishes onboarding. Absent until then. */
    onboardedAt: v.optional(v.number()),
    /**
     * Sign-up approval gate (convex/lib/approval.ts). New accounts start "pending";
     * an admin sets "approved" or "revoked". Absent on pre-gate rows (count as approved).
     */
    approvalStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("revoked")),
    ),
    approvalUpdatedAt: v.optional(v.number()),
    /** Admin email, "cli" or "backfill". */
    approvalUpdatedBy: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_approvalStatus", ["approvalStatus"])
    .index("by_role", ["role"])
    .index("by_userType", ["userType"])
    .index("by_betaAccess", ["betaAccess"])
    .index("by_deletedAt", ["deletedAt"]),

  subscriptionStates: defineTable({
    userId: v.id("users"),
    plan: v.union(
      v.literal("none"),
      v.literal("trial"),
      v.literal("basic"),
      v.literal("pro"),
      v.literal("max"),
    ),
    billingCycle: v.union(
      v.literal("none"),
      v.literal("monthly"),
      v.literal("annual"),
      v.literal("lifetime"),
    ),
    status: v.union(
      v.literal("inactive"),
      v.literal("active"),
      v.literal("grace"),
      v.literal("cancelled"),
    ),
    trialUsed: v.boolean(),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    technique: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    modelUsed: v.optional(v.string()),
    councilResponse: v.optional(v.any()),
    toolCalls: v.optional(v.any()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"])
    .index("by_conversationId_deletedAt", ["conversationId", "deletedAt"]),

  memories: defineTable({
    userId: v.id("users"),
    content: v.string(),
    sector: v.union(
      v.literal("semantic"),
      v.literal("episodic"),
      v.literal("procedural"),
      v.literal("emotional"),
      v.literal("general"),
    ),
    salience: v.number(),
    decayRate: v.number(),
    lastAccessed: v.number(),
    accessCount: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_salience", ["userId", "salience"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("cancelled"),
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    // TF-OSS-01: every added field is v.optional(...) — the deployment is
    // populated and non-optional additions break existing rows.
    energy: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    /** Planned effort in ms. */
    timeEstimate: v.optional(v.number()),
    /** Absent = elastic. Elastic items reflow around fixed ones. */
    flexibility: v.optional(v.union(v.literal("fixed"), v.literal("elastic"))),
    /** Record<"YYYY-MM-DD", number> — tracked ms per local day. */
    timeSpentOnDay: v.optional(v.any()),
    repeatCfgId: v.optional(v.id("taskRepeatCfgs")),
    parentTaskId: v.optional(v.id("tasks")),
    // T-005a: lightweight project grouping until a projects table exists.
    projectId: v.optional(v.string()),
    projectName: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    /** Set only on the transition to done. Cleared when the task leaves done. */
    completedAt: v.optional(v.number()),
    // Leftover from #206 — optional steps on a task, not a new table.
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          completed: v.boolean(),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_dueAt", ["userId", "dueAt"])
    .index("by_userId_projectId", ["userId", "projectId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /**
   * TF-OSS-01 — recurrence series config. Field design lifted from
   * super-productivity (MIT; read for design, nothing vendored).
   * One row per repeating series; tasks reference it via repeatCfgId.
   */
  taskRepeatCfgs: defineTable({
    userId: v.id("users"),
    repeatCycle: v.union(
      v.literal("DAILY"),
      v.literal("WEEKLY"),
      v.literal("MONTHLY"),
      v.literal("YEARLY"),
    ),
    /** Repeat every N cycles (every 2 weeks => WEEKLY + 2). */
    repeatEvery: v.number(),
    /** Weekdays the series fires on, 0–6 (Sunday = 0). */
    weekdays: v.array(v.number()),
    /** 1|2|3|4|-1 — "the Nth week's weekday" monthly pattern. */
    monthlyWeekOfMonth: v.optional(v.number()),
    /** 0–6, pairs with monthlyWeekOfMonth. */
    monthlyWeekday: v.optional(v.number()),
    monthlyLastDay: v.optional(v.boolean()),
    /** "YYYY-MM-DD" dates whose single occurrence was deleted. Never mutate the series. */
    deletedInstanceDates: v.array(v.string()),
    /** ADHD-critical: advance past missed days silently instead of backfilling overdue walls. */
    skipOverdue: v.boolean(),
    /** Don't spawn the next occurrence until the current one closes. */
    waitForCompletion: v.boolean(),
    repeatFromCompletionDate: v.boolean(),
    isPaused: v.boolean(),
    /** Default effort estimate in ms for spawned occurrences. */
    defaultEstimate: v.optional(v.number()),
    /** "YYYY-MM-DD" idempotency cursor — last day occurrences were generated for. */
    lastTaskCreationDay: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /**
   * T-006a — single event source shared by Day/Week/Month calendar views.
   */
  calendarEvents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    startsAtMs: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt_startsAtMs", ["userId", "deletedAt", "startsAtMs"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  focusBlocks: defineTable({
    userId: v.id("users"),
    startedAtMs: v.number(),
    durationMs: v.number(),
    label: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt_startedAtMs", ["userId", "deletedAt", "startedAtMs"]),

  notes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    pinned: v.boolean(),
    periodType: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("none"),
    ),
    aiGenerated: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_pinned", ["userId", "pinned"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  habits: defineTable({
    userId: v.id("users"),
    name: v.string(),
    cadence: v.union(v.literal("daily"), v.literal("weekly")),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  goals: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    targetDate: v.optional(v.number()),
    progressPercent: v.number(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  dayPlans: defineTable({
    userId: v.id("users"),
    /** "YYYY-MM-DD" in the user's local time (computed by the client). */
    localDate: v.string(),
    timezone: v.optional(v.string()),
    intention: v.optional(v.string()),
    /** Max 3, enforced in dayPlans.upsert. */
    topTaskIds: v.optional(v.array(v.id("tasks"))),
    energy: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    status: v.union(v.literal("draft"), v.literal("committed")),
    committedAt: v.optional(v.number()),
    reflection: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_deletedAt_localDate", ["userId", "deletedAt", "localDate"]),

  timeBlocks: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    dayPlanId: v.optional(v.id("dayPlans")),
    title: v.string(),
    /** Minutes since local midnight, 0-1439. */
    startMinute: v.number(),
    /** 5-720. */
    durationMinutes: v.number(),
    startsAtMs: v.number(),
    endsAtMs: v.number(),
    kind: v.union(
      v.literal("focus"),
      v.literal("task"),
      v.literal("habit"),
      v.literal("break"),
      v.literal("other"),
    ),
    taskId: v.optional(v.id("tasks")),
    habitId: v.optional(v.id("habits")),
    status: v.union(v.literal("planned"), v.literal("done"), v.literal("skipped")),
    source: v.union(v.literal("user"), v.literal("coach")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_deletedAt_localDate", ["userId", "deletedAt", "localDate"])
    .index("by_userId_deletedAt_startsAtMs", ["userId", "deletedAt", "startsAtMs"])
    .index("by_taskId", ["taskId"]),

  habitCheckIns: defineTable({
    userId: v.id("users"),
    habitId: v.id("habits"),
    localDate: v.string(),
    checkedAt: v.number(),
    source: v.union(
      v.literal("habits"),
      v.literal("today"),
      v.literal("suggestion"),
      v.literal("legacy"),
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt_localDate", ["userId", "deletedAt", "localDate"])
    .index("by_habitId_deletedAt_localDate", ["habitId", "deletedAt", "localDate"]),

  /**
   * Page templates. Starter templates live in code (`convex/lib/templateCatalog.ts`)
   * and are not rows. Rows here are templates the person saved.
   */
  templates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    periodType: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("none"),
    ),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /** One row per person. Missing row means the defaults in convex/preferences.ts. */
  userPreferences: defineTable({
    userId: v.id("users"),
    theme: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
    locale: v.union(v.literal("en"), v.literal("he")),
    weekStartsOn: v.union(v.literal(0), v.literal(1), v.literal(6)),
    timeZone: v.string(),
    emailReminders: v.boolean(),
    inAppNotifications: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /** A reminder the person defines. Phrases are their own words or derived from them. */
  nags: defineTable({
    userId: v.id("users"),
    label: v.string(),
    enabled: v.boolean(),
    phrases: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        source: v.union(v.literal("user"), v.literal("derived")),
        status: v.union(v.literal("proposed"), v.literal("accepted"), v.literal("rejected")),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /** One row per person. Missing row means the defaults in convex/coach.ts. */
  coachSettings: defineTable({
    userId: v.id("users"),
    /** Integer 0-10. */
    dial: v.number(),
    /** 2-4 tasks per proposal. */
    taskLoad: v.number(),
    panicUntil: v.optional(v.number()),
    acceptedStreak: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /** A proposal built by code. The person accepts or rejects it. */
  coachProposals: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    taskIds: v.array(v.id("tasks")),
    tenSecondAction: v.string(),
    realism: v.object({
      ok: v.boolean(),
      totalMinutes: v.number(),
      availableMinutes: v.number(),
      note: v.string(),
    }),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_status_deletedAt", ["userId", "status", "deletedAt"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    kind: v.union(v.literal("system"), v.literal("reminder"), v.literal("billing")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /**
   * TEMPO-MCP-01 — personal MCP tokens. Only the SHA-256 hex of the token is stored.
   * Revoked tokens stay as rows (`revokedAt`); they are never hard-deleted by the app.
   * `windowStartMs` / `windowCount` back the 120 calls/minute rate limit.
   */
  mcpTokens: defineTable({
    userId: v.id("users"),
    name: v.string(),
    tokenHash: v.string(),
    prefix: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    windowStartMs: v.optional(v.number()),
    windowCount: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),
});
