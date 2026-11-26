import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../insforge/migrations/20261127030000_tempo-approval-gate.sql",
  import.meta.url
);
const sql = (await Bun.file(migration).text()).replace(/^\s*--.*$/gm, "");

describe("approval gate SQL", () => {
  test("requires approval in the existing account activity function", () => {
    const definition = sql.match(
      /create or replace function public\.account_is_active\(\)\s+returns boolean\s+language sql\s+stable\s+security definer\s+set search_path = public\s+as \$\$([\s\S]*?)\$\$;/i
    );

    expect(definition?.[1]).toMatch(/\band\s+approval_status\s*=\s*'approved'/i);
  });

  test("does not add any policies, including a delete policy", () => {
    expect(sql).not.toMatch(/\bcreate\s+policy\b/i);
  });
});
