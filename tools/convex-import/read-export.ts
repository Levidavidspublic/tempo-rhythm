import { execFile } from "node:child_process";
import { lstat, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import schema from "../../convex/schema";

type JsonObject = Record<string, unknown>;

export type ConvexDocument = JsonObject & { _id: string; _creationTime: number };
export type ConvexTableMetadata = JsonObject & { name: string; id: number };

export type ConvexExportNamespace = {
  tables: Record<string, ConvexDocument[]>;
  tableMetadata: ConvexTableMetadata[];
  storageMetadata: ConvexDocument[];
};

export type ConvexExport = ConvexExportNamespace & {
  components: Record<string, ConvexExportNamespace>;
  counts: Record<string, number>;
  unknownTables: string[];
};

export type ReadExportOptions = {
  /** By default, reject all root tables absent from convex/schema.ts. Opting in returns their rows and names as well. Component tables are namespaced and are not part of the root schema. */
  allowUnknownTables?: boolean;
};

const tableName = /^[A-Za-z_][A-Za-z0-9_]*$/;
const componentName = /^[A-Za-z0-9_-]+$/;
const documentPath = /^(?:_components\/[A-Za-z0-9_-]+\/)*[A-Za-z_][A-Za-z0-9_]*\/documents\.jsonl$/;
const knownTables = new Set(Object.keys(schema.tables));
const run = promisify(execFile);

function isDocument(value: JsonObject): value is ConvexDocument {
  return typeof value._id === "string" && value._id.length > 0 &&
    typeof value._creationTime === "number" && Number.isFinite(value._creationTime);
}

function isTableMetadata(value: JsonObject): value is ConvexTableMetadata {
  return typeof value.name === "string" && tableName.test(value.name) &&
    typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0;
}

async function readLines<T extends JsonObject>(
  directory: string,
  label: string,
  valid: (value: JsonObject) => value is T,
): Promise<T[]> {
  const path = join(directory, "documents.jsonl");
  let text: string;
  try {
    if (!(await lstat(path)).isFile()) throw new Error();
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await readFile(path));
  } catch {
    throw new Error(`${label}/documents.jsonl: missing, unreadable, or not valid UTF-8`);
  }
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, i) => {
    const location = `${label}/documents.jsonl:${i + 1}`;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`${location}: invalid JSON`);
    }
    if (value === null || typeof value !== "object" || Array.isArray(value) || !valid(value as JsonObject)) {
      throw new Error(`${location}: invalid ${label.endsWith("/_tables") || label === "_tables" ? "table metadata" : "document (_id and _creationTime required)"}`);
    }
    return value as T;
  });
}

/** Reads documents.jsonl entries only; generated schema sidecars and storage blobs are not loaded. See https://docs.convex.dev/database/backup-restore#downloading-a-backup. */
export async function readExport(path: string, options: ReadExportOptions = {}): Promise<ConvexExport> {
  const source = resolve(path);
  const info = await stat(source).catch(() => undefined);
  if (!info?.isDirectory() && !(info?.isFile() && source.toLowerCase().endsWith(".zip"))) {
    throw new Error("Expected a Convex export folder or ZIP file");
  }

  const counts = new Map<string, number>();
  const components = new Map<string, ConvexExportNamespace>();
  async function readNamespace(directory: string, prefix: string): Promise<ConvexExportNamespace> {
    let tableMetadata: ConvexTableMetadata[] = [];
    let storageMetadata: ConvexDocument[] = [];
    const tables = new Map<string, ConvexDocument[]>();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error("Symbolic links are not supported in Convex exports");
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const entryPath = join(directory, name);
      const label = `${prefix}${name}`;
      if (name === "_components") {
        const children = await readdir(entryPath, { withFileTypes: true });
        for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
          if (!child.isDirectory() || !componentName.test(child.name)) {
            throw new Error("Invalid Convex component directory");
          }
          const componentPath = `${label}/${child.name}`;
          components.set(componentPath, await readNamespace(join(entryPath, child.name), `${componentPath}/`));
        }
      } else if (name === "_tables") {
        tableMetadata = await readLines(entryPath, label, isTableMetadata);
        counts.set(label, tableMetadata.length);
      } else if (name === "_storage") {
        storageMetadata = await readLines(entryPath, label, isDocument);
        counts.set(label, storageMetadata.length);
      } else {
        if (!tableName.test(name)) throw new Error("Invalid Convex table directory");
        const documents = await readLines(entryPath, label, isDocument);
        tables.set(name, documents);
        counts.set(label, documents.length);
      }
    }
    if (counts.has(`${prefix}_tables`)) {
      const names = new Set(tableMetadata.map(({ name }) => name));
      if (names.size !== tableMetadata.length || names.size !== tables.size ||
        [...names].some((name) => !tables.has(name))) {
        throw new Error(`${prefix}_tables/documents.jsonl: table metadata does not match document files`);
      }
    }
    return { tables: Object.fromEntries(tables), tableMetadata, storageMetadata };
  }

  const extracted = info.isDirectory() ? undefined : await mkdtemp(join(tmpdir(), "convex-export-"));
  try {
    if (extracted) {
      const env = { ...process.env, UNZIP: "", UNZIPOPT: "", ZIPINFO: "", ZIPINFOOPT: "" };
      try {
        const { stdout } = await run("/usr/bin/unzip", ["-Z1", source], { env });
        const files = stdout.split("\n").filter((entry) => entry.endsWith("/documents.jsonl"));
        if (!files.length || new Set(files).size !== files.length || files.some((entry) => !documentPath.test(entry))) {
          throw new Error();
        }
        await run("/usr/bin/unzip", ["-q", source, "*/documents.jsonl", "-d", extracted], { env });
      } catch {
        throw new Error("Unable to unpack Convex export ZIP with /usr/bin/unzip");
      }
    }
    const root = await readNamespace(extracted ?? source, "");
    if (!counts.size) throw new Error("Convex export has no documents.jsonl files");
    const unknownTables = Object.keys(root.tables).filter((name) => !knownTables.has(name)).sort();
    if (unknownTables.length && !options.allowUnknownTables) {
      throw new Error(`Unknown Convex tables: ${unknownTables.join(", ")}`);
    }
    return { ...root, components: Object.fromEntries(components), counts: Object.fromEntries(counts), unknownTables };
  } finally {
    if (extracted) await rm(extracted, { recursive: true, force: true });
  }
}
