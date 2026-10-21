import { describe, expect, test } from "bun:test";
import { reflowElastic, splitByFlexibility } from "./calibrate";

describe("priority calibration", () => {
  test("keeps fixed work in due-date order and reorders flexible work by priority", () => {
    const tasks = [
      { id: "fixed-later", flexibility: "fixed" as const, priority: "low" as const, dueAt: 40 },
      { id: "legacy", priority: "high" as const, dueAt: 30 },
      { id: "flex-low", flexibility: "elastic" as const, priority: "low" as const, dueAt: 10 },
      { id: "fixed-sooner", flexibility: "fixed" as const, priority: "high" as const, dueAt: 20 },
      { id: "flex-high", flexibility: "elastic" as const, priority: "high" as const, dueAt: 50 },
    ];

    const { fixed, elastic } = splitByFlexibility(tasks);

    expect(fixed.map((task) => task.id)).toEqual(["fixed-later", "fixed-sooner"]);
    expect(elastic.map((task) => task.id)).toEqual(["legacy", "flex-low", "flex-high"]);
    expect(reflowElastic(fixed, elastic).map((task) => task.id)).toEqual([
      "fixed-sooner",
      "fixed-later",
      "legacy",
      "flex-high",
      "flex-low",
    ]);
  });
});
