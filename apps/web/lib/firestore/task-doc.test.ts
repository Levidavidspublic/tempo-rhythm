import { expect, test } from "bun:test";
import {
  newTaskDoc,
  patchTaskDoc,
  restoreTaskDoc,
  softDeleteTaskDoc,
  TaskDocError,
  toTaskDoc,
} from "./task-doc";

test("newTaskDoc sets defaults and timestamps", () => {
  expect(newTaskDoc({ title: "Plan lunch" }, 100)).toEqual({
    title: "Plan lunch",
    status: "todo",
    priority: "medium",
    createdAt: 100,
    updatedAt: 100,
  });
  expect(
    newTaskDoc({ title: "Finished", status: "done" }, 200).completedAt,
  ).toBe(200);
});

test("toTaskDoc drops datastore and ownership fields", () => {
  const result = toTaskDoc({
    title: "Task",
    status: "todo",
    priority: "low",
    createdAt: 1,
    updatedAt: 2,
    userId: "user",
    _id: "task",
    _creationTime: 0,
  });
  expect(result).toEqual({
    title: "Task",
    status: "todo",
    priority: "low",
    createdAt: 1,
    updatedAt: 2,
  });
  expect("userId" in result).toBe(false);
});

test("invalid enumerations name their fields", () => {
  const base = {
    title: "Task",
    status: "todo",
    priority: "low",
    createdAt: 1,
    updatedAt: 1,
  };
  for (const field of [
    "status",
    "priority",
    "energy",
    "flexibility",
  ] as const) {
    expect(() => toTaskDoc({ ...base, [field]: "invalid" })).toThrow(
      new TaskDocError(field),
    );
  }
});

test("invalid required, unknown, and checklist fields throw", () => {
  const base = {
    title: "Task",
    status: "todo",
    priority: "low",
    createdAt: 1,
    updatedAt: 1,
  };
  expect(() => toTaskDoc({ ...base, title: "  " })).toThrow(TaskDocError);
  expect(() => toTaskDoc({ ...base, createdAt: "yesterday" })).toThrow(
    TaskDocError,
  );
  expect(() => toTaskDoc({ ...base, surprise: true })).toThrow(TaskDocError);
  expect(() =>
    toTaskDoc({ ...base, checklist: [{ id: "1", text: "Step" }] }),
  ).toThrow(TaskDocError);
});

test("patchTaskDoc manages completion transitions and timestamps", () => {
  const original = newTaskDoc({ title: "Task" }, 10);
  const done = patchTaskDoc(original, { status: "done" }, 20);
  expect(done).toMatchObject({
    status: "done",
    completedAt: 20,
    createdAt: 10,
    updatedAt: 20,
  });
  const reopened = patchTaskDoc(done, { status: "in_progress" }, 30);
  expect(reopened).toMatchObject({
    status: "in_progress",
    createdAt: 10,
    updatedAt: 30,
  });
  expect("completedAt" in reopened).toBe(false);
});

test("soft delete and restore round-trip without removing other fields", () => {
  const original = newTaskDoc(
    { title: "Task", description: "Keep me", projectName: "Home" },
    10,
  );
  const deleted = softDeleteTaskDoc(original, 20);
  const restored = restoreTaskDoc(deleted, 30);
  expect(deleted).toMatchObject({
    deletedAt: 20,
    updatedAt: 20,
    description: "Keep me",
    projectName: "Home",
  });
  expect(restored).toMatchObject({
    updatedAt: 30,
    description: "Keep me",
    projectName: "Home",
  });
  expect("deletedAt" in restored).toBe(false);
});

test("helpers do not mutate their inputs", () => {
  const createInput = { title: "Task", description: undefined };
  const created = newTaskDoc(createInput, 10);
  const patch = { status: "done" as const };
  const before = { ...created };
  const patched = patchTaskDoc(created, patch, 20);
  const deleted = softDeleteTaskDoc(patched, 30);
  restoreTaskDoc(deleted, 40);
  expect(createInput).toEqual({ title: "Task", description: undefined });
  expect(created).toEqual(before);
  expect(patch).toEqual({ status: "done" });
  expect(deleted.deletedAt).toBe(30);
});
