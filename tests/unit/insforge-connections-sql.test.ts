import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../insforge/migrations/20261126172700_tempo-connections.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(
  new URL("../../insforge/tests/connections.sql", import.meta.url),
  "utf8"
);
const tables = [
  "connections",
  "connection_secrets",
  "connection_limits",
  "connection_calls",
  "oauth_clients",
  "oauth_pending",
];

describe("InsForge connections SQL contract", () => {
  test.each(tables)("stores %s with soft deletion and an idempotent legacy import key", (table) => {
    const definition = sql.match(new RegExp(`create table public\\.${table} \\(.*?\\);`))?.[0];
    expect(definition).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(definition).toContain("created_at bigint not null");
    expect(definition).toContain("updated_at bigint not null");
    expect(definition).toContain("deleted_at bigint");
    expect(definition).toContain("legacy_convex_id text unique");
    expect(sql).toContain(`alter table public.${table} enable row level security;`);
  });

  test("allows only status columns for the signed-in, active, approved owner", () => {
    expect(sql.match(/create policy [^;]+;/g)).toEqual([
      "create policy connections_select_own on public.connections for select to authenticated " +
        "using ( user_id = (select auth.uid()) and deleted_at is null and public.account_is_active() " +
        "and exists ( select 1 from public.account_gate as gate where gate.user_id = connections.user_id " +
        "and (gate.approval_status = 'approved' or gate.role = 'admin') ) );",
    ]);

    const qualifiedTables = tables.map((table) => `public.${table}`).join(", ");
    expect(sql).toContain(`revoke all on ${qualifiedTables} from public, anon, authenticated;`);
    expect(sql.match(/grant [^;]+;/g)).toEqual([
      "grant select (id, user_id, provider, status, connected_at, last_used_at, account_label) " +
        "on public.connections to authenticated;",
      `grant select, insert, update on ${qualifiedTables} to project_admin;`,
    ]);
  });

  test("stores only OAuth hashes and encrypted credential material", () => {
    expect(sql).toContain("access_token_cipher text, refresh_token_cipher text");
    expect(sql).toContain("client_secret_cipher text");
    expect(sql).toContain("code_verifier_cipher text");
    expect(sql).toContain("state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$')");
    expect(sql).toContain(
      "confirm_nonce_hash text unique check (confirm_nonce_hash ~ '^[0-9a-f]{64}$')"
    );
    expect(sql).not.toMatch(
      /\b(?:access_token|refresh_token|client_secret|code_verifier|state|confirm_nonce) (?:text|bytea)\b/
    );
  });

  test("preserves staged reconnects and prevents duplicate usable rows and cross-owner links", () => {
    expect(sql).toContain(
      "check (status in ('pending_confirm', 'connected', 'needs_reauth', 'unavailable', 'revoking', 'disconnected'))"
    );
    expect(sql).toContain(
      "create unique index connections_one_usable_provider_idx on public.connections (user_id, provider) " +
        "where deleted_at is null and status in ('connected', 'needs_reauth', 'unavailable');"
    );
    expect(sql).toContain(
      "create unique index oauth_clients_live_issuer_redirect_idx on public.oauth_clients " +
        "(issuer, redirect_uri) where deleted_at is null;"
    );
    expect(sql).toContain("connection_id uuid not null unique");
    expect(
      sql.match(
        /foreign key \(user_id, connection_id\) references public\.connections \(user_id, id\)/g
      )
    ).toHaveLength(2);
  });

  test("keeps limits per owner and records call metadata without provider payloads", () => {
    expect(sql).toContain(
      "user_id uuid not null unique references auth.users(id) on delete cascade, connect_window_start_ms bigint"
    );
    expect(sql).toContain("disconnect_generation bigint not null default 0");
    expect(sql).toContain("check (kind in ('tool_call', 'disconnect'))");
    expect(sql).toContain("check (decision in ('auto', 'approved', 'rejected', 'blocked'))");
    expect(sql).toContain(
      "check (outcome in ('ok', 'error', 'approval_required', 'timeout', 'rate_limited', 'unauthorized', 'revoked', 'not_revoked'))"
    );
    expect(sql).toContain(
      "input_digest text check (input_digest ~ '^[0-9a-f]{64}$'), result_bytes bigint"
    );
    expect(sql).not.toMatch(/\b(?:input|output|payload|result|response) (?:text|jsonb?|bytea)\b/);
  });

  test("includes rollback-only fixtures for service writes and owner, other-account, and anon reads", () => {
    expect(fixture).toStartWith("begin;\n");
    expect(fixture.trimEnd()).toEndWith("rollback;");
    expect(fixture).not.toMatch(/\bcommit\s*;/i);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("is distinct from array['connected']");
    expect(fixture).toContain("is distinct from array['needs_reauth']");
    expect(fixture).toContain("set is_active = false");
    expect(fixture).toContain("set approval_status = 'pending'");
    expect(fixture).toContain("exception when foreign_key_violation");
    expect(fixture).toContain("exception when unique_violation");
    expect(fixture.match(/exception when insufficient_privilege/g)).toHaveLength(5);
    for (const table of tables.slice(1)) {
      expect(fixture).toContain(`'${table}'`);
    }
  });
});
