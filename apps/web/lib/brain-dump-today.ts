/**
 * Brain dump → Today (docs/APP-FLOW.md §3: "brain dump → proposal → Add N to Today").
 * `brain_dump.acceptPlan` adds every accepted line to Tasks; the lines marked Now then also get
 * today as their due date, so they show on Today and the coach's "what order should I do these
 * in?" can see them. Soon and Later stay in Tasks only, without a date.
 * The same rules hold on /brain-dump and in Today's brain-dump panel.
 */

type Urgency = "now" | "soon" | "later";

/** The ids of the Now lines: acceptPlan returns one id per item, in the items' order. */
export function nowTaskIds<T>(items: readonly { urgency: Urgency }[], taskIds: readonly T[]): T[] {
  return taskIds.filter((_, index) => items[index]?.urgency === "now");
}

/** The notice after Add accepted: how many were added, and whether the Now ones are on Today. */
export function addedNotice(created: number, onToday: number, t: (key: "bd.added" | "bd.addedToday") => string): string {
  return t(onToday > 0 ? "bd.addedToday" : "bd.added").replace("{n}", String(created));
}

type AcceptItem = { title: string; urgency: Urgency };

/**
 * Add the accepted lines, then put the Now ones on today, all at once. A Now line that cannot be
 * moved stays in Tasks; only the ones that moved are counted in `onToday`.
 */
export async function addAcceptedToToday<T>(
  items: readonly AcceptItem[],
  steps: {
    acceptPlan: (items: AcceptItem[]) => Promise<{ created: number; taskIds: T[] }>;
    putOnToday: (taskId: T) => Promise<unknown>;
  },
): Promise<{ created: number; onToday: number }> {
  const result = await steps.acceptPlan([...items]);
  const moved = await Promise.allSettled(nowTaskIds(items, result.taskIds).map((taskId) => steps.putOnToday(taskId)));
  return { created: result.created, onToday: moved.filter((outcome) => outcome.status === "fulfilled").length };
}

export type SortOutcome<Plan, Card> = { kind: "crisis"; card: Card } | { kind: "plan"; plan: Plan };

/**
 * Sort a dump the way /brain-dump does: crisis words get the fixed resources card (no model) and
 * never reach the sorter.
 */
export async function sortDump<Plan, Card>(
  text: string,
  steps: {
    isCrisis: (text: string) => Promise<boolean>;
    crisisCard: () => Promise<Card>;
    sort: (text: string) => Promise<Plan>;
  },
): Promise<SortOutcome<Plan, Card>> {
  if (await steps.isCrisis(text)) return { kind: "crisis", card: await steps.crisisCard() };
  return { kind: "plan", plan: await steps.sort(text) };
}
