import { describe, expect, test } from "bun:test";

const harness = new URL("../../scripts/insforge-local/", import.meta.url);
const stub = await Bun.file(new URL("stub.sql", harness)).text();
const runner = await Bun.file(new URL("run.sh", harness)).text();

describe("local InsForge harness", () => {
  test("defines the JWT roles and helpers required by migrations", () => {
    expect(stub).toMatch(/create role anon nologin/i);
    expect(stub).toMatch(/create role authenticated nologin/i);
    expect(stub).toMatch(/create role project_admin nologin bypassrls/i);
    expect(stub).toMatch(/create function auth\.uid\(\) returns uuid/i);
    expect(stub).toContain("request.jwt.claims");
    expect(stub).toMatch(/on tables to anon, authenticated, project_admin/i);
  });

  test("applies migrations in timestamp order and propagates SQL failures", () => {
    expect(runner).toContain("export LC_ALL=C");
    expect(runner).toContain("unset GLOBSORT");
    expect(runner).toContain('for file in "$migrations_dir"/*.sql');
    expect(runner).toContain('run_sql migrate "$file" -1');
    expect(runner).toContain("-v ON_ERROR_STOP=1");
    expect(runner).toContain("failed=$((failed + 1))");
    expect(runner).toContain('exit "$((failed > 0))"');
  });
});
