import { expect, test } from "bun:test";
import type { TaskStatus } from "../firestore/task-doc";
import { groupTasksByProject, type ProjectTaskRow } from "./project-task-groups";

function task(
  id: string,
  overrides: Partial<ProjectTaskRow> & { status?: TaskStatus } = {}
): ProjectTaskRow {
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

test("groups open tasks by project id and reports counts", () => {
  const result = groupTasksByProject([
    task("a", { projectId: "project-1", projectName: "Home" }),
    task("b", { projectId: "project-1", projectName: "Home", status: "in_progress" }),
    task("c", { projectId: "project-2", projectName: "Work" }),
  ]);

  expect(result.groups.map(({ projectId, count }) => ({ projectId, count }))).toEqual([
    { projectId: "project-1", count: 2 },
    { projectId: "project-2", count: 1 },
  ]);
  expect(result.totalCount).toBe(3);
});

test("puts the no-project group last and omits it when empty", () => {
  const withNoProject = groupTasksByProject([
    task("none-missing"),
    task("named", { projectId: "p", projectName: "Zulu" }),
    task("none-empty", { projectId: "" }),
  ]);
  expect(withNoProject.groups.map((group) => group.projectId)).toEqual(["p", null]);
  expect(withNoProject.groups[1]?.tasks.map((row) => row.id)).toEqual([
    "none-empty",
    "none-missing",
  ]);

  expect(
    groupTasksByProject([task("named", { projectId: "p", projectName: "Zulu" })]).groups.map(
      (group) => group.projectId
    )
  ).toEqual(["p"]);
});

test("leaves out deleted, done, and cancelled tasks", () => {
  const result = groupTasksByProject([
    task("todo"),
    task("progress", { status: "in_progress" }),
    task("deleted", { deletedAt: 10 }),
    task("done", { status: "done" }),
    task("cancelled", { status: "cancelled" }),
  ]);

  expect(result.groups[0]?.tasks.map((row) => row.id)).toEqual(["progress", "todo"]);
  expect(result.totalCount).toBe(2);
});

test("takes the trimmed project name from the newest task that has one", () => {
  const result = groupTasksByProject([
    task("old", { projectId: "p", projectName: " Old name ", updatedAt: 5 }),
    task("new-empty", { projectId: "p", projectName: "   ", updatedAt: 20 }),
    task("new-named", { projectId: "p", projectName: " New name ", updatedAt: 10 }),
  ]);

  expect(result.groups[0]?.projectName).toBe("New name");
});

test("orders due tasks first by due date, then undated tasks newest first", () => {
  const result = groupTasksByProject([
    task("undated-old", { createdAt: 2 }),
    task("due-later", { dueAt: 20, createdAt: 100 }),
    task("undated-new", { createdAt: 8 }),
    task("due-sooner", { dueAt: 10 }),
  ]);

  expect(result.groups[0]?.tasks.map((row) => row.id)).toEqual([
    "due-sooner",
    "due-later",
    "undated-new",
    "undated-old",
  ]);
});

test("sorts project groups by name ignoring case and breaks ties by project id", () => {
  const result = groupTasksByProject([
    task("z", { projectId: "z", projectName: "beta" }),
    task("b", { projectId: "b", projectName: "Alpha" }),
    task("a", { projectId: "a", projectName: "alpha" }),
  ]);

  expect(result.groups.map((group) => group.projectId)).toEqual(["a", "b", "z"]);
});

test("does not mutate the input list or its rows", () => {
  const first = task("first", { projectId: "p", dueAt: 20 });
  const second = task("second", { projectId: "p", dueAt: 10 });
  const input = [first, second] as const;

  const result = groupTasksByProject(input);

  expect(input).toEqual([first, second]);
  expect(input[0]).toBe(first);
  expect(input[1]).toBe(second);
  expect(result.groups[0]?.tasks).not.toBe(input);
  expect(result.groups[0]?.tasks).toEqual([second, first]);
});
