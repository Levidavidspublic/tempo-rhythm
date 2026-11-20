import { NagDocError, parseNagDoc, type NagDoc } from "../firestore-docs/nag-doc";

export type NagDraftResult =
  | { kind: "draft"; doc: NagDoc }
  | { kind: "refused"; reason: string };

export function draftNag(label: unknown, now: number): NagDraftResult {
  if (typeof label !== "string") {
    return { kind: "refused", reason: "label must be a string" };
  }
  if (!Number.isFinite(now)) {
    return { kind: "refused", reason: "now must be a finite number" };
  }

  const labelCodePoints = Array.from(label.trim()).slice(0, 120);
  while (labelCodePoints.join("").length > 120) {
    labelCodePoints.pop();
  }
  const normalizedLabel = labelCodePoints.join("").trim();
  if (normalizedLabel.length === 0) {
    return { kind: "refused", reason: "label is empty" };
  }

  try {
    const doc = parseNagDoc({
      label: normalizedLabel,
      enabled: true,
      phrases: [],
      createdAt: now,
      updatedAt: now,
    });
    return { kind: "draft", doc };
  } catch (error) {
    if (error instanceof NagDocError) {
      return { kind: "refused", reason: error.message };
    }
    return { kind: "refused", reason: "nag could not be validated" };
  }
}
