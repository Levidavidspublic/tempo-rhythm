import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflow = readFileSync(
  join(import.meta.dir, "../../.github/workflows/google-style.yml"),
  "utf8"
);

describe("google-style workflow", () => {
  test("splits formatting ownership without leaving non-workspace files unchecked", () => {
    expect(workflow).toContain("@biomejs/biome@2.3.8");
    expect(workflow).toContain(
      "mapfile -t biome_f < <(printf '%s\\n' \"${f[@]}\" | grep -E '^(apps|packages)/' || true)"
    );
    expect(workflow).toContain(
      "mapfile -t prettier_f < <(printf '%s\\n' \"${f[@]}\" | grep -vE '^(apps|packages)/' || true)"
    );
    expect(workflow).toContain(
      "/tmp/gts/node_modules/.bin/biome format"
    );
    expect(workflow).toContain(
      '--config-path="$GITHUB_WORKSPACE/packages/config/biome.json" "${rel[@]}"'
    );
    expect(workflow).toMatch(
      /prettier --config \/tmp\/gts\/node_modules\/gts\/\.prettierrc\.tempo\.json \\\n\s+--check "\$\{prettier_f\[@\]\/\#\/\$GITHUB_WORKSPACE\/\}"/
    );
    expect(workflow).toContain("/tmp/gts/node_modules/.bin/eslint");
    expect(workflow).toContain('"${f[@]/#/$GITHUB_WORKSPACE/}"');
    expect(workflow).toContain("--rule 'prettier/prettier: off'");

    const filters = workflow
      .split("\n")
      .filter(line => /mapfile -t (biome_f|prettier_f)/.test(line))
      .map(line => line.trim())
      .join("\n");
    const result = spawnSync(
      "bash",
      [
        "-c",
        `f=(apps/web/page.tsx packages/ui/card.tsx packages/ui/convex/_generated/api.ts tests/unit/check.ts root.ts)
${filters}
printf 'biome:%s\\n' "\${biome_f[*]}"
printf 'prettier:%s\\n' "\${prettier_f[*]}"`
      ],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "biome:apps/web/page.tsx packages/ui/card.tsx packages/ui/convex/_generated/api.ts\n" +
        "prettier:tests/unit/check.ts root.ts\n"
    );
  });
});
