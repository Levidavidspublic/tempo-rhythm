import { afterAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { file, spawn } from "bun";
import { readExport } from "../../tools/convex-import/read-export";
import { buildReport, type Counts, type LoadedCounts } from "../../tools/convex-import/report";

const repo = resolve(import.meta.dir, "../..");
const cli = join(repo, "tools/convex-import/cli.ts");
const scratch = await mkdtemp(join(tmpdir(), "tempo-import-cli-test-"));
const userId = "synthetic-user-id";
const email = "synthetic-loader@example.invalid";
const taskTitle = "Synthetic task's title\nCOMMIT;\nBEGIN;\nwith a backslash \\";

afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

async function fixture(name: string, tables: Record<string, Record<string, unknown>[]>) {
  const source = join(scratch, name);
  for (const [table, docs] of Object.entries(tables)) {
    const dir = join(source, table);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "documents.jsonl"),
      docs
        .map(
          (doc, i) => `${JSON.stringify({ _creationTime: 1, _id: `synthetic-doc-${i}`, ...doc })}\n`
        )
        .join("")
    );
  }
  return source;
}

async function runCli(
  source: string,
  out: string,
  { environment = "dev", args = [] }: { environment?: "dev" | "prod"; args?: string[] } = {}
) {
  const child = spawn(
    [process.execPath, cli, "--export", source, "--out", out, "--env", environment, ...args],
    { cwd: scratch, stdout: "pipe", stderr: "pipe" }
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("writes private SQL and a counts-only report with distinct skip rules", async () => {
  const source = await fixture("mixed", {
    users: [{ _id: userId, email }],
    tasks: [{ userId, title: taskTitle, status: "todo", priority: "low", updatedAt: 2 }],
    authSessions: [{}],
    voiceSessions: [{}],
    profiles: [{ email, firstField: "never-printed" }, { email: " ", secondField: 2 }, {}],
    unknownEmpty: [],
    "_components/agent/messages": [{}],
  });
  const out = join(scratch, "out-mixed");
  const result = await runCli(source, out, { environment: "prod" });
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("| profiles | 3 | 0 | 0 | 3 | — | skipped: undeclared table |");
  const dir = join(out, "prod");
  const raw = await readFile(join(dir, "report.json"), "utf8");
  const report = JSON.parse(raw);
  expect(report.passed).toBe(true);
  const rows = Object.fromEntries(report.tables.map((row: { table: string }) => [row.table, row]));
  expect(rows.users).toMatchObject({ exported: 1, transformed: 1, rejected: 0, loaded: null });
  expect(rows.tasks).toMatchObject({ exported: 1, transformed: 1, rejected: 0, loaded: null });
  expect(rows.authSessions.skipRule).toBe("convex auth");
  expect(rows.voiceSessions.skipRule).toBe("not mapped yet");
  expect(rows["_components/agent/messages"].skipRule).toBe("component table");
  expect(rows.profiles).toMatchObject({
    exported: 3,
    skipped: 3,
    fields: ["_creationTime", "_id", "email", "firstField", "secondField"],
    emailShare: { withEmail: 1, total: 3, percent: 100 / 3 },
  });
  expect(rows.unknownEmpty).not.toHaveProperty("fields");
  for (const value of [userId, email, "Synthetic task", "never-printed", "synthetic-doc-0"]) {
    expect(result.stdout + raw).not.toContain(value);
  }
  const loadPath = join(dir, "load.sql");
  const sql = await readFile(loadPath, "utf8");
  expect(sql.startsWith("BEGIN;")).toBe(false);
  expect(sql.endsWith("\nCOMMIT;\n")).toBe(false);
  expect(sql).toContain("title\nCOMMIT;\nBEGIN;\nwith a backslash");
  expect(sql.indexOf("INSERT INTO auth.users")).toBeLessThan(
    sql.indexOf("INSERT INTO public.tasks")
  );
  expect((await stat(loadPath)).mode & 0o777).toBe(0o600);
  expect((await stat(join(dir, "report.json"))).mode & 0o777).toBe(0o600);
});

test("aggregates mapper rejections, hides IDs, and exits nonzero", async () => {
  const source = await fixture("rejected", {
    users: [{ _id: "rejected-user-a" }, { _id: "rejected-user-b", email: "" }],
    tasks: [{ userId: "rejected-user-a", title: "private synthetic task" }],
  });
  const out = join(scratch, "out-rejected");
  const result = await runCli(source, out);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("");
  const raw = await readFile(join(out, "dev/report.json"), "utf8");
  expect(JSON.parse(raw)).toMatchObject({
    passed: false,
    tables: [
      {
        table: "users",
        exported: 2,
        transformed: 0,
        rejected: 2,
        rejectionReasons: { "missing email": 2 },
      },
      { table: "subscriptionStates" },
      { table: "taskRepeatCfgs" },
      {
        table: "tasks",
        exported: 1,
        transformed: 0,
        rejected: 1,
        rejectionReasons: { "unresolved userId": 1 },
      },
    ],
  });
  expect(result.stdout + raw).not.toMatch(/rejected-user-[ab]|private synthetic task/);
});

test("refuses in-repo output, including both root and environment symlinks", async () => {
  const source = await fixture("safety", { users: [] });
  const rootLink = join(scratch, "out-link");
  const envLink = join(scratch, "out-env-link");
  await symlink(repo, rootLink);
  await mkdir(envLink);
  await symlink(repo, join(envLink, "dev"));
  for (const out of [join(repo, "synthetic-output"), join(rootLink, "new-directory"), envLink]) {
    const result = await runCli(source, out);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Output directory must be outside the repository.");
  }
});

test("refuses prod apply and non-harness socket arguments before writing", async () => {
  const source = await fixture("apply-safety", { users: [] });
  const out = join(scratch, "out-apply-safety");
  const args = ["--apply-local", "--pg-socket", "example.invalid", "--pg-port", "5432"];
  const prod = await runCli(source, out, { environment: "prod", args });
  expect(prod.exitCode).toBe(1);
  expect(prod.stderr).toContain("Local apply is available for dev exports only.");
  const nonHarness = await runCli(source, out, { args });
  expect(nonHarness.exitCode).toBe(1);
  expect(nonHarness.stderr).toContain("Expected a dedicated local harness socket");
  const missingPort = await runCli(source, out, { args: args.slice(0, 3) });
  expect(missingPort.exitCode).toBe(1);
  expect(missingPort.stderr).toContain("Usage:");
  expect(await file(join(out, "dev/load.sql")).exists()).toBe(false);
});

test("requires counts to match in all identity destinations and fails on SQL-stage rejections", async () => {
  const source = await readExport(await fixture("matched", { users: [{ _id: userId, email }] }));
  const empty = { exported: 0, transformed: 0, rejected: 0 };
  const counts: Counts = {
    users: { exported: 1, transformed: 1, rejected: 0 },
    subscriptionStates: empty,
    taskRepeatCfgs: empty,
    tasks: empty,
  };
  const loaded: LoadedCounts = {
    "public.account_gate": 1,
    "auth.users": 1,
    "public.profiles": 1,
    "public.subscription_states": 0,
    "public.task_repeat_cfgs": 0,
    "public.tasks": 0,
  };
  expect(buildReport("dev", source, counts, [], [], loaded).passed).toBe(true);
  expect(
    buildReport("dev", source, counts, [], [], { ...loaded, "public.profiles": 0 }).passed
  ).toBe(false);
  const report = buildReport(
    "dev",
    source,
    counts,
    [],
    [{ table: "users", reason: "email cannot resolve to a unique, unclaimed auth user" }],
    { ...loaded, "public.account_gate": 0, "auth.users": 0, "public.profiles": 0 }
  );
  expect(report.passed).toBe(false);
  expect(report.tables[0]).toMatchObject({
    rejected: 1,
    loaded: 0,
    rejectionReasons: { "email cannot resolve to a unique, unclaimed auth user": 1 },
  });
});
