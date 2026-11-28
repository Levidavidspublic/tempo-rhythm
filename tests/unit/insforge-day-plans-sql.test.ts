import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127180000_tempo-day-plans.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical day plans and time blocks migration", () => {
  test("ships only the assigned migration filename", () => {
    expect(readdirSync(migrations).filter((file) => file.endsWith("_tempo-day-plans.sql"))).toEqual(
      [filename]
    );
  });

  test("defines no delete or realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+"?realtime"?\s*\./i);
    }
  });

  test("puts the owner first in every parent foreign key", () => {
    const foreignKey = /foreign\s+key\s*\([^)]*\)\s*references\s+public\.\w+\s*\([^)]*\)/gi;
    const foreignKeys = (sql.match(foreignKey) ?? []).map((key) => key.replace(/\s+/g, " "));
    expect(foreignKeys).toEqual([
      "foreign key (user_id, top_task_1_id) references public.tasks (user_id, id)",
      "foreign key (user_id, top_task_2_id) references public.tasks (user_id, id)",
      "foreign key (user_id, top_task_3_id) references public.tasks (user_id, id)",
      "foreign key (user_id, day_plan_id, local_date) references public.day_plans (user_id, id, local_date)",
      "foreign key (user_id, task_id) references public.tasks (user_id, id)",
      "foreign key (user_id, habit_id) references public.habits (user_id, id)",
    ]);
  });
});
