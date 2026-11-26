import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261126165700_tempo-focus-blocks.sql", import.meta.url),
  "utf8"
).replace(/\s+/g, " ");

const fixture = readFileSync(
  new URL("../../insforge/tests/focus-blocks.sql", import.meta.url),
  "utf8"
);

describe("InsForge focus blocks SQL contract (static)", () => {
  test("stores an owned epoch-ms row with bounded duration and optional label and task", () => {
    expect(migration).toContain("create table public.focus_blocks (");
    expect(migration).toContain("id uuid primary key default pg_catalog.gen_random_uuid()");
    expect(migration).toContain("user_id uuid not null references auth.users(id)");
    expect(migration).toContain("started_at_ms bigint not null");
    expect(migration).toContain(
      "duration_ms bigint not null check (duration_ms between 1 and 28800000)"
    );
    expect(migration).toContain(
      "label text check (pg_catalog.char_length(label) between 1 and 120)"
    );
    expect(migration).toContain("task_id uuid references public.tasks(id)");
    expect(migration).toContain(
      "created_at bigint not null, updated_at bigint not null, deleted_at bigint,"
    );
    expect(migration).toContain("legacy_convex_id text unique");
  });

  test("indexes owner, soft-delete status and start time for descending range reads", () => {
    expect(migration).toContain("on public.focus_blocks (user_id, deleted_at, started_at_ms desc)");
  });

  test("allows only authenticated active owners to select, insert and update", () => {
    const ownerGate = "user_id = (select auth.uid()) and public.account_is_active()";
    expect(migration).toContain("alter table public.focus_blocks enable row level security");
    expect(migration).toContain(`for select to authenticated using (${ownerGate})`);
    expect(migration).toContain(`for insert to authenticated with check ( ${ownerGate}`);
    expect(migration).toContain(
      `for update to authenticated using (${ownerGate}) with check (${ownerGate})`
    );
    expect(migration).toContain(
      "revoke all on public.focus_blocks from public, anon, authenticated"
    );
    expect(migration).toContain("grant select, insert on public.focus_blocks to authenticated");
    expect(migration).toContain(
      "grant update (deleted_at) on public.focus_blocks to authenticated"
    );
    expect(migration).not.toMatch(/\bfor (?:all|delete)\b/i);
  });

  test("accepts only live new blocks with no task or a live task from the same owner", () => {
    expect(migration).toContain("and deleted_at is null and ( task_id is null or exists (");
    expect(migration).toContain("where task.id = focus_blocks.task_id");
    expect(migration).toContain("and task.user_id = focus_blocks.user_id");
    expect(migration).toContain("and task.deleted_at is null");
  });

  test("stamps deletion and permits only a first delete or a restore within 30 days", () => {
    expect(migration).toContain("before update of deleted_at on public.focus_blocks");
    expect(migration).toContain("for each row when (current_user = 'authenticated')");
    expect(migration).toContain("if old.deleted_at is not null then raise check_violation");
    expect(migration).toContain("new.deleted_at := now_ms");
    expect(migration).toContain("old.deleted_at is null or old.deleted_at < now_ms - 2592000000");
    expect(migration).toContain("new.updated_at := now_ms");
  });

  test("ships separate rollback fixtures for reads, access denials and lifecycle constraints", () => {
    expect(fixture).toMatch(/^begin;[\s\S]*rollback;\s*$/);
    expect(fixture).toContain("[100, 300)");
    expect(fixture).toContain("Recent soft delete should be reversible");
    expect(fixture).toContain("Restore outside the 30-day grace window must be denied");
    expect(fixture).toContain("Linking a foreign or deleted task must be denied");
    expect(fixture).toContain("An out-of-bounds duration must be denied");
    expect(fixture).toContain("Hard delete must be denied");
    expect(fixture).toContain("Inactive accounts must not read even their own blocks");
    expect(fixture).toContain("Anonymous reads must be denied");
  });
});
