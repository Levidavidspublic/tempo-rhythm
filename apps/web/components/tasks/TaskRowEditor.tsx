"use client";

import { useState } from "react";
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
    <fieldset className="tk-editor" aria-label={`Edit ${task.title}`}>
      <label className="tp-field">
        <span className="tp-label">Task title</span>
        <input
          aria-label="Edit task title"
          dir="auto"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          className="tp-input"
        />
      </label>
      <div className="tk-editor__grid">
        <label className="tp-field">
          <span className="tp-label">Priority</span>
          <select
            aria-label="Edit priority"
            value={priority}
            disabled={disabled}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className="tp-input"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="tp-field">
          <span className="tp-label">Energy</span>
          <select
            aria-label="Edit energy"
            value={energy}
            disabled={disabled}
            onChange={(event) => setEnergy(event.target.value as TaskEnergy)}
            className="tp-input"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="tp-field">
          <span className="tp-label">Due date</span>
          <input
            type="date"
            aria-label="Edit due date"
            value={dueDate}
            disabled={disabled}
            onChange={(event) => setDueDate(event.target.value)}
            className="tp-input"
          />
        </label>
      </div>
      <div className="tp-field">
        <span className="tp-label">Checklist steps</span>
        {checklist.map((item) => (
          <div key={item.id} className="tk-editor__step">
            <span className="tk-editor__steptext" dir="auto">
              {item.text}
            </span>
            <button
              type="button"
              className="tp-btn tp-btn--secondary tp-btn--sm"
              disabled={disabled}
              aria-label={`Remove step ${item.text}`}
              onClick={() => setChecklist((current) => current.filter((step) => step.id !== item.id))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="tk-editor__add">
          <input
            aria-label="New checklist step"
            dir="auto"
            value={newStep}
            disabled={disabled}
            onChange={(event) => setNewStep(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addStep();
              }
            }}
            className="tp-input"
            placeholder="Add a small step"
          />
          <button
            type="button"
            className="tp-btn tp-btn--secondary"
            disabled={disabled || !newStep.trim()}
            onClick={addStep}
          >
            Add step
          </button>
        </div>
      </div>
      <button
        type="button"
        className="tp-btn tp-btn--primary tk-editor__save"
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
      </button>
    </fieldset>
  );
}
