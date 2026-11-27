import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261127170000_tempo-whop-events.sql", import.meta.url),
  "utf8"
);

describe("canonical InsForge Whop events migration", () => {
  test("defines neither client nor delete policies and does not hook into realtime", () => {
    expect(migration).not.toMatch(/\b(?:create|alter)\s+policy\b/i);
    expect(migration).not.toMatch(/\brealtime\s*\.|\bpublish_owner_change\b/i);
  });

  test("does not add an owner foreign key to the provider event ledger", () => {
    expect(migration).not.toMatch(/\breferences\b/i);
  });
});
