import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127100000_tempo-focus-blocks.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical focus blocks migration", () => {
  test("ships only the assigned focus blocks migration", () => {
    expect(
      readdirSync(migrations).filter((name) => name.endsWith("_tempo-focus-blocks.sql"))
    ).toEqual([filename]);
  });

  test("defines no delete policy or domain realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+"?realtime"?\s*\./i);
    }
  });

  test("links tasks with the owner column first on both sides", () => {
    expect(sql).toMatch(
      /foreign key\s*\(user_id, task_id\)\s*references public\.tasks\s*\(user_id, id\)/i
    );
  });
});
