import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126163600_tempo-page-ledger.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");
const fixture = readFileSync(
  new URL("../../insforge/tests/page-ledger.sql", import.meta.url),
  "utf8"
);
const operations = migration.match(/create table public\.page_operations \([^;]+;/)?.[0];
const payloads = migration.match(/create table public\.page_operation_payloads \([^;]+;/)?.[0];

describe("InsForge page ledger (static SQL contract)", () => {
  test.each([operations, payloads])(
    "preserves ownership, audit timestamps and legacy IDs",
    (sql) => {
      expect(sql).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
      expect(sql).toContain("user_id uuid not null references auth.users(id)");
      expect(sql).toContain("created_at bigint not null");
      expect(sql).toContain("updated_at bigint not null check (updated_at between created_at");
      expect(sql).toContain("deleted_at bigint");
      expect(sql).toContain("legacy_convex_id text unique");
    }
  );

  test("keeps receipt metadata and its delta content-free", () => {
    expect(operations).not.toMatch(/\b(payload|splices|body|inserted_text|removed_text)\b/);
    expect(operations).toContain("check (public.page_operation_delta_is_valid(delta))");
    expect(migration).toContain(
      "entry - array['startUtf16', 'removedLengthUtf16', 'insertedLengthUtf16'] <> '{}'::jsonb"
    );
    for (const field of ["startUtf16", "removedLengthUtf16", "insertedLengthUtf16"]) {
      expect(migration).toContain(
        `pg_catalog.jsonb_typeof(entry->'${field}') is distinct from 'number'`
      );
    }
    expect(migration).toContain("pg_catalog.jsonb_array_length(delta) > 64");
    expect(migration).toContain("splice_start <= previous_end");
    expect(migration).toContain("total_length > 262144");
  });

  test("reserves an owner-scoped ULID and checks all three lowercase SHA-256 digests", () => {
    expect(operations).toContain("unique (user_id, request_id)");
    expect(operations).toContain("request_id collate \"C\" ~ '^req_[0-7][0-9A-HJKMNP-TV-Z]{25}$'");
    for (const field of ["request_digest", "base_body_digest", "result_body_digest"]) {
      expect(operations).toContain(`${field} collate "C" ~ '^[0-9a-f]{64}$'`);
    }
  });

  test("distinguishes real revisions, noops, and Undo receipts", () => {
    expect(operations).toContain("kind in ('save', 'patch_block', 'add_task', 'undo')");
    expect(operations).toContain("source in ('ui', 'coach', 'mcp', 'legacy')");
    expect(operations).toContain("result in ('applied', 'noop')");
    expect(operations).toContain("result_revision between 0 and 9007199254740990");
    expect(operations).toContain(
      "result_revision = base_revision and result_body_digest = base_body_digest"
    );
    expect(operations).toContain(
      "result_revision = base_revision + 1 and result_body_digest <> base_body_digest"
    );
    expect(operations).toContain("(kind = 'undo') = (undo_of_operation_id is not null)");
    expect(operations).toContain("(undone_at_ms is null) = (undone_by_operation_id is null)");
    expect(operations).toContain("undone_at_ms >= applied_at_ms and undone_at_ms < undo_until_ms");
  });

  test("keeps both Undo and cleanup deadlines at five minutes and receipt retention at 48 hours", () => {
    expect(operations).toContain(
      "undo_until_ms is not null and undo_until_ms = applied_at_ms + 300000"
    );
    expect(operations).toContain("metadata_expires_at_ms = applied_at_ms + 172800000");
    expect(payloads).toContain("cleanup_due_at_ms = undo_until_ms + 300000");
    expect(migration).toContain("on public.page_operations (metadata_expires_at_ms, id)");
    expect(migration).toContain("on public.page_operation_payloads (cleanup_due_at_ms, id)");
  });

  test("constrains links to the same owner and page, and payloads to eligible receipts", () => {
    expect(operations).toContain(
      "foreign key (user_id, note_id) references public.notes (user_id, id)"
    );
    for (const field of ["undone_by_operation_id", "undo_of_operation_id"]) {
      expect(operations).toContain(
        `foreign key (user_id, note_id, ${field}) references public.page_operations (user_id, note_id, id)`
      );
    }
    expect(payloads).toContain("unique (user_id, operation_id)");
    expect(payloads).toContain(
      "foreign key (user_id, note_id, operation_id, undo_until_ms) references public.page_operations (user_id, note_id, id, undo_until_ms)"
    );
  });

  test("keeps fragment data separate and requires a content-free expired marker", () => {
    expect(payloads).toContain("check (public.page_operation_payload_is_valid(payload))");
    expect(migration).toContain("payload - array['state', 'expiredAtMs'] <> '{}'::jsonb");
    expect(migration).toContain("payload - array['state', 'splices'] <> '{}'::jsonb");
    expect(migration).toContain(
      "pg_catalog.jsonb_array_length(payload->'splices') not between 1 and 64"
    );
    expect(migration).toContain("fragment_bytes > 262144");
  });

  test("allows only active owners with live notes to read live receipts", () => {
    expect(migration).toContain("alter table public.page_operations enable row level security;");
    expect(migration).toContain(
      "revoke all on table public.page_operations from public, anon, authenticated;"
    );
    expect(migration.match(/grant [^;]+ on table public\.page_operations [^;]+;/g)).toEqual([
      "grant select on table public.page_operations to authenticated;",
    ]);
    expect(migration.match(/create policy [^;]+ on public\.page_operations [^;]+;/g)).toEqual([
      "create policy page_operations_select_own on public.page_operations for select to authenticated using ( user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null and exists ( select 1 from public.notes where notes.user_id = page_operations.user_id and notes.id = page_operations.note_id and notes.deleted_at is null ) );",
    ]);
  });

  test("revokes client payload access and never adds a policy, grant, or realtime publisher", () => {
    expect(migration).toContain(
      "alter table public.page_operation_payloads enable row level security;"
    );
    expect(migration).toContain(
      "revoke all on table public.page_operation_payloads from public, anon, authenticated;"
    );
    expect(migration).not.toMatch(/(?:create policy|grant)[^;]*\bpage_operation_payloads\b/);
    expect(migration).not.toMatch(/\brealtime\b|\bpublish_owner_change\b/);
  });

  test("ships a rollback fixture for authorization and constraint failures", () => {
    expect(fixture.trim()).toMatch(/^begin;[\s\S]*rollback;$/);
    for (const failure of [
      "Active owner could not read exactly their own receipt",
      "Owner could select private payloads",
      "Owner had direct ledger write privileges",
      "Deleted receipt was visible",
      "Receipt on deleted note was visible",
      "Restored receipt and note did not restore visibility",
      "Inactive owner could read receipt",
      "Anonymous user could select receipts",
      "Anonymous user could select private payloads",
      "Operation accepted a foreign note",
      "Duplicate owner request was accepted",
      "Operation accepted a noncanonical digest",
      "Operation delta accepted content",
      "Operation accepted the wrong receipt expiry",
      "Undo receipt accepted no target",
      "Payload could disagree with its receipt deadline",
      "Noop operation accepted a payload",
      "Expired payload could retain fragments",
    ]) {
      expect(fixture).toContain(`raise exception '${failure}`);
    }
  });
});
