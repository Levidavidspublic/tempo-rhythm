"use client";

/**
 * WeekGrid (S4 SessionScheduler, components.md §2.5 WeekColumns + DayTimeline): 7 day columns
 * by hour rows, laid out with `layoutWeek` from packages/core/plan/schedule.ts. Fixed items have
 * a solid edge and the word "Fixed"; flexible ones a dashed edge and "Flexible". Overlapping
 * items share the column in lanes. Items outside the visible hours are counted in words. The
 * grid scrolls inside itself, never the page.
 *
 * Every item is a button that opens a small mover under the grid: a day earlier or later,
 * 30 minutes earlier or later, or "Move to…" a day picked in a MonthGrid. Fixed items don't
 * move. Overlaps between a flexible item and a fixed one are named in words.
 */
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import {
  daysBetween,
  type LocalDate,
  parseLocalDate,
  weekday,
} from "../../../../packages/core/plan/calendar-math";
import {
  type Conflict,
  conflicts,
  type GridOptions,
  gridRange,
  layoutWeek,
  moveItem,
  type ScheduleItem,
} from "../../../../packages/core/plan/schedule";
import { MonthGrid } from "./MonthGrid";
import {
  countKey,
  formatClock,
  longDate,
  type PlanLang,
  pt,
  ptNodes,
  shortDate,
  weekdayName,
} from "./planCopy";

export type WeekItem = ScheduleItem & {
  title: string;
  /** False keeps the item in place even when it is flexible. Defaults to true. */
  movable?: boolean;
};

export type WeekAllDayItem = {
  id: string;
  date: LocalDate;
  title: string;
  kind: "fixed" | "flexible";
};

export type MoveTarget = { date: LocalDate; startMinute: number };

export type WeekGridProps<T extends WeekItem = WeekItem> = {
  weekStart: LocalDate;
  items: readonly T[];
  allDay?: readonly WeekAllDayItem[];
  today: LocalDate;
  /** Local clock minute now; draws the "Now" line in today's column. */
  nowMinute?: number | null;
  lang: PlanLang;
  options?: GridOptions;
  /** Without it the grid is read-only. */
  onMove?: (item: T, to: MoveTarget) => void | Promise<void>;
  idPrefix?: string;
};

export type MoverMove = {
  key: "prevDay" | "nextDay" | "earlier" | "later";
  to: MoveTarget;
  disabled: boolean;
};

const MOVE_LABEL = {
  prevDay: "cal.g.move.prevDay",
  nextDay: "cal.g.move.nextDay",
  earlier: "cal.g.move.earlier",
  later: "cal.g.move.later",
} as const;

/** The four step moves the mover offers, each disabled when it would change nothing. */
export function moverMoves(item: ScheduleItem, options: GridOptions = {}): MoverMove[] {
  const steps: Array<[MoverMove["key"], { days?: number; minutes?: number }]> = [
    ["prevDay", { days: -1 }],
    ["nextDay", { days: 1 }],
    ["earlier", { minutes: -30 }],
    ["later", { minutes: 30 }],
  ];
  return steps.map(([key, by]) => {
    const moved = moveItem(item, by, options);
    return {
      key,
      to: { date: moved.date, startMinute: moved.startMinute },
      disabled: moved.date === item.date && moved.startMinute === item.startMinute,
    };
  });
}

export function canMove(item: WeekItem): boolean {
  return item.kind === "flexible" && item.movable !== false;
}

/** Overlaps between a fixed item and a flexible one, the flexible one first. */
export function fixedClashes<T extends WeekItem>(
  items: readonly T[]
): Array<{ flexible: T; fixed: T; date: LocalDate; minutes: number }> {
  return conflicts(items)
    .filter((c: Conflict<T>) => c.kind === "fixed-flexible")
    .map((c) => ({ flexible: c.b, fixed: c.a, date: c.date, minutes: c.overlapMinutes }));
}

