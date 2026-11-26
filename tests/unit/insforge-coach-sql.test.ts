import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  new URL("../../insforge/migrations/20261126171800_tempo-coach.sql", import.meta.url)
).text();
const fixture = await Bun.file(new URL("../../insforge/tests/coach.sql", import.meta.url)).text();
const sql = migration.replace(/\s+/g, " ");

describe("InsForge coach SQL contract", () => {
  test("stores owned conversations with millisecond timestamps and stable import IDs", () => {
    const columns = migration.match(/create table public\.conversations \(\n([\s\S]+?)\n\);/)?.[1];
    expect(columns).toContain("user_id uuid not null references auth.users(id)");
    expect(columns).toContain("title text not null");
    expect(columns).toContain("technique text");
    expect(columns).toContain("unique (user_id, id)");
    expect(columns).toContain("created_at bigint not null");
    expect(columns).toContain("updated_at bigint not null");
    expect(columns).toContain("deleted_at bigint");
    expect(columns).toContain("legacy_convex_id text unique");
    expect(sql).toContain(
      "on public.conversations (user_id, updated_at desc, id) where deleted_at is null;"
    );
  });

  test("limits messages to display text and typed metadata, with a same-owner parent", () => {
    const columns = migration.match(/create table public\.messages \(\n([\s\S]+?)\n\);/)?.[1];
    expect(columns?.split("\n").map((line) => line.trim())).toEqual([
      "id uuid primary key default pg_catalog.gen_random_uuid(),",
      "user_id uuid not null,",
      "conversation_id uuid not null,",
      "role text not null check (role in ('user', 'assistant', 'system')),",
      "content text,",
      "model_used text,",
      "created_at bigint not null,",
      "updated_at bigint not null,",
      "deleted_at bigint,",
      "legacy_convex_id text unique,",
      "foreign key (user_id, conversation_id) references public.conversations (user_id, id)",
    ]);
    expect(sql).toContain(
      "on public.messages (user_id, conversation_id, deleted_at, created_at, id);"
    );
    expect(sql).toContain(
      "crisis-check input, transient reply input, and provider payloads stay in memory"
    );
  });

  test("exposes only live rows to their active owner, including the parent of every message", () => {
    for (const table of ["conversations", "messages"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
      expect(sql).toContain(
        `create policy ${table}_select_own on public.${table} for select to authenticated`
      );
      expect(sql.match(new RegExp(`create policy ${table}_select_own[^;]+`))?.[0]).toMatch(
        /using \( ?user_id = \(select auth\.uid\(\)\) and deleted_at is null and public\.account_is_active\(\)/
      );
    }
    expect(sql).toContain(
      "where conversation.user_id = messages.user_id and conversation.id = messages.conversation_id and conversation.deleted_at is null"
    );
  });

  test("keeps writes with the project service role, with no client write grants or policies", () => {
    expect(sql).toContain(
      "revoke all on public.conversations, public.messages from public, anon, authenticated;"
    );
    expect(sql.match(/grant [^;]+;/g)).toEqual([
      "grant select on public.conversations, public.messages to authenticated;",
      "grant select, insert, update on public.conversations, public.messages to project_admin;",
    ]);
    expect(sql).not.toMatch(/for (?:all|insert|update|delete) to (?:anon|authenticated|public)\b/);
  });

  test("routes only owner change notifications through the existing publisher", () => {
    for (const table of ["conversations", "messages"]) {
      expect(sql).toContain(
        `create trigger ${table}_publish_owner_change after insert or update on public.${table} ` +
          "for each row execute function public.publish_owner_change();"
      );
    }
    expect(sql).toContain(
      "pattern in ('conversations:%', 'messages:%') and realtime.channel_name() = " +
        "pg_catalog.split_part(pattern, ':', 1) || ':' || (select auth.uid())::text and public.account_is_active()"
    );
  });

  test("supplies rollback-only service, owner, other-account, inactive and anonymous fixtures", () => {
    expect(fixture).toStartWith("begin;\n");
    expect(fixture.trimEnd()).toEndWith("rollback;");
    expect(fixture).not.toMatch(/\bcommit\s*;/i);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("exception when foreign_key_violation");
    expect(fixture).toContain("exception when check_violation");
    expect(fixture.match(/exception when insufficient_privilege/g)).toHaveLength(5);
    expect(fixture).toContain("is distinct from array['q78-metadata', 'q78-reply']");
    expect(fixture).toContain("set is_active = false");
  });
});
