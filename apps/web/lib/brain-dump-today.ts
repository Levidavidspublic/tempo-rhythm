/**
 * Brain dump → Today (docs/APP-FLOW.md §3: "brain dump → proposal → Add N to Today").
 * `brain_dump.acceptPlan` adds every accepted line to Tasks; the lines marked Now then also get
 * today as their due date, so they show on Today and the coach's "what order should I do these
 * in?" can see them. Soon and Later stay in Tasks only.
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
