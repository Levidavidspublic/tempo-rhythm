import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const workflow = readFileSync(
  join(import.meta.dir, "../../.github/workflows/google-style.yml"),
  "utf8",
);

describe("google-style workflow", () => {
  test("splits formatting ownership without leaving non-workspace files unchecked", () => {
    expect(workflow).toContain(
      "mapfile -t prettier_f < <(printf '%s\\n' \"${f[@]}\" | grep -vE '^(apps|packages)/' || true)",
    );
    expect(workflow).toMatch(
      /prettier --config \/tmp\/gts\/node_modules\/gts\/\.prettierrc\.tempo\.json \\\n\s+--check "\$\{prettier_f\[@\]\/\#\/\$GITHUB_WORKSPACE\/\}"/,
    );
    expect(workflow).toContain("/tmp/gts/node_modules/.bin/eslint");
    expect(workflow).toContain('"${f[@]/#/$GITHUB_WORKSPACE/}"');
    expect(workflow).toContain("--rule 'prettier/prettier: off'");
  });
});
