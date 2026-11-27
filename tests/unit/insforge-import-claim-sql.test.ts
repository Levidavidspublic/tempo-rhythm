import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../insforge/migrations/20261127220000_tempo-import-claim.sql",
  import.meta.url
);
const sql = (await Bun.file(migration).text()).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "");

describe("import claim migration", () => {
  test("only grants staging schema and tables to project_admin", () => {
    const grants = [...sql.matchAll(/\bgrant\b[^;]*/gi)].map(([grant]) =>
      grant.replace(/\s+/g, " ").toLowerCase()
    );
    expect(grants).toEqual([
      "grant usage on schema tempo_import to project_admin",
      "grant select, insert, update on tempo_import.staged_users, tempo_import.staged_rows to project_admin",
      "grant select, insert, update on tempo_import.load_state, tempo_import.pending_verifications to project_admin",
      "grant execute on function tempo_import.begin_staged_load(), tempo_import.finalize_staged_load(), tempo_import.release_staged_load() to project_admin",
    ]);
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
  });

  test("revokes direct execution of both claim functions from clients", () => {
    expect(sql).toMatch(
      /revoke execute on function tempo_import\.claim_staged\(uuid, text\) from public, anon, authenticated;/i
    );
    expect(sql).toMatch(
      /revoke execute on function tempo_import\.claim_verified_user\(\) from public, anon, authenticated;/i
    );
    expect(sql).toMatch(
      /revoke execute on function tempo_import\.begin_staged_load\(\), tempo_import\.finalize_staged_load\(\),\s+tempo_import\.release_staged_load\(\)\s+from public, anon, authenticated;/i
    );
  });

  test("whitelists the only mapped tables at both staging and claim", () => {
    const targets = "\\(\\s*'task_repeat_cfgs'\\s*,\\s*'tasks'\\s*\\)";
    expect(sql).toMatch(new RegExp(`target_table\\s+in\\s*${targets}`, "i"));
    expect(sql).toMatch(new RegExp(`staged_row\\.target_table\\s+not\\s+in\\s*${targets}`, "i"));
  });
});
