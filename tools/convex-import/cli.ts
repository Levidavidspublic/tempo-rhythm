import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";
import { mapIdentity } from "./map-identity";
import { mapTasks } from "./map-tasks";
import { type ConvexExport, readExport } from "./read-export";
import {
  buildReport,
  type ImportEnvironment,
  type LoadedCounts,
  type MappedTable,
  printReport,
  type Rejection,
  targets,
} from "./report";
import { buildStage, type StageCounts, StageError } from "./stage";

const usage =
  "Usage: bun tools/convex-import/cli.ts --export <zip|dir> --env <dev|prod> --out <outside repo> [--target local|staged] [--apply-local --pg-socket <dir> --pg-port <n>]";
const run = promisify(execFile);

class CliError extends Error {}

function parseOptions(args: string[]) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        export: { type: "string" },
        env: { type: "string" },
        out: { type: "string" },
        target: { type: "string" },
        "apply-local": { type: "boolean" },
        "pg-socket": { type: "string" },
        "pg-port": { type: "string" },
      },
    });
    const environment = values.env;
    const socket = values["pg-socket"];
    const port = values["pg-port"];
    const apply = values["apply-local"];
    const target = values.target ?? "local";
    if (
      !values.export ||
      !values.out ||
      (environment !== "dev" && environment !== "prod") ||
      (target !== "local" && target !== "staged") ||
      (apply && (!socket || !port || !/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535)) ||
      (!apply && (socket !== undefined || port !== undefined))
    ) {
      throw new CliError(usage);
    }
    if (apply && environment === "prod")
      throw new CliError("Local apply is available for dev exports only.");
    if (target === "staged" && environment !== "dev")
      throw new CliError("Staged output is available for dev exports only.");
    return {
      source: values.export,
      environment: environment as ImportEnvironment,
      out: values.out,
      target,
      connection: apply && socket && port ? { socket, port } : undefined,
    };
  } catch (error) {
    throw error instanceof CliError ? error : new CliError(usage);
  }
}

function contains(root: string, target: string) {
  const rel = relative(root, target);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}

async function canonicalOutput(path: string): Promise<string> {
  const entry = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  return entry ? realpath(path) : join(await canonicalOutput(dirname(path)), basename(path));
}

async function outputDirectory(out: string, environment: ImportEnvironment) {
  const repo = await realpath(resolve(import.meta.dir, "../.."));
  const root = await canonicalOutput(resolve(out));
  const dir = await canonicalOutput(join(root, environment));
  if (contains(repo, root) || contains(repo, dir))
    throw new CliError("Output directory must be outside the repository.");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if ((await realpath(dir)) !== dir) throw new CliError("Output directory changed during setup.");
  return dir;
}

async function writePrivate(dir: string, name: string, text: string) {
  const tmp = join(dir, `.${name}.${randomUUID()}`);
  await writeFile(tmp, text, { mode: 0o600, flag: "wx" });
  await rename(tmp, join(dir, name));
}

function singleTransactionSql(sql: string) {
  return sql.replace(/E'(?:[^'\\]|\\[\s\S]|'')*'|'(?:[^']|'')*'|^(?:BEGIN|COMMIT);\n/gm, (part) =>
    part.endsWith(";\n") ? "" : part
  );
}

