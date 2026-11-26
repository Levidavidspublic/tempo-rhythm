export type ProposalTask = { taskId: string; title: string; minutes: number };

export type ProposalInput = {
  tasks: ProposalTask[];
  tenSecondAction: string;
  realism: { ok: boolean };
};

export type SettingsInput = { taskLoad: number };
export type BadDayInput = { isBadDay: boolean };

export type ProposalView = {
  heading: string;
  taskLines: string[];
  tenSecondAction: string;
  realismNote: string;
  loadNote: string;
};

export const BAD_DAY_BANNER = "Rough day? Keeping it light.";
export const REJECTED_COPY = "No problem. We can try again whenever.";
export const EMPTY_COPY = "Nothing to plan yet. Add a task or do a brain dump.";
export const ERROR_COPY = "That didn't work. Try again?";
export const REALISM_OK = "This fits the time you have.";
export const REALISM_TOO_MUCH = "This is a lot for the time you have. Want fewer?";

export function taskCount(n: number): string {
  return n === 1 ? "1 task" : `${n} tasks`;
}

export function nextLoadNote(taskLoad: number): string {
  return `Next time: ${taskCount(taskLoad)}`;
}

function minutesLabel(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1;
  return `${m} min`;
}

export function toView(
  proposal: ProposalInput,
  _settings: SettingsInput | undefined,
  badDay: BadDayInput | undefined,
): ProposalView {
  const count = proposal.tasks.length;
  return {
    heading: "Your plan for today",
    taskLines: proposal.tasks.map((t) => `${t.title} (${minutesLabel(t.minutes)})`),
    tenSecondAction: proposal.tenSecondAction,
    realismNote: proposal.realism.ok ? REALISM_OK : REALISM_TOO_MUCH,
    loadNote: badDay?.isBadDay ? `Lighter day: ${taskCount(count)}` : `Today: ${taskCount(count)}`,
  };
}
