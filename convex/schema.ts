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
    // KB-01 additive library metadata. Absent fields preserve existing rows; no backfill.
    tags: v.optional(v.array(v.string())),
    archivedAt: v.optional(v.number()),
    libraryRevision: v.optional(v.number()),
    libraryReceipts: v.optional(v.array(v.object({
      token: v.string(),
      requestKey: v.string(),
      appliedRevision: v.number(),
      undoUntilMs: v.number(),
      previous: v.object({ tags: v.optional(v.array(v.string())), archivedAt: v.optional(v.number()), deletedAt: v.optional(v.number()) }),
      result: v.object({ tags: v.optional(v.array(v.string())), archivedAt: v.optional(v.number()), deletedAt: v.optional(v.number()) }),
    }))),
    // TEMPO-B06-SUPPORT-CHAT-STATE (#807) — host-owned Agent lifecycle metadata.
    // All four are optional, so existing rows stay valid with no backfill. Missing
    // `nextChatSequence` / `chatGenerationEpoch` mean zero to future consumers.
    /** Opaque Agent-component thread id (a string at the host boundary, not a host table id). */
    agentThreadId: v.optional(v.string()),
    /** Next FIFO sequence to reserve for a chatRequests row in this conversation. */
    nextChatSequence: v.optional(v.number()),
    /** Fencing epoch. A completion carrying an older epoch is rejected by the consumer. */
    chatGenerationEpoch: v.optional(v.number()),
    /** The one chatRequests row that currently holds this conversation's generation claim. */
    activeChatRequestId: v.optional(v.id("chatRequests")),
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
    /**
     * TEMPO-B07-01 (#976): the web pages a coach reply that searched the web cites, in the order
     * its `[1]`, `[2]` markers count. Title, site and link only: no page text is stored.
     */
    sources: v.optional(
      v.array(v.object({ title: v.string(), site: v.string(), url: v.string() })),
    ),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"])
    .index("by_conversationId_deletedAt", ["conversationId", "deletedAt"]),

  /**
   * TEMPO-B06-SUPPORT-CHAT-STATE (#807) — content-free request/lifecycle metadata for Agent chat.
   * The Agent component stays canonical for prompt and reply content; this table links to those
   * message ids as opaque strings and never copies text, provider payloads or raw errors.
   * Inactive: nothing writes here yet. The indexes are ordinary, not unique constraints, so a
   * future writer must dedupe on owner + conversation + requestKey inside its own transaction.
   * Writer validation bounds (not enforced by these validators): requestKey 1-128 ASCII
   * letters/digits/underscore/hyphen; payloadDigest lowercase SHA-256 hex; sequence and
   * generationEpoch nonnegative safe integers; timestamps finite server epoch milliseconds.
   */
  /**
   * Live voice usage (HARD_RULES §9, docs/contracts/VOICE.md R-4): one row per voice session
   * (a lease). Content-free: no audio, transcript, reply text, token or provider response.
   * `durationMs` is server lease time, set when the session ends; the daily budget sums it
   * per local day (`dateKey`), and the global ceiling per UTC day (`utcDateKey`).
   */
  voiceSessions: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    /** The client's key for this start, so a repeated start returns the same lease. */
    clientKey: v.string(),
    status: v.union(v.literal("active"), v.literal("ended")),
    language: v.union(v.literal("en"), v.literal("he")),
    startedAt: v.number(),
    lastRenewalAt: v.number(),
    endedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    endReason: v.optional(
      v.union(
        v.literal("stopped"),
        v.literal("replaced"),
        v.literal("expired"),
        v.literal("exhausted"),
        v.literal("revoked"),
      ),
    ),
    dateKey: v.string(),
    utcDateKey: v.string(),
    grants: v.number(),
    sentences: v.number(),
    ttsChars: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_dateKey", ["userId", "dateKey"])
    .index("by_utcDateKey", ["utcDateKey"]),
  chatRequests: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    /** Caller-supplied idempotency key. */
    requestKey: v.string(),
    /** Lowercase SHA-256 hex of a versioned, deterministic encoding of the accepted payload. */
    payloadDigest: v.string(),
    /** FIFO position within the conversation. */
    sequence: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    /** Opaque Agent id of the one saved prompt message. */
    agentPromptMessageId: v.string(),
    /** Fencing value copied from the conversation when the claim is taken. */
    generationEpoch: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Opaque Agent id of the canonical reply, set when the request completes. */
    agentResultMessageId: v.optional(v.string()),
    /** Server-owned epoch ms after which a running claim may be reclaimed. */
    generationLeaseExpiresAtMs: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_conversationId_requestKey", ["userId", "conversationId", "requestKey"])
    .index("by_userId_conversationId_deletedAt_sequence", [
      "userId",
      "conversationId",
      "deletedAt",
      "sequence",
    ])
    .index("by_userId_conversationId_deletedAt_status_sequence", [
      "userId",
      "conversationId",
      "deletedAt",
      "status",
      "sequence",
    ]),

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
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    // TEMPO-B06-SUPPORT-CHAT-STATE (#807) — bounded live-memory read. Consumers use the exact
    // owner, deletedAt = undefined, descending order and take(20); ties follow updatedAt, then
    // Convex's appended creation time. No collect-and-sort.
    .index("by_userId_deletedAt_salience_updatedAt", [
      "userId",
      "deletedAt",
      "salience",
      "updatedAt",
    ]),

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
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    // TEMPO-B07-01 (#976): live tasks finished in a time range (`tasks.listDoneInRange`).
    .index("by_userId_deletedAt_completedAt", ["userId", "deletedAt", "completedAt"]),

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
    pageType: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("project"),
        v.literal("plain"),
        v.literal("template"),
      ),
    ),
    /** Local calendar date (YYYY-MM-DD). Writers validate real dates before storing them. */
    date: v.optional(v.string()),
    aiGenerated: v.optional(v.boolean()),
    // TEMPO-B06-SUPPORT-PAGE-LEDGER (#828) — body revision. Optional so legacy rows validate
    // with no backfill: a missing value means revision 0. Nothing writes it yet. A future writer
    // advances it by exactly one per body-changing write, in the same transaction as the body,
    // derived index and operation receipt (a safe integer in [0, MAX_SAFE_INTEGER - 1]).
    revision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_pinned", ["userId", "pinned"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_deletedAt_pageType_date", ["userId", "deletedAt", "pageType", "date"]),

  /** Disposable, derived index of validated `json tempo` blocks in notes.body. */
  noteBlocks: defineTable(
    v.union(
      v.object({
        userId: v.id("users"),
        noteId: v.id("notes"),
        type: v.literal("page-meta"),
        blockId: v.string(),
        v: v.literal(1),
        data: v.object({
          pageType: v.union(
            v.literal("daily"),
            v.literal("weekly"),
            v.literal("project"),
            v.literal("plain"),
            v.literal("template"),
          ),
          date: v.optional(v.string()),
          tags: v.array(v.string()),
        }),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
      }),
      v.object({
        userId: v.id("users"),
        noteId: v.id("notes"),
        type: v.literal("task"),
        blockId: v.string(),
        v: v.literal(1),
        data: v.object({
          title: v.string(),
          durationMin: v.number(),
          status: v.union(v.literal("now"), v.literal("later"), v.literal("done")),
          order: v.number(),
          inelastic: v.boolean(),
          reason: v.optional(v.string()),
          scheduledAt: v.optional(v.union(v.string(), v.null())),
          doneAt: v.optional(v.union(v.string(), v.null())),
        }),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
      }),
      v.object({
        userId: v.id("users"),
        noteId: v.id("notes"),
        type: v.literal("template"),
        blockId: v.string(),
        v: v.literal(1),
        data: v.object({
          name: v.string(),
          forPageType: v.union(
            v.literal("daily"),
            v.literal("weekly"),
            v.literal("project"),
            v.literal("plain"),
            v.literal("template"),
          ),
          isDefault: v.boolean(),
          tokens: v.array(v.string()),
          origin: v.union(v.literal("builtin"), v.literal("user")),
          status: v.union(v.literal("draft"), v.literal("live")),
          enabled: v.boolean(),
        }),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
      }),
      v.object({
        userId: v.id("users"),
        noteId: v.id("notes"),
        type: v.literal("broken"),
        blockId: v.optional(v.string()),
        position: v.number(),
        errorCode: v.union(
          v.literal("body_too_large"),
          v.literal("too_many_blocks"),
          v.literal("block_too_large"),
          v.literal("unclosed_fence"),
          v.literal("malformed_json"),
          v.literal("invalid_envelope"),
          v.literal("unsupported_type"),
          v.literal("unsupported_version"),
          v.literal("invalid_data"),
          v.literal("duplicate_id"),
          v.literal("duplicate_page_meta"),
          v.literal("nesting_too_deep"),
        ),
        createdAt: v.number(),
        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
      }),
    ),
  )
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_noteId_deletedAt_position", ["userId", "noteId", "deletedAt", "position"])
    .index("by_userId_noteId_blockId", ["userId", "noteId", "blockId"]),

  /**
   * TEMPO-B06-SUPPORT-PAGE-LEDGER (#828) — lightweight, immutable page-write receipt facts.
   * Content-free: offsets and lengths only. Source fragments live in `pageOperationPayloads`.
   * Inactive: nothing writes here yet (#787 owns the first writer).
   * Structural types only. The indexes are ordinary, not unique constraints. The later helper
   * (#831) owns semantic validation; every committing writer must call it. Bounds it enforces,
   * none of which these validators express: timestamps are finite safe nonnegative integer epoch
   * milliseconds; revisions are safe integers in [0, MAX_SAFE_INTEGER - 1]; `requestId` is `req_`
   * plus a valid 26-character ULID; digests are 64-character lowercase SHA-256 hex; delta offsets
   * and lengths are nonnegative integers; an applied body write has affectsBody = true,
   * resultRevision = baseRevision + 1 and a nonempty delta; a noop has affectsBody = false, equal
   * revisions and digests, an empty delta and no Undo fields; `undoUntilMs` is present only for
   * an applied non-undo operation; `undoneAtMs` and `undoneByOperationId` are both absent or both
   * present; `undoOfOperationId` is required only when kind = "undo"; `metadataExpiresAtMs` is
   * appliedAtMs + 48 hours.
   */
  pageOperations: defineTable({
    userId: v.id("users"),
    noteId: v.id("notes"),
    requestId: v.string(),
    /** Lowercase SHA-256 hex of a versioned, deterministic encoding of the accepted request. */
    requestDigest: v.string(),
    kind: v.union(
      v.literal("save"),
      v.literal("patch_block"),
      v.literal("add_task"),
      v.literal("undo"),
    ),
    /** Assigned by the trusted endpoint, never by the caller. */
    source: v.union(v.literal("ui"), v.literal("coach"), v.literal("mcp"), v.literal("legacy")),
    result: v.union(v.literal("applied"), v.literal("noop")),
    affectsBody: v.boolean(),
    baseRevision: v.number(),
    resultRevision: v.number(),
    /** Lowercase SHA-256 hex of the exact UTF-8 body before and after the write. */
    baseBodyDigest: v.string(),
    resultBodyDigest: v.string(),
    /** UTF-16 code-unit offsets and lengths of the forward change. No text. */
    delta: v.array(
      v.object({
        startUtf16: v.number(),
        removedLengthUtf16: v.number(),
        insertedLengthUtf16: v.number(),
      }),
    ),
    appliedAtMs: v.number(),
    undoUntilMs: v.optional(v.number()),
    undoneAtMs: v.optional(v.number()),
    undoneByOperationId: v.optional(v.id("pageOperations")),
    undoOfOperationId: v.optional(v.id("pageOperations")),
    proposalId: v.optional(v.id("pageProposals")),
    metadataExpiresAtMs: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_requestId", ["userId", "requestId"])
    .index("by_userId_noteId_affectsBody_resultRevision", [
      "userId",
      "noteId",
      "affectsBody",
      "resultRevision",
    ])
    .index("by_metadataExpiresAtMs", ["metadataExpiresAtMs"]),

  /**
   * TEMPO-B06-SUPPORT-PAGE-LEDGER (#828) — separately expiring, private inverse fragments.
   * The only operation table that holds source text. Never a second current page and never a
   * model-context source. One row per applied non-undo operation; none for a noop or an undo
   * receipt. Inactive: nothing writes here yet. A future cleanup handler (#808 and its
   * follow-ups) replaces the `available` form with the `expired` marker; nothing here schedules
   * or runs that. Writer validation (not expressed by these validators): each splice's lengths
   * equal the matching delta lengths, and the adopted splice-count and byte budgets hold.
   */
  pageOperationPayloads: defineTable({
    userId: v.id("users"),
    noteId: v.id("notes"),
    operationId: v.id("pageOperations"),
    undoUntilMs: v.number(),
    cleanupDueAtMs: v.number(),
    payload: v.union(
      v.object({
        state: v.literal("available"),
        splices: v.array(
          v.object({
            startUtf16: v.number(),
            removedText: v.string(),
            insertedText: v.string(),
          }),
        ),
      }),
      v.object({
        state: v.literal("expired"),
        expiredAtMs: v.number(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_operationId", ["userId", "operationId"])
    .index("by_userId_noteId_deletedAt", ["userId", "noteId", "deletedAt"])
    .index("by_cleanupDueAtMs", ["cleanupDueAtMs"]),

  /**
   * TEMPO-B06-SUPPORT-PAGE-LEDGER (#828) — one pending page action. Not another chat store: it
   * holds only the proposed action content, never a copied prompt, reply, memory or raw audio.
   * `sourceAgentPromptId` is an opaque Agent-component string, never cast to a host table id.
   * `sourceRequestKey` must resolve through #807's chatRequests contract to this same owner and
   * conversation. Inactive: nothing writes here yet (#793 owns confirmation). Writer validation
   * (not expressed by these validators): `localDate` is a real YYYY-MM-DD; `sourceRequestKey` is
   * 1-128 ASCII identifier characters; `sourceAgentPromptId` is 1-256 characters;
   * `proposalRevision` and `expectedPageRevision` are safe nonnegative integers; `blockId` is
   * `blk_` plus a valid ULID; `task.title` is nonblank, at most 500 Unicode code points and within
   * the block codec's BLOCK_CODEC_LIMITS.maxTextChars (UTF-16 code units); `durationMin` is an
   * integer in 1-1440 (stored default 15); `confirmDigest` is lowercase SHA-256 hex.
   */
  pageProposals: defineTable({
    userId: v.id("users"),
    kind: v.literal("add_task_to_today"),
    schemaVersion: v.literal(1),
    noteId: v.id("notes"),
    localDate: v.string(),
    conversationId: v.id("conversations"),
    sourceRequestKey: v.string(),
    sourceAgentPromptId: v.optional(v.string()),
    /** Guards an edited or replaced proposal. Distinct from `expectedPageRevision`. */
    proposalRevision: v.number(),
    /** Guards the target page: the notes.revision the preview was built against. */
    expectedPageRevision: v.number(),
    blockId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    proposalExpiresAtMs: v.number(),
    cleanupDueAtMs: v.number(),
    metadataExpiresAtMs: v.number(),
    payload: v.union(
      v.object({
        state: v.literal("available"),
        task: v.object({
          title: v.string(),
          durationMin: v.number(),
        }),
      }),
      v.object({
        state: v.literal("expired"),
        expiredAtMs: v.number(),
      }),
    ),
    decidedAtMs: v.optional(v.number()),
    confirmedOperationId: v.optional(v.id("pageOperations")),
    confirmDigest: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_userId_noteId_deletedAt", ["userId", "noteId", "deletedAt"])
    .index("by_userId_conversationId_sourceRequestKey", [
      "userId",
      "conversationId",
      "sourceRequestKey",
    ])
    .index("by_cleanupDueAtMs", ["cleanupDueAtMs"])
    .index("by_metadataExpiresAtMs", ["metadataExpiresAtMs"]),

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
    /** TEMPO-B07-01 (#976): the coach may search the web. Missing means off. */
    coachWebSearch: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"]),

  /**
   * TEMPO-B07-01 (#976): one row per web search the coach actually ran, for the per-person daily
   * limit (`coach.WEB_SEARCH_DAILY_LIMIT`, counted per UTC day in `utcDateKey`). Content-free: no
   * query, result or page text. Tombstoned rows still count toward their day. Rows from more than
   * 7 days ago are pruned as new searches are booked (`coach.reserveWebSearch`).
   */
  coachWebSearches: defineTable({
    userId: v.id("users"),
    /** UTC date (`YYYY-MM-DD`) the search ran on. */
    utcDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_utcDateKey", ["userId", "utcDateKey"]),

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

  /**
   * TEMPO-B07-07 (#989) — a person's connection to their own Executor account (research doc
   * `docs/research/EXECUTOR-IN-TEMPO.md` §5.1). No secrets here: tokens live in
   * `connectionSecrets`, read only by internal functions. At most one live usable row per person
   * and provider (`connected`, `needs_reauth` or `unavailable`). The OAuth callback stores new
   * tokens on a `pending_confirm` row, which nothing can use until the signed-in owner confirms it
   * with the one-time nonce (only its SHA-256 is stored, `confirmNonceHash`, alive until
   * `confirmExpiresAt`); confirming retires the previous row. `revoking` and `disconnected` rows
   * are tombstoned (`deletedAt`); a `revoking` row still has ciphertexts in `connectionSecrets`
   * until the revoke finishes or the sweep scrubs them. `refreshLease*` makes one token refresh run
   * at a time. The per-person limits live in `connectionLimits`, so a reconnect does not reset them.
   */
  connections: defineTable({
    userId: v.id("users"),
    provider: v.literal("executor"),
    status: v.union(
      v.literal("pending_confirm"),
      v.literal("connected"),
      v.literal("needs_reauth"),
      v.literal("unavailable"),
      v.literal("revoking"),
      v.literal("disconnected"),
    ),
    /** The MCP URL the tokens are bound to (the OAuth `resource`). */
    mcpUrl: v.string(),
    issuer: v.string(),
    clientRowId: v.id("oauthClients"),
    scope: v.optional(v.string()),
    /** Only if Executor ever sends one (UNKNOWN, doc §7.1 item 17). Nothing sets it in B07. */
    accountLabel: v.optional(v.string()),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    /**
     * SHA-256 hex of the one-time confirm nonce. Set on `pending_confirm`; kept after the confirm
     * only until `confirmExpiresAt` (never longer), so a repeated confirm whose reply was lost gets
     * the same answer; then cleared (`expireConfirmNonce`), and cleared at once on retirement.
     */
    confirmNonceHash: v.optional(v.string()),
    confirmExpiresAt: v.optional(v.number()),
    /**
     * The person's `connectionLimits.disconnectGeneration` when the connect attempt that made this
     * row started (missing reads as 0). A row from before the latest disconnect is never confirmed.
     */
    startGeneration: v.optional(v.number()),
    refreshLeaseUntil: v.optional(v.number()),
    refreshLeaseToken: v.optional(v.string()),
    /** Set when a disconnect or account deletion finishes: whether Executor confirmed the revoke. */
    revokedAtProvider: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_provider_deletedAt", ["userId", "provider", "deletedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_confirmNonceHash", ["confirmNonceHash"]),

  /**
   * TEMPO-B07-07 (#989) — one row per person: the fixed-window counters for Executor connect
   * attempts and lookups. Per person, not per connection, so disconnecting and reconnecting does
   * not reset them. Read even when tombstoned, so a restored account does not get a fresh window.
   * `disconnectGeneration` is the person's cancellation point: every disconnect adds one, and a
   * connect attempt that started under a lower number is never staged or confirmed.
   */
  connectionLimits: defineTable({
    userId: v.id("users"),
    connectWindowStartMs: v.optional(v.number()),
    connectWindowCount: v.optional(v.number()),
    callWindowStartMs: v.optional(v.number()),
    callWindowCount: v.optional(v.number()),
    /** How many disconnects the person has made (missing reads as 0). Only ever goes up. */
    disconnectGeneration: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  /**
   * TEMPO-B07-07 (#989) — encrypted tokens for one connection (AES-256-GCM, key from
   * `TEMPO_CONNECTIONS_KEY`; lib/connections/crypto.ts). Read by internal functions only; never
   * returned by a public function. Disconnect and the sweep scrub: the cipher fields go to
   * undefined and `deletedAt` is stamped (no hard delete, HARD_RULES §5).
   */
  connectionSecrets: defineTable({
    userId: v.id("users"),
    connectionId: v.id("connections"),
    accessTokenCipher: v.optional(v.string()),
    refreshTokenCipher: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    keyVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_connectionId", ["connectionId"]),

  /**
   * TEMPO-B07-07 (#989) — the OAuth client Tempo registered with an authorization server
   * (Dynamic Client Registration), one per issuer and redirect URI, shared by every person on the
   * deployment. Not user data: no `userId`. The client secret, if the server issued one, is
   * encrypted like the tokens. Endpoints are refreshed from the metadata on every connect.
   */
  oauthClients: defineTable({
    issuer: v.string(),
    redirectUri: v.string(),
    clientId: v.string(),
    clientSecretCipher: v.optional(v.string()),
    keyVersion: v.number(),
    tokenEndpointAuthMethod: v.union(
      v.literal("none"),
      v.literal("client_secret_basic"),
      v.literal("client_secret_post"),
    ),
    authorizationEndpoint: v.string(),
    tokenEndpoint: v.string(),
    registrationEndpoint: v.optional(v.string()),
    revocationEndpoint: v.optional(v.string()),
    codeChallengeS256: v.literal(true),
    issParameterSupported: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_issuer_redirectUri", ["issuer", "redirectUri"]),

  /**
   * TEMPO-B07-07 (#989) — one connect attempt, alive for 10 minutes. Only the SHA-256 of `state`
   * is stored; the PKCE verifier is encrypted and scrubbed (set to undefined) when the callback
   * uses the row, when it expires, or when the account is deleted. A used or expired row is
   * tombstoned, so a live row (`deletedAt` undefined) means "connecting".
   */
  oauthPending: defineTable({
    userId: v.id("users"),
    provider: v.literal("executor"),
    stateHash: v.string(),
    codeVerifierCipher: v.optional(v.string()),
    keyVersion: v.number(),
    issuer: v.string(),
    resource: v.string(),
    redirectUri: v.string(),
    clientRowId: v.id("oauthClients"),
    returnTo: v.union(v.literal("settings"), v.literal("coach")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    /** The person's `connectionLimits.disconnectGeneration` when this attempt started (missing: 0). */
    startGeneration: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_stateHash", ["stateHash"])
    .index("by_userId", ["userId"])
    .index("by_userId_deletedAt", ["userId", "deletedAt"])
    .index("by_deletedAt_expiresAt", ["deletedAt", "expiresAt"]),

  /**
   * TEMPO-B07-07 (#989) — audit: one row per Executor tool call the coach made or was refused,
   * and one per disconnect (research doc §4.5). Content-free: no inputs, no results; the input
   * is kept only as a SHA-256 digest. Soft-deleted with the account.
   */
  connectionCalls: defineTable({
    userId: v.id("users"),
    connectionId: v.id("connections"),
    kind: v.union(v.literal("tool_call"), v.literal("disconnect")),
    /** The MCP tool name (`search`, ...). */
    tool: v.optional(v.string()),
    /** The app tool path, for a later `call`. Empty in B07. */
    path: v.optional(v.string()),
    decision: v.optional(
      v.union(v.literal("auto"), v.literal("approved"), v.literal("rejected"), v.literal("blocked")),
    ),
    outcome: v.union(
      v.literal("ok"),
      v.literal("error"),
      v.literal("approval_required"),
      v.literal("timeout"),
      v.literal("rate_limited"),
      v.literal("unauthorized"),
      v.literal("revoked"),
      v.literal("not_revoked"),
    ),
    inputDigest: v.optional(v.string()),
    resultBytes: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    /** The coach message the call answered, if any. */
    messageId: v.optional(v.id("messages")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_connectionId_createdAt", ["connectionId", "createdAt"]),
});
