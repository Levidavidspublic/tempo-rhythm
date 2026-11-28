import { describe, expect, test } from "bun:test";
import { buildStage, stagedId } from "./stage";

const user = { _id: "owner", _creationTime: 1, email: " Mixed@Example.Invalid ", name: "Owner" };
const other = { _id: "other", _creationTime: 1, email: "other@example.invalid" };
const repeat = {
  _id: "repeat",
  _creationTime: 1,
  updatedAt: 3,
  userId: user._id,
  repeatCycle: "DAILY",
  repeatEvery: 1,
  weekdays: [],
  deletedInstanceDates: [],
  skipOverdue: false,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
};
const subscription = {
  _id: "subscription",
  _creationTime: 1,
  userId: user._id,
  plan: "pro",
  billingCycle: "monthly",
  status: "active",
  trialUsed: true,
};

function task(id: string, parentTaskId?: string, repeatCfgId?: string) {
  return {
    _id: id,
    _creationTime: 1,
    updatedAt: 3,
    title: "Quo'te \\ and newline\n",
    status: "todo",
    priority: "low",
    userId: user._id,
    parentTaskId,
    repeatCfgId,
  };
}

const loadId = "00000000-0000-4000-8000-0000000000aa";

describe("staged Convex import", () => {
  test("uses stable RFC 4122 version 5 IDs", () => {
    expect(stagedId("parent")).toBe("97fe9ca7-bb0a-5c7e-94d9-9ad3803b9718");
    expect(stagedId("child")).toBe("3195428f-838f-5c84-a40b-aacf7d59d7a6");
    expect(stagedId("repeat")).toBe("0b7cf05f-2c57-5b83-8be4-02bdfdd15955");
  });

  test("stages users, then repeat configs and parents before children, with direct UUID references", () => {
    const source = {
      users: [user, other],
      subscriptionStates: [subscription],
      taskRepeatCfgs: [repeat],
      tasks: [task("child", "parent"), task("parent", undefined, "repeat")],
    };
    const stage = buildStage(source, loadId);
    expect(buildStage(source, loadId)).toEqual(stage);
    expect(stage.rejected).toEqual([]);
    expect(stage.expected).toEqual({
      staged_users: 2,
      staged_subscriptions: 1,
      task_repeat_cfgs: 1,
      tasks: 2,
    });
    const [users, rows] = stage.chunks.map(({ sql }) => sql);
    expect(users).toContain(`E'${loadId}'::uuid`);
    expect(users).toContain("INSERT INTO tempo_import.staged_users");
    expect(users).toContain("E'mixed@example.invalid'");
    expect(users).toContain("E'approval_status', E'approved'");
    expect(users).toContain("E'plan', E'pro'");
    expect(rows).toContain("INSERT INTO tempo_import.staged_rows");
    expect(rows).toContain(
      `E'task_repeat_cfgs', E'${stagedId("repeat")}'::uuid, E'repeat', E'mixed@example.invalid', 0`
    );
    expect(rows).toContain(
      `E'tasks', E'${stagedId("parent")}'::uuid, E'parent', E'mixed@example.invalid', 1`
    );
    expect(rows).toContain(
      `E'tasks', E'${stagedId("child")}'::uuid, E'child', E'mixed@example.invalid', 2`
    );
    expect(rows).toContain(`E'parent_task_id', E'${stagedId("parent")}'::uuid`);
    expect(rows).toContain(`E'repeat_cfg_id', E'${stagedId("repeat")}'::uuid`);
    for (const chunk of stage.chunks) {
      expect(chunk.sql).toContain("WHERE staged.claimed_at IS NULL;");
      expect(chunk.sql).not.toMatch(/auth\.users|user_legacy_id|parent_legacy_id|repeat_legacy_id/);
    }
  });

  test("rejects duplicate emails and unresolved or cyclic owner links", () => {
    const stage = buildStage({
      users: [user, other, { ...other, _id: "duplicate", email: " OTHER@example.invalid " }],
      tasks: [
        task("allowed"),
        task("broken-repeat", undefined, "missing"),
        task("broken-parent", "missing"),
        task("broken-child", "broken-parent"),
        task("cycle-a", "cycle-b"),
        task("cycle-b", "cycle-a"),
        task("cycle-child", "cycle-a"),
        { ...task("duplicate-owner-task"), userId: other._id },
      ],
    }, loadId);
    expect(stage.expected).toMatchObject({ staged_users: 1, tasks: 1 });
    expect(stage.counts.tasks).toEqual({ exported: 8, transformed: 1, rejected: 7 });
    const byId = Object.fromEntries(stage.rejected.map(({ id, reason }) => [id, reason]));
    expect(byId).toEqual({
      other: "duplicate email (case-insensitive)",
      duplicate: "duplicate email (case-insensitive)",
      "broken-repeat": "unresolved or cross-owner repeatCfgId",
      "broken-parent": "unresolved or cross-owner parentTaskId",
      "broken-child": "unresolved or cross-owner parentTaskId",
      "cycle-a": "cyclic parentTaskId",
      "cycle-b": "cyclic parentTaskId",
      "cycle-child": "cyclic parentTaskId",
      "duplicate-owner-task": "unresolved userId",
    });
  });

  test("numbers files in order and limits counts and UTF-8 file sizes", () => {
    const tasks = Array.from({ length: 600 }, (_, i) => ({
      ...task(`task-${i}`),
      title: "שלום 🎵".repeat(50),
    }));
    const stage = buildStage({ users: [user], tasks }, loadId);
    expect(stage.expected.tasks).toBe(600);
    expect(stage.chunks.length).toBeGreaterThanOrEqual(3);
    expect(stage.chunks.reduce((sum, { rows }) => sum + rows, 0)).toBe(601);
    for (const [i, chunk] of stage.chunks.entries()) {
      expect(chunk.file).toBe(`stage-${String(i + 1).padStart(5, "0")}.sql`);
      expect(chunk.bytes).toBe(Buffer.byteLength(chunk.sql, "utf8"));
      expect(chunk.bytes).toBeLessThan(150_000);
      expect(chunk.rows).toBeLessThanOrEqual(500);
    }
  });

  test("fails without printing the contents of a single oversized row", () => {
    const tasks = [{ ...task("wide-task"), title: "private data".repeat(20_000) }];
    expect(() => buildStage({ users: [user], tasks }, loadId)).toThrow(
      /^A single staged row exceeds the SQL chunk size limit\.$/
    );
  });
});
