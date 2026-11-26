import { isInsforgeE2eMode } from "./e2e-mode";

type Row = Record<string, unknown> & { id: string } & Record<"user_id", string>;
type Scope = { table: string; uid: string };
type Fixture = { table: string; row: Row };
type Mutation =
  | { type: "insert"; row: Row }
  | { type: "update"; id: string; patch: Record<string, unknown> };
type Query = {
  filters?: readonly (readonly [string, string | number | boolean | null])[];
  order?: { column: string; ascending?: boolean };
};

function scopeKey({ table, uid }: Scope): string {
  if (!table || !uid) throw new Error("Fixture rows require a table and owner");
  return JSON.stringify([table, uid]);
}

function insertRow(rows: Map<string, Row>, uid: string, row: Row): void {
  if (!row.id || row.user_id !== uid) throw new Error("Invalid fixture row identity");
  if (rows.has(row.id)) throw new Error("Duplicate fixture row ID");
  rows.set(row.id, structuredClone(row));
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftText = String(left);
  const rightText = String(right);
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

function createRowStore() {
  let rowsByScope = new Map<string, Map<string, Row>>();
  const listeners = new Map<string, Set<() => void>>();

  function publish(key: string) {
    for (const listener of Array.from(listeners.get(key) ?? [])) {
      try {
        listener();
      } catch {
        console.error("[insforge-e2e-row-store] Subscriber notification failed");
      }
    }
  }

  return {
    select(scope: Scope, { filters = [], order }: Query = {}): Row[] {
      const rows = Array.from(rowsByScope.get(scopeKey(scope))?.values() ?? []).filter((row) =>
        filters.every(([column, value]) => row[column] === value)
      );
      if (order) {
        const { ascending = true, column } = order;
        rows.sort((a, b) => compareValues(a[column], b[column]) * (ascending ? 1 : -1));
      }
      return structuredClone(rows);
    },

    mutate(scope: Scope, mutation: Mutation): void {
      const key = scopeKey(scope);
      const rows = rowsByScope.get(key) ?? new Map<string, Row>();
      if (mutation.type === "insert") {
        insertRow(rows, scope.uid, mutation.row);
        rowsByScope.set(key, rows);
      } else {
        const existing = rows.get(mutation.id);
        if (!existing) throw new Error("Fixture row not found");
        const updated = { ...existing, ...mutation.patch };
        if (updated.id !== existing.id || updated.user_id !== existing.user_id) {
          throw new Error("Cannot change fixture row identity");
        }
        if (Object.keys(mutation.patch).length === 0) return;
        rows.set(existing.id, structuredClone(updated));
      }
      publish(key);
    },

    subscribe(scope: Scope, onChange: () => void): () => void {
      const key = scopeKey(scope);
      const callbacks = listeners.get(key) ?? new Set<() => void>();
      const listener = () => onChange();
      callbacks.add(listener);
      listeners.set(key, callbacks);
      return () => {
        callbacks.delete(listener);
        if (callbacks.size === 0 && listeners.get(key) === callbacks) listeners.delete(key);
      };
    },

    reset(fixtures: readonly Fixture[] = []): void {
      const seeded = new Map<string, Map<string, Row>>();
      for (const { table, row } of fixtures) {
        const key = scopeKey({ table, uid: row.user_id });
        const rows = seeded.get(key) ?? new Map<string, Row>();
        insertRow(rows, row.user_id, row);
        seeded.set(key, rows);
      }
      const changed = new Set([...rowsByScope.keys(), ...seeded.keys()]);
      rowsByScope = seeded;
      for (const key of changed) publish(key);
    },
  };
}

let browserStore: ReturnType<typeof createRowStore> | undefined;

export function getE2eRowStore() {
  if (!isInsforgeE2eMode() || typeof window === "undefined") return null;
  browserStore ??= createRowStore();
  return browserStore;
}