function timeRange(item: ScheduleItem): string {
  return `${formatClock(item.startMinute)}–${formatClock(item.startMinute + item.durationMinutes)}`;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function WeekGrid<T extends WeekItem>({
  weekStart,
  items,
  allDay = [],
  today,
  nowMinute = null,
  lang,
  options = {},
  onMove,
  idPrefix = "week",
}: WeekGridProps<T>) {
  const layout = useMemo(() => layoutWeek(items, weekStart, options), [items, weekStart, options]);
  const range = gridRange(options);
  const clashes = useMemo(() => fixedClashes(items), [items]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId === null ? undefined : items.find((item) => item.id === openId);
  const hours: number[] = [];
  for (let m = range.dayStartMinute; m < range.dayEndMinute; m += 60) hours.push(m);
  const slotsPerHour = 60 / range.slotMinutes;

  return (
    <div className="tp-sched" data-component="WeekGrid">
      {clashes.length > 0 ? (
        <div className="tp-notice" data-tone="caution" data-component="Notice">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <div className="tp-notice__text">
            <p className="tp-notice__title">{pt(lang, "cal.g.clash.h")}</p>
            <ul className="tp-sched__clashes">
              {clashes.map((clash) => (
                <li key={`${clash.flexible.id}|${clash.fixed.id}`}>
                  {ptNodes(lang, "cal.g.clash", {
                    a: { text: clash.flexible.title },
                    b: { text: clash.fixed.title },
                    date: shortDate(lang, clash.date),
                    n: clash.minutes,
                  })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <section
        className="tp-sched__scroll"
        aria-label={pt(lang, "cal.g.week", { date: shortDate(lang, weekStart) })}
      >
        <div
          className="tp-sched__grid"
          style={{ "--slots": layout.slots, "--per-hour": slotsPerHour } as Vars}
        >
          <div className="tp-sched__gutter" aria-hidden="true">
            <span className="tp-sched__corner" />
            <span className="tp-sched__allday-label tp-muted">{pt(lang, "cal.g.allDay")}</span>
            <span />
            <ol className="tp-sched__hours">
              {hours.map((m) => (
                <li className="tp-timeline__hour" key={m}>
                  {formatClock(m)}
                </li>
              ))}
            </ol>
            <span />
          </div>
          {layout.days.map((column) => {
            const { day } = parseLocalDate(column.date);
            const dayAllDay = allDay.filter((entry) => entry.date === column.date);
            const isToday = column.date === today;
            const showNow =
              isToday &&
              nowMinute !== null &&
              nowMinute >= range.dayStartMinute &&
              nowMinute < range.dayEndMinute;
            const empty =
              column.items.length === 0 &&
              dayAllDay.length === 0 &&
              column.hiddenBefore === 0 &&
              column.hiddenAfter === 0;
            return (
              <section
                className="tp-week__col tp-sched__col"
                key={column.date}
                aria-current={isToday ? "date" : undefined}
                aria-label={longDate(lang, column.date)}
                data-date={column.date}
              >
                <div className="tp-week__head">
                  <span>{weekdayName(lang, weekday(column.date))}</span>
                  <strong className="tp-num">{day}</strong>
                </div>
                <ul className="tp-sched__allday">
                  {dayAllDay.map((entry) => (
                    <li
                      className="tp-week__item tp-sched__allday-item"
                      data-kind={entry.kind === "fixed" ? "fixed" : "flex"}
                      key={entry.id}
                    >
                      <span className="tp-week__title" dir="auto">
                        {entry.title}
                      </span>
                      <span className="tp-week__kind">
                        {pt(lang, entry.kind === "fixed" ? "cal.g.fixed" : "cal.g.flex")}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="tp-sched__hidden tp-muted">
                  {column.hiddenBefore > 0
                    ? ptNodes(
                        lang,
                        countKey(column.hiddenBefore, "cal.g.earlier1", "cal.g.earlierN"),
                        {
                          n: column.hiddenBefore,
                        }
                      )
                    : empty
                      ? pt(lang, "cal.g.free")
                      : null}
                </p>
                <ul className="tp-sched__body">
                  {column.items.map((placed) => {
                    const item = placed.item;
                    const kind = item.kind === "fixed" ? "fixed" : "flex";
                    return (
                      <li
                        className="tp-sched__slot"
                        key={item.id}
                        style={
                          {
                            "--top": placed.top,
                            "--height": placed.height,
                            "--lane": placed.lane,
                            "--lanes": placed.lanes,
                          } as Vars
                        }
                      >
                        <button
                          className="tp-week__item tp-sched__item"
                          type="button"
                          data-kind={kind}
                          data-item-id={item.id}
                          aria-expanded={openId === item.id}
                          aria-controls={`${idPrefix}-mover`}
                          onClick={() => setOpenId(openId === item.id ? null : item.id)}
                        >
                          <span className="tp-week__time tp-num tp-mono tp-ltr">
                            {timeRange(item)}
                          </span>
                          <span className="tp-week__title" dir="auto">
                            {item.title}
                          </span>
                          <span className="tp-week__kind">
                            {pt(lang, kind === "fixed" ? "cal.g.fixed" : "cal.g.flex")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {showNow ? (
                    <li
                      className="tp-sched__now"
                      aria-hidden="true"
                      style={
                        {
                          "--top":
                            ((nowMinute as number) - range.dayStartMinute) / range.slotMinutes,
                        } as Vars
                      }
                    >
                      <span>
                        {pt(lang, "cal.g.now")}{" "}
                        <span className="tp-num tp-mono tp-ltr">
                          {formatClock(nowMinute as number)}
                        </span>
                      </span>
                    </li>
                  ) : null}
                </ul>
                <p className="tp-sched__hidden tp-muted">
                  {column.hiddenAfter > 0
                    ? ptNodes(lang, countKey(column.hiddenAfter, "cal.g.later1", "cal.g.laterN"), {
                        n: column.hiddenAfter,
                      })
                    : null}
                </p>
              </section>
            );
          })}
        </div>
      </section>

      <div id={`${idPrefix}-mover`}>
        {open ? (
          <ItemMover
            item={open}
            items={items}
            today={today}
            lang={lang}
            options={options}
            onMove={onMove}
            onClose={() => setOpenId(null)}
            idPrefix={idPrefix}
          />
        ) : null}
      </div>
    </div>
  );
}

export type ItemMoverProps<T extends WeekItem> = {
  item: T;
  items: readonly T[];
  today: LocalDate;
  lang: PlanLang;
  options?: GridOptions;
  onMove?: (item: T, to: MoveTarget) => void | Promise<void>;
  onClose: () => void;
  idPrefix?: string;
};

/** The small panel an item button opens. */
export function ItemMover<T extends WeekItem>({
  item,
  items,
  today,
  lang,
  options = {},
  onMove,
  onClose,
  idPrefix = "week",
}: ItemMoverProps<T>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const movable = Boolean(onMove) && canMove(item);
  const clashes = fixedClashes(items).filter(
    (c) => c.flexible.id === item.id || c.fixed.id === item.id
  );
  const { year, month } = parseLocalDate(item.date);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus the heading when a new item opens
  useEffect(() => {
    headingRef.current?.focus();
  }, [item.id]);

  const move = (to: MoveTarget) => {
    if (!onMove || busy) return;
    setBusy(true);
    setError(false);
    Promise.resolve(onMove(item, to))
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };

  const headingId = `${idPrefix}-mover-h`;
  return (
    <section
      className="tp-surface tp-sched__mover"
      aria-labelledby={headingId}
      data-component="ItemMover"
    >
      <div className="tp-sched__mover-head">
        <h3 className="tp-sched__mover-title" id={headingId} ref={headingRef} tabIndex={-1}>
          {ptNodes(lang, "cal.g.move.h", { title: { text: item.title } })}
        </h3>
        <button
          className="tp-btn tp-btn--ghost tp-btn--icon"
          type="button"
          aria-label={pt(lang, "cal.g.move.close")}
          onClick={onClose}
        >
          <TpIcon name="x" size="sm" />
        </button>
      </div>
      <p className="tp-muted tp-small">
        {ptNodes(lang, "cal.g.move.at", {
          date: shortDate(lang, item.date),
          time: { time: formatClock(item.startMinute) },
        })}
        {" · "}
        {pt(lang, item.kind === "fixed" ? "cal.g.fixed" : "cal.g.flex")}
      </p>
      {clashes.length > 0 ? (
        <ul className="tp-sched__clashes tp-small">
          {clashes.map((clash) => (
            <li key={`${clash.flexible.id}|${clash.fixed.id}`}>
              <TpIcon name="alert" size="sm" />{" "}
              {ptNodes(lang, "cal.g.clash.one", {
                b: { text: clash.fixed.id === item.id ? clash.flexible.title : clash.fixed.title },
                n: clash.minutes,
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {movable ? (
        <>
          <div className="tp-sched__mover-actions">
            {moverMoves(item, options).map((m) => (
              <button
                className="tp-btn tp-btn--secondary tp-btn--sm"
                type="button"
                key={m.key}
                data-move={m.key}
                disabled={m.disabled || busy}
                onClick={() => move(m.to)}
              >
                {m.key === "prevDay" || m.key === "earlier" ? (
                  <TpIcon name="chevron" size="sm" className="tp-icon--back" />
                ) : (
                  <TpIcon name="chevron" size="sm" flip />
                )}
                <span>{pt(lang, MOVE_LABEL[m.key])}</span>
              </button>
            ))}
            <button
              className="tp-btn tp-btn--secondary tp-btn--sm"
              type="button"
              data-move="to"
              aria-expanded={picking}
              aria-controls={`${idPrefix}-mover-pick`}
              disabled={busy}
              onClick={() => setPicking(!picking)}
            >
              <TpIcon name="calendar-grid" size="sm" />
              <span>{pt(lang, "cal.g.move.to")}</span>
            </button>
          </div>
          <div id={`${idPrefix}-mover-pick`}>
            {picking ? (
              <div className="tp-sched__pick">
                <p className="tp-label">{pt(lang, "cal.g.move.pick")}</p>
                <MonthGrid
                  year={year}
                  month={month}
                  items={items}
                  today={today}
                  selected={item.date}
                  lang={lang}
                  idPrefix={`${idPrefix}-pick`}
                  onSelectDay={(date) => {
                    if (daysBetween(item.date, date) === 0) return;
                    setPicking(false);
                    move({ date, startMinute: item.startMinute });
                  }}
                />
              </div>
            ) : null}
          </div>
          <output className="tp-small">{busy ? pt(lang, "cal.g.move.saving") : ""}</output>
          {error ? (
            <p className="tp-error-text" role="alert">
              {pt(lang, "cal.g.move.error")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="tp-small">{pt(lang, "cal.g.move.fixed")}</p>
      )}
    </section>
  );
}
