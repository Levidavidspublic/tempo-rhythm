import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127200000_tempo-page-proposals-nags.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical page proposals and nags migration", () => {
  test("ships only the assigned migration filename", () => {
    expect(
      readdirSync(migrations).filter((name) => name.endsWith("_tempo-page-proposals-nags.sql"))
    ).toEqual([filename]);
  });

  test("defines no delete, private-table, or realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+(?:"?realtime"?\s*\.|public\.page_proposals\b)/i);
    }
  });

  test("links the note, conversation, and receipt with the owner column first", () => {
    expect(sql).toMatch(
      /foreign key\s*\(user_id, note_id\)\s*references public\.notes\s*\(user_id, id\)/i
    );
    expect(sql).toMatch(
      /foreign key\s*\(user_id, conversation_id\)\s*references public\.conversations\s*\(user_id, id\)/i
    );
    expect(sql).toMatch(
      /foreign key\s*\(user_id, confirmed_operation_id, note_id\)\s*references public\.page_operations\s*\(user_id, id, note_id\)/i
    );
  });
});
