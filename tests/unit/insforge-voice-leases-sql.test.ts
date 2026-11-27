import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127130000_tempo-voice-leases.sql";

describe("canonical voice leases SQL", () => {
  test("there is one voice lease migration with the canonical filename", () => {
    const files = Array.from(new Bun.Glob("*_tempo-voice-leases.sql").scanSync(directory.pathname));
    expect(files).toEqual([filename]);
  });

  test("the private migration adds no client or realtime policies", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
  });

  test("the foreign key references the auth owner directly", async () => {
    const sql = await Bun.file(new URL(filename, directory)).text();
    expect(sql).toMatch(/\buser_id\s+uuid\s+not\s+null\s+references\s+auth\.users\s*\(id\)/i);
  });
});
