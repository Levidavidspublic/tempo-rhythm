/**
 * /brain-dump keeps the typed dump and the last sorted plan for this tab, with the accept/reject
 * choices already made, so browser Back then Forward, or a reload, brings them back without a
 * second model call. Only in this tab's sessionStorage: never localStorage, never the server.
 *
 * Once every line of the plan is rejected, only the typed dump is kept, so it can be sorted again.
 * An empty form (after "Add accepted", after Clear, or deleted by hand) clears it all. A kept dump
 * expires 2 hours after its last change. Storage that throws (private mode, blocked site data, a
 * full quota) or holds bad JSON reads as nothing kept; it never breaks the screen.
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
  /** The page "Save as a page" made from this plan, so a restored plan isn't saved twice. */
  savedPageId: string | null;
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

/**
 * The part worth keeping: the dump with its open plan; the dump alone once every line is rejected
 * (the plan is done, the text can be sorted again); null for an empty form.
 */
export function toKeep(session: BrainDumpSession): BrainDumpSession | null {
  const { draft, plan, rejected } = session;
  const allRejected =
    plan !== null &&
    plan.priorities.length > 0 &&
    plan.priorities.every((_, index) => rejected.includes(index));
  if (plan && !allRejected) {
    return {
      draft,
      plan,
      accepted: [...session.accepted],
      rejected: [...rejected],
      savedPageId: session.savedPageId,
    };
  }
  return draft.trim() === ""
    ? null
    : { draft, plan: null, accepted: [], rejected: [], savedPageId: null };
}

/** Keep what `toKeep` keeps, or clear it for an empty form. False when storage refused. */
export function saveBrainDumpSession(
  store: SessionStore | null,
  session: BrainDumpSession,
  now: number
): boolean {
  if (!store) return false;
  const kept = toKeep(session);
  if (!kept) return clearBrainDumpSession(store);
  const stored: Stored = { v: BRAIN_DUMP_SESSION_VERSION, savedAt: now, ...kept };
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
  // No plan yet, or a damaged one: the typed dump still comes back, without choices.
  const plan = parsePlan(value.plan);
  const lines = plan ? plan.priorities.length : 0;
  const rejected = indices(value.rejected, lines);
  const accepted = indices(value.accepted, lines).filter((i) => !rejected.includes(i));
  const { savedPageId } = value;
  return toKeep({
    draft,
    plan,
    accepted,
    rejected,
    savedPageId: typeof savedPageId === "string" && savedPageId !== "" ? savedPageId : null,
  });
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
