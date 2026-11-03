import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "@tempo/utils";
import { dailyPageDraft, dailyPageMeta, applyTokens, newBlockId } from "../../apps/mobile/lib/v3/daily-page";
import {
  addDays,
  clockTime,
  daysBetween,
  endOfDayDueAt,
  isEndOfDay,
  localDayBounds,
  localIsoDate,
  mondayOf,
  parseClock,
  partOfDay,
  weekDates,
  weekdayOf,
} from "../../apps/mobile/lib/v3/dates";
import { clampDial, countByDate, dialWord, editedWhen, initials, isOffline, noteKind, topTags } from "../../apps/mobile/lib/v3/display";
import { lastSevenDays, needsWelcomeBack } from "../../apps/mobile/lib/v3/habits";
import {
  buildJournalSection,
  findJournalSection,
  type JournalLabels,
  parseJournalSection,
  readJournal,
  upsertJournalSection,
} from "../../apps/mobile/lib/v3/journal";
import { isResumable, parseRun, runCounts, runReducer, startRun } from "../../apps/mobile/lib/v3/routine-run";
import { STRINGS } from "../../apps/mobile/lib/v3/strings";
import {
  energyWord,
  filterGroups,
  focusMinutes,
  formatCountdown,
  groupsAreEmpty,
  groupTasks,
  nextUpReason,
  pickNextUp,
  planEnergyWord,
  type TaskLike,
  taskMinutes,
} from "../../apps/mobile/lib/v3/tasks";
import { UNDO_MS, undoCountdown, undoLeftMs } from "../../apps/mobile/lib/v3/undo";

describe("dates", () => {
  test("calendar arithmetic on YYYY-MM-DD", () => {
    expect(addDays("2026-10-12", 1)).toBe("2026-10-13");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(weekdayOf("2026-10-13")).toBe(2);
    expect(weekDates("2026-10-12")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(daysBetween("2026-10-05", "2026-10-12")).toBe(7);
  });

  test("local day bounds and the end-of-day due time", () => {
    const { startMs, endMs } = localDayBounds("2026-10-13");
    expect(localIsoDate(new Date(startMs))).toBe("2026-10-13");
    expect(localIsoDate(new Date(endMs))).toBe("2026-10-14");
    expect(endOfDayDueAt("2026-10-13")).toBe(endMs - 1);
    expect(isEndOfDay(endOfDayDueAt("2026-10-13"))).toBe(true);
    expect(isEndOfDay(startMs + 9 * 3_600_000)).toBe(false);
  });

  test("24-hour clock in and out", () => {
    const d = new Date(2026, 9, 13, 8, 5);
    expect(clockTime(d.getTime())).toBe("08:05");
    expect(parseClock("14:30")).toBe(870);
    expect(parseClock("9.05")).toBe(545);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("noon")).toBeNull();
  });

  test("greeting part of day", () => {
    expect(partOfDay(7)).toBe("morning");
    expect(partOfDay(13)).toBe("afternoon");
    expect(partOfDay(21)).toBe("evening");
    expect(partOfDay(2)).toBe("evening");
  });
});

function task(partial: Partial<TaskLike> & { _id: string }): TaskLike {
  return { title: partial._id, status: "todo", priority: "medium", createdAt: 1, updatedAt: 1, ...partial };
}

