import type { TemplateDoc } from "../firestore-docs/template-doc";

export type TemplateRow = { id: string } & Pick<
  TemplateDoc,
  "name" | "periodType" | "body" | "updatedAt"
> & {
    description?: string;
    deletedAt?: number;
  };

type TemplateListOptions = {
  search?: string;
  period?: TemplateDoc["periodType"];
};

type TemplateCounts = Record<TemplateDoc["periodType"], number> & { all: number };

export function pickTemplates<T extends TemplateRow>(
  rows: readonly T[],
  options: TemplateListOptions = {}
): {
  templates: T[];
  counts: TemplateCounts;
  isEmpty: boolean;
  noMatches: boolean;
} {
  const liveRows = rows.filter((row) => row.deletedAt === undefined);
  const counts: TemplateCounts = { daily: 0, weekly: 0, monthly: 0, none: 0, all: 0 };

  for (const row of liveRows) {
    counts[row.periodType] += 1;
    counts.all += 1;
  }

  const search = options.search?.trim().toLowerCase() ?? "";
  const templates = liveRows
    .filter(
      (row) =>
        (options.period === undefined || row.periodType === options.period) &&
        (search === "" ||
          row.name.toLowerCase().includes(search) ||
          row.description?.toLowerCase().includes(search) === true)
    )
    .toSorted(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
        right.updatedAt - left.updatedAt ||
        left.id.localeCompare(right.id)
    );

  return {
    templates,
    counts,
    isEmpty: counts.all === 0,
    noMatches: counts.all > 0 && templates.length === 0,
  };
}
