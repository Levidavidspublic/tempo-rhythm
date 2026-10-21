import { describe, expect, test } from "bun:test";
import { isOpenTask } from "./coach";

describe("isOpenTask", () => {
  test("todo and in-progress tasks are open", () => {
    expect(isOpenTask({ status: "todo", deletedAt: undefined })).toBe(true);
    expect(isOpenTask({ status: "in_progress", deletedAt: undefined })).toBe(true);
  });

  test("done, cancelled and soft-deleted tasks are closed", () => {
    expect(isOpenTask({ status: "done", deletedAt: undefined })).toBe(false);
    expect(isOpenTask({ status: "cancelled", deletedAt: undefined })).toBe(false);
    expect(isOpenTask({ status: "todo", deletedAt: 1 })).toBe(false);
  });
});
