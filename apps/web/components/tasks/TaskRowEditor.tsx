"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  TaskChecklistItem,
  TaskEnergy,
  TaskPriority,
  TaskViewRecord,
} from "@/lib/task-view-filters";

export type TaskEditorUpdate = {
  title: string;
  priority: TaskPriority;
  energy: TaskEnergy;
  dueAt: number | null;
  checklist: TaskChecklistItem[] | null;
};

type TaskRowEditorProps = {
  task: TaskViewRecord;
  disabled: boolean;
  onSave: (update: TaskEditorUpdate) => void;
};

function dateInputValue(timestamp?: number): string {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localEndOfDay(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + 1).getTime() - 1;
}

export function TaskRowEditor({ task, disabled, onSave }: TaskRowEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [energy, setEnergy] = useState(task.energy);
  const [dueDate, setDueDate] = useState(() => dateInputValue(task.dueAt));
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>(() => task.checklist ?? []);
  const [newStep, setNewStep] = useState("");

  const addStep = () => {
    const text = newStep.trim();
    if (!text) return;
    setChecklist((current) => [
      ...current,
      { id: crypto.randomUUID(), text, completed: false },
    ]);
    setNewStep("");
  };

  return (
    <fieldset className="space-y-4" aria-label={`Edit ${task.title}`}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">Task title</span>
        <input
          aria-label="Edit task title"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Priority</span>
          <select
            aria-label="Edit priority"
            value={priority}
            disabled={disabled}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Energy</span>
          <select
            aria-label="Edit energy"
            value={energy}
            disabled={disabled}
            onChange={(event) => setEnergy(event.target.value as TaskEnergy)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Due date</span>
          <input
            type="date"
            aria-label="Edit due date"
            value={dueDate}
            disabled={disabled}
            onChange={(event) => setDueDate(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Checklist steps</span>
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.text}</span>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={`Remove step ${item.text}`}
              onClick={() => setChecklist((current) => current.filter((step) => step.id !== item.id))}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="New checklist step"
            value={newStep}
            disabled={disabled}
            onChange={(event) => setNewStep(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addStep();
              }
            }}
            className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="Add a small step"
          />
          <Button type="button" variant="outline" disabled={disabled || !newStep.trim()} onClick={addStep}>
            Add step
          </Button>
        </div>
      </div>
      <Button
        type="button"
        disabled={disabled || !title.trim()}
        onClick={() =>
          onSave({
            title: title.trim(),
            priority,
            energy,
            dueAt: localEndOfDay(dueDate),
            checklist: checklist.length > 0 ? checklist : null,
          })
        }
      >
        Save task
      </Button>
    </fieldset>
  );
}
