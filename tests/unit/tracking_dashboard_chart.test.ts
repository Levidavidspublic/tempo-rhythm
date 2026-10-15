import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrackingDashboardPoints } from "../../apps/mobile/lib/tracking-dashboard-data";

describe("buildTrackingDashboardPoints", () => {
  test("returns an empty list when nothing is logged", () => {
    expect(buildTrackingDashboardPoints([])).toEqual([]);
  });

  test("centers a single session and scales y from the chart floor", () => {
    const [point] = buildTrackingDashboardPoints(
      [{ id: "one", loggedAt: 1_700_000_000_000, focusMinutes: 25 }],
      { width: 280, height: 128, padding: 16 },
    );

    expect(point).toMatchObject({
      id: "one",
      focusMinutes: 25,
      x: 140,
      y: 16,
    });
  });

  test("places first and last sessions on the drawable edges", () => {
    const points = buildTrackingDashboardPoints(
      [
        { id: "early", loggedAt: 1_700_000_000_000, focusMinutes: 10 },
        { id: "late", loggedAt: 1_700_086_400_000, focusMinutes: 40 },
      ],
      { width: 280, height: 128, padding: 16 },
    );

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ id: "early", x: 16, y: 88 });
    expect(points[1]).toMatchObject({ id: "late", x: 264, y: 16 });
  });

  test("sorts by loggedAt so later sessions sit to the right", () => {
    const points = buildTrackingDashboardPoints(
      [
        { id: "later", loggedAt: 200, focusMinutes: 20 },
        { id: "earlier", loggedAt: 100, focusMinutes: 20 },
      ],
      { width: 200, height: 100, padding: 10 },
    );

    expect(points.map((point) => point.id)).toEqual(["earlier", "later"]);
    expect(points[0]?.x).toBe(10);
    expect(points[1]?.x).toBe(190);
  });
});

describe("mobile tracking leftover wiring", () => {
  const root = join(import.meta.dir, "../..");

  test("tracking screen renders the chart and does not overwrite today", () => {
    const screen = readFileSync(
      join(root, "apps/mobile/app/(tempo)/tracking.tsx"),
      "utf8",
    );
    const today = readFileSync(
      join(root, "apps/mobile/app/(tempo)/(tabs)/today.tsx"),
      "utf8",
    );

    expect(screen).toContain("TrackingDashboardChart");
    expect(screen).toContain("sessionLogsToTrackingSessions");
    // Today is the v3 screen now; the leftover must still not move onto it.
    expect(today).toContain("docs/design/v3/screens/mobile/today.html");
    expect(today).not.toContain("TrackingDashboardChart");
  });
});
