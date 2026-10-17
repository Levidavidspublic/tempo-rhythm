/**
 * Kitchen states pass: the plan screen offline. Convex holds a write until the connection is back,
 * so "Add these sessions", Undo and "Use these times" send nothing offline and say why in words,
 * instead of leaving a button on "Adding" for as long as the person is offline.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { localSlotToMs } from "../../../apps/web/components/calendar/gridData";
import { acceptBlock } from "../../../apps/web/components/calendar/plan/planForm";
import { ReplanPreview } from "../../../apps/web/components/calendar/plan/ReplanPanel";
import { type PlanTask, replanInput } from "../../../apps/web/components/calendar/plan/replanForm";
import { en, he } from "../../../apps/web/lib/i18n-groups/plan";
import { replanRest } from "../../../packages/core/plan/replan";

const ready = { sessions: 4, saving: false, pinned: false, title: "Maths exam", signedIn: "ready" as const, online: true };

describe("acceptBlock", () => {
  test("online, signed in, with a name: Add goes ahead", () => {
    expect(acceptBlock(ready)).toBeNull();
  });

  test("offline: nothing is sent, and the card says why", () => {
    expect(acceptBlock({ ...ready, online: false })).toBe("pp.offline.add");
  });

  test("the earlier checks still come first", () => {
    expect(acceptBlock({ ...ready, online: false, pinned: true })).toBe("skip");
    expect(acceptBlock({ ...ready, online: false, saving: true })).toBe("skip");
    expect(acceptBlock({ ...ready, online: false, sessions: 0 })).toBe("skip");
    expect(acceptBlock({ ...ready, online: false, title: "  " })).toBe("pp.err.title");
    expect(acceptBlock({ ...ready, online: false, signedIn: "signedOut" })).toBe("pp.signIn");
  });

  test("the offline words exist in both languages, without em dashes", () => {
    for (const key of ["pp.offline", "pp.offline.add", "pp.offline.undo", "rp.offline"] as const) {
      expect(en[key]).toBeTruthy();
      expect(he[key]).toBeTruthy();
      expect(`${en[key]}${he[key]}`).not.toContain("—");
    }
  });
});

describe("ReplanPreview offline", () => {
  const MIN = 60_000;
  const tasks: PlanTask[] = [
    { _id: "t1", title: "Learn: cells", status: "todo", dueAt: localSlotToMs("2026-10-19", 17 * 60), timeEstimate: 45 * MIN },
    { _id: "t2", title: "Learn: mitosis", status: "todo", dueAt: localSlotToMs("2026-10-22", 17 * 60), timeEstimate: 45 * MIN },
  ];
  const input = replanInput({
    deadline: "2026-10-30",
    tasks,
    source: { events: [], tasks: [] },
    now: { date: "2026-10-20", minute: 9 * 60 },
  });
  if (!input) throw new Error("expected input");
  const result = replanRest(input);
  const preview = (offline?: boolean) =>
    renderToStaticMarkup(
      createElement(ReplanPreview, {
        lang: "en" as const,
        result,
        titles: new Map(tasks.map((t) => [t._id, t.title])),
        deadline: "2026-10-30",
        leaveOut: false,
        offline,
        onLeaveOut: () => {},
        onAccept: () => {},
        onCancel: () => {},
      })
    );

  test("online, Use these times is on and nothing mentions the connection", () => {
    expect(result.moves.length).toBeGreaterThan(0);
    const html = preview();
    expect(html).not.toMatch(/data-action="replan-accept" disabled/);
    expect(html).not.toContain("You&#x27;re offline");
  });

  test("offline, Use these times is off and a line says why", () => {
    const html = preview(true);
    expect(html).toMatch(/data-action="replan-accept" disabled=""/);
    expect(html).toContain("You&#x27;re offline. Moving sessions needs a connection");
  });
});
