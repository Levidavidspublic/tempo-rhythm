type ConvexDoc = { _id: string; _creationTime: number; [key: string]: unknown };
type SourceTable = "tasks" | "taskRepeatCfgs";
type DestinationTable = "tasks" | "task_repeat_cfgs";
type Rejection = { table: SourceTable; id: string; reason: string };
type Literals = Record<string, string>;
type MappedTask = {
  owner: string;
  parent: string | undefined;
  repeat: string | undefined;
  row: Literals;
};

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.includes("\0") || /[\uD800-\uDFFF]/u.test(value)) {
    throw new Error(field + " must be valid Unicode text without null bytes");
  }
  return value;
}

function text(value: unknown, field: string): string {
  return "E'" + requireText(value, field).replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
}

function integer(value: unknown, field: string): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(field + " must be an integer");
  }
  return String(value);
}

function nearestMillisecond(value: unknown, field: string): string {
  return integer(typeof value === "number" ? Math.round(value) : value, field);
}

function int32(value: unknown, field: string): string {
  if (typeof value !== "number" || value < -2147483648 || value > 2147483647) {
    throw new Error(field + " must be a 32-bit integer");
  }
  return integer(value, field);
}

function bool(value: unknown, field: string): string {
  if (typeof value !== "boolean") throw new Error(field + " must be boolean");
  return value ? "TRUE" : "FALSE";
}

function oneOf(value: unknown, field: string, choices: readonly string[]): string {
  if (typeof value !== "string" || !choices.includes(value)) {
    throw new Error(field + " is not a supported value");
  }
  return text(value, field);
}

function optional(
  value: unknown,
  field: string,
  literal: (value: unknown, field: string) => string
): string {
  return value === null || value === undefined ? "NULL" : literal(value, field);
}

function jsonb(value: unknown, field: string): string {
  if (value === undefined) return "NULL";
  const json = JSON.stringify(value, (key, item: unknown) => {
    requireText(key, field);
    if (typeof item === "string") requireText(item, field);
    if (
      (typeof item === "number" && !Number.isFinite(item)) ||
      ["bigint", "undefined", "function", "symbol"].includes(typeof item)
    ) {
      throw new Error(field + " must be valid JSON");
    }
    return item;
  });
  return text(json, field) + "::jsonb";
}

function array(
  value: unknown,
  field: string,
  type: "integer" | "text",
  element: (value: unknown, field: string) => string
): string {
  if (!Array.isArray(value)) throw new Error(field + " must be an array");
  return "ARRAY[" + value.map((item) => element(item, field)).join(", ") + "]::" + type + "[]";
}

function timestamps(doc: ConvexDoc) {
  return {
    created_at: integer(doc.createdAt ?? Math.trunc(doc._creationTime), "createdAt"),
    updated_at: integer(doc.updatedAt, "updatedAt"),
    deleted_at: optional(doc.deletedAt, "deletedAt", integer),
  };
}

function countIds(docs: readonly ConvexDoc[]) {
  const counts = new Map<string, number>();
  for (const doc of docs) counts.set(doc._id, (counts.get(doc._id) ?? 0) + 1);
  return counts;
}

function stage(
  table: DestinationTable,
  rows: readonly Literals[],
  columns: readonly string[]
): string[] {
  const selection = columns.map((column) =>
    column.endsWith("_legacy_id") ? "NULL::text AS " + column : column
  );
  return [
    "CREATE TEMP TABLE tempo_import_" + table + " ON COMMIT DROP AS",
    "SELECT " + selection.join(", ") + " FROM public." + table + " WITH NO DATA;",
    "INSERT INTO pg_temp.tempo_import_" + table + " (" + columns.join(", ") + ") VALUES",
    rows.map((row) => "(" + columns.map((column) => row[column]).join(", ") + ")").join(",\n") +
      ";",
  ];
}

