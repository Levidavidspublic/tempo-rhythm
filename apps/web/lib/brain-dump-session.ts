/**
 * /brain-dump keeps the typed dump and the last sorted plan for this tab, with the accept/reject
 * choices already made, so browser Back then Forward, or a reload, brings them back without a
 * second model call. Only in this tab's sessionStorage: never localStorage, never the server.
 *
 * Nothing is kept once the plan is finished: an empty form (after "Add accepted" or Clear) and a
 * plan whose every line was rejected both clear it. A kept dump expires 2 hours after its last
 * change. Storage that throws (private mode, blocked site data, a full quota) or holds bad JSON
 * reads as nothing kept; it never breaks the screen.
 */

export const BRAIN_DUMP_SESSION_KEY = "tempo:brain-dump:session";
/** Bump when the stored shape changes: a kept dump with another version is dropped. */
export const BRAIN_DUMP_SESSION_VERSION = 1;
export const BRAIN_DUMP_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

type Urgency = "now" | "soon" | "later";

/** The sorted plan as `brain_dump.prioritize` returns it. */
export type KeptPlan = {
  summary: string;
  priorities: { title: string; reason: string; urgency: Urgency }[];
};

export type BrainDumpSession = {
  draft: string;
  plan: KeptPlan | null;
  /** Plan line indices the person accepted, and the ones they set aside. */
  accepted: number[];
  rejected: number[];
};

/** The part of `Storage` this needs, so tests can pass a fake. */
export type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type Stored = BrainDumpSession & { v: number; savedAt: number };

const URGENCIES: readonly string[] = ["now", "soon", "later"];

/** This tab's sessionStorage, or null where there is none or it is blocked. */
export function tabSessionStore(): SessionStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Finished, or nothing to keep: an empty form, or a plan with every line set aside. */
export function isFinished(session: BrainDumpSession): boolean {
  const { plan } = session;
  if (!plan) return session.draft.trim() === "";
  const lines = plan.priorities.length;
  return lines > 0 && plan.priorities.every((_, index) => session.rejected.includes(index));
}

/** Keep the dump for this tab, or clear it when it is finished. False when storage refused. */
export function saveBrainDumpSession(
  store: SessionStore | null,
  session: BrainDumpSession,
  now: number
): boolean {
  if (!store) return false;
  if (isFinished(session)) return clearBrainDumpSession(store);
  const stored: Stored = {
    v: BRAIN_DUMP_SESSION_VERSION,
    savedAt: now,
    draft: session.draft,
    plan: session.plan,
    accepted: session.plan ? [...session.accepted] : [],
    rejected: session.plan ? [...session.rejected] : [],
  };
  try {
    store.setItem(BRAIN_DUMP_SESSION_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/** The kept dump, or null when there is none, it expired, or it can't be read. */
export function loadBrainDumpSession(
  store: SessionStore | null,
  now: number
): BrainDumpSession | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(BRAIN_DUMP_SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const session = parseStored(raw, now);
  // Expired, from another version, or damaged: drop it so it isn't read again.
  if (!session) clearBrainDumpSession(store);
  return session;
}

/** Forget the kept dump. False when storage refused. */
export function clearBrainDumpSession(store: SessionStore | null): boolean {
  if (!store) return false;
  try {
    store.removeItem(BRAIN_DUMP_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

function parseStored(raw: string, now: number): BrainDumpSession | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== BRAIN_DUMP_SESSION_VERSION) return null;
  const { savedAt, draft } = value;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (now - savedAt >= BRAIN_DUMP_SESSION_TTL_MS) return null;
  if (typeof draft !== "string") return null;
  const plan = parsePlan(value.plan);
  if (!plan) {
    // No plan yet, or a damaged one: the typed dump still comes back, without choices.
    const typedOnly: BrainDumpSession = { draft, plan: null, accepted: [], rejected: [] };
    return isFinished(typedOnly) ? null : typedOnly;
  }
  const rejected = indices(value.rejected, plan.priorities.length);
  const accepted = indices(value.accepted, plan.priorities.length).filter(
    (i) => !rejected.includes(i)
  );
  const session = { draft, plan, accepted, rejected };
  return isFinished(session) ? null : session;
}

function parsePlan(value: unknown): KeptPlan | null {
  if (!isRecord(value) || typeof value.summary !== "string" || !Array.isArray(value.priorities)) {
    return null;
  }
  const priorities: KeptPlan["priorities"] = [];
  for (const item of value.priorities) {
    if (!isRecord(item)) return null;
    const { title, reason, urgency } = item;
    if (typeof title !== "string" || typeof reason !== "string") return null;
    if (typeof urgency !== "string" || !URGENCIES.includes(urgency)) return null;
    priorities.push({ title, reason, urgency: urgency as Urgency });
  }
  return { summary: value.summary, priorities };
}

/** Whole, in-range, unique line indices; anything else is dropped. */
function indices(value: unknown, lines: number): number[] {
  if (!Array.isArray(value)) return [];
  const kept: number[] = [];
  for (const index of value) {
    if (Number.isInteger(index) && index >= 0 && index < lines && !kept.includes(index)) {
      kept.push(index);
    }
  }
  return kept;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
