import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { acceptPlanForUser, planBrainDump } from "./brain_dump";
import {
  createEventForUser,
  listEventsInRangeForUser,
  maxCalendarRangeMs,
  updateEventForUser,
} from "./calendar_events";
import { getDayPlanForUser } from "./dayPlans";
import { CRISIS_CARD, crisisCardText, isCrisisText } from "./lib/crisisWords";
import { dayBoundsMs, isValidTimeZone, localDateOf } from "./lib/mcp/dates";
import { createNoteForUser, listNotesForUser, updateNoteForUser } from "./notes";
import { createTaskForUser, listTasksForUser, updateTaskForUser } from "./tasks";

/**
 * Tool implementations for the MCP endpoint (TEMPO-MCP-01). The HTTP action has no Convex Auth
 * identity, so every function here takes the token owner's `userId` and scopes all reads and
 * writes to it. They are internal: not callable from a browser.
 */
const DEFAULT_LIMIT = 50;

type Args = Record<string, unknown>;

function taskView(t: Doc<"tasks">) {
  return {
    id: t._id,
    title: t.title,
    notes: t.description ?? null,
    status: t.status,
    priority: t.priority,
    energy: t.energy ?? null,
    dueAtMs: t.dueAt ?? null,
    completedAtMs: t.completedAt ?? null,
    updatedAtMs: t.updatedAt,
  };
}

function noteView(n: Doc<"notes">) {
  return {
    id: n._id,
    title: n.title,
    body: n.body,
    pinned: n.pinned,
    updatedAtMs: n.updatedAt,
  };
}

function eventView(e: Doc<"calendarEvents">) {
  return { id: e._id, title: e.title, startsAtMs: e.startsAtMs };
}

function limitOf(args: Args): number {
  return typeof args.limit === "number" ? args.limit : DEFAULT_LIMIT;
}

export const runReadTool = internalQuery({
  args: { userId: v.id("users"), name: v.string(), args: v.any() },
  handler: async (ctx, { userId, name, args }): Promise<unknown> => {
    const a = args as Args;
    switch (name) {
      case "tasks_list": {
        const status = (a.status as string | undefined) ?? "open";
        const from = a.dueFrom as number | undefined;
        const to = a.dueTo as number | undefined;
        let rows = await listTasksForUser(ctx, userId, {
          ...(from !== undefined || to !== undefined
            ? { dueFrom: from ?? 0, dueTo: to ?? Number.MAX_SAFE_INTEGER }
            : {}),
        });
        if (status === "open") {
          rows = rows.filter((t) => t.status === "todo" || t.status === "in_progress");
        } else if (status === "done") {
          rows = rows.filter((t) => t.status === "done");
        }
        return { tasks: rows.slice(0, limitOf(a)).map(taskView) };
      }
      case "notes_list": {
        const rows = await listNotesForUser(ctx, userId, {
          pinnedOnly: a.pinnedOnly === true,
        });
        return { notes: rows.slice(0, limitOf(a)).map(noteView) };
      }
      case "calendar_list": {
        const fromMs = a.fromMs as number;
        const toMs = a.toMs as number;
        if (toMs <= fromMs) throw new Error("Calendar range must end after it starts.");
        if (toMs - fromMs > maxCalendarRangeMs) throw new Error("Calendar range is too large.");
        const rows = await listEventsInRangeForUser(ctx, userId, fromMs, toMs);
        return { events: rows.map(eventView) };
      }
      case "today_plan_get": {
        const timezone = (a.timezone as string | undefined) ?? "UTC";
        if (!isValidTimeZone(timezone)) throw new Error(`Unknown timezone: ${timezone}`);
        const date = (a.date as string | undefined) ?? localDateOf(timezone, Date.now());
        const plan = await getDayPlanForUser(ctx, userId, date);
        const { startMs, endMs } = dayBoundsMs(date, timezone);
        const due = await listTasksForUser(ctx, userId, {
          dueFrom: startMs,
          dueTo: endMs,
        });
        const topTasks: Doc<"tasks">[] = [];
        for (const taskId of plan?.topTaskIds ?? []) {
          const t = await ctx.db.get(taskId);
          if (t && t.userId === userId && t.deletedAt === undefined) topTasks.push(t);
        }
        return {
          date,
          timezone,
          plan: plan
            ? {
                status: plan.status,
                intention: plan.intention ?? null,
                energy: plan.energy ?? null,
                reflection: plan.reflection ?? null,
              }
            : null,
          topTasks: topTasks.map(taskView),
          tasksDue: due.map(taskView),
        };
      }
      default:
        throw new Error(`Unknown read tool: ${name}`);
    }
  },
});

