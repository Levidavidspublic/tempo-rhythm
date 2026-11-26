import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126171900_tempo-memories.sql", import.meta.url),
  "utf8"
);
const fixture = readFileSync(new URL("../../insforge/tests/memories.sql", import.meta.url), "utf8");
const ownerGate = "(user_id = (select auth.uid()) and public.account_is_active())";

test("defines private owner-linked memory rows with epoch milliseconds and import provenance", () => {
  expect(migration).toContain("create table public.memories (");
  expect(migration).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
  expect(migration).toContain("user_id uuid not null references auth.users(id) on delete cascade");
  expect(migration).toContain("content text not null");
  expect(migration).toContain(
    "sector in ('semantic', 'episodic', 'procedural', 'emotional', 'general')"
  );
  expect(migration).toContain("salience double precision not null");
  expect(migration).toContain("decay_rate double precision not null");
  expect(migration).toContain("access_count bigint not null check (access_count >= 0)");
  for (const column of ["last_accessed", "created_at", "updated_at"]) {
    expect(migration).toContain(`${column} bigint not null`);
  }
  expect(migration).toContain("legacy_convex_id text unique");
  expect(migration).toContain(
    "source text check (source in ('chatgpt', 'claude', 'grok', 'other'))"
  );
  expect(migration).toContain("imported_at bigint,");
  expect(migration).toContain(
    "visibility text not null default 'private' check (visibility = 'private')"
  );
});

test("indexes live and recoverable owner rows without introducing vector or raw payload storage", () => {
  expect(migration).toContain("deleted_at bigint,");
  expect(migration).not.toContain("deleted_at bigint not null");
  expect(migration).toContain(
    "on public.memories (user_id, deleted_at, salience desc, updated_at desc);"
  );
  expect(migration).not.toMatch(
    /\b(?:vector|hnsw|ivfflat|embedding|match_memories|jsonb|bytea)\b/i
  );
  expect(migration).not.toMatch(/\b(?:transcript|raw_message|raw_payload)\b/i);
});

test("limits client access to active-owner select, insert, and update, with no hard delete", () => {
  expect(migration).toContain("alter table public.memories enable row level security;");
  const clientGrants = migration.match(/^grant .*;$/gm);
  expect(clientGrants).toEqual([
    "grant select, insert, update on public.memories to authenticated;",
  ]);
  expect(migration).toContain("revoke all on public.memories from public, anon, authenticated;");
  expect(
    migration.match(/create policy[^;]+;/g)?.map((policy) => policy.replace(/\s+/g, " "))
  ).toEqual([
    `create policy memories_select_own on public.memories for select to authenticated using ${ownerGate};`,
    `create policy memories_insert_own on public.memories for insert to authenticated with check ${ownerGate};`,
    `create policy memories_update_own on public.memories for update to authenticated using ${ownerGate} with check ${ownerGate};`,
  ]);
});

test("includes a rollback-only policy fixture for service, owner and denied clients", () => {
  expect(fixture).toMatch(/^begin;$/m);
  expect(fixture.trimEnd()).toEndWith("rollback;");
  expect(fixture).not.toMatch(/^commit;/im);
  expect(fixture).toContain("set local role project_admin;");
  expect(fixture).toContain("set local role authenticated;");
  expect(fixture).toContain("set local role anon;");
  expect(fixture).toContain("where id = other_row");
  expect(fixture).toContain("set user_id = other_id");
  expect(fixture).toContain("set deleted_at = null");
  expect(fixture).toContain("set is_active = false");
  expect(fixture).toContain("exception when insufficient_privilege then");
  expect(fixture).toContain("exception when check_violation then");
});
