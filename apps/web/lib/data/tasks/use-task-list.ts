"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { DATA_BACKEND } from "@/lib/backend-flag";
import type { Filter } from "@/lib/insforge/owner-row-transport";
import type { useLiveRows } from "@/lib/insforge/use-live-rows";

type TaskListArgs = FunctionArgs<typeof api.tasks.list>;
type TaskListResult = FunctionReturnType<typeof api.tasks.list>;
type Task = TaskListResult[number];
type UseTaskList = (args: TaskListArgs | "skip", uid?: string) => TaskListResult | undefined;

type TaskRow = Record<string, unknown>;
type UseReadFailure = () => [string | undefined, (readKey: string) => void];

const select =
  "id,user_id,title,description,status,priority,energy,time_estimate,flexibility,time_spent_on_day,repeat_cfg_id,parent_task_id,project_id,project_name,due_at,completed_at,checklist,created_at,updated_at,deleted_at";

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function requireColumn<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing required InsForge task column");
  return value;
}

function mapTask(row: TaskRow): Task {
  const createdAt = requireColumn(readNumber(row["created_at"]));
  return {
    _id: requireColumn(readString(row["id"])) as Task["_id"],
    _creationTime: createdAt,
    userId: requireColumn(readString(row["user_id"])) as Task["userId"],
    title: requireColumn(readString(row["title"])),
    description: readString(row["description"]),
    status: requireColumn(readString(row["status"])) as Task["status"],
    priority: requireColumn(readString(row["priority"])) as Task["priority"],
    energy: readString(row["energy"]) as Task["energy"],
    timeEstimate: readNumber(row["time_estimate"]),
    flexibility: readString(row["flexibility"]) as Task["flexibility"],
    timeSpentOnDay: row["time_spent_on_day"] ?? undefined,
    repeatCfgId: readString(row["repeat_cfg_id"]) as Task["repeatCfgId"],
    parentTaskId: readString(row["parent_task_id"]) as Task["parentTaskId"],
    projectId: readString(row["project_id"]),
    projectName: readString(row["project_name"]),
    dueAt: readNumber(row["due_at"]),
    completedAt: readNumber(row["completed_at"]),
    checklist: (row["checklist"] ?? undefined) as Task["checklist"],
    createdAt,
    updatedAt: requireColumn(readNumber(row["updated_at"])),
  };
}

export function makeUseTaskList(useQueryImpl: typeof useQuery<typeof api.tasks.list>) {
  return function useTaskList(args: TaskListArgs | "skip"): TaskListResult | undefined {
    return useQueryImpl(api.tasks.list, args);
  };
}

export function makeUseInsforgeTaskList(
  useRows: typeof useLiveRows<TaskRow>,
  useReadFailure: UseReadFailure = useState<string>
): UseTaskList {
  return function useInsforgeTaskList(args, uid) {
    const [failedReadKey, setFailedReadKey] = useReadFailure();
    const readUid = args === "skip" ? undefined : uid;
    const filters: Filter[] = [];
    if (args !== "skip") {
      const projectId = args.projectId?.trim();
      if (args.status) filters.push(["status", args.status]);
      if (projectId) filters.push(["project_id", projectId]);
      if (args.priority) filters.push(["priority", args.priority]);
    }
    const readKey = JSON.stringify([readUid, filters]);
    const rows = useRows({
      table: "tasks",
      uid: readUid,
      select,
      filters,
      order: { column: "updated_at", ascending: false },
      onError: () => setFailedReadKey(readKey),
    });
    if (!readUid || args === "skip") return undefined;
    if (failedReadKey === readKey) throw new Error("Unable to load InsForge tasks");
    if (!rows) return undefined;

    const { energy, dueFrom, dueTo } = args;
    const search = args.search?.trim().toLowerCase();
    return rows
      .filter((row) => row["deleted_at"] === null || row["deleted_at"] === undefined)
      .map(mapTask)
      .filter((task) => {
        if (energy && (task.energy ?? "medium") !== energy) return false;
        if (
          search &&
          !task.title.toLowerCase().includes(search) &&
          !task.description?.toLowerCase().includes(search)
        ) {
          return false;
        }
        return (
          dueFrom === undefined ||
          dueTo === undefined ||
          (task.dueAt !== undefined && task.dueAt >= dueFrom && task.dueAt < dueTo)
        );
      });
  };
}

export const useTaskList: UseTaskList =
  DATA_BACKEND === "insforge"
    ? makeUseInsforgeTaskList(
        (require("@/lib/insforge/use-live-rows") as typeof import("@/lib/insforge/use-live-rows"))
          .useLiveRows
      )
    : makeUseTaskList(useQuery);
