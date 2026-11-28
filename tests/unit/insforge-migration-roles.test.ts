import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

const directory = new URL("../../insforge/migrations/", import.meta.url);

describe("InsForge migration owner privileges", () => {
  test("never revokes ALL, TRIGGER, or REFERENCES from project_admin", () => {
    const violations: string[] = [];

    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".sql"))) {
      const sql = readFileSync(new URL(filename, directory), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/--[^\n]*/g, " ");

      for (const [statement, privileges, grantees] of sql.matchAll(
        /\brevoke\s+([^;]+?)\s+on\s+[^;]+?\s+from\s+([^;]+);/gi
      )) {
        if (
          /(?:^|,)\s*(?:group\s+)?"?project_admin"?\s*(?=,|$|cascade\b|restrict\b)/i.test(
            grantees
          ) &&
          /(?:^|,)\s*(?:grant\s+option\s+for\s+)?(?:all|trigger|references)\b/i.test(privileges)
        ) {
          violations.push(`${filename}: ${statement.replace(/\s+/g, " ")}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
