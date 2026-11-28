import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127210000_tempo-coach-settings.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical coach settings migration", () => {
  test("ships only the assigned migration filename", () => {
    expect(
      readdirSync(migrations).filter((name) => name.endsWith("_tempo-coach-settings.sql"))
    ).toEqual([filename]);
  });

  test("defines no delete, private-table, or realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+(?:"?realtime"?\s*\.|public\.coach_web_searches\b)/i);
    }
  });

  test("both tables reference only the auth user, with no cross-row links", () => {
    expect(sql.match(/references\s+[^,\n]+/gi)).toEqual([
      "references auth.users(id) on delete cascade",
      "references auth.users(id) on delete cascade",
    ]);
  });
});
