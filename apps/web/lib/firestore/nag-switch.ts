import { parseNagDoc, type NagDoc } from "../firestore-docs/nag-doc";

export type NagSwitchPlan =
  | {
      kind: "patch";
      patch: { enabled: boolean; updatedAt: number };
      fields: string[];
    }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

/** Plans a checked, immutable Firestore patch for switching a nag on or off. */
export function planNagSwitch(stored: NagDoc, enabled: unknown, now: number): NagSwitchPlan {
  try {
    if (stored.deletedAt !== undefined) {
      return { kind: "refused", reason: "nag is deleted" };
    }
    if (typeof enabled !== "boolean") {
      return { kind: "refused", reason: "enabled must be a boolean" };
    }
    if (!Number.isFinite(now)) {
      return { kind: "refused", reason: "now must be finite" };
    }
    if (stored.enabled === enabled) {
      return { kind: "unchanged" };
    }

    const patch = { enabled, updatedAt: now };
    parseNagDoc({ ...stored, ...patch });

    return { kind: "patch", patch, fields: Object.keys(patch).sort() };
  } catch {
    return { kind: "refused", reason: "nag could not be checked" };
  }
}
