import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  new URL("../../insforge/migrations/20261126165400_tempo-habits.sql", import.meta.url)
).text();
const fixtures = await Bun.file(new URL("../../insforge/tests/habits.sql", import.meta.url)).text();

describe("InsForge habits migration contract (static SQL)", () => {
  test("stores owned habits and check-ins with legacy IDs and epoch-ms audit fields", () => {
    for (const table of ["habits", "habit_check_ins"]) {
      const columns = migration.split(`create table public.${table} (`)[1]?.split("\n);")[0];
      expect(columns).toBeDefined();
      expect(columns).toContain("user_id uuid not null references auth.users(id)");
      expect(columns).toContain("legacy_convex_id text unique");
      expect(columns).toContain("created_at bigint not null");
      expect(columns).toContain("updated_at bigint not null");
      expect(columns).toContain("deleted_at bigint");
    }
    expect(migration).toContain("check (cadence in ('daily', 'weekly'))");
    expect(migration).toContain("current_streak integer not null default 0");
    expect(migration).toContain("longest_streak integer not null default 0");
    expect(migration).toContain("last_completed_at bigint");
    expect(migration).toContain("checked_at bigint not null");
    expect(migration).toContain("check (source in ('habits', 'today', 'suggestion', 'legacy'))");
  });

  test("constrains a check-in to a habit with the same owner", () => {
    expect(migration).toContain("unique (id, user_id)");
    expect(migration).toContain(
      "foreign key (habit_id, user_id) references public.habits (id, user_id)"
    );
  });

  test("makes each calendar day unique only while a check-in is live", () => {
    expect(migration).toContain("local_date date not null");
    expect(migration).toMatch(
      /create unique index \w+\s+on public\.habit_check_ins \(habit_id, local_date\) where deleted_at is null;/
    );
    expect(migration).toContain("on public.habit_check_ins (user_id, deleted_at, local_date)");
    expect(migration).toContain("on public.habit_check_ins (habit_id, deleted_at, local_date)");
  });

  test("requires an active owner to select, insert, or update, without granting hard deletes", () => {
    const ownerCheck = "user_id = (select auth.uid()) and public.account_is_active()";
    for (const table of ["habits", "habit_check_ins"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
      const policies = [
        ...migration.matchAll(new RegExp(`create policy \\w+ on public\\.${table}[^;]+;`, "g")),
      ];
      expect(policies).toHaveLength(3);
      const [select, insert, update] = policies.map(([policy]) =>
        policy.replace(/\s+/g, " ").replace(/\( /g, "(")
      );
      expect(select).toContain(`for select to authenticated using (${ownerCheck})`);
      expect(insert).toContain(`for insert to authenticated with check (${ownerCheck}`);
      expect(update).toContain(
        `for update to authenticated using (${ownerCheck}) with check (${ownerCheck}`
      );
    }
  });

  test("rejects check-in writes against archived habits or another owner's habit", () => {
    for (const action of ["insert", "update"]) {
      const policy = migration
        .split(`create policy habit_check_ins_${action}_own`)[1]
        ?.split(";")[0];
      expect(policy?.split("with check")[1]).toMatch(
        /exists \(\s+select 1 from public\.habits\s+where id = habit_check_ins\.habit_id and user_id = habit_check_ins\.user_id\s+and deleted_at is null/
      );
    }
  });

  test("registers owner-only realtime channels for inserts and updates", () => {
    for (const table of ["habits", "habit_check_ins"]) {
      expect(migration).toContain(`('${table}:%',`);
      expect(migration).toContain(
        `after insert or update on public.${table}\n  for each row execute function public.publish_owner_change();`
      );
    }
    expect(migration).toContain("alter table realtime.channels enable row level security;");
    expect(migration).toContain("for select to authenticated\n  using (\n    pattern in");
    expect(migration).toContain(
      "realtime.channel_name() = pg_catalog.split_part(pattern, ':', 1) || ':' || (select auth.uid())::text"
    );
  });

  test("provides rollback fixtures for ownership, duplicate, and soft-delete cases", () => {
    expect(fixtures).toMatch(/^begin;[\s\S]+rollback;\s*$/);
    expect(fixtures).toContain("set local role authenticated;");
    expect(fixtures).toContain("set local role anon;");
    expect(fixtures).toContain("exception when foreign_key_violation");
    expect(fixtures).toContain("exception when insufficient_privilege");
    expect(fixtures).toContain("exception when unique_violation");
    expect(fixtures).toContain("exception when check_violation");
    expect(fixtures).toContain("exception when datetime_field_overflow");
    expect(fixtures).toContain("set deleted_at = 2, updated_at = 2");
    expect(fixtures).toContain("set deleted_at = null, updated_at = 5");
  });
});
