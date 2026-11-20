import { describe, expect, test } from "bun:test";
import { draftCalendarEvent, pickUpcomingEvents } from "./calendar-event-draft";

describe("draftCalendarEvent", () => {
  test("builds a checked calendar event and trims its title", () => {
    expect(draftCalendarEvent({ title: "  Planning session  ", startsAtMs: 500 }, 100)).toEqual({
      ok: true,
      doc: {
        title: "Planning session",
        startsAtMs: 500,
        createdAt: 100,
        updatedAt: 100,
      },
    });
  });

  test("refuses a whitespace-only title", () => {
    expect(draftCalendarEvent({ title: "   ", startsAtMs: 500 }, 100)).toEqual({
      ok: false,
      reason: "empty_title",
    });
  });

  test("shortens a long title to 200 characters", () => {
    const result = draftCalendarEvent({ title: "x".repeat(300), startsAtMs: 500 }, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.title).toHaveLength(200);
  });

  test("refuses a negative or non-finite start and a bad current time", () => {
    expect(draftCalendarEvent({ title: "Event", startsAtMs: -1 }, 100)).toEqual({
      ok: false,
      reason: "bad_start",
    });
    expect(draftCalendarEvent({ title: "Event", startsAtMs: Number.NaN }, 100)).toEqual({
      ok: false,
      reason: "bad_start",
    });
    expect(draftCalendarEvent({ title: "Event", startsAtMs: 500 }, Number.NaN)).toEqual({
      ok: false,
      reason: "bad_now",
    });
  });

  test("does not put undefined values in the document", () => {
    const result = draftCalendarEvent({ title: "Event", startsAtMs: 500 }, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.values(result.doc)).not.toContain(undefined);
  });
});

describe("pickUpcomingEvents", () => {
  test("drops deleted and past events and orders equal starts by id", () => {
    const rows = [
      { id: "later", startsAtMs: 30 },
      { id: "b", startsAtMs: 20 },
      { id: "past", startsAtMs: 9 },
      { id: "deleted", startsAtMs: 10, deletedAt: 40 },
      { id: "a", startsAtMs: 20 },
      { id: "edge", startsAtMs: 10 },
    ];

    expect(pickUpcomingEvents(rows, 10).map(({ id }) => id)).toEqual([
      "edge",
      "a",
      "b",
      "later",
    ]);
  });

  test("cuts the sorted events to max", () => {
    const rows = [
      { id: "third", startsAtMs: 30 },
      { id: "first", startsAtMs: 10 },
      { id: "second", startsAtMs: 20 },
    ];
    expect(pickUpcomingEvents(rows, 0, 2).map(({ id }) => id)).toEqual(["first", "second"]);
    expect(pickUpcomingEvents(rows, Number.NaN)).toEqual([]);
    expect(pickUpcomingEvents(rows, 0, 0)).toEqual([]);
  });
});
