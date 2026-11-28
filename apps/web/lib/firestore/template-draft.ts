import { checkTemplateDoc, type TemplateDoc } from "../firestore-docs/template-doc";

const TEMPLATE_NAME_MAX = 120;

type DraftTemplateResult =
  | { kind: "draft"; doc: TemplateDoc }
  | { kind: "refused"; reason: string };

const periodTypes = new Set<TemplateDoc["periodType"]>(["daily", "weekly", "monthly", "none"]);

export function draftTemplate(
  input: { name: unknown; body: unknown; periodType?: unknown; description?: unknown },
  now: number
): DraftTemplateResult {
  try {
    if (!Number.isFinite(now)) return { kind: "refused", reason: "now must be a finite number" };
    if (typeof input.name !== "string") {
      return { kind: "refused", reason: "name must be a string" };
    }

    const trimmedName = input.name.trim();
    let nameEnd = Math.min(trimmedName.length, TEMPLATE_NAME_MAX);
    if (nameEnd > 0 && nameEnd < trimmedName.length) {
      const cut = trimmedName.charCodeAt(nameEnd - 1);
      if (cut >= 0xd800 && cut <= 0xdbff) nameEnd -= 1;
    }
    const name = trimmedName.slice(0, nameEnd).trim();
    if (name.length === 0) return { kind: "refused", reason: "name must not be empty" };
    if (typeof input.body !== "string") {
      return { kind: "refused", reason: "body must be a string" };
    }

    const periodType = input.periodType === undefined ? "none" : input.periodType;
    if (
      typeof periodType !== "string" ||
      !periodTypes.has(periodType as TemplateDoc["periodType"])
    ) {
      return { kind: "refused", reason: "periodType is invalid" };
    }

    const description =
      typeof input.description === "string" ? input.description.trim() : undefined;
    const checked = checkTemplateDoc({
      name,
      body: input.body,
      periodType,
      ...(description ? { description } : {}),
      createdAt: now,
      updatedAt: now,
    });

    return checked.ok
      ? { kind: "draft", doc: checked.doc }
      : { kind: "refused", reason: checked.reason };
  } catch {
    return { kind: "refused", reason: "Template could not be drafted" };
  }
}
