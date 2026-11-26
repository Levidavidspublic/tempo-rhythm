import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126163800_tempo-templates.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(
  new URL("../../insforge/tests/templates.sql", import.meta.url),
  "utf8"
);
const ownership = "(user_id = (select auth.uid()) and public.account_is_active())";

describe("InsForge templates (static SQL contract)", () => {
  test("stores private templates with the Convex fields, audit times and legacy identity", () => {
    const table = migration.match(/create table public\.templates \([^;]+;/)?.[0];
    expect(table).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(table).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(table).toContain("name text not null check (name ~ '[^[:space:]]'), description text,");
    expect(table).toContain("period_type text not null check (period_type in (");
    expect(table).toContain("('daily', 'weekly', 'monthly', 'none')");
    expect(table).toContain(
      "body text not null, created_at bigint not null, updated_at bigint not null"
    );
    expect(table).toContain("deleted_at bigint, legacy_convex_id text unique");
  });

  test("keeps starter IDs reserved to the code catalog, with no SQL seed rows", () => {
    expect(migration).toContain("check (legacy_convex_id not like 'starter:%')");
    expect(migration).not.toMatch(/insert into (?:public\.)?templates\b/);
  });

  test("indexes the newest-first live owner list and single-row lookup", () => {
    expect(migration).toContain(
      "create index templates_user_deleted_updated_idx on public.templates (user_id, deleted_at, updated_at desc, id);"
    );
    expect(migration).toContain("id uuid primary key");
  });

  test("restricts reads and writes to active owners, with no hard-delete grant", () => {
    expect(migration).toContain("alter table public.templates enable row level security;");
    expect(migration).toContain("revoke all on public.templates from public, anon, authenticated;");
    expect(migration.match(/grant [^;]+ on public\.templates [^;]+;/g)).toEqual([
      "grant select, insert, update on public.templates to authenticated;",
    ]);
    expect(migration.match(/create policy [^;]+ on public\.templates [^;]+;/g)).toEqual([
      `create policy templates_select_own on public.templates for select to authenticated using ${ownership};`,
      `create policy templates_insert_own on public.templates for insert to authenticated with check ${ownership};`,
      `create policy templates_update_own on public.templates for update to authenticated using ${ownership} with check ${ownership};`,
    ]);
  });

  test("reuses ID-only publishing on the exact active owner channel", () => {
    expect(migration).toContain(
      "values ('templates:%', 'Per-owner template changes (id only)', true)"
    );
    expect(migration).toContain(
      "create policy tempo_templates_owner_subscribe on realtime.channels for select to authenticated"
    );
    expect(migration).toContain(
      "public.account_is_active() and pattern = 'templates:%' and realtime.channel_name() = 'templates:' || (select auth.uid())::text"
    );
    expect(migration).toContain(
      "create trigger templates_publish_owner_change after insert or update on public.templates for each row execute function public.publish_owner_change();"
    );
  });

  test("includes rollback-only fixtures for allowed and denied access and constraints", () => {
    expect(fixture.trim()).toMatch(/^begin;[\s\S]*rollback;$/);
    for (const assertion of [
      "Newest-first live list did not isolate owner templates",
      "Lookup by ID did not isolate owner templates",
      "Active owner could not edit their template",
      "Owner could update a foreign template",
      "Owner could create a template for another user",
      "Owner could transfer template ownership",
      "Unsupported period accepted",
      "Blank template name accepted",
      "User row accepted a reserved starter ID",
      "Duplicate legacy template ID accepted",
      "Soft-deleted template remained in the live selector",
      "Active owner could not restore their template",
      "Owner had a hard-delete privilege",
      "Anonymous templates were visible",
      "Anonymous user could create a template",
      "Inactive owner could read templates",
      "Inactive owner could edit templates",
      "Inactive owner could create a template",
      "Owner could not subscribe to their template channel",
      "Owner could subscribe to a foreign template channel",
      "A non-exact template channel matched",
      "Inactive owner could subscribe to templates",
      "Expected ID-only template events were not published",
    ]) {
      expect(fixture).toContain(assertion);
    }
  });
});
