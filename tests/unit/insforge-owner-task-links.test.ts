import { describe, expect, test } from "bun:test";

const MIGRATION = await Bun.file(
  new URL("../../insforge/migrations/20261126161300_tempo-owner-task-links.sql", import.meta.url)
).text();

const TASK_LINKS = MIGRATION.split(";")
  .map((statement) => statement.trim())
  .find((statement) => statement.startsWith("alter table public.tasks\n  drop constraint"));

const FOREIGN_KEYS = Array.from(
  (TASK_LINKS ?? "").matchAll(
    /foreign key \(([^)]+)\)\s+references public\.(\w+) \(([^)]+)\) match simple(?=,|$)/g
  ),
  ([, source, table, target]) => ({
    source: source.split(", "),
    table,
    target: target.split(", "),
  })
);

const TARGET_ROWS: Array<Record<string, string>> = [
  { user_id: "owner-a", id: "row-a" },
  { user_id: "owner-b", id: "row-b" },
];

describe.each([
  ["repeat_cfg_id", "task_repeat_cfgs"],
  ["parent_task_id", "tasks"],
])("tasks.%s", (linkColumn, targetTable) => {
  const foreignKey = FOREIGN_KEYS.find(({ source }) => source.includes(linkColumn));

  test("replaces the ID-only foreign key with a validated owner-qualified key", () => {
    expect(TASK_LINKS).toContain(`drop constraint tasks_${linkColumn}_fkey`);
    expect(MIGRATION).toContain(
      `alter table public.${targetTable}\n  add constraint ${targetTable}_user_id_id_key unique (user_id, id);`
    );
    expect(MIGRATION).not.toMatch(new RegExp(`alter column ${linkColumn}\\s+set not null`, "i"));
    expect(foreignKey).toEqual({
      source: ["user_id", linkColumn],
      table: targetTable,
      target: ["user_id", "id"],
    });
  });

  test.each([
    ["accepts owner A's own row", "owner-a", "row-a", true],
    ["accepts owner B's own row", "owner-b", "row-b", true],
    ["rejects owner A linking to owner B's row", "owner-a", "row-b", false],
    ["rejects owner B linking to owner A's row", "owner-b", "row-a", false],
    ["accepts a null link", "owner-a", null, true],
  ])("%s", (_name, owner, link, expected) => {
    if (!foreignKey) throw new Error(`Missing MATCH SIMPLE foreign key for ${linkColumn}`);

    const row: Record<string, string | null> = { user_id: owner, [linkColumn]: link };
    const key = foreignKey.source.map((column) => row[column]);
    const matches =
      key.includes(null) ||
      TARGET_ROWS.some((target) =>
        foreignKey.target.every((column, index) => target[column] === key[index])
      );
    expect(matches).toBe(expected);
  });
});
