"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  getCalendarRangeMs,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/calendar/date-math";
import type { Lang } from "@/lib/i18n";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { intlLocale } from "@/lib/you/screenState";
import {
  DAY_MINUTES,
  layoutItems,
  localMinuteOfDay,
  type TimelineLayoutItem,
} from "./timelineLayout";

export type DayTimelineBlock = FunctionReturnType<typeof api.timeBlocks.listForDate>[number];

type CalendarEventRow = FunctionReturnType<typeof api.calendar_events.listInRange>[number];

type DayTimelineProps = {
  localDate?: string;
  onSelectBlock?: (block: DayTimelineBlock) => void;
  onCreateAt?: (startMinute: number) => void;
};

type BlockStatus = DayTimelineBlock["status"];

const HOUR_HEIGHT_PX = 72;
const DAY_HOURS = 24;
const GUTTER_PX = 68;
const WORKDAY_START_HOUR = 6;
/** Calendar events have a start and no end. Drawn as a short read-only card. */
const EVENT_DURATION_MINUTES = 30;
/**
 * Status actions stay inside the slot. A CSS min-height taller than the slot
 * paints over later hours; clipping the slot hides Done / Let it go / Undo.
 * The action row never wraps (a wrapped second line would be clipped); in a
 * narrow overlap column it scrolls sideways so every control stays reachable.
 * 36px fits one title line plus h-4 actions (a 30-minute block). 64px also
 * fits the time line and h-6 actions (a 60-minute block at 72px per hour).
 */
const STACKED_CARD_MIN_PX = 36;
const FULL_CARD_MIN_PX = 64;

const kindClassName: Record<DayTimelineBlock["kind"], string> = {
  focus: "border-primary/40 bg-primary/15",
  task: "border-slate-blue/40 bg-slate-blue/15",
  habit: "border-moss/40 bg-moss/15",
  break: "border-border bg-secondary",
  other: "border-accent/50 bg-accent/25",
};

/** English reads 9:30 AM; Hebrew reads the 24-hour 09:30, with no English suffix (as DayPlanSummary). */
function formatMinute(minute: number, lang: Lang): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, minute));
  const hours = Math.floor(clamped / 60) % 24;
  const mins = String(clamped % 60).padStart(2, "0");
  if (lang === "he") return `${String(hours).padStart(2, "0")}:${mins}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${mins} ${suffix}`;
}

function formatRange(startMinute: number, durationMinutes: number, lang: Lang): string {
  return `${formatMinute(startMinute, lang)}–${formatMinute(startMinute + durationMinutes, lang)}`;
}

function itemBox(item: TimelineLayoutItem): {
  top: number;
  height: number;
  left: string;
  width: string;
} {
  const span = `calc(100% - ${GUTTER_PX}px)`;
  return {
    top: (item.top / DAY_MINUTES) * DAY_HOURS * HOUR_HEIGHT_PX,
    height: (item.height / DAY_MINUTES) * DAY_HOURS * HOUR_HEIGHT_PX,
    left: `calc(${GUTTER_PX}px + ${span} * ${item.column} / ${item.columns})`,
    width: `calc(${span} / ${item.columns} - 8px)`,
  };
}

