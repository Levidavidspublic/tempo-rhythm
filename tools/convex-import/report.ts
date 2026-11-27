import { authTables } from "@convex-dev/auth/server";
import type { ConvexExport } from "./read-export";

export const targets = {
  users: ["public.account_gate", "auth.users", "public.profiles"],
  subscriptionStates: ["public.subscription_states"],
  taskRepeatCfgs: ["public.task_repeat_cfgs"],
  tasks: ["public.tasks"],
} as const;

export type MappedTable = keyof typeof targets;
export type Counts = Record<
  MappedTable,
  { exported: number; transformed: number; rejected: number }
>;
export type Rejection = { table: MappedTable; reason: string };
export type LoadedCounts = Record<(typeof targets)[MappedTable][number], number>;
export type ImportEnvironment = "dev" | "prod";

const authNames = new Set(Object.keys(authTables));

type TableReport = {
  table: string;
  exported: number;
  transformed: number;
  rejected: number;
  skipped: number;
  loaded: number | null;
  destinations?: Record<string, number | null>;
  rejectionReasons?: Record<string, number>;
  skipRule?: string;
  fields?: string[];
  emailShare?: { withEmail: number; total: number; percent: number };
};

export function describeSkippedTables(source: ConvexExport): TableReport[] {
  const undeclared = new Set(source.unknownTables);
  return Object.entries(source.counts)
    .filter(([table]) => !Object.hasOwn(targets, table))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([table, exported]) => {
      const skipRule = table.startsWith("_components/")
        ? "component table"
        : table === "_tables" || table === "_storage"
          ? "export metadata"
          : authNames.has(table)
            ? "convex auth"
            : undeclared.has(table)
              ? "undeclared table"
              : "not mapped yet";
      const row: TableReport = {
        table,
        exported,
        transformed: 0,
        rejected: 0,
        skipped: exported,
        loaded: null,
        skipRule,
      };
      const docs = source.tables[table];
      if (skipRule === "undeclared table" && docs?.length) {
        row.fields = [...new Set(docs.flatMap(Object.keys))].sort();
        if (table === "profiles") {
          const withEmail = docs.filter(
            ({ email }) => typeof email === "string" && email.trim() !== ""
          ).length;
          row.emailShare = {
            withEmail,
            total: docs.length,
            percent: (100 * withEmail) / docs.length,
          };
        }
      }
      return row;
    });
}

export function buildReport(
  environment: ImportEnvironment,
  source: ConvexExport,
  counts: Counts,
  rejections: readonly Rejection[],
  runtimeRejections: readonly Rejection[] = [],
  loaded?: LoadedCounts
) {
  const mapped: TableReport[] = (Object.keys(targets) as MappedTable[]).map((table) => {
    const destinations = targets[table];
    const reasons = new Map<string, number>();
    for (const rejection of [...rejections, ...runtimeRejections]) {
      if (rejection.table !== table) continue;
      reasons.set(rejection.reason, (reasons.get(rejection.reason) ?? 0) + 1);
    }
    return {
      table,
      ...counts[table],
      rejected: counts[table].rejected + runtimeRejections.filter((r) => r.table === table).length,
      skipped: 0,
      loaded: loaded?.[destinations[0]] ?? null,
      destinations: Object.fromEntries(destinations.map((dest) => [dest, loaded?.[dest] ?? null])),
      rejectionReasons: Object.fromEntries([...reasons].sort(([a], [b]) => a.localeCompare(b))),
    };
  });
  const passed = mapped.every(
    (row) =>
      row.rejected === 0 &&
      (!loaded ||
        Object.values(row.destinations ?? {}).every(
          (count) => count === row.exported - row.rejected - row.skipped
        ))
  );
  return { environment, passed, tables: [...mapped, ...describeSkippedTables(source)] };
}

export function printReport({ tables }: ReturnType<typeof buildReport>): string {
  const lines = [
    "| Table | Exported | Transformed | Rejected | Skipped | Loaded | Rule |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of tables) {
    const destinations = Object.entries(row.destinations ?? {});
    const loaded =
      destinations.length > 1 && row.loaded !== null
        ? destinations.map(([name, count]) => `${name}: ${count}`).join("; ")
        : (row.loaded ?? "—");
    const rule = row.skipRule ? `skipped: ${row.skipRule}` : "—";
    lines.push(
      `| ${row.table} | ${row.exported} | ${row.transformed} | ${row.rejected} | ${row.skipped} | ${loaded} | ${rule} |`
    );
  }
  for (const row of tables) {
    for (const [reason, count] of Object.entries(row.rejectionReasons ?? {})) {
      lines.push(`${row.table}: ${count} rejected (${reason})`);
    }
  }
  return lines.join("\n");
}
