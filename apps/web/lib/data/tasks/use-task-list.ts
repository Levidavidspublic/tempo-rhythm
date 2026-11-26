"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { DATA_BACKEND } from "@/lib/backend-flag";
import type { Filter } from "@/lib/insforge/owner-row-transport";
import type { useLiveRows } from "@/lib/insforge/use-live-rows";

type TaskListArgs = FunctionArgs<typeof api.tasks.list>;
type TaskListResult = FunctionReturnType<typeof api.tasks.list>;
type Task = TaskListResult[number];
type UseTaskList = (args: TaskListArgs | "skip", uid?: string) => TaskListResult | undefined;

type TaskRow = {
  id: Task["_id"];
  user_id: Task["userId"];
  title: string;
  description: string | null;
  status: Task["status"];
  priority: Task["priority"];
  energy: Task["energy"] | null;
  time_estimate: number | null;
  flexibility: Task["flexibility"] | null;
  time_spent_on_day: unknown;
  repeat_cfg_id: Task["repeatCfgId"] | null;
  parent_task_id: Task["parentTaskId"] | null;
  project_id: string | null;
  project_name: string | null;
  due_at: number | null;
  completed_at: number | null;
  checklist: Task["checklist"] | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

const select =
  "id,user_id,title,description,status,priority,energy,time_estimate,flexibility,time_spent_on_day,repeat_cfg_id,parent_task_id,project_id,project_name,due_at,completed_at,checklist,created_at,updated_at,deleted_at";

export function makeUseTaskList(useQueryImpl: typeof useQuery<typeof api.tasks.list>) {
  return function useTaskList(args: TaskListArgs | "skip"): TaskListResult | undefined {
    return useQueryImpl(api.tasks.list, args);
  };
}

export function makeUseInsforgeTaskList(useRows: typeof useLiveRows<TaskRow>): UseTaskList {
  return function useInsforgeTaskList(args, uid) {
    const filters: Filter[] = [];
    if (args !== "skip") {
      const projectId = args.projectId?.trim();
      if (args.status) filters.push(["status", args.status]);
      if (projectId) filters.push(["project_id", projectId]);
      if (args.priority) filters.push(["priority", args.priority]);
    }
    const rows = useRows({
      table: "tasks",
      uid: args === "skip" ? undefined : uid,
      select,
      filters,
      order: { column: "updated_at", ascending: false },
    });
    if (!uid || !rows || args === "skip") return undefined;

    const { energy, dueFrom, dueTo } = args;
    const search = args.search?.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (row.deleted_at != null) return false;
        if (energy && (row.energy ?? "medium") !== energy) return false;
        if (
          search &&
          !row.title.toLowerCase().includes(search) &&
          !row.description?.toLowerCase().includes(search)
        ) {
          return false;
        }
        return (
          dueFrom === undefined ||
          dueTo === undefined ||
          (row.due_at != null && row.due_at >= dueFrom && row.due_at < dueTo)
        );
      })
      .map((row) => ({
        _id: row.id,
        _creationTime: row.created_at,
        userId: row.user_id,
        title: row.title,
        description: row.description ?? undefined,
        status: row.status,
        priority: row.priority,
        energy: row.energy ?? undefined,
        timeEstimate: row.time_estimate ?? undefined,
        flexibility: row.flexibility ?? undefined,
        timeSpentOnDay: row.time_spent_on_day ?? undefined,
        repeatCfgId: row.repeat_cfg_id ?? undefined,
        parentTaskId: row.parent_task_id ?? undefined,
        projectId: row.project_id ?? undefined,
        projectName: row.project_name ?? undefined,
        dueAt: row.due_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        checklist: row.checklist ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  };
}

export const useTaskList: UseTaskList =
  DATA_BACKEND === "insforge"
    ? makeUseInsforgeTaskList(
        (require("@/lib/insforge/use-live-rows") as typeof import("@/lib/insforge/use-live-rows"))
          .useLiveRows
      )
    : makeUseTaskList(useQuery);
