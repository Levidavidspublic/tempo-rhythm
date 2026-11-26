import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126165800_tempo-calendar-events.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(
  new URL("../../insforge/tests/calendar-events.sql", import.meta.url),
  "utf8"
);

describe("InsForge calendar events migration (static SQL contract)", () => {
  test("preserves owner, import identity, title and epoch millisecond lifecycle fields", () => {
    expect(migration).toContain("create table public.calendar_events (");
    expect(migration).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(migration).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade"
    );
    expect(migration).toContain("title text not null check (title ~ '[^[:space:]]')");
    expect(migration).toContain(
      "created_at bigint not null, updated_at bigint not null, deleted_at bigint"
    );
    expect(migration).toContain("legacy_convex_id text unique");
  });

  test("accepts a legacy timed point or a strictly ordered span in exactly one time representation", () => {
    expect(migration).toContain(
      "starts_at_ms bigint, ends_at_ms bigint, start_date date, end_date date"
    );
    expect(migration).toMatch(
      /constraint calendar_events_schedule_check check \( \( starts_at_ms is not null and start_date is null and end_date is null and \(ends_at_ms is null or ends_at_ms > starts_at_ms\) \) or \( starts_at_ms is null and ends_at_ms is null and start_date is not null and end_date is not null and end_date > start_date \) \)/
    );
  });

  test("has separate owner-scoped live indexes with stable tie breakers", () => {
    expect(migration).toContain("calendar_events_user_id_idx on public.calendar_events (user_id)");
    expect(migration).toContain(
      "on public.calendar_events (user_id, starts_at_ms, id) where deleted_at is null and starts_at_ms is not null"
    );
    expect(migration).toContain(
      "on public.calendar_events (user_id, start_date, id) where deleted_at is null and start_date is not null"
    );
  });

  test("limits table policies to active owner reads, inserts and updates, including restores", () => {
    const owner = "(user_id = (select auth.uid()) and public.account_is_active())";
    expect(migration).toContain("alter table public.calendar_events enable row level security;");
    expect(migration.match(/create policy [^;]+ on public\.calendar_events [^;]+;/g)).toEqual([
      `create policy calendar_events_select_own on public.calendar_events for select to authenticated using ${owner};`,
      `create policy calendar_events_insert_own on public.calendar_events for insert to authenticated with check ${owner};`,
      `create policy calendar_events_update_own on public.calendar_events for update to authenticated using ${owner} with check ${owner};`,
    ]);
  });

  test("publishes inserts and updates to a dedicated channel with exact owner matching", () => {
    expect(migration).toContain(
      "values ('calendar_events:%', 'Per-owner calendar event changes (id only)', true)"
    );
    expect(migration).toContain(
      "for select to authenticated using ( pattern = 'calendar_events:%' and realtime.channel_name() = 'calendar_events:' || (select auth.uid())::text and public.account_is_active() );"
    );
    expect(migration).toContain(
      "after insert or update on public.calendar_events for each row execute function public.publish_owner_change();"
    );
  });

  test("ships rollback fixtures for range reads, access denials and the soft-delete lifecycle", () => {
    expect(fixture.trim()).toMatch(/^begin;[\s\S]*rollback;$/);
    expect(fixture).toContain("insert into auth.users");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("and starts_at_ms < 1795654800000");
    expect(fixture).toContain("and start_date < date '2026-11-27'");
    expect(fixture).toContain("set deleted_at = 2");
    expect(fixture).toContain("set deleted_at = null");
    expect(fixture).toContain("Owner could hard-delete an event");
    expect(fixture).toContain("Owner could update a neighbor event");
    expect(fixture).toContain("Owner could insert a neighbor event");
    expect(fixture).toContain("Owner could transfer event ownership");
    expect(fixture).toContain("Owner could subscribe to a neighbor calendar channel");
    expect(fixture).toContain("Anonymous role could read calendar events");
    expect(fixture).toContain("Inactive owner could read calendar events");
    expect(fixture).toContain("Inactive owner could insert calendar events");
    expect(fixture.match(/exception when insufficient_privilege/g)).toHaveLength(3);
  });

  test("ships negative fixtures for missing, mixed and reversed schedules and blank titles", () => {
    expect(fixture).toContain("(null::bigint, null::bigint, null::date, null::date)");
    expect(fixture).toContain("(1000, null, date '2026-11-26', date '2026-11-27')");
    expect(fixture).toContain("(1000, 999, null, null)");
    expect(fixture).toContain("(null, null, date '2026-11-26', null)");
    expect(fixture).toContain("(null, null, date '2026-11-27', date '2026-11-26')");
    expect(fixture).toContain("rejected_constraint <> 'calendar_events_schedule_check'");
    expect(fixture).toContain("Whitespace-only event title was accepted");
    expect(fixture.match(/exception when check_violation/g)).toHaveLength(2);
  });
});