describe("tasks", () => {
  const start = new Date(2026, 9, 13).getTime();
  const end = new Date(2026, 9, 14).getTime();
  const rows = [
    task({ _id: "today", dueAt: start + 3_600_000 }),
    task({ _id: "earlier", dueAt: start - 86_400_000 }),
    task({ _id: "later", dueAt: end + 86_400_000 }),
    task({ _id: "inbox", createdAt: 5 }),
    task({ _id: "done", status: "done", completedAt: start + 60_000 }),
    task({ _id: "doneYesterday", status: "done", completedAt: start - 60_000 }),
    task({ _id: "cancelled", status: "cancelled", dueAt: start + 1 }),
  ];

  test("groups: earlier due dates sit in Today, never marked late", () => {
    const g = groupTasks(rows, start, end);
    expect(g.today.map((t) => t._id)).toEqual(["earlier", "today"]);
    expect(g.upcoming.map((t) => t._id)).toEqual(["later"]);
    expect(g.inbox.map((t) => t._id)).toEqual(["inbox"]);
    expect(g.doneToday.map((t) => t._id)).toEqual(["done"]);
  });

  test("filter and search", () => {
    const g = groupTasks(rows, start, end);
    const inbox = filterGroups(g, "inbox", "");
    expect(inbox.today).toEqual([]);
    expect(inbox.doneToday).toEqual([]);
    expect(inbox.inbox).toHaveLength(1);
    expect(filterGroups(g, "all", "LATER").upcoming).toHaveLength(1);
    expect(groupsAreEmpty(filterGroups(g, "all", "nothing like this"))).toBe(true);
  });

  test("next up: started, then important, then earliest due; Not now moves it last", () => {
    const list = [
      task({ _id: "a", dueAt: 5 }),
      task({ _id: "b", dueAt: 9, priority: "high" }),
      task({ _id: "c", dueAt: 20, status: "in_progress" }),
    ];
    expect(pickNextUp(list, new Set())?._id).toBe("c");
    expect(pickNextUp(list, new Set(["c"]))?._id).toBe("b");
    expect(pickNextUp(list, new Set(["c", "b"]))?._id).toBe("a");
    expect(pickNextUp([task({ _id: "x", status: "done" })], new Set())).toBeNull();
    expect(nextUpReason(list[2] as TaskLike)).toBe("started");
    expect(nextUpReason(list[1] as TaskLike)).toBe("high");
    expect(nextUpReason(list[0] as TaskLike)).toBe("due");
  });

  test("minutes, focus length and the countdown", () => {
    expect(taskMinutes({ timeEstimate: 25 * 60_000 })).toBe(25);
    expect(taskMinutes({})).toBeNull();
    expect(focusMinutes({})).toBe(25);
    expect(focusMinutes({ timeEstimate: 60_000 })).toBe(5);
    expect(focusMinutes({ timeEstimate: 3 * 3_600_000 })).toBe(90);
    expect(formatCountdown(292_000)).toBe("4:52");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  test("energy words", () => {
    expect(energyWord("low")).toBe("quiet");
    expect(energyWord(undefined)).toBe("steady");
    expect(planEnergyWord("high")).toBe("push");
    expect(planEnergyWord(undefined)).toBeNull();
  });
});

describe("undo window", () => {
  test("five minutes, counted down, then closed", () => {
    expect(UNDO_MS).toBe(300_000);
    expect(undoCountdown(0, 1000)).toBe("4:59");
    expect(undoLeftMs(0, 400_000)).toBe(0);
    expect(undoCountdown(0, 300_000)).toBeNull();
  });
});

describe("habits", () => {
  test("seven days ending today, oldest first", () => {
    const days = lastSevenDays("2026-10-12", new Set(["2026-10-06", "2026-10-12"]));
    expect(days.map((d) => d.date)).toEqual(weekDates("2026-10-06"));
    expect(days[0]?.done).toBe(true);
    expect(days[1]?.done).toBe(false);
    expect(days[6]).toMatchObject({ today: true, done: true, day: 12, weekday: 1 });
  });

  test("welcome back after 7+ days without a log, never for a new habit", () => {
    const old = new Date(2026, 8, 1).getTime();
    const fresh = new Date(2026, 9, 10).getTime();
    expect(needsWelcomeBack({ todayIso: "2026-10-12", createdAt: old, lastLoggedIso: "2026-10-01" })).toBe(true);
    expect(needsWelcomeBack({ todayIso: "2026-10-12", createdAt: old, lastLoggedIso: "2026-10-08" })).toBe(false);
    expect(needsWelcomeBack({ todayIso: "2026-10-12", createdAt: old, lastLoggedIso: null })).toBe(true);
    expect(needsWelcomeBack({ todayIso: "2026-10-12", createdAt: fresh, lastLoggedIso: null })).toBe(false);
  });
});

describe("guided routine run", () => {
  test("done, skip, back, pause and finish", () => {
    let run = startRun("r", 3, 1);
    run = runReducer(run, { type: "done", now: 2 });
    run = runReducer(run, { type: "pause", now: 3 });
    expect(run).toMatchObject({ index: 1, paused: true, pausedAt: 3 });
    expect(isResumable(run)).toBe(true);
    run = runReducer(run, { type: "skip", now: 4 });
    expect(run.paused).toBe(false);
    run = runReducer(run, { type: "back", now: 5 });
    expect(run.index).toBe(1);
    expect(run.marks).toEqual(["done", "open", "open"]);
    run = runReducer(run, { type: "skip", now: 6 });
    run = runReducer(run, { type: "done", now: 7 });
    expect(run.finished).toBe(true);
    expect(runCounts(run)).toEqual({ done: 2, skipped: 1 });
    expect(runReducer(run, { type: "done", now: 8 })).toBe(run);
    expect(isResumable(run)).toBe(false);
  });

  test("a saved run is read back only when it still fits the routine", () => {
    const run = runReducer(startRun("r", 3, 1), { type: "done", now: 2 });
    expect(parseRun(JSON.stringify(run), "r", 3)).toEqual(run);
    expect(parseRun(JSON.stringify(run), "r", 4)).toBeNull();
    expect(parseRun(JSON.stringify(run), "other", 3)).toBeNull();
    expect(parseRun("{broken", "r", 3)).toBeNull();
    expect(parseRun(null, "r", 3)).toBeNull();
  });
});

describe("display rules", () => {
  test("dial word: quiet 0–3, steady 4–7, push 8–10", () => {
    expect([0, 3, 4, 7, 8, 10].map(dialWord)).toEqual(["quiet", "quiet", "steady", "steady", "push", "push"]);
    expect(clampDial(14)).toBe(10);
    expect(clampDial(-2)).toBe(0);
  });

  test("offline only after a first connection", () => {
    expect(isOffline({ isWebSocketConnected: false, hasEverConnected: false })).toBe(false);
    expect(isOffline({ isWebSocketConnected: false, hasEverConnected: true })).toBe(true);
    expect(isOffline({ isWebSocketConnected: true, hasEverConnected: true })).toBe(false);
  });

  test("initials never spell the placeholder", () => {
    expect(initials("Maya Ronen")).toBe("MR");
    expect(initials("דנה")).toBe("ד");
    expect(initials("User")).toBe("");
    expect(initials(undefined)).toBe("");
  });

  test("note kind, edited label, counts and tags", () => {
    expect(noteKind({ pageType: "daily" })).toBe("daily");
    expect(noteKind({ periodType: "weekly" })).toBe("weekly");
    expect(noteKind({})).toBe("note");
    const now = new Date(2026, 9, 13, 12).getTime();
    expect(editedWhen(new Date(2026, 9, 13, 8).getTime(), now)).toEqual({ kind: "time" });
    expect(editedWhen(new Date(2026, 9, 12, 8).getTime(), now)).toEqual({ kind: "yesterday" });
    expect(editedWhen(new Date(2026, 9, 9, 8).getTime(), now)).toEqual({ kind: "day", iso: "2026-10-09" });
    expect(editedWhen(new Date(2026, 9, 1, 8).getTime(), now)).toEqual({ kind: "date", iso: "2026-10-01" });
    const at = new Date(2026, 9, 13, 9).getTime();
    expect(countByDate([at, at + 1000], ["2026-10-12", "2026-10-13"])).toEqual({ "2026-10-12": 0, "2026-10-13": 2 });
    expect(topTags([["a", "b"], ["b"], ["c", "b", "a"]], 2)).toEqual(["b", "a"]);
  });
});

const J = STRINGS.journal;
const LABELS: JournalLabels = {
  heading: J["page.title"],
  moodQ: J["mood.q"],
  q1: J["q1.label"],
  q2: J["q2.label"],
  mood: { low: J["mood.low"], okay: J["mood.okay"], good: J["mood.good"] },
};
const copy = (i: 0 | 1) => ({
  heading: J["page.title"][i],
  moodQ: J["mood.q"][i],
  q1: J["q1.label"][i],
  q2: J["q2.label"][i],
  mood: { low: J["mood.low"][i], okay: J["mood.okay"][i], good: J["mood.good"][i] },
});

describe("journal section in the daily page", () => {
  const entry = { mood: "okay" as const, q1: "The morning felt rushed.", q2: "Packed two boxes." };

  test("builds plain Markdown and reads it back, in either language", () => {
    const en = buildJournalSection(entry, copy(0));
    expect(en).toBe(
      "## Journal\n\n**How was today, overall?** Okay\n\n**What took energy today?**\nThe morning felt rushed.\n\n**One small thing that went well**\nPacked two boxes.\n",
    );
    expect(parseJournalSection(en, LABELS)).toEqual(entry);
    const he = buildJournalSection({ ...entry, q1: "בוקר לחוץ." }, copy(1));
    expect(he.startsWith("## יומן\n")).toBe(true);
    expect(readJournal(`intro\n\n${he}`, LABELS)).toEqual({ ...entry, q1: "בוקר לחוץ." });
  });

  test("empty parts are left out", () => {
    expect(buildJournalSection({ mood: null, q1: "", q2: "x" }, copy(0))).toBe("## Journal\n\n**One small thing that went well**\nx\n");
  });

  test("saving replaces only the journal section", () => {
    const body = "## Intention\nOne line.\n\n## Journal\n**What took energy today?**\nold\n\n## Notes\nkeep me\n";
    const next = upsertJournalSection(body, buildJournalSection(entry, copy(0)), LABELS.heading);
    expect(next.startsWith("## Intention\nOne line.\n\n## Journal\n")).toBe(true);
    expect(next).toContain("The morning felt rushed.");
    expect(next).not.toContain("old");
    expect(next.endsWith("\n## Notes\nkeep me\n")).toBe(true);
    expect(findJournalSection(next, LABELS.heading)).not.toBeNull();
  });

  test("with no section yet, it is added at the end", () => {
    const section = buildJournalSection(entry, copy(0));
    expect(upsertJournalSection("## Notes\n", section, LABELS.heading)).toBe(`## Notes\n\n${section}`);
    expect(upsertJournalSection("", section, LABELS.heading)).toBe(section);
  });

  test("text that is not under a known label is kept", () => {
    const parsed = parseJournalSection("## Journal\nA free line I wrote on the web.\n", LABELS);
    expect(parsed).toEqual({ mood: null, q1: "A free line I wrote on the web.", q2: "" });
  });
});

describe("daily page made from the template", () => {
  const STARTER = "# Today\n\n## Intention\nOne line for what would make today feel complete.\n\n## Notes\n";

  test("block ids fit the codec", () => {
    expect(newBlockId(Date.UTC(2026, 9, 13), () => 0.5)).toMatch(/^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });

  test("the body opens with a page-meta block the codec accepts for that date", () => {
    const draft = dailyPageDraft("2026-10-13", STARTER, "en", Date.UTC(2026, 9, 13), () => 0.25);
    expect(draft.title).toBe("Tuesday, 13 October");
    expect(draft.body.startsWith("```json tempo\n")).toBe(true);
    expect(draft.body).not.toContain("# Today");
    const segments = parseTempoBlocks(draft.body);
    const meta = segments.find((s) => s.kind === "valid");
    expect(meta?.kind === "valid" && meta.block.type === "page-meta" && meta.block.data).toEqual({
      pageType: "daily",
      date: "2026-10-13",
      tags: [],
    });
  });

  test("Hebrew title and token filling outside blocks", () => {
    expect(dailyPageDraft("2026-10-13", STARTER, "he").title).toContain("13");
    const meta = dailyPageMeta("2026-10-13", 0, () => 0);
    expect(applyTokens(`{{date}} {{unknown}}\n${meta}`, { date: "2026-10-13" })).toBe(`2026-10-13 {{unknown}}\n${meta}`);
  });
});
