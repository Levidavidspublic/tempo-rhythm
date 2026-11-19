import { describe, expect, test } from "bun:test";
import {
  parseTaskRepeatDoc,
  softDeleteTaskRepeatDoc,
  type TaskRepeatDoc,
  TaskRepeatDocError,
} from "./task-repeat-doc";

const minimal: TaskRepeatDoc = {
  repeatCycle: "DAILY",
  repeatEvery: 1,
  weekdays: [],
  deletedInstanceDates: [],
  skipOverdue: true,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
  createdAt: 100,
  updatedAt: 100,
};

describe("task repeat documents", () => {
  test("parses a minimal valid document", () => {
    expect(parseTaskRepeatDoc(minimal)).toEqual(minimal);
  });

  test("parses a document with every optional field", () => {
    const full: TaskRepeatDoc = {
      ...minimal,
      repeatCycle: "MONTHLY",
      weekdays: [1, 5],
      monthlyWeekOfMonth: -1,
      monthlyWeekday: 5,
      monthlyLastDay: false,
      defaultEstimate: 3_600_000,
      lastTaskCreationDay: "2026-11-19",
      deletedAt: 200,
    };
    expect(parseTaskRepeatDoc(full)).toEqual(full);
  });

  test("refuses an invalid cycle and repeat count", () => {
    expect(() => parseTaskRepeatDoc({ ...minimal, repeatCycle: "HOURLY" })).toThrow(
      new TaskRepeatDocError("repeatCycle")
    );
    expect(() => parseTaskRepeatDoc({ ...minimal, repeatEvery: 0 })).toThrow(
      new TaskRepeatDocError("repeatEvery")
    );
  });

  test("refuses invalid weekdays and malformed skipped dates", () => {
    expect(() => parseTaskRepeatDoc({ ...minimal, weekdays: [7] })).toThrow(
      new TaskRepeatDocError("weekdays")
    );
    expect(() => parseTaskRepeatDoc({ ...minimal, weekdays: [2, 2] })).toThrow(
      new TaskRepeatDocError("weekdays")
    );
    expect(() => parseTaskRepeatDoc({ ...minimal, deletedInstanceDates: ["19-11-2026"] })).toThrow(
      new TaskRepeatDocError("deletedInstanceDates")
    );
  });

  test("drops legacy keys and refuses unknown keys", () => {
    const withLegacy = {
      ...minimal,
      userId: "user",
      _id: "repeat",
      _creationTime: 50,
    };
    expect(parseTaskRepeatDoc(withLegacy)).toEqual(minimal);
    expect(() => parseTaskRepeatDoc({ ...minimal, surprise: true })).toThrow(
      new TaskRepeatDocError("surprise")
    );
  });

  test("soft deletes while retaining all other fields", () => {
    const parsed = parseTaskRepeatDoc({
      ...minimal,
      weekdays: [1],
      defaultEstimate: 0,
    });
    expect(softDeleteTaskRepeatDoc(parsed, 500)).toEqual({
      ...parsed,
      deletedAt: 500,
      updatedAt: 500,
    });
  });
});
