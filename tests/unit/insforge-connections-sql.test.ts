import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261127160000_tempo-connections.sql", import.meta.url),
  "utf8"
);

describe("canonical InsForge connections migration", () => {
  test("defines neither client nor delete policies and does not hook into realtime", () => {
    expect(migration).not.toMatch(/\b(?:create|alter)\s+policy\b/i);
    expect(migration).not.toMatch(/\brealtime\s*\.|\bpublish_owner_change\b/i);
  });

  test("orders the connection key and both owned foreign keys by owner first", () => {
    expect(migration).toMatch(/\bunique\s*\(\s*user_id\s*,\s*id\s*\)/i);
    const ownerLinks = [
      ...migration.matchAll(
        /\bforeign\s+key\s*\(\s*user_id\s*,\s*connection_id\s*\)\s+references\s+public\.connections\s*\(\s*user_id\s*,\s*id\s*\)/gi
      ),
    ];
    expect(ownerLinks).toHaveLength(2);
  });
});
