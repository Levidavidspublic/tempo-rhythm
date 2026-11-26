import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readExport } from "../../tools/convex-import/read-export";

const fixture = fileURLToPath(
  new URL("../../tools/convex-import/fixtures/mini-export/", import.meta.url)
);

async function withExport(run: (path: string) => Promise<void>) {
  const path = await mkdtemp(join(tmpdir(), "convex-export-test-"));
  try {
    await run(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test("reads snapshot rows, empty tables, table manifests, component data and storage metadata", async () => {
  const result = await readExport(fixture);
  expect(result.counts).toEqual({
    _tables: 3,
    _storage: 1,
    tasks: 2,
    taskRepeatCfgs: 0,
    users: 1,
    "_components/agent/_tables": 1,
    "_components/agent/messages": 1,
  });
  expect(result.unknownTables).toEqual([]);
  expect(result.tables.tasks[0]).toEqual({
    _id: "fixture-task-1",
    _creationTime: 1010,
    title: "Water the model fern",
    userId: "fixture-user",
  });
  expect(result.tables.taskRepeatCfgs).toEqual([]);
  expect(result.tableMetadata).toContainEqual({ id: 10002, name: "tasks" });
  expect(result.components["_components/agent"].tables.messages).toHaveLength(1);
  expect(result.storageMetadata[0]?.contentType).toBe("text/plain");
});

test("rejects all unknown root tables by default, or returns them and their counts on opt-in", async () => {
  await withExport(async (path) => {
    for (const name of ["retiredThings", "extraThings", "authSessions"]) {
      await mkdir(join(path, name));
      await writeFile(join(path, name, "documents.jsonl"), '{"_id":"fixture","_creationTime":7}');
    }
    await expect(readExport(path)).rejects.toThrow(
      "Unknown Convex tables: extraThings, retiredThings"
    );
    const result = await readExport(path, { allowUnknownTables: true });
    expect(result.unknownTables).toEqual(["extraThings", "retiredThings"]);
    expect(result.counts).toEqual({ extraThings: 1, retiredThings: 1, authSessions: 1 });
    expect(result.tables.retiredThings).toEqual([{ _id: "fixture", _creationTime: 7 }]);
  });
});

test.each([
  ['{"marker":"synthetic-private-text",}', "invalid JSON"],
  ['{"_id":"synthetic-private-text"}', "invalid document (_id and _creationTime required)"],
  ["", "invalid JSON"],
])("rejects malformed rows without including their content (%s)", async (line, reason) => {
  await withExport(async (path) => {
    await mkdir(join(path, "tasks"));
    await writeFile(
      join(path, "tasks", "documents.jsonl"),
      `{"_id":"fixture","_creationTime":7}\r\n${line}\r\n`
    );
    await expect(readExport(path)).rejects.toThrow(new Error(`tasks/documents.jsonl:2: ${reason}`));
  });
});

test("rejects a manifest that does not match the document files", async () => {
  await withExport(async (path) => {
    await cp(fixture, path, { recursive: true });
    await writeFile(join(path, "_tables", "documents.jsonl"), '{"id":10001,"name":"users"}\n');
    await expect(readExport(path)).rejects.toThrow(
      "_tables/documents.jsonl: table metadata does not match document files"
    );
  });
});

test("reports unreadable ZIPs without exposing unzip output", async () => {
  await withExport(async (path) => {
    const zip = join(path, "invalid.zip");
    await writeFile(zip, "synthetic non-ZIP content");
    await expect(readExport(zip)).rejects.toThrow(
      new Error("Unable to unpack Convex export ZIP with /usr/bin/unzip")
    );
  });
});

test("does not buffer a ZIP listing of ignored storage blobs", async () => {
  await withExport(async (path) => {
    const zip = join(path, "large-storage.zip");
    const createZip = [
      "import sys, zipfile",
      "with zipfile.ZipFile(sys.argv[1], 'w') as archive:",
      '    archive.writestr(\'tasks/documents.jsonl\', \'{"_id":"fixture","_creationTime":1}\\n\')',
      "    for i in range(13000):",
      "        archive.writestr(f'_storage/{i:05}-' + 'x' * 80, '')",
    ].join("\n");
    await promisify(execFile)("python3", ["-c", createZip, zip]);
    const result = await readExport(zip);
    expect(result.counts).toEqual({ tasks: 1 });
    expect(result.storageMetadata).toEqual([]);
  });
});
