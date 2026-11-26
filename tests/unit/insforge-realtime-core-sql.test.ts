import { describe, expect, test } from "bun:test";

const directory = new URL("../../insforge/migrations/", import.meta.url);
const migrations = new Bun.Glob("[0-9]*_tempo-*.sql");

describe("realtime core SQL", () => {
  test("all canonical migrations share one owner-channel policy", async () => {
    const policyFiles: string[] = [];
    for await (const file of migrations.scan({ cwd: directory.pathname })) {
      const sql = await Bun.file(new URL(file, directory)).text();
      const policies = sql.matchAll(/\bcreate\s+policy\b[^;]*?\bon\s+realtime\.channels\b/gi);
      policyFiles.push(...Array.from(policies, () => file));
    }
    expect(policyFiles).toEqual(["20261127020000_tempo-realtime-core.sql"]);
  });

  test("the trigger publishes only table, operation, and row ID", async () => {
    const sql = await Bun.file(new URL("20261127020000_tempo-realtime-core.sql", directory)).text();
    const call = sql.match(/\bperform realtime\.publish\([\s\S]*?\);/gi);
    expect(call).toHaveLength(1);
    expect(call?.[0]?.replace(/\s+/g, " ")).toBe(
      "perform realtime.publish( tg_table_name || ':' || new.user_id::text, tg_op, pg_catalog.jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', row_id) );",
    );
  });
});
