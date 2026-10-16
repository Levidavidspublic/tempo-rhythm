"use client";

import { type KeyboardEvent, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
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
  onCancel: () => void;
};

/** Where a key was pressed: a one-line field (title, due date), a select, or the new-step field. */
export type EditorFieldKind = "line" | "select" | "step";

/** The parts of a keydown the editor's key rules read. */
export type EditorKey = { key: string; isComposing: boolean; keyCode?: number };

/**
 * True while an input method (IME) is composing: that Enter or Escape belongs to the IME, not
 * the editor. Safari sends the Enter that ends a composition with keyCode 229 and isComposing off.
 */
export function isComposingKey(event: EditorKey): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** An Enter the editor may act on. */
export function isEditorEnter(event: EditorKey): boolean {
  return event.key === "Enter" && !isComposingKey(event);
}

/** Enter saves from a one-line field or a select. In the new-step field it adds the step instead. */
export function shouldSaveOnEnter(event: EditorKey, field: EditorFieldKind): boolean {
  return isEditorEnter(event) && field !== "step";
}

/** Escape cancels the edit from any field. */
export function shouldCancelOnEscape(event: EditorKey): boolean {
  return event.key === "Escape" && !isComposingKey(event);
}

function editorKey(event: KeyboardEvent): EditorKey {
  return { key: event.key, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode };
}

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

export function TaskRowEditor({ task, disabled, onSave, onCancel }: TaskRowEditorProps) {
  const { t } = useLocale();
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [energy, setEnergy] = useState(task.energy);
  const [dueDate, setDueDate] = useState(() => dateInputValue(task.dueAt));
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>(() => task.checklist ?? []);
  const [newStep, setNewStep] = useState("");
  const canSave = !disabled && title.trim().length > 0;

  const addStep = () => {
    const text = newStep.trim();
    if (!text) return;
    setChecklist((current) => [
      ...current,
      { id: crypto.randomUUID(), text, completed: false },
    ]);
    setNewStep("");
  };

  const save = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      priority,
      energy,
      dueAt: localEndOfDay(dueDate),
      checklist: checklist.length > 0 ? checklist : null,
    });
  };

  // Enter in a field saves, the same as Save task. The editor is not a form: forms never nest here.
  const saveOnEnter = (field: EditorFieldKind) => (event: KeyboardEvent) => {
    if (!shouldSaveOnEnter(editorKey(event), field)) return;
    event.preventDefault();
    save();
  };

  return (
    <fieldset
      className="tk-editor"
      aria-label={t("tasks.editName").replace("{title}", () => task.title)}
      onKeyDown={(event) => {
        if (!shouldCancelOnEscape(editorKey(event))) return;
        // Taken here, so the shell's own Escape (it closes the coach) leaves this one alone.
        event.preventDefault();
        onCancel();
      }}
    >
      <label className="tp-field">
        <span className="tp-label">{t("editor.taskTitle")}</span>
        <input
          aria-label={t("tasks.editTitle")}
          dir="auto"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={saveOnEnter("line")}
          className="tp-input"
        />
      </label>
      <div className="tk-editor__grid">
        <label className="tp-field">
          <span className="tp-label">{t("tasks.priority")}</span>
          <select
            aria-label={t("tasks.editPriority")}
            value={priority}
            disabled={disabled}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            onKeyDown={saveOnEnter("select")}
            className="tp-input"
          >
            <option value="high">{t("tasks.level.high")}</option>
            <option value="medium">{t("tasks.level.medium")}</option>
            <option value="low">{t("tasks.level.low")}</option>
          </select>
        </label>
        <label className="tp-field">
          <span className="tp-label">{t("tasks.energy")}</span>
          <select
            aria-label={t("tasks.editEnergy")}
            value={energy}
            disabled={disabled}
            onChange={(event) => setEnergy(event.target.value as TaskEnergy)}
            onKeyDown={saveOnEnter("select")}
            className="tp-input"
          >
            <option value="low">{t("tasks.level.low")}</option>
            <option value="medium">{t("tasks.level.medium")}</option>
            <option value="high">{t("tasks.level.high")}</option>
          </select>
        </label>
        <label className="tp-field">
          <span className="tp-label">{t("tasks.dueDate")}</span>
          <input
            type="date"
            aria-label={t("tasks.editDue")}
            value={dueDate}
            disabled={disabled}
            onChange={(event) => setDueDate(event.target.value)}
            onKeyDown={saveOnEnter("line")}
            className="tp-input"
          />
        </label>
      </div>
      <div className="tp-field">
        <span className="tp-label">{t("tasks.checklistSteps")}</span>
        {checklist.map((item) => (
          <div key={item.id} className="tk-editor__step">
            <span className="tk-editor__steptext" dir="auto">
              {item.text}
            </span>
            <button
              type="button"
              className="tp-btn tp-btn--secondary tp-btn--sm"
              disabled={disabled}
              aria-label={t("tasks.removeStep").replace("{step}", () => item.text)}
              onClick={() => setChecklist((current) => current.filter((step) => step.id !== item.id))}
            >
              {t("editor.remove")}
            </button>
          </div>
        ))}
        <div className="tk-editor__add">
          <input
            aria-label={t("tasks.newStep")}
            dir="auto"
            value={newStep}
            disabled={disabled}
            onChange={(event) => setNewStep(event.target.value)}
            onKeyDown={(event) => {
              if (isEditorEnter(editorKey(event))) {
                event.preventDefault();
                addStep();
              }
            }}
            className="tp-input"
            placeholder={t("tasks.newStepPh")}
          />
          <button
            type="button"
            className="tp-btn tp-btn--secondary"
            disabled={disabled || !newStep.trim()}
            onClick={addStep}
          >
            {t("tasks.addStep")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tp-btn tp-btn--primary tk-editor__save"
          disabled={!canSave}
          onClick={save}
        >
          {t("tasks.save")}
        </button>
        <button type="button" className="tp-btn tp-btn--ghost" onClick={onCancel}>
          {t("tasks.cancel")}
        </button>
      </div>
    </fieldset>
  );
}
