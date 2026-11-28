import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertSafeOutDir } from "../../scripts/build-standalone";

function repo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tempo-out-"));
}

test("rejects the filesystem root", () => {
  expect(() => assertSafeOutDir("/", repo())).toThrow(/filesystem root/);
});

test("rejects a path outside the repository", () => {
  const root = repo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "tempo-out-other-"));
  expect(() => assertSafeOutDir(outside, root)).toThrow(/outside the repository/);
});

test("rejects the repository root", () => {
  const root = repo();
  expect(() => assertSafeOutDir(root, root)).toThrow(/repository/);
});

test("accepts dist/hostinger", () => {
  const root = repo();
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  expect(() => assertSafeOutDir(path.join(root, "dist", "hostinger"), root)).not.toThrow();
});
