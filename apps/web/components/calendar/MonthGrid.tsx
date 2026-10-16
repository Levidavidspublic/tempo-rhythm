"use client";

/**
 * MonthGrid (docs/design/v3/components.md §2.5): `.tp-month`, a 6 × 7 grid of day buttons with
 * dots and a "3 items" count. Today has `aria-current="date"`, the chosen day `aria-pressed`.
 * Previous / next really change the month. Keys: arrows move a day or a week (left and right
 * swap in Hebrew), Home / End go to the week's ends, Page Up / Page Down change the month.
 * Hebrew weeks start on Sunday.
 */
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import {
  addDays,
  daysInMonth,
  formatLocalDate,
  type LocalDate,
  monthMatrix,
  parseLocalDate,
  startOfWeek,
  type Weekday,
} from "../../../../packages/core/plan/calendar-math";
import { monthCounts, type ScheduleItem } from "../../../../packages/core/plan/schedule";
import {
  countKey,
  longDate,
  monthTitle,
  type PlanLang,
  pt,
  ptNodes,
  weekdayName,
  weekStartFor,
} from "./planCopy";

export type MonthGridProps = {
  year: number;
  /** 1–12. */
  month: number;
  items: readonly ScheduleItem[];
  today: LocalDate;
  selected?: LocalDate | null;
  lang: PlanLang;
  /** Defaults to Sunday in Hebrew and Monday in English. */
  weekStartsOn?: Weekday;
  onSelectDay?: (date: LocalDate) => void;
  onMonthChange?: (year: number, month: number) => void;
  /** Unique prefix for ids when two grids share a page. */
  idPrefix?: string;
};

