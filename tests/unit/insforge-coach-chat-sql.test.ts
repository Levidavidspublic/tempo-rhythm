import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127110000_tempo-coach-chat.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical coach chat migration", () => {
  test("ships only the assigned coach chat migration", () => {
    expect(
      readdirSync(migrations).filter((name) => name.endsWith("_tempo-coach-chat.sql"))
    ).toEqual([filename]);
  });

  test("defines no delete policy or domain realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+"?realtime"?\s*\./i);
    }
  });

  test("links messages to conversations with the owner column first on both sides", () => {
    expect(sql).toMatch(
      /foreign key\s*\(user_id, conversation_id\)\s*references public\.conversations\s*\(user_id, id\)/i
    );
  });
});
