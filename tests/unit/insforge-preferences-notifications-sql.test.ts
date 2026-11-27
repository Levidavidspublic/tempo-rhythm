import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127140000_tempo-preferences-notifications.sql";

describe("canonical preferences and notifications SQL", () => {
  test("there is one preferences migration with the canonical filename", () => {
    const files = Array.from(
      new Bun.Glob("*_tempo-preferences-notifications.sql").scanSync(directory.pathname)
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
    expect(sql).not.toMatch(/\bcreate\s+policy\b[^;]*\bon\s+realtime\s*\./i);
  });

  test("preferences and notifications each reference the auth owner directly", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(
      sql.match(/\buser_id\s+uuid\s+not\s+null\b[^,;]*\breferences\s+auth\.users\s*\(id\)/gi)
    ).toHaveLength(2);
  });
});
