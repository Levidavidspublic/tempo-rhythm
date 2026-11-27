import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261127070000_tempo-habits.sql", import.meta.url),
  "utf8"
);

describe("canonical InsForge habits migration", () => {
  test("defines only explicit select, insert and update policies per table", () => {
    const policies = [...migration.matchAll(/\bcreate\s+policy\b[^;]+;/gi)];
    expect(
      policies.map(([policy]) => policy.match(/\bfor\s+(\w+)/i)?.[1]?.toLowerCase()).sort()
    ).toEqual(["insert", "insert", "select", "select", "update", "update"]);
  });

  test("does not define a realtime policy", () => {
    expect(migration).not.toMatch(/\b(?:create|alter)\s+policy\b[^;]+\bon\s+"?realtime"?\s*\./i);
  });

  test("orders the habits key and the check-in foreign key by owner first", () => {
    expect(migration).toMatch(/\bunique\s*\(\s*user_id\s*,\s*id\s*\)/i);
    expect(migration).toMatch(
      /\bforeign\s+key\s*\(\s*user_id\s*,\s*habit_id\s*\)\s+references\s+public\.habits\s*\(\s*user_id\s*,\s*id\s*\)/i
    );
  });
});
