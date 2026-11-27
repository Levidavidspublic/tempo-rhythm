import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127120000_tempo-memories.sql";

describe("canonical memories SQL", () => {
  test("there is one memories migration with the canonical filename", () => {
    const files = Array.from(new Bun.Glob("*_tempo-memories.sql").scanSync(directory.pathname));
    expect(files).toEqual([filename]);
  });

  test("the migration adds neither a delete policy nor a realtime policy", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bfor\s+(delete|all)\b/i);
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bon\s+realtime\s*\./i);
  });

  test("the foreign key references the auth owner directly", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).toMatch(/\buser_id\s+uuid\s+not\s+null\s+references\s+auth\.users\s*\(id\)/i);
  });
});
