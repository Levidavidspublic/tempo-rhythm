/**
 * Kitchen T3 study copy: every key exists in English and Hebrew, the labels handed to the
 * @tempo/ui study components are never empty, and the words stay kind (no "failed", "must",
 * "overdue", "streak", no em dashes, no emoji).
 */
import { describe, expect, test } from "bun:test";
import { emptyLabelKeys } from "../../../packages/ui/src/study/shared";
import { en, he } from "../../../apps/web/lib/i18n-groups/study";
import { MESSAGES, translate } from "../../../apps/web/lib/i18n";
import { deckLabels, quizLabels, reviewLabels, scoreLabels, testLabels } from "../../../apps/web/components/study/labels";

const keys = Object.keys(en) as (keyof typeof en)[];

describe("study copy", () => {
  test("every key has non-empty English and Hebrew, merged into the app's messages", () => {
    for (const key of keys) {
      expect(en[key].trim().length).toBeGreaterThan(0);
      expect(he[key]?.trim().length ?? 0).toBeGreaterThan(0);
      expect(MESSAGES.en[key]).toBe(en[key]);
      expect(MESSAGES.he[key]).toBe(he[key]);
    }
    expect(Object.keys(he).sort()).toEqual([...keys].sort());
  });
  test("placeholders match between languages", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of keys) expect(`${key}:${slots(he[key])}`).toBe(`${key}:${slots(en[key])}`);
  });
  test("kind words only: no shaming, no pressure, no em dashes or emoji", () => {
    for (const text of [...Object.values(en), ...Object.values(he)]) {
      expect(text).not.toMatch(/\b(failed|fail|must|overdue|streaks?|leaderboard|level up)\b/i);
      expect(text).not.toContain("—");
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  test("Hebrew is in the neutral plural (no gendered singular imperatives)", () => {
    for (const text of Object.values(he)) expect(text).not.toMatch(/\b(בחר|בחרי|הוסף|הוסיפי|נסה|נסי|פתח|פתחי)\b/);
  });
  test("the study components never get an empty label, in either language", () => {
    for (const lang of ["en", "he"] as const) {
      const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
      const all = { deck: deckLabels(t), review: reviewLabels(t), quiz: quizLabels(t), test: testLabels(t), score: scoreLabels(t, "points") };
      expect(emptyLabelKeys(all)).toEqual([]);
    }
  });
  test("a near miss in typed recall reads \"Almost\" in English, never \"Close\" (a dismiss word read aloud)", () => {
    expect(translate("en", "st.rc.close")).toBe("Almost");
    expect(translate("he", "st.rc.close")).toBe("קרובה");
  });
  test("nav, crumbs and the command bar know Study", () => {
    expect(translate("en", "nav.study")).toBe("Study");
    expect(translate("he", "nav.study")).toBe("לימוד");
  });
});
