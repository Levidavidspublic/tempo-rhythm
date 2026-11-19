import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const workflow = readFileSync(
  join(import.meta.dir, "../../.github/workflows/google-style.yml"),
  "utf8",
);

describe("google-style workflow", () => {
  test("leaves formatting to Biome while preserving the gts ESLint gate", () => {
    expect(workflow).not.toMatch(/\bprettier\s+.*--check/);
    expect(workflow).toContain("/tmp/gts/node_modules/.bin/eslint");
    expect(workflow).toContain("--rule 'prettier/prettier: off'");
  });
});
