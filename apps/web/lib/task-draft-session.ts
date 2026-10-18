/**
 * The add form on the task views keeps what is typed for this tab, so leaving and coming back
 * (Back, Forward, a reload) brings the title back. Only in this tab's sessionStorage: never
 * localStorage, never the server.
 *
 * One draft per tab, tagged with the view it was typed in, and it comes back only there: Today
 * shows the same form but adds to today, so a title typed in Inbox must not turn up in it. An
 * empty title clears the draft, and so does adding the task. A kept draft expires 2 hours after
 * its last change. Storage that throws (private mode, blocked site data, a full quota) or holds
 * bad JSON reads as nothing kept; it never breaks the screen.
 */
import type { TaskEnergy, TaskPriority } from "@/lib/task-view-filters";

export const TASK_DRAFT_KEY = "tempo:tasks:draft";
/** Bump when the stored shape changes: a kept draft with another version is dropped. */
export const TASK_DRAFT_VERSION = 1;
export const TASK_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export type TaskDraftRepeat = "none" | "daily" | "weekly";

/** The add form's fields, as the screen holds them. */
export type TaskDraft = {
  title: string;
  projectName: string;
  priority: TaskPriority;
  energy: TaskEnergy;
  dueToday: boolean;
  dueDate: string;
  repeat: TaskDraftRepeat;
  checklistText: string;
};

/** A kept draft as it reads back: always the title; each other field only while it is sound. */
export type KeptTaskDraft = Pick<TaskDraft, "title"> & Partial<Omit<TaskDraft, "title">>;

/** The part of `Storage` this needs, so tests can pass a fake. */
export type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type Stored = { v: number; savedAt: number; scope: string; draft: TaskDraft };

const LEVELS: readonly string[] = ["low", "medium", "high"];
const REPEATS: readonly string[] = ["none", "daily", "weekly"];
/** What `<input type="date">` gives: YYYY-MM-DD, or "" for no date. */
const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;

/** This tab's sessionStorage, or null where there is none or it is blocked. */
export function tabSessionStore(): SessionStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Keep the draft typed in `scope` (the view), or clear it once the title is empty.
 * False when storage refused.
 */
export function saveTaskDraft(
  store: SessionStore | null,
  scope: string,
  draft: TaskDraft,
  now: number
): boolean {
  if (!store) return false;
  if (draft.title.trim() === "") return clearTaskDraft(store, scope);
  const stored: Stored = {
    v: TASK_DRAFT_VERSION,
    savedAt: now,
    scope,
    // Field by field, so only the form's own fields are stored.
    draft: {
      title: draft.title,
      projectName: draft.projectName,
      priority: draft.priority,
      energy: draft.energy,
      dueToday: draft.dueToday,
      dueDate: draft.dueDate,
      repeat: draft.repeat,
      checklistText: draft.checklistText,
    },
  };
  try {
    store.setItem(TASK_DRAFT_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/**
 * The draft kept for `scope`, or null when there is none, it was typed in another view, it
 * expired, or it can't be read.
 */
export function loadTaskDraft(
  store: SessionStore | null,
  scope: string,
  now: number
): KeptTaskDraft | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(TASK_DRAFT_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const kept = parseStored(raw, now);
  if (!kept) {
    // Expired, from another version, or damaged: drop it so it isn't read again.
    try {
      store.removeItem(TASK_DRAFT_KEY);
    } catch {
      // Nothing kept either way.
    }
    return null;
  }
  // Another view's draft stays for that view.
  return kept.scope === scope ? kept.draft : null;
}

/**
 * Forget the draft kept for `scope`. A draft typed in another view stays. False when storage
 * refused.
 */
export function clearTaskDraft(store: SessionStore | null, scope: string): boolean {
  if (!store) return false;
  try {
    const raw = store.getItem(TASK_DRAFT_KEY);
    if (raw === null) return true;
    const owner = storedScope(raw);
    if (owner !== null && owner !== scope) return true;
    store.removeItem(TASK_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The view a stored draft of this version was typed in, or null when it can't be told. */
function storedScope(raw: string): string | null {
  const value = parseJson(raw);
  if (!isRecord(value) || value.v !== TASK_DRAFT_VERSION) return null;
  return typeof value.scope === "string" ? value.scope : null;
}

function parseStored(raw: string, now: number): { scope: string; draft: KeptTaskDraft } | null {
  const value = parseJson(raw);
  if (!isRecord(value) || value.v !== TASK_DRAFT_VERSION) return null;
  const { savedAt, scope } = value;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (now - savedAt >= TASK_DRAFT_TTL_MS) return null;
  if (typeof scope !== "string") return null;
  const draft = parseDraft(value.draft);
  return draft ? { scope, draft } : null;
}

/** The title, or nothing; then each other field that is still sound. */
function parseDraft(value: unknown): KeptTaskDraft | null {
  if (!isRecord(value)) return null;
  const { title, projectName, priority, energy, dueToday, dueDate, repeat, checklistText } = value;
  if (typeof title !== "string" || title.trim() === "") return null;
  const kept: KeptTaskDraft = { title };
  if (typeof projectName === "string") kept.projectName = projectName;
  if (typeof priority === "string" && LEVELS.includes(priority)) {
    kept.priority = priority as TaskPriority;
  }
  if (typeof energy === "string" && LEVELS.includes(energy)) kept.energy = energy as TaskEnergy;
  // "Show on Today" and the due date are set together, so they come back together or not at all.
  if (
    typeof dueToday === "boolean" &&
    typeof dueDate === "string" &&
    (dueDate === "" || DATE_VALUE.test(dueDate))
  ) {
    kept.dueToday = dueToday;
    kept.dueDate = dueToday ? "" : dueDate;
  }
  if (typeof repeat === "string" && REPEATS.includes(repeat)) {
    kept.repeat = repeat as TaskDraftRepeat;
  }
  if (typeof checklistText === "string") kept.checklistText = checklistText;
  return kept;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
