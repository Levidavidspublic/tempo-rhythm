export const BLOCK_KINDS = ["focus", "task", "habit", "break", "other"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type BlockFormInput = {
  localDate: string;
  title: string;
  /** `HH:MM`, 24-hour. */
  start: string;
  durationMinutes: number;
  kind: BlockKind;
  taskId?: string;
  habitId?: string;
};

export type BlockFormValue = {
  localDate: string;
  title: string;
  startMinute: number;
  durationMinutes: number;
  startsAtMs: number;
  endsAtMs: number;
  kind: BlockKind;
  taskId?: string;
  habitId?: string;
};

export type BlockFormErrors = Partial<
  Record<"title" | "start" | "durationMinutes" | "kind" | "localDate", string>
>;

export type BlockFormResult =
  | { ok: true; value: BlockFormValue }
  | { ok: false; errors: BlockFormErrors };

const MINUTES_PER_DAY = 1440;

export function profileGatedArgs<Args>(
  isAuthenticated: boolean,
  profile: unknown,
  args: Args
): Args | "skip" {
  return isAuthenticated && profile != null ? args : "skip";
}

export function minuteToTimeString(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseStart(start: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function parseBlockForm(input: BlockFormInput): BlockFormResult {
  const errors: BlockFormErrors = {};

  const title = input.title.trim();
  if (!title) errors.title = "Give this block a name.";

  const startMinute = parseStart(input.start);
  if (startMinute === null) errors.start = "Pick a start time between 00:00 and 23:59.";

  const { durationMinutes } = input;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720) {
    errors.durationMinutes = "Length must be a whole number of minutes from 5 to 720.";
  } else if (startMinute !== null && startMinute + durationMinutes > MINUTES_PER_DAY) {
    errors.durationMinutes = "This block runs past midnight. Shorten it or start earlier.";
  }

  if (!(BLOCK_KINDS as readonly string[]).includes(input.kind)) {
    errors.kind = "Pick a type for this block.";
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.localDate);
  let dayStart: Date | null = null;
  if (dateMatch) {
    const y = Number(dateMatch[1]);
    const mo = Number(dateMatch[2]);
    const d = Number(dateMatch[3]);
    const candidate = new Date(y, mo - 1, d);
    if (
      candidate.getFullYear() === y &&
      candidate.getMonth() === mo - 1 &&
      candidate.getDate() === d
    ) {
      dayStart = candidate;
    }
  }
  if (!dayStart) errors.localDate = "That date isn't valid.";

  if (Object.keys(errors).length > 0 || startMinute === null || !dayStart) {
    return { ok: false, errors };
  }

  const startsAtMs = new Date(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
    Math.floor(startMinute / 60),
    startMinute % 60
  ).getTime();

  const value: BlockFormValue = {
    localDate: input.localDate,
    title,
    startMinute,
    durationMinutes,
    startsAtMs,
    endsAtMs: startsAtMs + durationMinutes * 60_000,
    kind: input.kind,
  };
  if (input.taskId) value.taskId = input.taskId;
  if (input.habitId) value.habitId = input.habitId;
  return { ok: true, value };
}
