import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as blockSpecByName from "@tempo/ui/blocks/block-spec";
import * as catalogByName from "@tempo/ui/blocks/catalog";
import * as decisionStepsByName from "@tempo/ui/blocks/decision-steps";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as blockSpecByPath from "./block-spec";
import * as catalogByPath from "./catalog";
import * as decisionStepsByPath from "./decision-steps";

/**
 * TEMPO-B06-SUPPORT-UI-DEPS (redone as v3/ui-block-exports, was PR #896). Proves the preflight for the block registry (#789):
 * the block modules load through explicit `@tempo/ui/blocks/*` package exports, and `react-dom`
 * resolves inside `packages/ui` at the exact version `apps/web` pins, so a render test works here.
 * Imports by package name are package self-references: Bun resolves `@tempo/ui/...` from this
 * package's own `package.json` `exports`, so no `node_modules/@tempo/ui` link is needed here.
 */

const UI_DIR = join(import.meta.dir, "..", "..");
const REPO_DIR = join(UI_DIR, "..", "..");
const WEB_DIR = join(REPO_DIR, "apps", "web");

type Manifest = {
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version?: string;
};

function readJson(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

const uiManifest = readJson(join(UI_DIR, "package.json"));
const webManifest = readJson(join(WEB_DIR, "package.json"));

/** The installed `react-dom` that a module in `fromDir` gets, as a real path and its version. */
function installedReactDom(fromDir: string): { dir: string; version: string | undefined } {
  const fromRequire = createRequire(join(fromDir, "package.json"));
  const manifestPath = realpathSync(fromRequire.resolve("react-dom/package.json"));
  return { dir: join(manifestPath, ".."), version: readJson(manifestPath).version };
}

/** Where a package-name import from this test file resolves to. */
const resolveFromHere = createRequire(import.meta.path).resolve;

const BLOCK_EXPORTS = {
  "./blocks/catalog": "./src/blocks/catalog.ts",
  "./blocks/block-spec": "./src/blocks/block-spec.ts",
  "./blocks/decision-steps": "./src/blocks/decision-steps.tsx",
} as const;

describe("@tempo/ui block exports", () => {
  test("the manifest names each block module explicitly, with no wildcard or barrel", () => {
    const exportsMap = uiManifest.exports ?? {};
    for (const [key, target] of Object.entries(BLOCK_EXPORTS)) {
      expect(exportsMap[key]).toBe(target);
    }
    const blockKeys = Object.keys(exportsMap).filter((key) => key.startsWith("./blocks"));
    expect(blockKeys.sort()).toEqual(Object.keys(BLOCK_EXPORTS).sort());
    expect(Object.keys(exportsMap).some((key) => key.includes("*"))).toBe(false);
    // Every exported block module exists on disk (the registry export arrives with #789, not before).
    for (const target of Object.values(BLOCK_EXPORTS)) {
      expect(existsSync(join(UI_DIR, target))).toBe(true);
    }
  });

  test("@tempo/ui/blocks/catalog loads the catalog module by package name", () => {
    expect(resolveFromHere("@tempo/ui/blocks/catalog")).toBe(
      join(UI_DIR, "src", "blocks", "catalog.ts")
    );
    expect(catalogByName.tempoBlockCatalog).toBeDefined();
    expect(catalogByName.tempoBlockCatalog).toBe(catalogByPath.tempoBlockCatalog);
    expect([...catalogByName.BLOCK_COMPONENT_TYPES]).toEqual([
      ...catalogByPath.BLOCK_COMPONENT_TYPES,
    ]);
    expect(catalogByName.JSON_RENDER_VERSION).toBe("0.21.0");
  });

  test("@tempo/ui/blocks/block-spec loads the spec adapter by package name", () => {
    expect(resolveFromHere("@tempo/ui/blocks/block-spec")).toBe(
      join(UI_DIR, "src", "blocks", "block-spec.ts")
    );
    expect(typeof blockSpecByName.safeBlockSpec).toBe("function");
    expect(blockSpecByName.safeBlockSpec).toBe(blockSpecByPath.safeBlockSpec);
    expect(typeof blockSpecByName.tempoBlockToSpec).toBe("function");
    // Garbage in gives the fixed fallback card, through the package-name import.
    const fallback = blockSpecByName.safeBlockSpec({ root: "nope" });
    expect(fallback).toEqual(blockSpecByPath.brokenBlockSpec("invalid_spec"));
  });

  test("@tempo/ui/blocks/decision-steps loads the decision card's steps by package name", () => {
    expect(resolveFromHere("@tempo/ui/blocks/decision-steps")).toBe(
      join(UI_DIR, "src", "blocks", "decision-steps.tsx")
    );
    expect(decisionStepsByName.DecisionSteps).toBe(decisionStepsByPath.DecisionSteps);
    expect(decisionStepsByName.DECISION_LIMITS).toEqual({ minSteps: 2, maxSteps: 7 });
  });
});

describe("react-dom inside @tempo/ui", () => {
  test("the manifest pins react-dom exactly like apps/web and declares it as a peer", () => {
    const webPin = webManifest.dependencies?.["react-dom"];
    expect(webPin).toBe("19.2.3");
    expect(uiManifest.devDependencies?.["react-dom"]).toBe(webPin);
    expect(uiManifest.peerDependencies?.["react-dom"]).toBe("^19.0.0");
    expect(uiManifest.peerDependencies?.react).toBe("^19.0.0");
    expect(uiManifest.dependencies?.["react-dom"]).toBeUndefined();
  });

  test("react-dom resolves here at the pinned version, the same install apps/web uses", () => {
    const fromUi = installedReactDom(UI_DIR);
    const fromWeb = installedReactDom(WEB_DIR);
    expect(fromUi.version).toBe(uiManifest.devDependencies?.["react-dom"]);
    expect(fromUi.version).toBe("19.2.3");
    expect(fromUi.dir).toBe(fromWeb.dir);
  });

  test("react-dom/server renders a React element from inside packages/ui", () => {
    const markup = renderToStaticMarkup(
      createElement("p", { dir: "auto" }, "Plan the morning & rest")
    );
    expect(markup).toBe('<p dir="auto">Plan the morning &amp; rest</p>');
  });
});
