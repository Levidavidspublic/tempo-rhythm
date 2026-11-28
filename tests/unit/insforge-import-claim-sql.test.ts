import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../insforge/migrations/20261127230000_tempo-import-claim.sql",
  import.meta.url
);
const sql = (await Bun.file(migration).text()).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "");

describe("import claim migration", () => {
  test("only grants the import schema to project_admin", () => {
    const grants = [...sql.matchAll(/\bgrant\b[^;]*/gi)].map(([grant]) =>
      grant.replace(/\s+/g, " ").toLowerCase()
    );
    expect(grants).toEqual([
      "grant usage on schema tempo_import to project_admin",
      "grant select, insert, update on tempo_import.loads, tempo_import.staged_users, tempo_import.staged_rows, tempo_import.pending_verifications to project_admin",
      "grant execute on function tempo_import.begin_staged_load(uuid), tempo_import.finalize_staged_load(uuid), tempo_import.release_staged_load(uuid) to project_admin",
    ]);
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
  });

  test("takes the advisory lock before the staged-user row lock", () => {
    const body = sql.slice(sql.indexOf("function tempo_import.claim_staged"));
    const lock = body.indexOf("pg_advisory_xact_lock");
    const row = body.indexOf("for update of waiting");
    expect(lock).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(lock);
  });

  test("release deletes only the named load", () => {
    expect(sql).toMatch(/delete from tempo_import\.staged_rows where load_id = p_load_id/i);
    expect(sql).toMatch(/delete from tempo_import\.staged_users where load_id = p_load_id/i);
    expect(sql).not.toMatch(/delete from tempo_import\.staged_users where claimed_at is null/i);
  });
});
