import { describe, expect, test } from "bun:test";
import {
  dayLabel,
  fill,
  filterGoals,
  filterProjects,
  formatCountdown,
  goalStatus,
  groupBoard,
  isGoalFilter,
  isoWeekOf,
  isNewProjectId,
  isProjectFilter,
  linePoints,
  minutesFromEstimate,
  neighbourColumn,
  newProjectId,
  orderProjectTasks,
  projectStatusFor,
  projectNameFor,
  stepsByWeek,
  storedGoalStatus,
  summarizeProjects,
  weekStartMs,
  weeklySummary,
} from "./goals-projects";
import { slugifyProjectName } from "./task-view-filters";

describe("goal status words", () => {
  test("maps stored statuses to the design's words and back", () => {
    expect(goalStatus("active")).toBe("active");
    expect(goalStatus("archived")).toBe("resting");
    expect(goalStatus("completed")).toBe("done");
    for (const s of ["active", "resting", "done"] as const) {
      expect(goalStatus(storedGoalStatus(s))).toBe(s);
    }
  });

  test("filters goals by word, All keeps everything", () => {
    const goals = [
      { id: "a", status: "active" as const },
      { id: "b", status: "archived" as const },
      { id: "c", status: "completed" as const },
    ];
    expect(filterGoals(goals, "all").map((g) => g.id)).toEqual(["a", "b", "c"]);
    expect(filterGoals(goals, "resting").map((g) => g.id)).toEqual(["b"]);
    expect(filterGoals(goals, "done").map((g) => g.id)).toEqual(["c"]);
    expect(isGoalFilter("resting")).toBe(true);
    expect(isGoalFilter("paused")).toBe(false);
  });
});

describe("projects from tasks", () => {
  test("groups by projectId, counts live tasks and takes the newest name", () => {
    const projects = summarizeProjects([
      { projectId: "home-reset", projectName: "Home reset", status: "done", updatedAt: 1 },
      { projectId: "home-reset", projectName: "Home Reset!", status: "todo", updatedAt: 5 },
      { projectId: "home-reset", status: "cancelled", updatedAt: 9 },
      { projectId: "talk", projectName: "Thursday talk", status: "done", updatedAt: 3 },
      { status: "todo", updatedAt: 10 },
      { projectId: "  ", status: "todo", updatedAt: 11 },
    ]);
    expect(projects).toEqual([
      { id: "home-reset", name: "Home Reset!", done: 1, total: 2, status: "active", updatedAt: 9 },
      { id: "talk", name: "Thursday talk", done: 1, total: 1, status: "done", updatedAt: 3 },
    ]);
  });

  test("a project with no stored name falls back to its slug as a title", () => {
    expect(summarizeProjects([{ projectId: "moving-flat", status: "todo", updatedAt: 1 }])[0]?.name).toBe(
      "Moving Flat",
    );
    expect(projectNameFor([], "moving-flat")).toBe("Moving Flat");
    expect(
      projectNameFor(
        [
          { projectName: "Old", status: "todo", updatedAt: 1 },
          { projectName: "מעבר דירה", status: "todo", updatedAt: 2 },
        ],
        "x",
      ),
    ).toBe("מעבר דירה");
  });

  test("status: Idea with nothing planned, Done when every live task is done", () => {
    expect(projectStatusFor(0, 0)).toBe("idea");
    expect(projectStatusFor(1, 3)).toBe("active");
    expect(projectStatusFor(3, 3)).toBe("done");
    expect(summarizeProjects([{ projectId: "x", status: "cancelled", updatedAt: 1 }])[0]?.status).toBe("idea");
  });

  test("orders a project's tasks: open by when they were added, then done, set-aside left out", () => {
    const ordered = orderProjectTasks([
      { id: "done-late", status: "done" as const, createdAt: 1, completedAt: 50 },
      { id: "open-2", status: "in_progress" as const, createdAt: 20 },
      { id: "gone", status: "cancelled" as const, createdAt: 2 },
      { id: "open-1", status: "todo" as const, createdAt: 10 },
      { id: "done-early", status: "done" as const, createdAt: 30, completedAt: 40 },
    ]);
    expect(ordered.map((t) => t.id)).toEqual(["open-1", "open-2", "done-early", "done-late"]);
  });

  test("filters by status; Paused has no stored source so it matches nothing yet", () => {
    const rows = [
      { id: "a", status: "active" as const },
      { id: "b", status: "done" as const },
    ];
    expect(filterProjects(rows, "done").map((r) => r.id)).toEqual(["b"]);
    expect(filterProjects(rows, "paused")).toEqual([]);
    expect(isProjectFilter("paused")).toBe(true);
    expect(isProjectFilter("resting")).toBe(false);
  });

  test("new project ids survive the legacy slug normaliser unchanged", () => {
    const id = newProjectId(1_760_000_000_000, 0.5);
    expect(id.startsWith("project-")).toBe(true);
    expect(slugifyProjectName(id)).toBe(id);
    expect(newProjectId(1, 0)).toBe("project-10000");
    expect(isNewProjectId(id)).toBe(true);
    expect(isNewProjectId("home-reset")).toBe(false);
    expect(isNewProjectId("project")).toBe(false);
  });
});

