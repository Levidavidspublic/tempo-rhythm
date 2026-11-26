import { describe, expect, test } from "bun:test";
import { themeInitScript } from "../theme-script";
import {
  currentTier,
  formatUsd,
  isEarlyAccess,
  isOnTrial,
  type PlanSnapshot,
  TIERS,
  tierPrice,
} from "./billing";
import { clampDial, DIAL_DEFAULT, dialWord } from "./dial";
import { finishArgs, isOptionalStep, parseStep, prefillName } from "./onboarding";
import { profileErrors } from "./profile";
import { applyTextSize, readTextSize, TEXT_SIZE_STORAGE_KEY } from "./textSize";

describe("coach dial", () => {
  test("words follow the design: quiet 0–3, steady 4–7, push 8–10", () => {
    expect([0, 3].map(dialWord)).toEqual(["quiet", "quiet"]);
    expect([4, 7].map(dialWord)).toEqual(["steady", "steady"]);
    expect([8, 10].map(dialWord)).toEqual(["push", "push"]);
  });
  test("clamps to whole numbers from 0 to 10 and defaults to 4", () => {
    expect(clampDial(-3)).toBe(0);
    expect(clampDial(12)).toBe(10);
    expect(clampDial(6.4)).toBe(6);
    expect(clampDial(Number.NaN)).toBe(DIAL_DEFAULT);
    expect(clampDial(undefined)).toBe(4);
  });
});

describe("billing", () => {
  const plan = (patch: Partial<PlanSnapshot>): PlanSnapshot => ({
    plan: "none",
    status: "inactive",
    isBeta: false,
    ...patch,
  });

  test("prices: a year costs ten months, the trial is $1 for 3 weeks", () => {
    const byId = Object.fromEntries(TIERS.map((tier) => [tier.id, tier]));
    expect(tierPrice(byId.basic!, "month")).toEqual({ amount: 10, per: "month" });
    expect(tierPrice(byId.basic!, "year")).toEqual({ amount: 100, per: "year" });
    expect(tierPrice(byId.max!, "year")).toEqual({ amount: 400, per: "year" });
    expect(tierPrice(byId.trial!, "year")).toEqual({ amount: 1, per: "3w" });
    expect(byId.pro!.liveVoiceMinutes).toBe(90);
    expect(byId.max!.liveVoiceMinutes).toBe(180);
    expect(formatUsd(20)).toBe("$20");
  });

  test("early-access accounts have Max and are never on a trial", () => {
    const early = plan({ plan: "max", status: "active", isBeta: true });
    expect(isEarlyAccess(early)).toBe(true);
    expect(currentTier(early)).toBe("max");
    expect(isOnTrial(plan({ plan: "trial", status: "active", isBeta: true }))).toBe(false);
  });

  test("a live plan is the current tier; none or inactive has no current tier", () => {
    expect(currentTier(plan({ plan: "pro", status: "active" }))).toBe("pro");
    expect(currentTier(plan({ plan: "basic", status: "grace" }))).toBe("basic");
    expect(currentTier(plan({ plan: "pro", status: "cancelled" }))).toBeNull();
    expect(currentTier(plan({ plan: "none", status: "active" }))).toBeNull();
    expect(isOnTrial(plan({ plan: "trial", status: "active" }))).toBe(true);
    expect(isOnTrial(plan({ plan: "trial", status: "inactive" }))).toBe(false);
  });
});

describe("onboarding steps", () => {
  test("?step= opens steps 1 to 5; anything else opens step 1", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep("9")).toBe(5);
    expect(parseStep("0")).toBe(1);
    expect(parseStep("abc")).toBe(1);
    expect(parseStep(null)).toBe(1);
  });
  test("only the name and brain dump steps can be skipped", () => {
    expect([1, 2, 3, 4, 5].filter(isOptionalStep)).toEqual([2, 4]);
  });
  test("the name field never starts with the 'there' fallback", () => {
    expect(prefillName("  Sam  ")).toBe("  Sam  ");
    expect(prefillName("there")).toBe("");
    expect(prefillName(undefined)).toBe("");
  });
  test("finish keeps the trimmed name unless the name step was skipped or blank", () => {
    expect(finishArgs("  Sam  ", false)).toEqual({ fullName: "Sam" });
    expect(finishArgs("Sam", true)).toEqual({});
    expect(finishArgs("   ", false)).toEqual({});
  });
});

describe("profile checks", () => {
  test("a blank name is the one error; a name is fine", () => {
    expect(profileErrors({ fullName: "  " })).toEqual([{ field: "profile-name", message: "set.profile.nameErr" }]);
    expect(profileErrors({ fullName: "Maya" })).toEqual([]);
  });
});

describe("text size", () => {
  test("unknown values read as medium; medium clears the attribute", () => {
    expect(readTextSize("l")).toBe("l");
    expect(readTextSize("xl")).toBe("m");
    expect(readTextSize(null)).toBe("m");
    const attrs: Record<string, string> = {};
    const root = {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
      removeAttribute: (name: string) => {
        delete attrs[name];
      },
    };
    applyTextSize(root, "s");
    expect(attrs["data-text-size"]).toBe("s");
    applyTextSize(root, "m");
    expect(attrs["data-text-size"]).toBeUndefined();
  });

  test("the pre-hydration script applies a stored small or large size", () => {
    const run = (stored: string | null) => {
      const attrs: Record<string, string> = {};
      const root = {
        lang: "",
        dir: "",
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
        removeAttribute: (name: string) => {
          delete attrs[name];
        },
      };
      const localStorage = { getItem: (key: string) => (key === TEXT_SIZE_STORAGE_KEY ? stored : null) };
      new Function("document", "location", "localStorage", themeInitScript())(
        { documentElement: root },
        { search: "" },
        localStorage,
      );
      return attrs["data-text-size"];
    };
    expect(run("l")).toBe("l");
    expect(run("s")).toBe("s");
    expect(run("m")).toBeUndefined();
    expect(run("huge")).toBeUndefined();
  });
});
