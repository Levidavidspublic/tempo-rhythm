import { describe, expect, test } from "bun:test";

const harness = new URL("../../scripts/insforge-local/", import.meta.url);
const stub = await Bun.file(new URL("stub.sql", harness)).text();
const runner = await Bun.file(new URL("run.sh", harness)).text();

describe("local InsForge harness", () => {
  test("defines the JWT roles and helpers required by migrations", () => {
    expect(stub).toMatch(/create role anon nologin/i);
    expect(stub).toMatch(/create role authenticated nologin/i);
    expect(stub).toMatch(/create role project_admin nologin bypassrls nosuperuser nocreaterole;/i);
    expect(stub).toMatch(/create function auth\.uid\(\) returns uuid/i);
    expect(stub).toContain("request.jwt.claims");
    expect(stub).toMatch(/alter default privileges for role project_admin in schema public/i);
    expect(stub).toMatch(/on tables to anon, authenticated;/i);
    expect(stub).not.toMatch(
      /\b(?:create|alter)\s+role\s+project_admin\b[^;]*\b(?:superuser|createrole)\b/i
    );
    expect(stub).not.toMatch(/\bgrant\s+(?:anon|authenticated)\b[^;]*\bto\s+project_admin\b/i);
  });

  test("applies migrations in timestamp order and propagates SQL failures", () => {
    expect(runner).toContain("export LC_ALL=C");
    expect(runner).toContain("unset GLOBSORT");
    expect(runner).toContain('for file in "$migrations_dir"/*.sql');
    expect(runner).toMatch(/run_sql migrate "\$file" -1 -c 'SET ROLE project_admin'/);
    expect(runner).toContain("-v ON_ERROR_STOP=1");
    expect(runner).toContain("failed=$((failed + 1))");
    expect(runner).toContain('exit "$((failed > 0))"');
  });
});
