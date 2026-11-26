import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126163500_tempo-notes.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(new URL("../../insforge/tests/notes.sql", import.meta.url), "utf8");
const noteTables = ["notes", "note_blocks"];
const ownership = "user_id = (select auth.uid()) and public.account_is_active()";
const liveParent = [
  "and exists ( select 1 from public.notes",
  "where notes.user_id = note_blocks.user_id and notes.id = note_blocks.note_id",
  "and notes.deleted_at is null )",
].join(" ");

describe("InsForge notes and note blocks (static SQL contract)", () => {
  test.each(noteTables)("keeps %s owner-scoped, restorable, and importable", (table) => {
    const definition = migration.match(new RegExp(`create table public\\.${table} \\([^;]+;`))?.[0];
    expect(definition).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(definition).toContain("user_id uuid not null references auth.users(id)");
    expect(definition).toContain("created_at bigint not null, updated_at bigint not null");
    expect(definition).toContain("deleted_at bigint, legacy_convex_id text unique");
  });

  test("indexes newest and pinned notes and permits one live dated page per owner and kind", () => {
    expect(migration).toContain("period_type in ('daily', 'weekly', 'monthly', 'none')");
    expect(migration).toContain("page_type in ('daily', 'weekly', 'project', 'plain', 'template')");
    expect(migration).toContain("date date, ai_generated boolean");
    expect(migration).toContain("revision bigint check (revision between 0 and 9007199254740990)");
    expect(migration).toContain("on public.notes (user_id, deleted_at, updated_at desc, id)");
    expect(migration).toContain(
      "on public.notes (user_id, updated_at desc, id) where deleted_at is null and pinned"
    );
    expect(migration).toContain(
      "create unique index notes_live_period_date_idx on public.notes (user_id, page_type, date)"
    );
    expect(migration).toContain(
      "where deleted_at is null and page_type in ('daily', 'weekly') and date is not null"
    );
  });

  test("qualifies the note link by owner and indexes block position without losing duplicate IDs", () => {
    expect(migration).toContain("constraint notes_user_id_id_key unique (user_id, id)");
    expect(migration).toContain("note_id uuid not null");
    expect(migration).toContain(
      "foreign key (user_id, note_id) references public.notes (user_id, id)"
    );
    expect(migration).toContain(
      "on public.note_blocks (user_id, note_id, deleted_at, position, id)"
    );
    expect(migration).toContain(
      "create index note_blocks_note_block_id_idx on public.note_blocks (user_id, note_id, block_id)"
    );
    expect(migration).toContain("position integer not null check (position >= 0)");
  });

  test("requires a version-one object or a content-free broken block", () => {
    expect(migration).toContain("type in ('page-meta', 'task', 'template', 'broken')");
    expect(migration).toContain(
      "case when type = 'broken' then v is null and data is null and error_code is not null"
    );
    expect(migration).toContain(
      "else block_id is not null and (v = 1) is true and data is not null"
    );
    expect(migration).toContain("pg_catalog.jsonb_typeof(data) = 'object' and error_code is null");
    expect(migration).toContain("'invalid_data', 'duplicate_id', 'duplicate_page_meta'");
  });

  test.each(noteTables)("allows only active-owner select, insert and update on %s", (table) => {
    const filter = table === "notes" ? `(${ownership})` : `( ${ownership} ${liveParent} )`;
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
    expect(
      migration.match(new RegExp(`create policy [^;]+ on public\\.${table} [^;]+;`, "g"))
    ).toEqual([
      `create policy ${table}_select_own on public.${table} for select to authenticated using ${filter};`,
      `create policy ${table}_insert_own on public.${table} for insert to authenticated with check ${filter};`,
      `create policy ${table}_update_own on public.${table} for update to authenticated using ${filter} with check ${filter};`,
    ]);
  });

  test.each(noteTables)("publishes %s row IDs to exact owner channels", (table) => {
    expect(migration).toMatch(
      /create policy tempo_notes_owner_subscribe on realtime\.channels for select to authenticated using \( public\.account_is_active\(\)/
    );
    expect(migration).toContain(`('${table}:%', 'Per-owner`);
    expect(migration).toContain(
      `pattern = '${table}:%' and realtime.channel_name() = '${table}:' || (select auth.uid())::text`
    );
    expect(migration).toContain(
      `create trigger ${table}_publish_owner_change after insert or update on public.${table}`
    );
    expect(migration).toContain("for each row execute function public.publish_owner_change();");
  });

  test("ships rollback-only fixtures for allow, deny and constraint cases", () => {
    expect(fixture.trim()).toMatch(/^begin;[\s\S]*rollback;$/);
    for (const assertion of [
      "Ordered live block read",
      "Owner could relink a block to a foreign note",
      "An owner-qualified foreign key accepted a foreign note",
      "Two live daily notes used the same owner and date",
      "A valid block lost its required version",
      "A broken block lost its required error code",
      "Soft-deleted parent did not hide its blocks",
      "Note and block restore failed",
      "Owner could hard-delete a note",
      "Owner could hard-delete a block",
      "Owner could subscribe to a foreign",
      "Expected ID-only note and block events",
      "Anonymous notes were visible",
      "An inactive owner could read notes or blocks",
    ]) {
      expect(fixture).toContain(assertion);
    }
  });
});
