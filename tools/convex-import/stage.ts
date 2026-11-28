import { createHash } from "node:crypto";
import { mapIdentity } from "./map-identity";
import { mapTasks } from "./map-tasks";
import type { ConvexDocument } from "./read-export";

const namespace = "9f5656a1-a26a-45c7-9e24-3d4679c5495a";
const maxChunkBytes = 150_000;
const maxChunkRows = 500;
const stagedAt = "(extract(epoch from pg_catalog.statement_timestamp()) * 1000)::bigint";

export class StageError extends Error {}

export function stagedId(id: string): string {
  const bytes = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(id, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function text(value: string): string {
  return "E'" + value.replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
}

function uuid(id: string | undefined): string {
  return id === undefined ? "NULL" : text(stagedId(id)) + "::uuid";
}

function json(values: Record<string, string> | undefined): string {
  if (!values) return "NULL";
  return (
    "pg_catalog.jsonb_build_object(" +
    Object.entries(values)
      .flatMap(([key, value]) => [text(key), value])
      .join(", ") +
    ")"
  );
}

type Chunk = { file: string; bytes: number; rows: number; sql: string };

function writeChunks(
  chunks: Chunk[],
  table: "staged_users" | "staged_rows",
  key: string[],
  columns: string[],
  tuples: string[]
) {
  const allColumns = [...key, ...columns];
  const header = `INSERT INTO tempo_import.${table} AS staged (${allColumns.join(", ")}) VALUES\n`;
  const footer =
    `\nON CONFLICT (${key.join(", ")}) DO UPDATE SET\n  ` +
    columns.map((column) => `${column} = excluded.${column}`).join(",\n  ") +
    "\nWHERE staged.claimed_at IS NULL;\n";
  const fixedBytes = Buffer.byteLength(header + footer);
  let rows: string[] = [];
  let bytes = fixedBytes;
  function flush() {
    if (!rows.length) return;
    const file = `stage-${String(chunks.length + 1).padStart(5, "0")}.sql`;
    chunks.push({ file, bytes, rows: rows.length, sql: header + rows.join(",\n") + footer });
    bytes = fixedBytes;
    rows = [];
  }
  for (const tuple of tuples) {
    const rowBytes = Buffer.byteLength(tuple);
    if (fixedBytes + rowBytes >= maxChunkBytes) {
      throw new StageError("A single staged row exceeds the SQL chunk size limit.");
    }
    if (rows.length === maxChunkRows || bytes + rowBytes + (rows.length ? 2 : 0) >= maxChunkBytes) {
      flush();
    }
    bytes += rowBytes + (rows.length ? 2 : 0);
    rows.push(tuple);
  }
  flush();
}

export function buildStage(tables: Record<string, readonly ConvexDocument[]>, loadId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loadId)) {
    throw new StageError("A staged load id must be a UUID.");
  }
  const loadSql = text(loadId) + "::uuid";
  const identity = mapIdentity(tables.users ?? [], tables.subscriptionStates ?? []);
  const owners = new Map(identity.users.map(({ id, email }) => [id, email]));
  const tasks = mapTasks(tables.tasks ?? [], tables.taskRepeatCfgs ?? [], new Set(owners.keys()));
  const rejected = [...identity.rejected, ...tasks.rejected];
  const counts = { ...identity.counts, ...tasks.counts };

  const orderedTasks: typeof tasks.taskRows = [];
  const children = new Map<string, typeof tasks.taskRows>();
  for (const task of tasks.taskRows) {
    if (task.parent === undefined) {
      orderedTasks.push(task);
    } else {
      const siblings = children.get(task.parent) ?? [];
      siblings.push(task);
      children.set(task.parent, siblings);
    }
  }
  const visited = new Set<string>();
  for (const task of orderedTasks) {
    visited.add(task.id);
    for (const child of children.get(task.id) ?? []) orderedTasks.push(child);
  }
  for (const task of tasks.taskRows) {
    if (visited.has(task.id)) continue;
    rejected.push({ table: "tasks", id: task.id, reason: "cyclic parentTaskId" });
    counts.tasks.transformed--;
    counts.tasks.rejected++;
  }

  const chunks: Chunk[] = [];
  writeChunks(
    chunks,
    "staged_users",
    ["load_id", "email_lower"],
    ["legacy_convex_id", "gate", "profile", "subscription", "staged_at"],
    identity.users.map(
      ({ id, email, gate, profile, subscription }) =>
        `(${[loadSql, text(email), text(id), json(gate), json(profile), json(subscription), stagedAt].join(", ")})`
    )
  );

  const repeats = tasks.repeatRows.map((repeat) => ({
    ...repeat,
    target: "task_repeat_cfgs" as const,
  }));
  const ordered = orderedTasks.map((task) => ({ ...task, target: "tasks" as const }));
  writeChunks(
    chunks,
    "staged_rows",
    ["load_id", "target_table", "id"],
    ["legacy_convex_id", "owner_email_lower", "load_order", "payload", "staged_at"],
    [...repeats, ...ordered].map((item, order) => {
      const values = Object.fromEntries(
        Object.entries(item.row).filter(([column]) => !column.endsWith("_legacy_id"))
      );
      if (item.target === "tasks") {
        values.repeat_cfg_id = uuid(item.repeat);
        values.parent_task_id = uuid(item.parent);
      }
      const email = owners.get(item.owner);
      if (email === undefined) throw new StageError("A staged row has no mapped owner.");
      return `(${[loadSql, text(item.target), uuid(item.id), text(item.id), text(email), order, json(values), stagedAt].join(", ")})`;
    })
  );

  return {
    counts,
    rejected,
    chunks,
    expected: {
      staged_users: identity.users.length,
      staged_subscriptions: counts.subscriptionStates.transformed,
      task_repeat_cfgs: repeats.length,
      tasks: ordered.length,
    },
  };
}

export type StageCounts = ReturnType<typeof buildStage>["expected"];
