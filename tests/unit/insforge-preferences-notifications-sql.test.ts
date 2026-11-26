import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../insforge/migrations/20261126170900_tempo-preferences-notifications.sql",
    import.meta.url
  ),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(
  new URL("../../insforge/tests/preferences-notifications.sql", import.meta.url),
  "utf8"
);

describe("InsForge preferences and notifications SQL contract (static)", () => {
  test("stores one live preference row per owner and preserves the legacy defaults", () => {
    expect(migration).toContain("create table public.user_preferences");
    expect(migration).toContain(
      "user_id uuid not null default auth.uid() references auth.users(id)"
    );
    expect(migration).toContain("on public.user_preferences (user_id) where deleted_at is null");
    expect(migration).toContain("create unique index user_preferences_live_owner_idx");
    expect(migration).toContain("default 'system' check (theme in ('system', 'light', 'dark'))");
    expect(migration).toContain("default 'en' check (locale in ('en', 'he'))");
    expect(migration).toContain("default 1 check (week_starts_on in (0, 1, 6))");
    expect(migration).toContain("default 'UTC' check (time_zone ~ '[^[:space:]]')");
    expect(migration).toContain("email_reminders boolean not null default true");
    expect(migration).toContain("in_app_notifications boolean not null default true");
    expect(migration).toContain("coach_web_search boolean not null default false");
    expect(migration.match(/deleted_at bigint, legacy_convex_id text unique/g)).toHaveLength(2);
  });

  test("limits preference patches to active owners and editable fields", () => {
    const ownerGuard = "user_id = (select auth.uid()) and public.account_is_active()";
    const liveOwner = `${ownerGuard} and deleted_at is null`;
    const fields =
      "theme, locale, week_starts_on, time_zone, email_reminders, " +
      "in_app_notifications, coach_web_search";
    expect(migration).toContain("alter table public.user_preferences enable row level security");
    expect(migration).toContain(`for select to authenticated using (${liveOwner})`);
    expect(migration).toContain(`for insert to authenticated with check (${liveOwner})`);
    expect(migration).toContain(
      `for update to authenticated using (${liveOwner}) with check (${liveOwner})`
    );
    expect(migration).toContain(
      `grant insert (user_id, ${fields}) on public.user_preferences to authenticated`
    );
    expect(migration).toContain(
      `grant update (${fields}) on public.user_preferences to authenticated`
    );
    expect(migration).toContain(
      "new.updated_at := trunc(extract(epoch from statement_timestamp())"
    );
  });

  test("indexes live and unread inboxes and reserves direct notice writes for service", () => {
    expect(migration).toContain("create table public.notifications");
    expect(migration).toContain(
      "kind text not null check (kind in ('system', 'reminder', 'billing'))"
    );
    expect(migration).toContain("read_at bigint, created_at bigint not null, updated_at bigint");
    expect(migration).toContain("on public.notifications (user_id, created_at desc, id)");
    expect(migration).toContain("where deleted_at is null and read_at is null");
    expect(migration).toContain("alter table public.notifications enable row level security");
    expect(migration).toContain(
      "revoke all on public.user_preferences, public.notifications from public, anon, authenticated"
    );
    expect(migration.match(/create policy \w+ on public\.notifications\b[^;]+;/g)).toEqual([
      "create policy notifications_select_own on public.notifications for select to authenticated " +
        "using (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null);",
    ]);
    expect(migration.match(/grant [^;]+ on [^;]*public\.notifications[^;]*;/g)).toEqual([
      "grant select on public.user_preferences, public.notifications to authenticated;",
      "grant select, insert, update on public.user_preferences, public.notifications to project_admin;",
    ]);
  });

  test("single and bulk marks derive the actor from auth and stamp only unread live rows", () => {
    const functions = [
      "public.mark_notification_read(notification_id uuid)",
      "public.mark_all_notifications_read()",
    ];
    const guard =
      "user_id = (select auth.uid()) and public.account_is_active() " +
      "and deleted_at is null and read_at is null";
    for (const [index, signature] of functions.entries()) {
      const body = migration.split(`create function ${signature}`)[1]?.split("$$;")[0];
      expect(body).toContain(
        "returns integer language sql security definer set search_path = pg_catalog"
      );
      expect(body).toContain("update public.notifications set read_at = stamp.now_ms");
      expect(body).toContain("updated_at = stamp.now_ms");
      expect(body).toContain(`where ${index === 0 ? "id = notification_id and " : ""}${guard}`);
      expect(body).toContain("select count(*)::integer from marked");
    }
    const signatures = "public.mark_notification_read(uuid), public.mark_all_notifications_read()";
    expect(migration).toContain(`revoke execute on function ${signatures} from public, anon`);
    expect(migration).toContain(`grant execute on function ${signatures} to authenticated`);
  });

  test("reuses the owner-only realtime trigger and registers only the two scoped channels", () => {
    for (const table of ["user_preferences", "notifications"]) {
      expect(migration).toContain(`pattern = '${table}:%'`);
      expect(migration).toContain(
        `realtime.channel_name() = '${table}:' || (select auth.uid())::text`
      );
      expect(migration).toContain(
        `after insert or update on public.${table} for each row ` +
          "execute function public.publish_owner_change()"
      );
    }
    expect(migration).toContain("on realtime.channels for select to authenticated");
    expect(migration).toContain("using ( public.account_is_active() and ( (pattern =");
  });

  test("ships rollback-only SQL fixtures for owner, service and denied clients", () => {
    expect(fixture).toMatch(/^begin;[\s\S]*rollback;\s*$/);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("An owner cannot create another account preference row");
    expect(fixture).toContain("A blank time zone must be denied");
    expect(fixture).toContain("Client notice creation must be denied");
    expect(fixture).toContain("Foreign, deleted, missing and null ids must not mark any notices");
    expect(fixture).toContain(
      "Bulk mark must count only this owner''s remaining live unread notices"
    );
    expect(fixture).toContain(
      "An inactive owner must not read preferences or read and mark notices"
    );
    expect(fixture).toContain("Anonymous mark requests must be denied");
  });
});
