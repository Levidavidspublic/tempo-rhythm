import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261127060000_tempo-templates.sql", import.meta.url),
  "utf8"
);

describe("canonical InsForge templates migration", () => {
  test("defines only explicit select, insert and update policies", () => {
    const policies = [...migration.matchAll(/\bcreate\s+policy\b[^;]+;/gi)];
    expect(
      policies.map(([policy]) => policy.match(/\bfor\s+(\w+)/i)?.[1]?.toLowerCase()).sort()
    ).toEqual(["insert", "select", "update"]);
  });

  test("does not define a realtime policy", () => {
    expect(migration).not.toMatch(/\b(?:create|alter)\s+policy\b[^;]+\bon\s+"?realtime"?\s*\./i);
  });

  test("has no composite owner foreign key because templates only reference auth users", () => {
    const references = [...migration.matchAll(/\breferences\s+([^,\n]+)/gi)];
    expect(references.map(([, target]) => target.trim())).toEqual([
      "auth.users(id) on delete cascade",
    ]);
  });
});
