import { describe, expect, test } from "bun:test";
import { groupByEnergy } from "./groupByEnergy";

describe("groupByEnergy", () => {
  test("defaults missing energy, orders open tasks, and excludes closed tasks", () => {
    const groups = groupByEnergy([
      {
        id: "later",
        status: "todo",
        priority: "high",
        energy: "low",
        dueAt: 300,
      },
      { id: "medium", status: "in_progress", priority: "medium" },
      {
        id: "lower",
        status: "todo",
        priority: "low",
        energy: "low",
        dueAt: 100,
      },
      {
        id: "sooner",
        status: "todo",
        priority: "high",
        energy: "low",
        dueAt: 200,
      },
      { id: "done", status: "done", priority: "high", energy: "high" },
      {
        id: "cancelled",
        status: "cancelled",
        priority: "high",
        energy: "high",
      },
    ] as const);

    expect(groups.low.map((task) => task.id)).toEqual([
      "sooner",
      "later",
      "lower",
    ]);
    expect(groups.medium.map((task) => task.id)).toEqual(["medium"]);
    expect(groups.high).toEqual([]);
  });
});
