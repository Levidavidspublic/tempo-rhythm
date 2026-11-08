/**
 * HARD_RULES §2 — forbidden-tech scan. Zero tolerance.
 *
 * Fails (exit 1) when a forbidden package appears as a dependency in any
 * workspace `package.json`, or is imported from application source code.
 *
 * Run: `bun run scan:forbidden-tech`
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..");

/** Exact package names (and scope prefixes ending in "/") from HARD_RULES §2. */
const forbiddenPackages = [
  // Backend-as-a-Service
  "firebase",
  "firebase-admin",
  "@firebase/",
  "@supabase/",
  "supabase",
  // ORMs
  "prisma",
  "@prisma/",
  "drizzle-orm",
  "drizzle-kit",
  "typeorm",
  "mongoose",
  // Auth
  "auth0",
  "@auth0/",
  "@clerk/",
  "next-auth",
  "better-auth",
  // Payments (direct Stripe SDK; RevenueCat wraps it)
  "stripe",
  "@stripe/",
  // AI provider SDKs (Mistral API goes through native fetch)
  "openai",
  "@anthropic-ai/",
  "@google/generative-ai",
  "@mistralai/",
  // Client state
  "redux",
  "@reduxjs/",
  "react-redux",
  "zustand",
  "jotai",
  "recoil",
  "mobx",
  "mobx-react",
  // HTTP
  "axios",
  "ky",
  "got",
  // Direct DB clients
  "mongodb",
  "pg",
  "mysql2",
] as const;

const sourceRoots = ["apps", "packages", "convex"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const skipDirs = new Set(["node_modules", ".next", ".expo", "dist", "build", "_generated", ".turbo"]);

function isForbidden(name: string): string | undefined {
  for (const forbidden of forbiddenPackages) {
    if (forbidden.endsWith("/")) {
      if (name.startsWith(forbidden)) return forbidden;
    } else if (name === forbidden) {
      return forbidden;
    }
  }
  return undefined;
}

const violations: string[] = [];

// 1. Dependency declarations in every workspace package.json.
const manifests = ["package.json", "apps/web/package.json", "apps/mobile/package.json"];
const packagesDir = path.join(repoRoot, "packages");
if (fs.existsSync(packagesDir)) {
  for (const entry of fs.readdirSync(packagesDir)) {
    manifests.push(path.join("packages", entry, "package.json"));
  }
}
for (const manifest of manifests) {
  const abs = path.join(repoRoot, manifest);
  if (!fs.existsSync(abs)) continue;
  const pkg = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, Record<string, string>>;
  for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      const hit = isForbidden(name);
      if (hit) violations.push(`${manifest} declares forbidden package "${name}" (${section}, rule: ${hit})`);
    }
  }
}

// 2. Import specifiers in application source.
const importPattern = /(?:from\s+|require\(\s*|import\(\s*)["']([^"'\n]+)["']/g;
function scanFile(absPath: string, relPath: string): void {
  const content = fs.readFileSync(absPath, "utf8");
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1] as string;
    if (specifier.startsWith(".") || specifier.startsWith("node:") || specifier.startsWith("@/")) continue;
    const packageName = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : (specifier.split("/")[0] as string);
    const hit = isForbidden(packageName);
    if (hit) violations.push(`${relPath} imports forbidden package "${specifier}" (rule: ${hit})`);
  }
}

function walk(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      const abs = path.join(dir, entry.name);
      scanFile(abs, path.relative(repoRoot, abs));
    }
  }
}

for (const root of sourceRoots) {
  const abs = path.join(repoRoot, root);
  if (fs.existsSync(abs)) walk(abs);
}

if (violations.length > 0) {
  console.error("scan:forbidden-tech FAILED — HARD_RULES §2 violations:");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("scan:forbidden-tech OK — no forbidden dependencies or imports found.");
