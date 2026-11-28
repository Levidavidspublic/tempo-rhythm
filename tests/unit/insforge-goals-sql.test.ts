import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127080000_tempo-goals.sql";

async function migrationSql() {
  return (await Bun.file(new URL(filename, directory)).text())
    .replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "")
    .replace(/"/g, "");
}

describe("goals migration", () => {
  test("uses the canonical filename", async () => {
    const files = [];
    for await (const file of new Bun.Glob("*_tempo-goals.sql").scan({ cwd: directory.pathname })) {
      files.push(file);
    }
    expect(files).toEqual([filename]);
  });

  test("does not define a delete-capable or realtime policy", async () => {
    const sql = await migrationSql();
    for (const [policy] of sql.matchAll(/\bcreate\s+policy\b[^;]+/gi)) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+realtime\s*\./i);
    }
  });

  test("has no composite owner FK because goals only reference auth users", async () => {
    const sql = await migrationSql();
    expect(sql).not.toMatch(/\bforeign\s+key\s*\([^)]*,/i);
  });
});