export function shiftMonth(
  year: number,
  month: number,
  by: number
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The same day in another month, clamped to that month's length (31 Jan → 28 Feb). */
export function sameDayIn(date: LocalDate, year: number, month: number): LocalDate {
  const { day } = parseLocalDate(date);
  return formatLocalDate(year, month, Math.min(day, daysInMonth(year, month)));
}

/** Where a key press moves the focused day, or null when the key isn't a grid key. */
export function monthKeyTarget(
  date: LocalDate,
  key: string,
  rtl: boolean,
  weekStartsOn: Weekday
): LocalDate | null {
  const { year, month } = parseLocalDate(date);
  switch (key) {
    case "ArrowRight":
      return addDays(date, rtl ? -1 : 1);
    case "ArrowLeft":
      return addDays(date, rtl ? 1 : -1);
    case "ArrowDown":
      return addDays(date, 7);
    case "ArrowUp":
      return addDays(date, -7);
    case "Home":
      return startOfWeek(date, { weekStartsOn });
    case "End":
      return addDays(startOfWeek(date, { weekStartsOn }), 6);
    case "PageUp": {
      const prev = shiftMonth(year, month, -1);
      return sameDayIn(date, prev.year, prev.month);
    }
    case "PageDown": {
      const next = shiftMonth(year, month, 1);
      return sameDayIn(date, next.year, next.month);
    }
    default:
      return null;
  }
}

function inMonth(date: LocalDate, year: number, month: number): boolean {
  const parts = parseLocalDate(date);
  return parts.year === year && parts.month === month;
}

export function MonthGrid({
  year,
  month,
  items,
  today,
  selected = null,
  lang,
  weekStartsOn,
  onSelectDay,
  onMonthChange,
  idPrefix = "month",
}: MonthGridProps) {
  const [shown, setShown] = useState({ year, month });
  useEffect(() => setShown({ year, month }), [year, month]);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<LocalDate | null>(null);
  const firstDay = weekStartsOn ?? weekStartFor(lang);
  const rtl = lang === "he";

  const cells = useMemo(
    () =>
      monthCounts(items, monthMatrix(shown.year, shown.month, { weekStartsOn: firstDay })).flat(),
    [items, shown.year, shown.month, firstDay]
  );

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  });

  const go = (next: { year: number; month: number }) => {
    setShown(next);
    onMonthChange?.(next.year, next.month);
  };

  // One tab stop: the chosen day, else today, else the 1st of the shown month.
  const focusDate =
    selected && inMonth(selected, shown.year, shown.month)
      ? selected
      : inMonth(today, shown.year, shown.month)
        ? today
        : formatLocalDate(shown.year, shown.month, 1);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) => {
    const target = monthKeyTarget(date, event.key, rtl, firstDay);
    if (!target) return;
    event.preventDefault();
    const parts = parseLocalDate(target);
    if (!inMonth(target, shown.year, shown.month)) go({ year: parts.year, month: parts.month });
    pendingFocus.current = target;
    onSelectDay?.(target);
    if (!onSelectDay)
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  };

  const titleId = `${idPrefix}-title`;
  const headDays = Array.from({ length: 7 }, (_, i) => ((firstDay + i) % 7) as Weekday);

  return (
    <div className="tp-month" data-component="MonthGrid">
      <div className="tp-month__head">
        <button
          className="tp-btn tp-btn--ghost tp-btn--icon"
          type="button"
          aria-label={pt(lang, "cal.g.prev")}
          onClick={() => go(shiftMonth(shown.year, shown.month, -1))}
        >
          <TpIcon name="chevron" size="sm" className="tp-icon--back" />
        </button>
        <h2 className="tp-month__title" id={titleId} aria-live="polite">
          {monthTitle(lang, shown.year, shown.month)}
        </h2>
        <button
          className="tp-btn tp-btn--ghost tp-btn--icon"
          type="button"
          aria-label={pt(lang, "cal.g.next")}
          onClick={() => go(shiftMonth(shown.year, shown.month, 1))}
        >
          <TpIcon name="chevron" size="sm" flip />
        </button>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: the design's labelled grid of day buttons; a fieldset would add a form box around it */}
      <div className="tp-month__grid" role="group" aria-labelledby={titleId} ref={gridRef}>
        {headDays.map((day) => (
          <div className="tp-month__dow" aria-hidden="true" key={day} data-weekday={day}>
            <abbr title={weekdayName(lang, day, "long")}>{weekdayName(lang, day)}</abbr>
          </div>
        ))}
        {cells.map((cell) => {
          const countText =
            cell.count > 0
              ? pt(lang, countKey(cell.count, "cal.g.item1", "cal.g.itemsN"), { n: cell.count })
              : pt(lang, "cal.g.noItems");
          const dots = [
            ...Array.from({ length: Math.min(cell.fixed, 3) }, () => "fixed"),
            ...Array.from(
              { length: Math.min(cell.flexible, Math.max(0, 3 - cell.fixed)) },
              () => "flex"
            ),
          ];
          return (
            <button
              className="tp-month__day"
              type="button"
              key={cell.date}
              data-date={cell.date}
              data-outside={cell.inMonth ? undefined : "true"}
              aria-current={cell.date === today ? "date" : undefined}
              aria-pressed={onSelectDay ? cell.date === selected : undefined}
              aria-label={`${longDate(lang, cell.date)}${cell.date === today ? `, ${pt(lang, "cal.g.today")}` : ""}, ${countText}`}
              tabIndex={cell.date === focusDate ? 0 : -1}
              onClick={() => {
                if (!cell.inMonth)
                  go({
                    year: parseLocalDate(cell.date).year,
                    month: parseLocalDate(cell.date).month,
                  });
                onSelectDay?.(cell.date);
              }}
              onKeyDown={(event) => onKey(event, cell.date)}
            >
              <span className="tp-month__n tp-num" aria-hidden="true">
                {cell.day}
              </span>
              {cell.count > 0 ? (
                <>
                  <span className="tp-month__dots" aria-hidden="true">
                    {dots.map((kind, i) => (
                      <span className={`tp-dot tp-dot--${kind}`} key={`${kind}${i}`} />
                    ))}
                  </span>
                  <span className="tp-month__count" aria-hidden="true">
                    {ptNodes(lang, countKey(cell.count, "cal.g.item1", "cal.g.itemsN"), {
                      n: cell.count,
                    })}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Today as a local `YYYY-MM-DD` (the caller's clock). */
export function todayLocal(now: Date = new Date()): LocalDate {
  return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
