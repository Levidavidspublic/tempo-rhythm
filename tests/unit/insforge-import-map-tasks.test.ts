import { expect, test } from "bun:test";
import { mapTasks } from "../../tools/convex-import/map-tasks";

const owners = new Set(["owner1", "owner2"]);
const task = {
  _id: "task1",
  _creationTime: 1_700_000_000_000.25,
  userId: "owner1",
  title: "Parent",
  status: "todo",
  priority: "medium",
  updatedAt: 1_700_000_000_010,
};
const repeat = {
  _id: "repeat1",
  _creationTime: 1_700_000_000_002,
  userId: task.userId,
  repeatCycle: "WEEKLY",
  repeatEvery: 2,
  weekdays: [1, 5],
  deletedInstanceDates: [],
  skipOverdue: true,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
  updatedAt: 1_700_000_000_009,
};

test("emits recurrence before tasks, then resolves parents in a timestamp-guarded pass", () => {
  const { sql, rejected, counts } = mapTasks(
    [{ ...task, _id: "child", title: "Child", repeatCfgId: repeat._id, parentTaskId: task._id }, task],
    [repeat],
    owners,
  );
  expect(rejected).toEqual([]);
  expect(counts).toEqual({
    tasks: { exported: 2, transformed: 2, rejected: 0 },
    taskRepeatCfgs: { exported: 1, transformed: 1, rejected: 0 },
  });
  expect(sql.indexOf("INSERT INTO public.task_repeat_cfgs")).toBeLessThan(sql.indexOf("INSERT INTO public.tasks"));
  expect(sql.indexOf("INSERT INTO public.tasks")).toBeLessThan(sql.indexOf("UPDATE public.tasks"));
  expect(sql).toContain("E'child', E'owner1', E'repeat1', E'task1', E'Child'");
  expect(sql).toContain("gate.legacy_convex_id = input.user_legacy_id");
  expect(sql).toContain("repeat.user_id = gate.user_id AND repeat.legacy_convex_id = input.repeat_legacy_id");
  expect(sql).toContain("parent.user_id = input.user_id AND parent.legacy_convex_id = input.parent_legacy_id");
  expect(sql).toContain("target.updated_at = input.updated_at AND target.parent_task_id IS DISTINCT FROM parent.id");
  expect(sql.match(/ON CONFLICT \(legacy_convex_id\) DO UPDATE/g)).toHaveLength(2);
  expect(sql.match(/WHERE excluded.updated_at >= target.updated_at AND excluded.user_id = target.user_id/g)).toHaveLength(2);
});

test("maps bigint timestamps, native repeat arrays, and task JSONB", () => {
  const { sql, rejected } = mapTasks([{
    ...task,
    projectId: "p1",
    projectName: "Project",
    dueAt: 1_700_000_000_012,
    completedAt: 1_700_000_000_013,
    deletedAt: 1_700_000_000_014,
    timeSpentOnDay: { "2026-11-27": 60000 },
    checklist: [{ id: "c1", text: "check", completed: false }],
  }], [{ ...repeat, createdAt: 1_700_000_000_003 }], owners);
  expect(rejected).toEqual([]);
  expect(sql).toContain("ARRAY[1, 5]::integer[]");
  expect(sql).toContain("ARRAY[]::text[]");
  expect(sql).toContain("1700000000003, 1700000000009, NULL");
  expect(sql).toContain("1700000000000, 1700000000010, 1700000000014");
  expect(sql).toContain("E'{\"2026-11-27\":60000}'::jsonb");
  expect(sql).toContain("E'[{\"id\":\"c1\",\"text\":\"check\",\"completed\":false}]'::jsonb");
  expect(sql).toContain("E'p1', E'Project', 1700000000012, 1700000000013");
});

test("returns missing and cross-owner source references without emitting those rows", () => {
  const result = mapTasks([
    task,
    { ...task, _id: "orphan-user", userId: "missing-user" },
    { ...task, _id: "orphan-repeat", repeatCfgId: "missing-repeat" },
    { ...task, _id: "orphan-parent", parentTaskId: "missing-parent" },
    { ...task, _id: "descendant", parentTaskId: "orphan-parent" },
    { ...task, _id: "other-parent", userId: "owner2", parentTaskId: task._id },
    { ...task, _id: "other-repeat", userId: "owner2", repeatCfgId: repeat._id },
  ], [repeat, { ...repeat, _id: "orphan-config", userId: "missing-user" }], owners);
  expect(result.rejected.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual([
    { table: "tasks", id: "descendant", reason: "unresolved or cross-owner parentTaskId" },
    { table: "taskRepeatCfgs", id: "orphan-config", reason: "unresolved userId" },
    { table: "tasks", id: "orphan-parent", reason: "unresolved or cross-owner parentTaskId" },
    { table: "tasks", id: "orphan-repeat", reason: "unresolved or cross-owner repeatCfgId" },
    { table: "tasks", id: "orphan-user", reason: "unresolved userId" },
    { table: "tasks", id: "other-parent", reason: "unresolved or cross-owner parentTaskId" },
    { table: "tasks", id: "other-repeat", reason: "unresolved or cross-owner repeatCfgId" },
  ]);
  expect(result.counts.tasks).toEqual({ exported: 7, transformed: 1, rejected: 6 });
  for (const { id } of result.rejected) expect(result.sql).not.toContain("E'" + id + "'");
  expect(result.sql).toContain("WITH RECURSIVE broken");
  expect(result.sql).toContain("JOIN broken ON child.parent_legacy_id = broken.legacy_convex_id");
  expect(result.sql).toContain("AS \"table\", legacy_convex_id AS id, reason");
});

test("quotes text, IDs, arrays, and JSON with quotes, backslashes, and dollar signs", () => {
  const clock = "\u{1f570}";
  const hostile = "O'Brien\\path$$" + clock;
  const result = mapTasks([{
    ...task,
    title: hostile,
    _id: hostile,
    repeatCfgId: hostile,
    checklist: [{ id: "x", text: hostile, completed: false }],
  }], [{ ...repeat, _id: hostile, deletedInstanceDates: [hostile] }], owners);
  expect(result.rejected).toEqual([]);
  const escaped = "E'O''Brien\\\\path$$" + clock + "'";
  expect(result.sql).toContain(escaped);
  expect(result.sql).toContain("ARRAY[" + escaped + "]::text[]");
  expect(result.sql).toContain("E'[{\"id\":\"x\",\"text\":\"O''Brien\\\\\\\\path$$" + clock +
    "\",\"completed\":false}]'::jsonb");
  expect(result.sql).not.toContain(hostile);
});

test("rejects null bytes in text, JSON values, JSON keys, and array elements", () => {
  const nul = "before\0after";
  const { sql, rejected } = mapTasks([
    { ...task, _id: "text-nul", title: nul },
    { ...task, _id: "json-nul", timeSpentOnDay: { key: nul } },
    { ...task, _id: "key-nul", timeSpentOnDay: { [nul]: true } },
  ], [{ ...repeat, deletedInstanceDates: [nul] }], owners);
  expect(rejected.map(({ id }) => id)).toEqual([repeat._id, "text-nul", "json-nul", "key-nul"]);
  for (const { reason } of rejected) expect(reason).toContain("without null bytes");
  expect(sql).toBe("");
});
