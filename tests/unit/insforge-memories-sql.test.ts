import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127120000_tempo-memories.sql";

describe("canonical memories SQL", () => {
  test("there is one memories migration with the canonical filename", () => {
    const files = Array.from(
      new Bun.Glob("*_tempo-memories.sql").scanSync(Bun.fileURLToPath(directory))
    );
    expect(files).toEqual([filename]);
  });

  test("the migration adds neither a delete policy nor a realtime policy", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      const command = policy.match(/\bfor\s+(select|insert|update|delete|all)\b/i);
      expect(command?.[1]?.toLowerCase()).not.toBe("delete");
      expect(command?.[1]?.toLowerCase()).not.toBe("all");
      expect(command).not.toBeNull();
    }
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bon\s+"?realtime"?\s*\./i);
  });

  test("the foreign key references the auth owner directly", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).toMatch(/\buser_id\s+uuid\s+not\s+null\s+references\s+auth\.users\s*\(id\)/i);
  });
});
