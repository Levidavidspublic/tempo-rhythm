import { checkTemplateDoc, type TemplateDoc } from "../firestore-docs/template-doc";

export type TemplateEdit = {
  name?: string;
  body?: string;
  description?: string;
  periodType?: string;
};

export type TemplateEditPlan =
  | { kind: "patch"; patch: Partial<TemplateDoc>; fields: string[] }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

const periodTypes = new Set<TemplateDoc["periodType"]>(["daily", "weekly", "monthly", "none"]);

export function planTemplateEdit(
  stored: TemplateDoc,
  edit: TemplateEdit,
  now: number
): TemplateEditPlan {
  try {
    if (stored.deletedAt !== undefined) {
      return { kind: "refused", reason: "template is deleted" };
    }

    const patch: Partial<TemplateDoc> = {};

    if (edit.name !== undefined) {
      const name = edit.name.trim().slice(0, 120).trim();
      if (name.length === 0) {
        return { kind: "refused", reason: "name must not be empty" };
      }
      if (name !== stored.name) patch.name = name;
    }
    if (edit.body !== undefined && edit.body !== stored.body) patch.body = edit.body;
    if (edit.description !== undefined) {
      const description = edit.description.trim();
      if (description !== stored.description) patch.description = description;
    }
    if (edit.periodType !== undefined) {
      if (!periodTypes.has(edit.periodType as TemplateDoc["periodType"])) {
        return { kind: "refused", reason: "period is invalid" };
      }
      if (edit.periodType !== stored.periodType) {
        patch.periodType = edit.periodType as TemplateDoc["periodType"];
      }
    }

    if (Object.keys(patch).length === 0) return { kind: "unchanged" };

    patch.updatedAt = now;
    const checked = checkTemplateDoc({ ...stored, ...patch });
    if (!checked.ok) return { kind: "refused", reason: checked.reason };

    return { kind: "patch", patch, fields: Object.keys(patch).sort() };
  } catch {
    return { kind: "refused", reason: "template could not be checked" };
  }
}
