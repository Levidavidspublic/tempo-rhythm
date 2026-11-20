import { expect, test } from "bun:test";
import type { TaskDoc, TaskStatus } from "../firestore/task-doc";
import { overdueSummary, pickOverdueTasks } from "./overdue-tasks";

type Task = TaskDoc & { id: string };

const DAY_START = 10_000;

function task(id: string, overrides: Partial<TaskDoc> = {}): Task {
  return {
    id,
    title: id,
    status: "todo",
    priority: "medium",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test("a task due yesterday and still todo is picked", () => {
  const yesterday = task("yesterday", { dueAt: DAY_START - 1 });

  expect(pickOverdueTasks([yesterday], DAY_START)).toEqual([yesterday]);
  expect(pickOverdueTasks([yesterday], Number.NaN)).toEqual([]);
});

test("a task due exactly at dayStartMs is not picked", () => {
  expect(pickOverdueTasks([task("today", { dueAt: DAY_START })], DAY_START)).toEqual([]);
});

test("done and cancelled tasks are left out", () => {
  const closedStatuses: TaskStatus[] = ["done", "cancelled"];
  const tasks = closedStatuses.map((status) => task(status, { dueAt: 1, status }));

  expect(pickOverdueTasks(tasks, DAY_START)).toEqual([]);
});

test("soft-deleted tasks are left out", () => {
  expect(
    pickOverdueTasks([task("deleted", { dueAt: 1, deletedAt: 2 })], DAY_START)
  ).toEqual([]);
});

test("tasks with no due time are left out", () => {
  expect(pickOverdueTasks([task("unscheduled")], DAY_START)).toEqual([]);
});

test("result is sorted oldest first with ties by id and the input is untouched", () => {
  const tasks = [
    task("c", { dueAt: 3 }),
    task("b", { dueAt: 1 }),
    task("a", { dueAt: 1, status: "in_progress" }),
  ];
  const originalOrder = [...tasks];

  expect(pickOverdueTasks(tasks, DAY_START).map(({ id }) => id)).toEqual(["a", "b", "c"]);
  expect(tasks).toEqual(originalOrder);
});

test("overdueSummary gives none, one and many", () => {
  expect(overdueSummary(-1)).toEqual({ copyKey: "today.carriedOver.none", count: 0 });
  expect(overdueSummary(1)).toEqual({ copyKey: "today.carriedOver.one", count: 1 });
  expect(overdueSummary(3.9)).toEqual({ copyKey: "today.carriedOver.many", count: 3 });
});
