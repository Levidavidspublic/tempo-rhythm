import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127040000_tempo-notes.sql";

describe("canonical notes SQL", () => {
  test("there is one notes migration with the canonical filename", () => {
    const files = Array.from(new Bun.Glob("*_tempo-notes.sql").scanSync(directory.pathname));
    expect(files).toEqual([filename]);
  });

  test("the migration adds neither a delete policy nor a realtime policy", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bfor\s+(delete|all)\b/i);
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bon\s+realtime\s*\./i);
  });

  test("the note block parent foreign key puts the owner first", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).toMatch(/\bunique\s*\(user_id,\s*id\)/i);
    expect(sql).toMatch(
      /\bforeign\s+key\s*\(user_id,\s*note_id\)\s+references\s+public\.notes\s*\(user_id,\s*id\)/i
    );
  });
});
