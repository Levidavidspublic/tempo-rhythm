export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_ENERGIES = ["low", "medium", "high"] as const;
export type TaskEnergy = (typeof TASK_ENERGIES)[number];

export const TASK_FLEXIBILITIES = ["fixed", "elastic"] as const;
export type TaskFlexibility = (typeof TASK_FLEXIBILITIES)[number];

export type TaskDoc = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  description?: string;
  energy?: TaskEnergy;
  timeEstimate?: number;
  flexibility?: TaskFlexibility;
  timeSpentOnDay?: Record<string, number>;
  repeatCfgId?: string;
  parentTaskId?: string;
  projectId?: string;
  projectName?: string;
  dueAt?: number;
  completedAt?: number;
  checklist?: { id: string; text: string; completed: boolean }[];
  deletedAt?: number;
};

export class TaskDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "TaskDocError";
  }
}

const REQUIRED_KEYS = ["title", "status", "priority", "createdAt", "updatedAt"] as const;
const OPTIONAL_STRING_KEYS = [
  "description",
  "repeatCfgId",
  "parentTaskId",
  "projectId",
  "projectName",
] as const;
const OPTIONAL_NUMBER_KEYS = ["timeEstimate", "dueAt", "completedAt", "deletedAt"] as const;
const TASK_KEYS = new Set<string>([
  ...REQUIRED_KEYS,
  ...OPTIONAL_STRING_KEYS,
  ...OPTIONAL_NUMBER_KEYS,
  "energy",
  "flexibility",
  "timeSpentOnDay",
  "checklist",
]);
const IGNORED_KEYS = new Set(["userId", "_id", "_creationTime"]);

function fail(field: string): never {
  throw new TaskDocError(field);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function toTaskDoc(input: Record<string, unknown>): TaskDoc {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (IGNORED_KEYS.has(key) || value === undefined) continue;
    if (!TASK_KEYS.has(key)) fail(key);
    clean[key] = value;
  }

  if (typeof clean.title !== "string" || clean.title.trim().length === 0) fail("title");
  if (!isOneOf(clean.status, TASK_STATUSES)) fail("status");
  if (!isOneOf(clean.priority, TASK_PRIORITIES)) fail("priority");
  if (!isFiniteNumber(clean.createdAt)) fail("createdAt");
  if (!isFiniteNumber(clean.updatedAt)) fail("updatedAt");

  for (const key of OPTIONAL_STRING_KEYS) {
    if (key in clean && typeof clean[key] !== "string") fail(key);
  }
  for (const key of OPTIONAL_NUMBER_KEYS) {
    if (key in clean && !isFiniteNumber(clean[key])) fail(key);
  }
  if ("energy" in clean && !isOneOf(clean.energy, TASK_ENERGIES)) fail("energy");
  if ("flexibility" in clean && !isOneOf(clean.flexibility, TASK_FLEXIBILITIES)) fail("flexibility");

  if ("timeSpentOnDay" in clean) {
    const spent = clean.timeSpentOnDay;
    if (typeof spent !== "object" || spent === null || Array.isArray(spent)) fail("timeSpentOnDay");
    for (const [day, amount] of Object.entries(spent)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isFiniteNumber(amount) || amount < 0) {
        fail("timeSpentOnDay");
      }
    }
  }

  if ("checklist" in clean) {
    if (!Array.isArray(clean.checklist)) fail("checklist");
    for (const item of clean.checklist) {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item) ||
        Object.keys(item).length !== 3 ||
        typeof (item as Record<string, unknown>).id !== "string" ||
        typeof (item as Record<string, unknown>).text !== "string" ||
        typeof (item as Record<string, unknown>).completed !== "boolean"
      ) {
        fail("checklist");
      }
    }
  }

  return clean as TaskDoc;
}

export function newTaskDoc(
  input: { title: string; priority?: TaskPriority; status?: TaskStatus } & Partial<TaskDoc>,
  now: number,
): TaskDoc {
  const status = input.status ?? "todo";
  const candidate: Record<string, unknown> = {
    ...input,
    status,
    priority: input.priority ?? "medium",
    createdAt: now,
    updatedAt: now,
  };
  if (status === "done") candidate.completedAt = now;
  return toTaskDoc(candidate);
}

export function patchTaskDoc(doc: TaskDoc, patch: Partial<TaskDoc>, now: number): TaskDoc {
  const candidate: Record<string, unknown> = {
    ...doc,
    ...patch,
    createdAt: doc.createdAt,
    updatedAt: now,
  };
  if (doc.status !== "done" && candidate.status === "done") candidate.completedAt = now;
  if (doc.status === "done" && candidate.status !== "done") delete candidate.completedAt;
  return toTaskDoc(candidate);
}

export function softDeleteTaskDoc(doc: TaskDoc, now: number): TaskDoc {
  return toTaskDoc({ ...doc, deletedAt: now, updatedAt: now });
}

export function restoreTaskDoc(doc: TaskDoc, now: number): TaskDoc {
  const candidate: Record<string, unknown> = { ...doc, updatedAt: now };
  delete candidate.deletedAt;
  return toTaskDoc(candidate);
}
