import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_RING_SIZE,
  DEFAULT_RING_STROKE,
  WEEKLY_STREAK_GOAL,
  buildStreakRingGeometry,
} from "../../apps/mobile/lib/tracking-streak-ring";

describe("buildStreakRingGeometry", () => {
  test("keeps a zero streak empty", () => {
    const ring = buildStreakRingGeometry({ streakCount: 0 });
    const expectedCircumference =
      2 * Math.PI * ((DEFAULT_RING_SIZE - DEFAULT_RING_STROKE) / 2);

    expect(ring.progress).toBe(0);
    expect(ring.dashOffset).toBeCloseTo(expectedCircumference);
    expect(ring.weeklyGoal).toBe(WEEKLY_STREAK_GOAL);
    expect(ring.streakCount).toBe(0);
  });

  test("fills three of seven days", () => {
    const ring = buildStreakRingGeometry({ streakCount: 3, weeklyGoal: 7 });
    expect(ring.progress).toBeCloseTo(3 / 7);
    expect(ring.dashOffset).toBeCloseTo(ring.circumference * (4 / 7));
  });

  test("clamps a finished week to a full ring", () => {
    const full = buildStreakRingGeometry({ streakCount: 7, weeklyGoal: 7 });
    const over = buildStreakRingGeometry({ streakCount: 10, weeklyGoal: 7 });

    expect(full.progress).toBe(1);
    expect(full.dashOffset).toBe(0);
    expect(over.progress).toBe(1);
    expect(over.dashOffset).toBe(0);
  });

  test("treats a non-finite count as empty instead of inventing a streak", () => {
    expect(buildStreakRingGeometry({ streakCount: Number.NaN }).streakCount).toBe(
      0,
    );
    expect(buildStreakRingGeometry({ streakCount: -4 }).streakCount).toBe(0);
  });
});

describe("mobile streak ring leftover wiring", () => {
  const root = join(import.meta.dir, "../..");

  test("tracking uses the ring, Convex streaks.getCurrent, and no fake seed", () => {
    const screen = readFileSync(
      join(root, "apps/mobile/app/(tempo)/tracking.tsx"),
      "utf8",
    );
    const ring = readFileSync(
      join(root, "apps/mobile/components/tracking/TrackingStreakRing.tsx"),
      "utf8",
    );
    const today = readFileSync(
      join(root, "apps/mobile/app/(tempo)/(tabs)/today.tsx"),
      "utf8",
    );

    expect(screen).toContain("TrackingStreakRing");
    expect(screen).toContain("api.streaks.getCurrent");
    expect(screen).toContain("TrackingDashboardChart");
    expect(screen).toContain("sessions={sessions}");
    expect(screen).not.toContain("initialStreak");
    expect(ring).not.toContain("initialStreak");
    expect(ring).not.toContain("Count today");
    // Today is the v3 screen now; the leftover must still not move onto it.
    expect(today).toContain("docs/design/v3/screens/mobile/today.html");
    expect(today).not.toContain("TrackingStreakRing");
  });
});