describe("board columns", () => {
  test("moves one column at a time and stops at the edges", () => {
    expect(neighbourColumn("todo", "prev")).toBeNull();
    expect(neighbourColumn("todo", "next")).toBe("in_progress");
    expect(neighbourColumn("in_progress", "prev")).toBe("todo");
    expect(neighbourColumn("done", "next")).toBeNull();
  });

  test("groups To do / Doing / Done and leaves set-aside cards off the board", () => {
    const groups = groupBoard([
      { id: "a", status: "todo" as const },
      { id: "b", status: "cancelled" as const },
      { id: "c", status: "done" as const },
      { id: "d", status: "in_progress" as const },
    ]);
    expect(groups.todo.map((t) => t.id)).toEqual(["a"]);
    expect(groups.in_progress.map((t) => t.id)).toEqual(["d"]);
    expect(groups.done.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("formatting", () => {
  test("minutes, countdown and placeholders", () => {
    expect(minutesFromEstimate(undefined)).toBeNull();
    expect(minutesFromEstimate(0)).toBeNull();
    expect(minutesFromEstimate(15 * 60_000)).toBe(15);
    expect(minutesFromEstimate(10_000)).toBe(1);
    expect(formatCountdown(5 * 60_000)).toBe("5:00");
    expect(formatCountdown(299_001)).toBe("5:00");
    expect(formatCountdown(61_000)).toBe("1:01");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(fill("Between {min} and {max}", { min: 2, max: 5 })).toBe("Between 2 and 5");
    expect(fill("{name} board {missing}", { name: "Moving" })).toBe("Moving board {missing}");
  });

  test("day labels say Today, else a short weekday and the date", () => {
    const today = new Date(2026, 9, 13).getTime();
    const end = new Date(2026, 9, 14).getTime();
    expect(dayLabel(today + 3_600_000, today, end, "en")).toEqual({ kind: "today" });
    expect(dayLabel(new Date(2026, 9, 14, 9).getTime(), today, end, "en")).toEqual({
      kind: "day",
      weekday: "Wed",
      day: 14,
    });
    expect(dayLabel(new Date(2026, 9, 14, 9).getTime(), today, end, "he")).toEqual({
      kind: "day",
      weekday: "ד׳",
      day: 14,
    });
  });
});

describe("small steps by week", () => {
  const now = new Date(2026, 9, 14, 12).getTime(); // Wed 14 Oct 2026, ISO week 42

  test("weeks start on Monday and carry their ISO number", () => {
    expect(new Date(weekStartMs(now)).getDate()).toBe(12);
    expect(new Date(weekStartMs(new Date(2026, 9, 18).getTime())).getDate()).toBe(12); // Sunday
    expect(isoWeekOf(now)).toBe(42);
    expect(isoWeekOf(new Date(2026, 0, 1).getTime())).toBe(1);
  });

  test("counts finished tasks per week, oldest first, and ignores the rest", () => {
    const at = (m: number, d: number) => new Date(2026, m, d, 10).getTime();
    const points = stepsByWeek(
      [
        { status: "done", completedAt: at(9, 13) },
        { status: "done", completedAt: at(9, 12) },
        { status: "done", completedAt: at(9, 5) },
        { status: "done", completedAt: at(8, 21) },
        { status: "done", completedAt: at(7, 1) }, // older than the range
        { status: "todo", completedAt: at(9, 13) },
        { status: "done" },
      ],
      now,
      4,
    );
    expect(points.map((p) => p.week)).toEqual([39, 40, 41, 42]);
    expect(points.map((p) => p.count)).toEqual([1, 0, 1, 2]);
    expect(stepsByWeek([], now, 8)).toHaveLength(8);
  });

  test("summaries stay gentle and never score", () => {
    const pts = (counts: number[]) => counts.map((count, i) => ({ startMs: i, week: 39 + i, count }));
    expect(weeklySummary(pts([0, 0, 0, 0]))).toEqual({ key: "gp.line.none", params: {} });
    expect(weeklySummary(pts([3, 3, 3, 3]))).toEqual({ key: "gp.line.same", params: { n: 3 } });
    expect(weeklySummary(pts([3, 5, 2, 4]))).toEqual({ key: "gp.line.range", params: { min: 2, max: 5 } });
    expect(weeklySummary(pts([3, 5, 2, 4, 1, 1, 1, 2]))).toEqual({
      key: "gp.line.rangeWeeks",
      params: { min: 1, max: 5, weeks: 8 },
    });
  });

  test("line points sit inside the design's viewBox, the busiest week at the top", () => {
    const points = linePoints([
      { startMs: 0, week: 39, count: 3 },
      { startMs: 1, week: 40, count: 5 },
      { startMs: 2, week: 41, count: 0 },
      { startMs: 3, week: 42, count: 4 },
    ]);
    expect(points.map((p) => p.x)).toEqual([75, 165, 255, 345]);
    expect(points[1]?.y).toBe(60);
    expect(points[2]?.y).toBe(180);
    expect(linePoints([{ startMs: 0, week: 1, count: 0 }])[0]?.y).toBe(180);
  });
});