function upsert(
  table: DestinationTable,
  columns: string[],
  source: string,
  filter: string
): string[] {
  const mutable = columns.filter((column) => column !== "user_id" && column !== "legacy_convex_id");
  return [
    "INSERT INTO public." + table + " AS target (" + columns.join(", ") + ")",
    "SELECT " +
      columns.map((column) => "input." + column).join(", ") +
      " FROM pg_temp." +
      source +
      " AS input",
    "WHERE " + filter,
    "ON CONFLICT (legacy_convex_id) DO UPDATE SET",
    mutable.map((column) => "  " + column + " = excluded." + column).join(",\n"),
    "WHERE excluded.updated_at >= target.updated_at AND excluded.user_id = target.user_id",
    "  AND ROW(" + mutable.map((column) => "excluded." + column).join(", ") + ")",
    "    IS DISTINCT FROM ROW(" + mutable.map((column) => "target." + column).join(", ") + ");",
  ];
}

export function mapTasks(
  tasks: readonly ConvexDoc[],
  taskRepeatCfgs: readonly ConvexDoc[],
  identityUserIds: ReadonlySet<string>
) {
  const rejected: Rejection[] = [];
  const repeatIds = countIds(taskRepeatCfgs);
  const repeatOwners = new Map<string, string>();
  const mappedRepeats: { id: string; owner: string; row: Literals }[] = [];
  for (const repeat of taskRepeatCfgs) {
    try {
      const owner = repeat.userId;
      if (typeof owner !== "string" || !identityUserIds.has(owner))
        throw new Error("unresolved userId");
      if (!repeat._id || repeatIds.get(repeat._id) !== 1)
        throw new Error("missing or duplicate repeat config ID");
      const row = {
        legacy_convex_id: text(repeat._id, "_id"),
        user_legacy_id: text(owner, "userId"),
        repeat_cycle: oneOf(repeat.repeatCycle, "repeatCycle", [
          "DAILY",
          "WEEKLY",
          "MONTHLY",
          "YEARLY",
        ]),
        repeat_every: int32(repeat.repeatEvery, "repeatEvery"),
        weekdays: array(repeat.weekdays, "weekdays", "integer", int32),
        monthly_week_of_month: optional(repeat.monthlyWeekOfMonth, "monthlyWeekOfMonth", int32),
        monthly_weekday: optional(repeat.monthlyWeekday, "monthlyWeekday", int32),
        monthly_last_day: optional(repeat.monthlyLastDay, "monthlyLastDay", bool),
        deleted_instance_dates: array(
          repeat.deletedInstanceDates,
          "deletedInstanceDates",
          "text",
          text
        ),
        skip_overdue: bool(repeat.skipOverdue, "skipOverdue"),
        wait_for_completion: bool(repeat.waitForCompletion, "waitForCompletion"),
        repeat_from_completion_date: bool(
          repeat.repeatFromCompletionDate,
          "repeatFromCompletionDate"
        ),
        is_paused: bool(repeat.isPaused, "isPaused"),
        default_estimate: optional(repeat.defaultEstimate, "defaultEstimate", integer),
        last_task_creation_day: optional(repeat.lastTaskCreationDay, "lastTaskCreationDay", text),
        ...timestamps(repeat),
      };
      mappedRepeats.push({ id: repeat._id, owner, row });
      repeatOwners.set(repeat._id, owner);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejected.push({ table: "taskRepeatCfgs", id: repeat._id, reason: error.message });
    }
  }

  const candidates = new Map<string, MappedTask>();
  const taskIds = countIds(tasks);
  for (const task of tasks) {
    try {
      const owner = task.userId;
      if (typeof owner !== "string" || !identityUserIds.has(owner))
        throw new Error("unresolved userId");
      if (!task._id || taskIds.get(task._id) !== 1) throw new Error("missing or duplicate task ID");
      const repeat = task.repeatCfgId;
      if (
        repeat !== null &&
        repeat !== undefined &&
        (typeof repeat !== "string" || repeatOwners.get(repeat) !== owner)
      ) {
        throw new Error("unresolved or cross-owner repeatCfgId");
      }
      const parent =
        task.parentTaskId === null || task.parentTaskId === undefined
          ? undefined
          : requireText(task.parentTaskId, "parentTaskId");
      candidates.set(task._id, {
        owner,
        parent,
        repeat: typeof repeat === "string" ? repeat : undefined,
        row: {
          legacy_convex_id: text(task._id, "_id"),
          user_legacy_id: text(owner, "userId"),
          repeat_legacy_id: optional(repeat, "repeatCfgId", text),
          parent_legacy_id: optional(parent, "parentTaskId", text),
          title: text(task.title, "title"),
          description: optional(task.description, "description", text),
          status: oneOf(task.status, "status", ["todo", "in_progress", "done", "cancelled"]),
          priority: oneOf(task.priority, "priority", ["low", "medium", "high"]),
          energy: optional(task.energy, "energy", (value, field) =>
            oneOf(value, field, ["low", "medium", "high"])
          ),
          time_estimate: optional(task.timeEstimate, "timeEstimate", nearestMillisecond),
          flexibility: optional(task.flexibility, "flexibility", (value, field) =>
            oneOf(value, field, ["fixed", "elastic"])
          ),
          time_spent_on_day: jsonb(task.timeSpentOnDay, "timeSpentOnDay"),
          project_id: optional(task.projectId, "projectId", text),
          project_name: optional(task.projectName, "projectName", text),
          due_at: optional(task.dueAt, "dueAt", integer),
          completed_at: optional(task.completedAt, "completedAt", integer),
          checklist: jsonb(task.checklist, "checklist"),
          ...timestamps(task),
        },
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejected.push({ table: "tasks", id: task._id, reason: error.message });
    }
  }

  const childrenByParent = new Map<string, string[]>();
  const brokenParents: string[] = [];
  for (const [id, { owner, parent }] of candidates) {
    if (parent === undefined) continue;
    if (candidates.get(parent)?.owner !== owner) {
      brokenParents.push(id);
    } else {
      const children = childrenByParent.get(parent) ?? [];
      children.push(id);
      childrenByParent.set(parent, children);
    }
  }
  for (const id of brokenParents) {
    if (!candidates.delete(id)) continue;
    rejected.push({ table: "tasks", id, reason: "unresolved or cross-owner parentTaskId" });
    brokenParents.push(...(childrenByParent.get(id) ?? []));
  }

  const repeatRows = mappedRepeats.map(({ row }) => row);
  const sql: string[] = [];
  if (repeatRows.length || candidates.size) {
    sql.push(
      "BEGIN;",
      "DO $$ BEGIN PERFORM pg_catalog.pg_advisory_xact_lock(20261127, 34); END $$;"
    );
  }
  if (repeatRows[0]) {
    const columns = Object.keys(repeatRows[0]);
    sql.push(
      ...stage("task_repeat_cfgs", repeatRows, columns),
      "CREATE TEMP TABLE tempo_import_repeat_plan ON COMMIT DROP AS",
      "SELECT input.*, gate.user_id, CASE",
      "  WHEN gate.user_id IS NULL THEN 'unresolved userId'",
      "  WHEN existing.user_id <> gate.user_id THEN 'repeat config ID belongs to a different owner'",
      "END AS reason",
      "FROM pg_temp.tempo_import_task_repeat_cfgs AS input",
      "LEFT JOIN public.account_gate AS gate ON gate.legacy_convex_id = input.user_legacy_id",
      "LEFT JOIN public.task_repeat_cfgs AS existing ON existing.legacy_convex_id = input.legacy_convex_id;",
      "SELECT 'taskRepeatCfgs' AS \"table\", legacy_convex_id AS id, reason",
      "FROM pg_temp.tempo_import_repeat_plan WHERE reason IS NOT NULL ORDER BY id;",
      ...upsert(
        "task_repeat_cfgs",
        columns.map((column) => (column === "user_legacy_id" ? "user_id" : column)),
        "tempo_import_repeat_plan",
        "input.reason IS NULL"
      )
    );
  }

  const taskRows = [...candidates.values()].map(({ row }) => row);
  if (taskRows[0]) {
    const columns = Object.keys(taskRows[0]);
    const eligible =
      "NOT EXISTS (SELECT 1 FROM pg_temp.tempo_import_task_rejections AS rejected" +
      " WHERE rejected.legacy_convex_id = input.legacy_convex_id)";
    sql.push(
      ...stage("tasks", taskRows, columns),
      "CREATE TEMP TABLE tempo_import_task_plan ON COMMIT DROP AS",
      "SELECT input.*, gate.user_id, repeat.id AS repeat_cfg_id, CASE",
      "  WHEN gate.user_id IS NULL THEN 'unresolved userId'",
      "  WHEN input.repeat_legacy_id IS NOT NULL AND repeat.id IS NULL THEN 'unresolved or cross-owner repeatCfgId'",
      "  WHEN existing.user_id <> gate.user_id THEN 'task ID belongs to a different owner'",
      "END AS reason",
      "FROM pg_temp.tempo_import_tasks AS input",
      "LEFT JOIN public.account_gate AS gate ON gate.legacy_convex_id = input.user_legacy_id",
      "LEFT JOIN public.task_repeat_cfgs AS repeat",
      "  ON repeat.user_id = gate.user_id AND repeat.legacy_convex_id = input.repeat_legacy_id",
      "LEFT JOIN public.tasks AS existing ON existing.legacy_convex_id = input.legacy_convex_id;",
      "CREATE TEMP TABLE tempo_import_task_rejections ON COMMIT DROP AS",
      "WITH RECURSIVE broken (legacy_convex_id) AS (",
      "  SELECT legacy_convex_id FROM pg_temp.tempo_import_task_plan WHERE reason IS NOT NULL",
      "  UNION",
      "  SELECT child.legacy_convex_id FROM pg_temp.tempo_import_task_plan AS child",
      "  JOIN broken ON child.parent_legacy_id = broken.legacy_convex_id",
      ") SELECT input.legacy_convex_id, coalesce(input.reason, 'unresolved parentTaskId') AS reason",
      "FROM pg_temp.tempo_import_task_plan AS input JOIN broken USING (legacy_convex_id);",
      "SELECT 'tasks' AS \"table\", legacy_convex_id AS id, reason",
      "FROM pg_temp.tempo_import_task_rejections ORDER BY id;",
      ...upsert(
        "tasks",
        columns
          .filter((column) => column !== "parent_legacy_id")
          .map((column) =>
            column === "user_legacy_id"
              ? "user_id"
              : column === "repeat_legacy_id"
                ? "repeat_cfg_id"
                : column
          ),
        "tempo_import_task_plan",
        eligible
      ),
      "UPDATE public.tasks AS target SET parent_task_id = parent.id",
      "FROM pg_temp.tempo_import_task_plan AS input",
      "LEFT JOIN public.tasks AS parent",
      "  ON parent.user_id = input.user_id AND parent.legacy_convex_id = input.parent_legacy_id",
      "WHERE target.legacy_convex_id = input.legacy_convex_id AND target.user_id = input.user_id",
      "  AND target.updated_at = input.updated_at AND target.parent_task_id IS DISTINCT FROM parent.id",
      "  AND " + eligible + ";"
    );
  }
  return {
    sql: sql.length ? [...sql, "COMMIT;", ""].join("\n") : "",
    rejected,
    repeatRows: mappedRepeats,
    taskRows: [...candidates].map(([id, task]) => ({ id, ...task })),
    counts: {
      tasks: {
        exported: tasks.length,
        transformed: taskRows.length,
        rejected: tasks.length - taskRows.length,
      },
      taskRepeatCfgs: {
        exported: taskRepeatCfgs.length,
        transformed: repeatRows.length,
        rejected: taskRepeatCfgs.length - repeatRows.length,
      },
    },
  };
}