export const runWriteTool = internalMutation({
  args: { userId: v.id("users"), name: v.string(), args: v.any() },
  handler: async (ctx, { userId, name, args }): Promise<unknown> => {
    const a = args as Args;
    switch (name) {
      case "task_create": {
        const taskId = await createTaskForUser(ctx, userId, {
          title: a.title as string,
          description: a.notes as string | undefined,
          dueAt: a.dueAtMs as number | undefined,
          priority: a.priority as "low" | "medium" | "high" | undefined,
          energy: a.energy as "low" | "medium" | "high" | undefined,
        });
        const task = await ctx.db.get(taskId);
        return { task: task ? taskView(task) : { id: taskId } };
      }
      case "task_update": {
        const taskId = ctx.db.normalizeId("tasks", a.taskId as string);
        if (!taskId) throw new Error("Task not found");
        const completed = a.completed as boolean | undefined;
        await updateTaskForUser(ctx, userId, {
          taskId,
          title: a.title as string | undefined,
          description: a.notes as string | undefined,
          dueAt: a.dueAtMs as number | null | undefined,
          ...(completed === undefined ? {} : { status: completed ? "done" : "todo" }),
        });
        const task = await ctx.db.get(taskId);
        return { task: task ? taskView(task) : { id: taskId } };
      }
      case "note_create": {
        const noteId = await createNoteForUser(ctx, userId, {
          title: a.title as string,
          body: (a.body as string | undefined) ?? "",
        });
        const note = await ctx.db.get(noteId);
        return { note: note ? noteView(note) : { id: noteId } };
      }
      case "note_update": {
        const noteId = ctx.db.normalizeId("notes", a.noteId as string);
        if (!noteId) throw new Error("Note not found");
        await updateNoteForUser(ctx, userId, {
          noteId,
          title: a.title as string | undefined,
          body: a.body as string | undefined,
          pinned: a.pinned as boolean | undefined,
        });
        const note = await ctx.db.get(noteId);
        return { note: note ? noteView(note) : { id: noteId } };
      }
      case "calendar_create": {
        const eventId = await createEventForUser(ctx, userId, {
          title: a.title as string,
          startsAtMs: a.startsAtMs as number,
        });
        const event = await ctx.db.get(eventId);
        return { event: event ? eventView(event) : { id: eventId } };
      }
      case "calendar_update": {
        const eventId = ctx.db.normalizeId("calendarEvents", a.eventId as string);
        if (!eventId) throw new Error("Event not found");
        await updateEventForUser(ctx, userId, {
          eventId,
          title: a.title as string | undefined,
          startsAtMs: a.startsAtMs as number | undefined,
        });
        const event = await ctx.db.get(eventId);
        return { event: event ? eventView(event) : { id: eventId } };
      }
      default:
        throw new Error(`Unknown write tool: ${name}`);
    }
  },
});

const urgencyValidator = v.union(v.literal("now"), v.literal("soon"), v.literal("later"));

/** Save the planner's items as tasks (the `accept: true` half of brain_dump). */
export const acceptBrainDump = internalMutation({
  args: {
    userId: v.id("users"),
    items: v.array(v.object({ title: v.string(), urgency: urgencyValidator })),
  },
  handler: async (ctx, { userId, items }) => acceptPlanForUser(ctx, userId, items),
});

/**
 * brain_dump: same planner as `brain_dump.prioritize` (DeepInfra seam). The caller
 * (`mcp.authorizeCall`) has already checked the account is approved, which is the AI gate.
 */
export const runBrainDump = internalAction({
  args: {
    userId: v.id("users"),
    text: v.string(),
    accept: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, text, accept }): Promise<unknown> => {
    if (isCrisisText(text)) {
      return {
        crisis: true,
        accepted: false,
        created: 0,
        plan: { priorities: [] },
        resources: crisisCardText(CRISIS_CARD),
      };
    }
    const plan = await planBrainDump(text);
    if (!accept) {
      return { plan, accepted: false };
    }
    if (plan.priorities.length === 0) {
      return {
        plan,
        accepted: false,
        created: 0,
        taskIds: [] as Id<"tasks">[],
      };
    }
    const saved = await ctx.runMutation(internal.mcpTools.acceptBrainDump, {
      userId,
      items: plan.priorities.map((p) => ({
        title: p.title,
        urgency: p.urgency,
      })),
    });
    return { plan, accepted: true, ...saved };
  },
});
