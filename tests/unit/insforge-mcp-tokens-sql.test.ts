import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../insforge/migrations/20261127150000_tempo-mcp-tokens.sql", import.meta.url),
  "utf8"
);

describe("canonical InsForge MCP token migration", () => {
  test("defines neither client nor delete policies and does not hook into realtime", () => {
    expect(migration).not.toMatch(/\b(?:create|alter)\s+policy\b/i);
    expect(migration).not.toMatch(/\brealtime\s*\.|\bpublish_owner_change\b/i);
  });

  test("references only the auth owner, with no composite foreign key", () => {
    const references = [...migration.matchAll(/\breferences\s+([^,\n]+)/gi)];
    expect(references.map(([, target]) => target.trim())).toEqual([
      "auth.users(id) on delete cascade",
    ]);
  });
});
