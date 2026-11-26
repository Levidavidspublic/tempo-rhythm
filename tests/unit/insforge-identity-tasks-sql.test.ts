import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../insforge/migrations/20261127010000_tempo-identity-tasks.sql",
  import.meta.url,
);
const sql = (await Bun.file(migration).text()).replace(/^\s*--.*$/gm, "");
const tables = ["account_gate", "profiles", "subscription_states", "task_repeat_cfgs", "tasks"];

describe("identity and tasks SQL", () => {
  test("enables RLS without a client delete policy on every table", () => {
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security;`, "i"));
    }
    const policies = [...sql.matchAll(/\bcreate\s+policy\b[^;]*;/gi)];
    expect(policies.length).toBeGreaterThan(0);
    for (const [policy] of policies) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\s+to\s+authenticated\b/i);
      expect(policy).not.toMatch(/\bon\s+public\.subscription_states\b/i);
    }
  });

  test("all task cross-row foreign keys use the owner-first composite key", () => {
    const links = [...sql.matchAll(/\bforeign key\s*\(([^)]+)\)\s+references public\.(\w+)\s*\(([^)]+)\)/gi)];
    expect(links.map(([, columns, target, key]) => [columns, target, key])).toEqual([
      ["user_id, repeat_cfg_id", "task_repeat_cfgs", "user_id, id"],
      ["user_id, parent_task_id", "tasks", "user_id, id"],
    ]);
    expect(sql).not.toMatch(/\b(?:repeat_cfg_id|parent_task_id)\s+uuid\s+references/i);
  });

  test("every directly imported table has a unique legacy Convex ID", () => {
    for (const table of ["account_gate", "subscription_states", "task_repeat_cfgs", "tasks"]) {
      const definition = sql.match(new RegExp(`create table public\\.${table} \\(.*?\\n\\);`, "is"))?.[0];
      expect(definition).toMatch(/\blegacy_convex_id text unique\b/i);
    }
  });
});
