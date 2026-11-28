import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127050000_tempo-page-ledger.sql";

describe("canonical page ledger SQL", () => {
  test("there is one page ledger migration with the canonical filename", () => {
    const files = Array.from(new Bun.Glob("*_tempo-page-ledger.sql").scanSync(directory.pathname));
    expect(files).toEqual([filename]);
  });

  test("the migration adds neither a delete policy nor a realtime policy", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bfor\s+(delete|all)\b/i);
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bon\s+realtime\s*\./i);
  });

  test("note, Undo, and payload foreign keys put the owner and target ID first", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).toMatch(
      /\bforeign\s+key\s*\(user_id,\s*note_id\)\s+references\s+public\.notes\s*\(user_id,\s*id\)/i
    );
    const undoLinks = sql.match(
      /\bforeign\s+key\s*\(user_id,\s*(undone_by_operation_id|undo_of_operation_id),\s*note_id\)\s+references\s+public\.page_operations\s*\(user_id,\s*id,\s*note_id\)/gi
    );
    expect(undoLinks).toHaveLength(2);
    expect(sql).toMatch(
      /\bforeign\s+key\s*\(user_id,\s*operation_id,\s*note_id,\s*undo_until_ms\)\s+references\s+public\.page_operations\s*\(user_id,\s*id,\s*note_id,\s*undo_until_ms\)/i
    );
  });
});
