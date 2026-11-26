import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  new URL(
    "../../insforge/migrations/20261126173200_tempo-whop-membership-events.sql",
    import.meta.url
  )
).text();
const fixture = (
  await Bun.file(new URL("../../insforge/tests/whop-membership-events.sql", import.meta.url)).text()
)
  .replace(/^--.*$/gm, "")
  .trim();

describe("InsForge Whop membership events SQL contract", () => {
  test("stores only the mapped event metadata and epoch millisecond timestamps", () => {
    const table = migration.match(
      /create table public\.whop_membership_events \(\n([\s\S]+?)\n\);/
    )?.[1];
    expect(table).toBeDefined();
    const columns = [...(table ?? "").matchAll(/^ {2}(\w+) (\w+)\b/gm)];
    expect(columns.map(([, name, type]) => `${name} ${type}`)).toEqual([
      "event_id text",
      "membership_id text",
      "event_type text",
      "status text",
      "plan_id text",
      "product_id text",
      "whop_user_id text",
      "cancel_at_period_end boolean",
      "event_timestamp bigint",
      "received_at bigint",
    ]);
    expect(migration).toContain("event_timestamp bigint not null");
    expect(migration).toContain(
      "received_at bigint not null default (extract(epoch from pg_catalog.now()) * 1000)::bigint"
    );
  });

  test("uses the delivery ID as a global conflict target and indexes provider time per membership", () => {
    expect(migration).toContain(
      "event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{1,128}$')"
    );
    expect(migration).toContain(
      "membership_id text not null check (membership_id ~ '^[A-Za-z0-9_-]{1,128}$')"
    );
    expect(migration).toContain("(membership_id, event_timestamp desc);");
    expect(fixture).toContain("on conflict (event_id) do nothing;");
    expect(fixture).toContain("order by event_timestamp desc limit 1;");
  });

  test("rejects event types and statuses that the Whop mapper does not accept", () => {
    expect(migration).toContain("event_type text not null check");
    expect(migration).toContain(
      "event_type in ('membership.activated', 'membership.updated', 'membership.deactivated')"
    );
    expect(migration).toContain("status text not null check");
    expect(migration).toContain(
      "status in ('trialing', 'active', 'past_due', 'completed', 'canceled', 'expired', 'unresolved')"
    );
    expect(fixture).toContain("exception when check_violation");
  });

  test("enables RLS and exposes no policies, client grants or realtime feed", () => {
    expect(migration).toContain(
      "alter table public.whop_membership_events enable row level security;"
    );
    expect(migration).toContain(
      "revoke all on table public.whop_membership_events from public, anon, authenticated;"
    );
    expect(migration).not.toMatch(/\b(create policy|grant|create trigger|publication)\b/i);
  });

  test("ships rollback-only assertions for service access and denied owner, other and anon access", () => {
    expect(fixture).toMatch(/^begin;[\s\S]*\brollback;$/);
    expect(fixture).not.toMatch(/\bcommit\s*;/i);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("whop_user_id = owner_id::text");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("current_setting('q92.owner_id')");
    expect(fixture).toContain("current_setting('q92.other_id')");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("exception when insufficient_privilege");
  });
});