async function localPsql({ socket, port }: { socket: string; port: string }) {
  const captain = await realpath(join(homedir(), "work/captain")).catch(() => "");
  const cluster = isAbsolute(socket) ? await realpath(socket).catch(() => "") : "";
  if (
    !captain ||
    !cluster ||
    cluster === captain ||
    cluster.includes(",") ||
    !contains(captain, cluster) ||
    !(await lstat(join(cluster, `.s.PGSQL.${port}`)).catch(() => undefined))?.isSocket() ||
    (await realpath(join(cluster, "data")).catch(() => "")) !== join(cluster, "data")
  ) {
    throw new CliError("Expected a dedicated local harness socket and data directory.");
  }
  const bin = resolve(process.env.PG_BIN ?? join(homedir(), "kitchen-omniagent/runtime/pg/bin"));
  const options = [
    "-X",
    "-w",
    "-h",
    cluster,
    "-p",
    port,
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-qAt",
  ];
  async function psql(database: string, args: string[]) {
    try {
      const { stdout } = await run(join(bin, "psql"), [...options, "-d", database, ...args], {
        env: { LD_LIBRARY_PATH: resolve(bin, "../lib"), LC_ALL: "C" },
        maxBuffer: 16 * 1024 * 1024,
      });
      return stdout;
    } catch {
      throw new CliError("Local psql command failed; query output withheld.");
    }
  }
  const directory = await psql("postgres", ["-c", "SHOW data_directory"]);
  if (directory.trimEnd() !== join(cluster, "data"))
    throw new CliError("Socket does not belong to the requested harness cluster.");
  return (args: string[]) => psql("tempo_test", args);
}

async function applyLocally(psql: Awaited<ReturnType<typeof localPsql>>, loadFile: string) {
  const output = await psql(["-z", "-0", "-1", "-f", loadFile]);
  const fields = output ? output.slice(0, -1).split("\0") : [];
  if (output && (!output.endsWith("\0") || fields.length % 3 !== 0))
    throw new CliError("Unexpected local psql rejection output.");
  const rejections: Rejection[] = [];
  for (let i = 0; i < fields.length; i += 3) {
    const [table, , reason] = fields.slice(i, i + 3);
    if (!table || !Object.hasOwn(targets, table) || !reason)
      throw new CliError("Unexpected local psql rejection output.");
    rejections.push({ table: table as MappedTable, reason });
  }

  const names = Object.values(targets).flat();
  const queries = names.map((name) => {
    if (name === "auth.users" || name === "public.profiles") {
      const id = name === "auth.users" ? "id" : "user_id";
      return `SELECT count(*) FROM ${name} AS dest JOIN public.account_gate AS gate
        ON gate.user_id = dest.${id} WHERE gate.legacy_convex_id IS NOT NULL`;
    }
    return `SELECT count(*) FROM ${name} WHERE legacy_convex_id IS NOT NULL`;
  });
  const counts = (await psql(["-c", `SELECT ${queries.map((query) => `(${query})`).join(", ")}`]))
    .trim()
    .split("|");
  if (
    counts.length !== names.length ||
    counts.some((n) => !/^\d+$/.test(n) || !Number.isSafeInteger(Number(n)))
  )
    throw new CliError("Unexpected local psql count output.");
  const loaded = Object.fromEntries(
    names.map((name, i) => [name, Number(counts[i])])
  ) as LoadedCounts;
  return { rejections, loaded };
}

async function applyStaged(
  psql: Awaited<ReturnType<typeof localPsql>>,
  dir: string,
  files: { file: string }[]
): Promise<StageCounts> {
  const role = ["-c", "SET ROLE project_admin"];
  for (const { file } of files) {
    await psql([...role, "-c", "SET statement_timeout = '25s'", "-f", join(dir, file)]);
  }
  const output = await psql([
    ...role,
    "-c",
    `SELECT
      (SELECT count(*) FROM tempo_import.staged_users),
      (SELECT count(*) FROM tempo_import.staged_users WHERE subscription IS NOT NULL),
      (SELECT count(*) FROM tempo_import.staged_rows WHERE target_table = 'task_repeat_cfgs'),
      (SELECT count(*) FROM tempo_import.staged_rows WHERE target_table = 'tasks')`,
  ]);
  const fields = output.trim().split("|");
  const counts = fields.map(Number);
  if (
    fields.length !== 4 ||
    fields.some((value) => !/^\d+$/.test(value)) ||
    counts.some((value) => !Number.isSafeInteger(value))
  ) {
    throw new CliError("Unexpected local psql staging count output.");
  }
  const [staged_users, staged_subscriptions, task_repeat_cfgs, tasks] = counts as [
    number,
    number,
    number,
    number,
  ];
  return { staged_users, staged_subscriptions, task_repeat_cfgs, tasks };
}