export function DayTimeline({ localDate, onSelectBlock, onCreateAt }: DayTimelineProps) {
  const { t, lang } = useLocale();
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const hasConvexUser = profile != null;
  const setStatus = useMutation(api.timeBlocks.setStatus);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const alignedRef = useRef<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);

  const todayLocalDate = toDateInputValue(new Date(bounds.startMs));
  const requestedDate = localDate ?? todayLocalDate;
  const range = useMemo(() => {
    // Always use getCalendarRangeMs so a 23h/25h local day matches the hour grid
    // and localMinuteOfDay (useLocalDayBounds is fixed 24h and drifts on DST).
    const day = localDate ? parseDateInputValue(localDate) : new Date(bounds.startMs);
    if (!day || Number.isNaN(day.getTime())) return null;
    return getCalendarRangeMs("day", day);
  }, [bounds.startMs, localDate]);

  const canQuery = isAuthenticated && hasConvexUser && range !== null;
  const blocks = useQuery(
    api.timeBlocks.listForDate,
    canQuery ? { localDate: requestedDate } : "skip"
  );
  const events = useQuery(
    api.calendar_events.listInRange,
    canQuery && range ? { startMs: range.startMs, endMs: range.endMs } : "skip"
  );

  const viewingToday = requestedDate === todayLocalDate;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!viewingToday) return;
    const tick = () => setNow(new Date());
    tick();
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const delay = 60_000 - (Date.now() % 60_000);
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, delay);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [viewingToday]);

  const isLoading =
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined ||
        (hasConvexUser && range !== null && (blocks === undefined || events === undefined))));

  useEffect(() => {
    // The skeleton replaces the scroller while loading, and a new date remounts
    // the grid at midnight, so re-align to 06:00 per date and after each load.
    if (isLoading) {
      alignedRef.current = null;
      return;
    }
    if (alignedRef.current === requestedDate || !isAuthenticated || !profile) return;
    const node = scrollerRef.current;
    if (!node) return;
    const align = () => {
      node.scrollTop = WORKDAY_START_HOUR * HOUR_HEIGHT_PX;
      alignedRef.current = requestedDate;
    };
    const frame = requestAnimationFrame(align);
    return () => cancelAnimationFrame(frame);
  }, [isAuthenticated, isLoading, profile, requestedDate]);

  const laidOut = useMemo(() => {
    if (!blocks || !events || !range) return [];
    const blockItems = blocks.map((block) => ({
      id: block._id,
      kind: block.kind,
      startMinute: block.startMinute,
      durationMinutes: block.durationMinutes,
    }));
    const eventItems = events.map((event) => ({
      id: event._id,
      kind: "event",
      startMinute: localMinuteOfDay(event.startsAtMs),
      durationMinutes: EVENT_DURATION_MINUTES,
    }));
    return layoutItems([...blockItems, ...eventItems]);
  }, [blocks, events, range]);

  const blocksById = useMemo(() => {
    return new Map<string, DayTimelineBlock>((blocks ?? []).map((block) => [block._id, block]));
  }, [blocks]);

  const eventsById = useMemo(() => {
    return new Map<string, CalendarEventRow>((events ?? []).map((event) => [event._id, event]));
  }, [events]);

  async function changeStatus(block: DayTimelineBlock, status: BlockStatus) {
    setPendingId(block._id);
    setActionError(false);
    try {
      await setStatus({ timeBlockId: block._id, status });
    } catch {
      setActionError(true);
    } finally {
      setPendingId(null);
    }
  }

  function createAtHour(hour: number, event: MouseEvent<HTMLButtonElement>) {
    if (!onCreateAt) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    const minuteInHour = Math.min(59, Math.max(0, Math.floor(ratio * 60)));
    onCreateAt(Math.min(DAY_MINUTES - 1, hour * 60 + minuteInHour));
  }

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label={t("timeline.title")} className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-[32rem] animate-pulse rounded-3xl bg-muted" />
      </section>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <section
        aria-label={t("timeline.title")}
        className="rounded-3xl border border-border bg-card px-5 py-8 text-center"
      >
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("timeline.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("timeline.signedOut")}</p>
        <Button asChild className="mt-4">
          <Link href="/sign-in">{t("timeline.signIn")}</Link>
        </Button>
      </section>
    );
  }

  if (!range) {
    return (
      <section
        aria-label={t("timeline.title")}
        className="rounded-3xl border border-border bg-card px-5 py-8"
      >
        <p className="text-sm text-muted-foreground">{t("timeline.badDate")}</p>
      </section>
    );
  }

  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const showNow = mounted && viewingToday;
  const blockCount = blocks?.length ?? 0;

  return (
    <section aria-label={t("timeline.title")} className="space-y-3" data-testid="day-timeline">
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("timeline.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {mounted
            ? new Date(range.startMs).toLocaleDateString(intlLocale(lang), {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : requestedDate}
        </p>
      </div>

      {blockCount === 0 ? (
        <p className="text-sm text-muted-foreground">{t("timeline.empty")}</p>
      ) : null}

      {actionError ? <p className="text-sm text-muted-foreground">{t("timeline.error")}</p> : null}

      <div
        className="h-[72rem] max-h-[80vh] overflow-y-auto rounded-3xl border border-border bg-card"
        ref={scrollerRef}
      >
        <div className="relative" style={{ height: DAY_HOURS * HOUR_HEIGHT_PX }}>
          {Array.from({ length: DAY_HOURS }, (_, hour) => (
            <button
              aria-label={t("timeline.addAt").replace("{time}", () =>
                formatMinute(hour * 60, lang)
              )}
              className="absolute inset-x-0 border-t border-border-soft text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={hour}
              onClick={(event) => createAtHour(hour, event)}
              style={{ top: hour * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
              type="button"
            >
              <span className="pointer-events-none px-2 pt-1 text-xs text-muted-foreground">
                {formatMinute(hour * 60, lang)}
              </span>
            </button>
          ))}

          {laidOut.map((item) => {
            const box = itemBox(item);
            if (item.kind === "event") {
              return <EventCard box={box} event={eventsById.get(item.id)} key={item.id} />;
            }
            const block = blocksById.get(item.id);
            if (!block) return null;
            return (
              <BlockCard
                block={block}
                box={box}
                busy={pendingId === block._id}
                key={item.id}
                onChangeStatus={changeStatus}
                onSelect={onSelectBlock}
              />
            );
          })}

          {showNow ? (
            <div
              className="pointer-events-none absolute z-20 border-t-2 border-primary"
              data-testid="now-marker"
              style={{
                top: (nowMinute / DAY_MINUTES) * DAY_HOURS * HOUR_HEIGHT_PX,
                left: GUTTER_PX,
                right: 8,
              }}
            >
              <span className="absolute -top-3 left-0 rounded-full bg-primary px-2 text-xs text-primary-foreground">
                {t("timeline.now")}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EventCard({
  event,
  box,
}: {
  event: CalendarEventRow | undefined;
  box: { top: number; height: number; left: string; width: string };
}) {
  const { lang } = useLocale();
  if (!event) return null;
  const timeLabel = formatMinute(localMinuteOfDay(event.startsAtMs), lang);
  return (
    <div
      className="absolute z-10 box-border flex flex-col justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background/80 px-2 text-muted-foreground"
      data-timeline-item
      style={box}
    >
      <p className="truncate text-xs leading-tight">{event.title}</p>
      <p className="truncate text-xs leading-tight">{timeLabel}</p>
    </div>
  );
}

function StatusActions({
  block,
  busy,
  buttonClassName,
  onChangeStatus,
  rangeLabel,
}: {
  block: DayTimelineBlock;
  busy: boolean;
  buttonClassName: string;
  onChangeStatus: (block: DayTimelineBlock, status: BlockStatus) => void;
  rangeLabel: string;
}) {
  const { t } = useLocale();
  const withRange = (template: string) => template.replace("{range}", () => rangeLabel);
  return (
    <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1 overflow-x-auto">
      <Button
        aria-label={withRange(t("timeline.doneAt"))}
        className={buttonClassName}
        disabled={busy || block.status === "done"}
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus(block, "done");
        }}
        size="sm"
        type="button"
      >
        {t("timeline.done")}
      </Button>
      <Button
        aria-label={withRange(t("timeline.letGoAt"))}
        className={buttonClassName}
        disabled={busy || block.status === "skipped"}
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus(block, "skipped");
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("timeline.letGo")}
      </Button>
      <Button
        aria-label={withRange(t("timeline.undoAt"))}
        className={buttonClassName}
        disabled={busy || block.status === "planned"}
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus(block, "planned");
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t("timeline.undo")}
      </Button>
    </div>
  );
}

function BlockCard({
  block,
  box,
  busy,
  onSelect,
  onChangeStatus,
}: {
  block: DayTimelineBlock;
  box: { top: number; height: number; left: string; width: string };
  busy: boolean;
  onSelect?: (block: DayTimelineBlock) => void;
  onChangeStatus: (block: DayTimelineBlock, status: BlockStatus) => void;
}) {
  const { t, lang } = useLocale();
  const range = formatRange(block.startMinute, block.durationMinutes, lang);
  // An isolated LTR run, so a Hebrew page shows 09:00–10:00 and not 10:00–09:00.
  const rangeText = <span className="tp-num">{range}</span>;
  const skipped = block.status === "skipped";
  const tint = skipped ? "border-border bg-muted text-muted-foreground" : kindClassName[block.kind];
  const showTime = box.height >= FULL_CARD_MIN_PX;
  const stacked = box.height >= STACKED_CARD_MIN_PX;
  let statusNote = "";
  if (skipped) statusNote = ` · ${t("timeline.status.letGo")}`;
  else if (block.status === "done") statusNote = ` · ${t("timeline.status.done")}`;
  let density: "full" | "stacked" | "compact" = "compact";
  if (showTime) density = "full";
  else if (stacked) density = "stacked";
  const actionClassName = showTime
    ? "h-6 shrink-0 px-2 py-0 text-xs leading-none focus-visible:ring-inset focus-visible:ring-offset-0"
    : "h-4 shrink-0 px-1 py-0 text-xs leading-none focus-visible:ring-inset focus-visible:ring-offset-0";

  return (
    <article
      className={`absolute z-10 box-border overflow-hidden rounded-2xl border ${tint} ${
        stacked
          ? `flex flex-col gap-0.5 px-2 ${showTime ? "py-0.5" : "py-0"}`
          : "flex items-center gap-1 px-1"
      }`}
      data-density={density}
      data-status={block.status}
      data-timeline-item
      style={box}
    >
      <button
        aria-label={
          skipped
            ? `${block.title}, ${range}, ${t("timeline.status.letGo")}`
            : `${block.title}, ${range}`
        }
        className={
          stacked
            ? "min-h-0 shrink overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            : "min-w-0 flex-1 truncate text-left text-xs leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        }
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(block);
        }}
        type="button"
      >
        {stacked ? (
          <>
            <span
              className={`block truncate font-medium text-foreground ${
                showTime ? "text-sm leading-tight" : "text-xs leading-none"
              }`}
            >
              {block.title}
              {showTime ? null : <> · {rangeText}</>}
              {showTime ? null : statusNote}
            </span>
            {showTime ? (
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {rangeText}
                {statusNote}
              </span>
            ) : null}
          </>
        ) : (
          <>
            {block.title} · {rangeText}
            {statusNote}
          </>
        )}
      </button>
      <StatusActions
        block={block}
        busy={busy}
        buttonClassName={actionClassName}
        onChangeStatus={onChangeStatus}
        rangeLabel={range}
      />
    </article>
  );
}
