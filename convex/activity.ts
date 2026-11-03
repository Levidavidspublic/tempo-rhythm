import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

const activityKind = v.union(
  v.literal("task"),
  v.literal("note"),
  v.literal("habit"),
  v.literal("focus"),
  v.literal("calendar"),
  v.literal("goal"),
);

const activityItem = v.object({
  id: v.string(),
  kind: activityKind,
  action: v.string(),
  title: v.string(),
  href: v.string(),
  occurredAt: v.number(),
});

export type ActivityItem = {
  id: string;
  kind: "task" | "note" | "habit" | "focus" | "calendar" | "goal";
  action: string;
  title: string;
  href: string;
  occurredAt: number;
};

export const list = query({
  args: {},
  returns: v.array(activityItem),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return listActivityForUser(ctx, user._id);
  },
});

export async function listActivityForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ActivityItem[]> {
  const [tasks, notes, checkIns, focusBlocks, events, habits, goals] = await Promise.all([
    ctx.db.query("tasks").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("notes").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("habitCheckIns").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("focusBlocks").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("calendarEvents").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("habits").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("goals").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
  ]);

  const live = <T extends { deletedAt?: number }>(rows: T[]) =>
    rows.filter((row) => row.deletedAt === undefined);
  const habitNames = new Map(live(habits).map((habit) => [habit._id, habit.name]));
  const items: ActivityItem[] = [
    ...live(tasks).map((task) => ({
      id: `task:${task._id}`,
      kind: "task" as const,
      action: task.status === "done" ? "Completed task" : "Updated task",
      title: task.title,
      href: "/tasks",
      occurredAt: task.completedAt ?? task.updatedAt ?? task._creationTime,
    })),
    ...live(notes).map((note) => ({
      id: `note:${note._id}`,
      kind: "note" as const,
      action: note.updatedAt === note.createdAt ? "Created note" : "Updated note",
      title: note.title || "Untitled note",
      href: `/notes/${note._id}`,
      occurredAt: note.updatedAt ?? note._creationTime,
    })),
    ...live(checkIns).map((checkIn) => ({
      id: `habit:${checkIn._id}`,
      kind: "habit" as const,
      action: "Logged habit",
      title: habitNames.get(checkIn.habitId) ?? "Habit check-in",
      href: `/habits/${checkIn.habitId}`,
      occurredAt: checkIn.checkedAt ?? checkIn.updatedAt ?? checkIn._creationTime,
    })),
    ...live(focusBlocks).map((block) => ({
      id: `focus:${block._id}`,
      kind: "focus" as const,
      action: "Focused",
      title: block.label || "Focus session",
      href: "/tracking",
      occurredAt: block.updatedAt ?? block.startedAtMs ?? block._creationTime,
    })),
    ...live(events).map((event) => ({
      id: `calendar:${event._id}`,
      kind: "calendar" as const,
      action: "Updated event",
      title: event.title,
      href: "/calendar",
      occurredAt: event.updatedAt ?? event._creationTime,
    })),
    ...live(goals).map((goal) => ({
      id: `goal:${goal._id}`,
      kind: "goal" as const,
      action: goal.status === "completed" ? "Completed goal" : "Updated goal",
      title: goal.title,
      href: `/goals/${goal._id}`,
      occurredAt: goal.updatedAt ?? goal._creationTime,
    })),
  ];

  return items.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 50);
}
