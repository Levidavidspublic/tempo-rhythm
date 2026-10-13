import { describe, expect, test } from "bun:test";
import {
  emptyStateActionLabel,
  emptyStateLeaveQuiet,
  emptyStateReassurance,
  getTempoEmptyStateCopy,
  tempoEmptyStateCopy,
} from "../../apps/mobile/lib/tempo-empty-state";

const SHAME_WORDS = [
  /\bbehind\b/i,
  /\bfailing\b/i,
  /\blazy\b/i,
  /\boverdue\b/i,
  /\bforgot\b/i,
  /\bshould have\b/i,
];

const SCAFFOLD_SCREENS = [
  ["today", "apps/mobile/app/(tempo)/(tabs)/today.tsx"],
  ["tasks", "apps/mobile/app/(tempo)/(tabs)/tasks.tsx"],
  ["notes", "apps/mobile/app/(tempo)/(tabs)/notes.tsx"],
  ["coach", "apps/mobile/app/(tempo)/(tabs)/coach.tsx"],
  ["calendar", "apps/mobile/app/(tempo)/calendar.tsx"],
  ["capture", "apps/mobile/app/(tempo)/capture.tsx"],
  ["habits", "apps/mobile/app/(tempo)/habits.tsx"],
  ["journal", "apps/mobile/app/(tempo)/journal.tsx"],
  ["templates", "apps/mobile/app/(tempo)/templates.tsx"],
] as const;

describe("tempo empty-state copy", () => {
  test("covers the nine scaffold screens", () => {
    expect(Object.keys(tempoEmptyStateCopy).toSorted()).toEqual(
      SCAFFOLD_SCREENS.map(([id]) => id).toSorted(),
    );
  });

  test("every screen has a title, summary, and action", () => {
    for (const [screenId] of SCAFFOLD_SCREENS) {
      const copy = getTempoEmptyStateCopy(screenId);
      expect(copy.screenId).toBe(screenId);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(20);
      expect(copy.actionLabel.length).toBeGreaterThan(0);
    }
  });

  test("copy stays shame-free", () => {
    const blobs = [
      emptyStateReassurance,
      emptyStateLeaveQuiet,
      ...Object.values(tempoEmptyStateCopy).flatMap((copy) => [
        copy.title,
        copy.summary,
        copy.actionLabel,
      ]),
    ];

    for (const text of blobs) {
      for (const shame of SHAME_WORDS) {
        expect(text).not.toMatch(shame);
      }
    }
  });

  test("default action label is gentle", () => {
    expect(emptyStateActionLabel()).toBe("Start gently");
    expect(emptyStateActionLabel("Write one line")).toBe("Write one line");
  });
});

describe("tempo empty-state screens", () => {
  // The T-F008 scaffolds were replaced by the v3 mobile screens (docs/design/v3/screens/mobile);
  // each screen now carries its own design empty state, so this checks the replacement instead.
  test.each([...SCAFFOLD_SCREENS])(
    "%s is the v3 screen and keeps a default export",
    async (screenId, filePath) => {
      const source = await Bun.file(filePath).text();
      expect(source).toContain(`docs/design/v3/screens/mobile/${screenId}.html`);
      expect(source).not.toContain("T-F008 scaffold");
      expect(source).toMatch(/export default function \w+/);
    },
  );

  test("routines and settings keep their landed content", async () => {
    const routines = await Bun.file(
      "apps/mobile/app/(tempo)/routines.tsx",
    ).text();
    const settings = await Bun.file(
      "apps/mobile/app/(tempo)/settings.tsx",
    ).text();

    expect(routines).toContain("BreathworkTimer");
    expect(routines).not.toContain("TempoEmptyState");
    expect(settings).toContain('href="/accessibility"');
    expect(settings).not.toContain("TempoEmptyState");
  });
});
