export type Urgency = "now" | "soon" | "later";

export type PlanItem = { title: string; reason: string; urgency: Urgency };

export type Plan = { summary: string; priorities: PlanItem[] };

/** Indices of the preview items the user accepted. Nothing is accepted at first. */
export type Selection = readonly number[];

export const MAX_ACCEPTED = 6;

export const URGENCY_ORDER: readonly Urgency[] = ["now", "soon", "later"];

export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "Now",
  soon: "Soon",
  later: "Later",
};

export function canSubmit(raw: string): boolean {
  return raw.trim().length > 0;
}

/** Accept an unchosen item, or take back an accepted one. */
export function toggleItem(selection: Selection, index: number): number[] {
  if (selection.includes(index)) return selection.filter((i) => i !== index);
  return [...selection, index];
}

/** Accepted items in plan order, capped at MAX_ACCEPTED. Titles are trimmed; blanks are dropped. */
export function acceptedItems(
  plan: Plan,
  selection: Selection,
): { title: string; urgency: Urgency }[] {
  const chosen = new Set(selection);
  const items: { title: string; urgency: Urgency }[] = [];
  plan.priorities.forEach((item, index) => {
    const title = item.title.trim();
    if (chosen.has(index) && title) items.push({ title, urgency: item.urgency });
  });
  return items.slice(0, MAX_ACCEPTED);
}

export type PlanGroup = { urgency: Urgency; items: { index: number; item: PlanItem }[] };

/** Groups in the order now, soon, later; empty groups are left out. Keeps each item's plan index. */
export function groupByUrgency(plan: Plan): PlanGroup[] {
  return URGENCY_ORDER.map((urgency) => ({
    urgency,
    items: plan.priorities
      .map((item, index) => ({ index, item }))
      .filter((entry) => entry.item.urgency === urgency),
  })).filter((group) => group.items.length > 0);
}
