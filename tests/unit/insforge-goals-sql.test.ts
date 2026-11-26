import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126165500_tempo-goals.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const statements = migration.split(";").map((statement) => statement.trim());
const fixture = readFileSync(new URL("../../insforge/tests/goals.sql", import.meta.url), "utf8");

describe("InsForge goals SQL contract (static)", () => {
  test("stores the Convex goal shape, with bounded fractional progress and the stored statuses", () => {
    const table = statements.find((statement) =>
      statement.startsWith("create table public.goals ")
    );
    expect(table).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(table).toContain("user_id uuid not null references auth.users(id)");
    expect(table).toContain("title text not null, description text, target_date bigint,");
    expect(table).toContain(
      "created_at bigint not null, updated_at bigint not null, deleted_at bigint"
    );
    expect(table).toContain("legacy_convex_id text unique");
    expect(table).toContain("progress_percent double precision not null default 0");
    expect(table).toContain("check (progress_percent between 0 and 100)");
    expect(table).toContain("status text not null default 'active'");
    expect(table).toContain("check (status in ('active', 'completed', 'archived'))");
  });

  test("indexes newest live goals by owner, with or without a status filter", () => {
    expect(migration).toContain("on public.goals (user_id, deleted_at, updated_at desc);");
    expect(migration).toContain("on public.goals (user_id, deleted_at, status, updated_at desc);");
  });

  test("requires an active owning account to select, insert, or update", () => {
    const owner = "(user_id = (select auth.uid()) and public.account_is_active())";
    expect(statements).toContain("alter table public.goals enable row level security");
    expect(
      statements.filter((statement) => /^create policy .* on public\.goals /.test(statement))
    ).toEqual([
      `create policy goals_select_own on public.goals for select to authenticated using ${owner}`,
      `create policy goals_insert_own on public.goals for insert to authenticated with check ${owner}`,
      `create policy goals_update_own on public.goals for update to authenticated using ${owner} with check ${owner}`,
    ]);
  });

  test("allows soft-delete and restore, but not client changes to identity or hard deletes", () => {
    expect(statements).toContain("revoke all on public.goals from public, anon, authenticated");
    expect(statements.filter((statement) => /^grant .* on public\.goals /.test(statement))).toEqual(
      [
        "grant select on public.goals to authenticated",
        "grant insert (user_id, title, description, target_date, progress_percent, status, created_at, updated_at) on public.goals to authenticated",
        "grant update (title, description, target_date, progress_percent, status, updated_at, deleted_at) on public.goals to authenticated",
      ]
    );
  });

  test("uses the shared publisher and limits subscriptions to the active owner", () => {
    expect(migration).toContain("values ('goals:%', 'Per-owner goal changes (id only)', true)");
    expect(statements).toContain(
      "create policy goals_subscribe_own on realtime.channels for select to authenticated using ( pattern = 'goals:%' and realtime.channel_name() = ('goals:' || (select auth.uid())::text) and public.account_is_active() )"
    );
    expect(statements).toContain(
      "create trigger goals_publish_owner_change after insert or update on public.goals for each row execute function public.publish_owner_change()"
    );
  });

  test("ships rollback fixtures for owner operations, access denials, and invalid values", () => {
    expect(fixture.trim().startsWith("begin;")).toBe(true);
    expect(fixture.trim().endsWith("rollback;")).toBe(true);
    for (const assertion of [
      "Owner cannot read goal defaults",
      "Archived goal is not selectable",
      "Owner cannot soft-delete goal",
      "Owner cannot restore goal",
      "Cross-owner read was allowed",
      "Cross-owner update was allowed",
      "Cross-owner insert was allowed",
      "Client can write protected goal fields",
      "Hard delete was allowed",
      "Invalid stored status was allowed",
      "Out-of-range progress was allowed",
      "Owner cannot select own goals channel",
      "Cross-owner goals channel was allowed",
      "Inactive owner can read own goal",
      "Inactive owner can update own goal",
      "Inactive owner can insert a goal",
      "Inactive owner can select own goals channel",
      "Anonymous read was allowed",
    ]) {
      expect(fixture).toContain(`raise exception '${assertion}';`);
    }
  });
});
