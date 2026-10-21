import { describe, expect, test } from "bun:test";
import { list } from "./activity";
import { makeFakeCtx, run } from "./lib/testFakeCtx";

describe("activity.list", () => {
  test("returns only the current user's live items, newest first", async () => {
    const ctx = makeFakeCtx("users:mine", ["users:other"]);
    await ctx.db.insert("notes", {
      userId: "users:mine",
      title: "My note",
      createdAt: 10,
      updatedAt: 30,
    });
    await ctx.db.insert("tasks", {
      userId: "users:mine",
      title: "Finished task",
      status: "done",
      createdAt: 10,
      updatedAt: 20,
      completedAt: 20,
    });
    await ctx.db.insert("notes", {
      userId: "users:other",
      title: "Private note",
      createdAt: 40,
      updatedAt: 40,
    });
    await ctx.db.insert("goals", {
      userId: "users:mine",
      title: "Deleted goal",
      status: "active",
      createdAt: 50,
      updatedAt: 50,
      deletedAt: 51,
    });

    const result = await run(list, ctx, {});

    expect(result.map((item: { title: string }) => item.title)).toEqual([
      "My note",
      "Finished task",
    ]);
    expect(result[0].href).toContain("/notes/");
    expect(result[1].action).toBe("Completed task");
  });

  test("caps the combined feed at 50 items", async () => {
    const ctx = makeFakeCtx("users:mine");
    for (let index = 0; index < 55; index += 1) {
      await ctx.db.insert("notes", {
        userId: "users:mine",
        title: `Note ${index}`,
        createdAt: index,
        updatedAt: index,
      });
    }

    const result = await run(list, ctx, {});

    expect(result).toHaveLength(50);
    expect(result[0].title).toBe("Note 54");
    expect(result[49].title).toBe("Note 5");
  });
});
