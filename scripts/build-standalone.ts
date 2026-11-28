/**
 * Build the Tempo web app with Bun and assemble a Hostinger Node.js bundle.
 *
 * The bundle is a Next.js standalone server: server.js at the folder root,
 * traced node_modules, .next/static and public next to the real server.
 * Hostinger runs it as application type "other" with entry server.js.
 * It does not deploy, and it does not write a deploy branch.
 *
 * Run from the repo root, with the build-time names set (values are not printed):
 *   bun scripts/build-standalone.ts [out-dir]
 * Default out dir: dist/hostinger (gitignored). Also writes dist/hostinger.tgz
 * beside that folder when the default is used, or <out-dir>.tgz otherwise.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRel = "apps/web";
const appDir = path.join(repoRoot, appRel);

const BUILD_PUBLIC = [
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_DATA_BACKEND",
  "NEXT_PUBLIC_ENABLE_PASSKEYS",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_INSFORGE_ANON_KEY",
  "NEXT_PUBLIC_INSFORGE_URL",
  "NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID",
  "NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID",
  "NEXT_PUBLIC_PRIVACY_URL",
  "NEXT_PUBLIC_TERMS_URL",
] as const;

const NEVER_ON = [
  "TEMPO_E2E_AUTH_BYPASS",
  "NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS",
  "TEMPO_E2E_PUBLIC_CALENDAR",
] as const;

function die(message: string): never {
  throw new Error(message);
}

function assertSafeOutDir(out: string): void {
  const root = path.resolve(repoRoot);
  if (out === root || root.startsWith(`${out}${path.sep}`)) {
    die("Refusing output directory: it is the repository or a parent of it.");
  }
  const rel = path.relative(root, out);
  const inside = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (!inside) return;
  if (rel.split(path.sep)[0] !== "dist") {
    die("Refusing output directory inside the repository unless it is under dist/.");
  }
}

function unset(names: readonly string[]): string[] {
  return names.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });
}

const bypassOn = NEVER_ON.filter((name) => process.env[name] === "1");
if (bypassOn.length > 0) {
  die(`Refusing to build: ${bypassOn.join(", ")} is 1. Never bake the e2e bypass.`);
}

const missing = unset(BUILD_PUBLIC);
if (missing.length > 0) {
  die(`Refusing to build. Set these names (values are not printed): ${missing.join(", ")}`);
}

const outDir = path.resolve(process.argv[2] ?? path.join(repoRoot, "dist/hostinger"));
const tarball = `${outDir}.tgz`;
assertSafeOutDir(outDir);

const build = spawnSync("bun", ["run", "--filter=tempo-rhythm-web", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
if (build.status !== 0) {
  die(`bun build failed (exit ${build.status ?? "signal"})`);
}

const standaloneDir = path.join(appDir, ".next", "standalone");
if (!fs.existsSync(standaloneDir)) {
  die(`No standalone output at ${path.relative(repoRoot, standaloneDir)}`);
}

function findServer(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findServer(full));
    else if (entry.name === "server.js") found.push(full);
  }
  return found;
}

const servers = findServer(standaloneDir);
const preferred = servers.find((file) => file.endsWith(`${path.sep}${appRel}${path.sep}server.js`));
const serverSrc = preferred ?? (servers.length === 1 ? servers[0] : undefined);
if (serverSrc === undefined) {
  die(
    servers.length === 0
      ? "standalone output has no server.js"
      : `More than one server.js and none under ${appRel}`
  );
}

function danglingLinks(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
      if (!fs.existsSync(target)) found.push(full);
      continue;
    }
    if (entry.isDirectory()) found.push(...danglingLinks(full));
  }
  return found;
}

function repairDangling(bundle: string) {
  const bundleModules = path.join(bundle, "node_modules");
  const repoModules = path.join(repoRoot, "node_modules");
  for (const link of danglingLinks(bundle)) {
    const missing = path.resolve(path.dirname(link), fs.readlinkSync(link));
    const rel = path.relative(bundleModules, missing);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      die(`dangling link outside the bundle node_modules: ${path.relative(bundle, link)}`);
    }
    const source = path.join(repoModules, rel);
    if (!fs.existsSync(source)) {
      die(`cannot repair ${path.relative(bundle, link)}; node_modules/${rel} is not in the repo`);
    }
    fs.mkdirSync(path.dirname(missing), { recursive: true });
    fs.cpSync(source, missing, { recursive: true, dereference: true });
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const copied = spawnSync("cp", ["-a", `${standaloneDir}/.`, outDir], { stdio: "inherit" });
if (copied.status !== 0) die(`cp of standalone failed (exit ${copied.status ?? "signal"})`);
repairDangling(outDir);

const serverRel = path.relative(standaloneDir, serverSrc);
const serverDestDir = path.dirname(path.join(outDir, serverRel));
const staticSrc = path.join(appDir, ".next", "static");
if (!fs.existsSync(staticSrc)) die("Build produced no .next/static");
fs.cpSync(staticSrc, path.join(serverDestDir, ".next", "static"), { recursive: true });
const publicSrc = path.join(appDir, "public");
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, path.join(serverDestDir, "public"), { recursive: true });
}

const rootServer = path.join(outDir, "server.js");
if (path.resolve(serverDestDir, "server.js") !== path.resolve(rootServer)) {
  const rel = path
    .relative(outDir, path.join(serverDestDir, "server.js"))
    .split(path.sep)
    .join("/");
  fs.writeFileSync(
    rootServer,
    `"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const server = path.join(__dirname, ${JSON.stringify(rel)});
const child = spawn(process.execPath, [server], { stdio: "inherit", env: process.env });
function stopChild(signal) {
  if (!child.killed) child.kill(signal);
}
process.on("SIGTERM", () => stopChild("SIGTERM"));
process.on("SIGINT", () => stopChild("SIGINT"));
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code === null ? 1 : code);
});
`
  );
}

const pkgPath = path.join(outDir, "package.json");
const pkg = fs.existsSync(pkgPath)
  ? (JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
      engines?: Record<string, string>;
    })
  : {};
pkg.scripts = { ...(pkg.scripts ?? {}), start: "node server.js" };
pkg.engines = { ...(pkg.engines ?? {}), node: "24" };
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

fs.rmSync(tarball, { force: true });
const tar = spawnSync("tar", ["-czf", tarball, "-C", path.dirname(outDir), path.basename(outDir)], {
  stdio: "inherit",
});
if (tar.status !== 0) die(`tar failed (exit ${tar.status ?? "signal"})`);

function bytes(target: string): number {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) return stat.size;
  let total = stat.size;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    total += bytes(path.join(target, entry.name));
  }
  return total;
}

console.log(`bundle ${outDir}`);
console.log(`bundle_bytes ${bytes(outDir)}`);
console.log(`tarball ${tarball}`);
console.log(`tarball_bytes ${fs.statSync(tarball).size}`);
console.log(`entry server.js -> ${serverRel.split(path.sep).join("/")}`);
