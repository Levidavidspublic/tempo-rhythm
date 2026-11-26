import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  new URL("../../insforge/migrations/20261126173000_tempo-mcp-tokens.sql", import.meta.url)
).text();
const fixture = (
  await Bun.file(new URL("../../insforge/tests/mcp-tokens.sql", import.meta.url)).text()
)
  .replace(/^--.*$/gm, "")
  .trim();

describe("InsForge MCP token SQL contract", () => {
  test("stores only ownership, digest, display, rate limit and lifecycle metadata", () => {
    const columns = [...migration.matchAll(/^ {2}(?!constraint\b)(\w+) (\w+)\b/gm)];
    expect(columns.map(([, name, type]) => `${name} ${type}`)).toEqual([
      "id uuid",
      "user_id uuid",
      "name text",
      "token_hash text",
      "prefix text",
      "last_used_at bigint",
      "revoked_at bigint",
      "window_start_ms bigint",
      "window_count integer",
      "created_at bigint",
      "updated_at bigint",
      "deleted_at bigint",
      "legacy_convex_id text",
    ]);
    expect(migration).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade"
    );
    expect(migration).toContain("legacy_convex_id text unique");
  });

  test("requires a unique SHA-256 digest and allows only a short display prefix", () => {
    expect(migration).toContain(
      "token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$')"
    );
    expect(migration).toContain("prefix text not null check (prefix ~ '^tmcp_[A-Za-z0-9_-]{3}$')");
    expect(migration).toContain("on public.mcp_tokens (user_id, created_at desc);");
  });

  test("rejects incomplete rate windows and enforces the 120-call cap", () => {
    expect(migration).toContain("(window_start_ms is null and window_count is null)");
    expect(migration).toContain(
      "(window_start_ms is not null and window_count is not null and window_count between 1 and 120)"
    );
  });

  test("enables RLS without client grants, policies, or realtime publication", () => {
    expect(migration).toContain("alter table public.mcp_tokens enable row level security;");
    expect(migration).toContain(
      "revoke all on table public.mcp_tokens from public, anon, authenticated;"
    );
    expect(migration).not.toMatch(/\b(create policy|grant|create trigger|publication)\b/i);
  });

  test("ships rollback-only service and denied client fixtures", () => {
    expect(fixture).toMatch(/^begin;[\s\S]*\brollback;$/);
    expect(fixture).not.toMatch(/\bcommit\s*;/i);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("where user_id = owner_id and token_hash = owner_digest");
    expect(fixture).toContain("exception when unique_violation");
    expect(fixture).toContain("exception when check_violation");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("current_setting('q90.owner_id')");
    expect(fixture).toContain("current_setting('q90.other_id')");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("exception when insufficient_privilege");
  });
});