async function runStaged(
  source: ConvexExport,
  dir: string,
  psql: Awaited<ReturnType<typeof localPsql>> | undefined
) {
  const { chunks, counts, rejected, expected } = buildStage(source.tables);
  const report = {
    ...buildReport("dev", source, counts, rejected),
    target: "staged",
    staged: { expected, loaded: null as StageCounts | null },
  };
  const destinations = {
    users: "staged_users",
    subscriptionStates: "staged_subscriptions",
    taskRepeatCfgs: "task_repeat_cfgs",
    tasks: "tasks",
  } as const;
  const manifest = chunks.map(({ file, bytes, rows }) => ({ file, bytes, rows }));
  for (const chunk of chunks) await writePrivate(dir, chunk.file, chunk.sql);
  await writePrivate(dir, "manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    if (psql && report.passed) {
      const loaded = await applyStaged(psql, dir, manifest);
      report.staged.loaded = loaded;
      report.passed = Object.keys(expected).every(
        (key) => loaded[key as keyof StageCounts] === expected[key as keyof StageCounts]
      );
    }
  } catch (error) {
    report.passed = false;
    throw error;
  } finally {
    for (const row of report.tables) {
      if (!Object.hasOwn(destinations, row.table)) continue;
      const target = destinations[row.table as keyof typeof destinations];
      row.loaded = report.staged.loaded?.[target] ?? null;
      row.destinations = { [target]: row.loaded };
    }
    await writePrivate(dir, "report.json", `${JSON.stringify(report, null, 2)}\n`);
  }
  const lines = Object.entries(expected).map(
    ([key, count]) =>
      `| ${key} | ${count} | ${report.staged.loaded?.[key as keyof StageCounts] ?? "—"} |`
  );
  process.stdout.write(
    `${printReport(report)}\n\n| Staged target | Expected | Loaded |\n| --- | ---: | ---: |\n${lines.join("\n")}\n`
  );
  return report.passed ? 0 : 1;
}

async function main(args: string[]) {
  const options = parseOptions(args);
  const psql = options.connection ? await localPsql(options.connection) : undefined;
  const source = await readExport(options.source, { allowUnknownTables: true }).catch(() => {
    throw new CliError("Could not read the Convex export.");
  });
  if (options.target === "staged") {
    return runStaged(source, await outputDirectory(options.out, options.environment), psql);
  }
  const tables = source.tables;
  const users = tables.users ?? [];
  const identity = mapIdentity(users, tables.subscriptionStates ?? []);
  const rejectedUsers = new Set(
    identity.rejected.filter(({ table }) => table === "users").map(({ id }) => id)
  );
  const userIds = new Set(users.filter(({ _id }) => !rejectedUsers.has(_id)).map(({ _id }) => _id));
  const tasks = mapTasks(tables.tasks ?? [], tables.taskRepeatCfgs ?? [], userIds);
  const counts = { ...identity.counts, ...tasks.counts };
  const rejections = [...identity.rejected, ...tasks.rejected];
  const dir = await outputDirectory(options.out, options.environment);
  const loadFile = join(dir, "load.sql");
  await writePrivate(dir, "load.sql", singleTransactionSql(identity.sql + tasks.sql));

  let report = buildReport(options.environment, source, counts, rejections);
  try {
    if (psql) {
      const result = await applyLocally(psql, loadFile);
      report = buildReport(
        options.environment,
        source,
        counts,
        rejections,
        result.rejections,
        result.loaded
      );
    }
  } catch (error) {
    report.passed = false;
    throw error;
  } finally {
    await writePrivate(dir, "report.json", `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${printReport(report)}\n`);
  return report.passed ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message =
      error instanceof CliError || error instanceof StageError
        ? error.message
        : "Convex import failed; details withheld.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
