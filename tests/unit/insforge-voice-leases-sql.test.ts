import { describe, expect, test } from "bun:test";

const migration = (
  await Bun.file(
    new URL("../../insforge/migrations/20261126172500_tempo-voice-leases.sql", import.meta.url)
  ).text()
).replace(/\s+/g, " ");
const fixture = (
  await Bun.file(new URL("../../insforge/tests/voice-leases.sql", import.meta.url)).text()
)
  .replace(/^--.*$/gm, "")
  .trim();

describe("InsForge voice lease SQL contract", () => {
  test("stores only lease metadata with Auth ownership and import identity", () => {
    const columns = [
      ...migration.matchAll(/(?:\(|,)\s+(\w+) (?:uuid|text|bigint|date|integer)\b/g),
    ];
    expect(columns.map(([, name]) => name)).toEqual([
      "id",
      "user_id",
      "conversation_id",
      "client_key",
      "status",
      "language",
      "started_at",
      "last_renewal_at",
      "expires_at",
      "ended_at",
      "duration_ms",
      "end_reason",
      "date_key",
      "utc_date_key",
      "grants",
      "sentences",
      "tts_chars",
      "created_at",
      "updated_at",
      "deleted_at",
      "legacy_convex_id",
    ]);
    expect(migration).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade"
    );
    expect(migration).toContain("legacy_convex_id text unique");
  });

  test("denies all client table access, including the owner, and publishes no realtime", () => {
    expect(migration).toContain("alter table public.voice_leases enable row level security;");
    expect(migration).toContain(
      "revoke all on table public.voice_leases from public, anon, authenticated;"
    );
    expect(migration).not.toMatch(/\b(create policy|grant|create trigger|publish_owner_change)\b/i);
  });

  test("serializes active rows per owner without blocking ended or soft-deleted rows", () => {
    expect(migration).toContain(
      "create unique index voice_leases_one_active_per_owner on public.voice_leases (user_id) " +
        "where status = 'active' and deleted_at is null;"
    );
    expect(migration).toContain("on public.voice_leases (user_id, date_key);");
    expect(migration).toContain("on public.voice_leases (utc_date_key);");
  });

  test("bounds heartbeats by the session window and derives expiry from both limits", () => {
    expect(migration).toContain(
      "constraint voice_leases_heartbeat_bounds check ( last_renewal_at between started_at and " +
        "started_at + 900000 and last_renewal_at <= updated_at )"
    );
    expect(migration).toContain(
      "expires_at bigint generated always as ( least(last_renewal_at + 45000, started_at + 900000) ) stored"
    );
  });

  test("rejects incomplete or inconsistent end metadata", () => {
    expect(migration).toContain(
      "(status = 'active' and ended_at is null and duration_ms is null and end_reason is null)"
    );
    expect(migration).toContain(
      "status = 'ended' and ended_at is not null and duration_ms is not null and end_reason is not null"
    );
    expect(migration).toContain("ended_at between started_at and expires_at");
    expect(migration).toContain("duration_ms = ended_at - started_at");
  });

  test("ships rollback-only SQL assertions for service, both client identities and anon", () => {
    expect(fixture).toMatch(/^begin;[\s\S]*\brollback;$/);
    expect(fixture).not.toMatch(/\bcommit\s*;/i);
    expect(fixture).toContain("set local role project_admin;");
    expect(fixture).toContain("exception when unique_violation");
    expect(fixture).toContain("exception when check_violation");
    expect(fixture).toContain("set local role authenticated;");
    expect(fixture).toContain("current_setting('q85.owner_id')");
    expect(fixture).toContain("current_setting('q85.other_id')");
    expect(fixture).toContain("set local role anon;");
    expect(fixture).toContain("exception when insufficient_privilege");
  });
});
