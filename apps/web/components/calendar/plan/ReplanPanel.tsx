"use client";

/**
 * "Re-plan the rest" on the plan screen (PRD F-07: missed or clashing sessions move to new times,
 * fixed items stay put, no shaming). When the saved plan has sessions still to do that were missed
 * or now overlap something on the calendar, a quiet notice says so in words, with one secondary
 * button. It opens a preview: what moves where, what doesn't fit and the planner's ways out (a
 * later date, longer days, fewer sessions), with Use these times / Cancel. Nothing changes before
 * that. Saving calls `plans.replan`; an Undo toast stays for 5:00 (`plans.undoReplan`), held by
 * ReplanArea above the panel so it outlives a change of the plan shown.
 *
 * The new times come from `replanRest` (packages/core/plan/replan.ts): done sessions, sessions in
 * progress and fixed events stay where they are. Data: plans.get, and busy time from today to the
 * plan's date (or the later one picked in the preview) read in windows of at most 31 days
 * (busyWindows.ts, planApi.ts). Copy: lib/i18n-groups/plan.ts.
 */
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToastRoom } from "@/components/study/useToastRoom";
import { TpIcon } from "@/components/tempo/TpIcon";
import { UndoToast } from "@/components/you/UndoToast";
import type { Id } from "@/convex/_generated/dataModel";
import type { LocalDate } from "../../../../../packages/core/plan/calendar-math";
import {
  type LocalMoment,
  type ReplanResult,
  type ReplanWaysOut,
  replanRest,
  replanWaysOut,
} from "../../../../../packages/core/plan/replan";
import { localDateOf, localSlotToMs } from "../gridData";
import {
  countKey,
  formatClock,
  longDate,
  type PlanKey,
  type PlanLang,
  pt,
  ptNodes,
  shortDate,
} from "../planCopy";
import { busyWindows } from "./busyWindows";
import { useBusyTime, usePlan, useReplanActions } from "./planApi";
import {
  type ReplanOverrides,
  replanInput,
  replanNotice,
  replanToastTitle,
  sameMoment,
  sameReplan,
} from "./replanForm";

/** The local date and clock minute now. */
function nowMoment(now: Date = new Date()): LocalMoment {
  return { date: localDateOf(now), minute: now.getHours() * 60 + now.getMinutes() };
}

/** Local date and clock minute now, read in the browser and again every minute. */
function useNowMoment(): LocalMoment | null {
  const [moment, setMoment] = useState<LocalMoment | null>(null);
  useEffect(() => {
    const tick = () => setMoment(nowMoment());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return moment;
}

export type ReplanNoticeProps = {
  lang: PlanLang;
  notice: { key: PlanKey; n: number };
  open: boolean;
  onToggle: () => void;
  /** Id of the preview the button opens. */
  controls: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
};

/** The quiet notice: what needs a new time, in words, and one secondary button. */
export function ReplanNotice({
  lang,
  notice,
  open,
  onToggle,
  controls,
  buttonRef,
}: ReplanNoticeProps) {
  return (
    <div className="tp-notice" data-tone="info" data-component="Notice" data-testid="replan-notice">
      <span className="tp-notice__icon">
        <TpIcon name="refresh" size="sm" />
      </span>
      <div className="tp-notice__text">
        <output className="tp-notice__title">{ptNodes(lang, notice.key, { n: notice.n })}</output>
        <div className="tp-plan__replan-action">
          <button
            ref={buttonRef}
            className="tp-btn tp-btn--secondary tp-btn--sm"
            type="button"
            data-action="replan-open"
            aria-expanded={open}
            aria-controls={controls}
            onClick={onToggle}
          >
            <TpIcon name="calendar-grid" size="sm" />
            <span>{pt(lang, "rp.open")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export type ReplanPreviewProps = {
  lang: PlanLang;
  result: Pick<ReplanResult, "moves" | "unplaced">;
  /** Session titles by task id. */
  titles: ReadonlyMap<string, string>;
  /** The date nothing may reach (the plan's, or the later one picked here). */
  deadline: LocalDate;
  /** Set when calendar events are only read up to this day (busyWindows.ts). */
  checkedUntil?: LocalDate | null;
  /** Set when a later date was picked: the plan's date moves to it. */
  newDate?: LocalDate | null;
  ways?: ReplanWaysOut | null;
  leaveOut: boolean;
  busy?: boolean;
  failed?: boolean;
  /** The browser is offline: "Use these times" is off, and a line says why. */
  offline?: boolean;
  /** Set when the times were worked out again because some had passed: said in words. */
  refreshed?: boolean;
  /** The "worked out again" note, which takes the keyboard when it appears. */
  refreshedRef?: RefObject<HTMLParagraphElement | null>;
  /** False when the screen already has its one primary button. */
  primary?: boolean;
  onUseMinutes?: (minutes: number) => void;
  onUseDate?: (date: LocalDate) => void;
  onLeaveOut: (on: boolean) => void;
  onAccept: () => void;
  onCancel: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

/** What moves where, what doesn't fit and its ways out, then Use these times / Cancel. */
export function ReplanPreview({
  lang,
  result,
  titles,
  deadline,
  checkedUntil = null,
  newDate = null,
  ways = null,
  leaveOut,
  busy = false,
  failed = false,
  offline = false,
  refreshed = false,
  refreshedRef,
  primary = true,
  onUseMinutes,
  onUseDate,
  onLeaveOut,
  onAccept,
  onCancel,
  headingRef,
}: ReplanPreviewProps) {
  const headingId = useId();
  const unplaced = result.unplaced.length;
  const canAccept = result.moves.length > 0 || (leaveOut && unplaced > 0);
  const title = (id: string) => titles.get(id) ?? "";
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <section
      className="tp-surface tp-plan__replan-preview"
      aria-labelledby={headingId}
      data-component="ReplanPreview"
      aria-busy={busy || undefined}
      onKeyDown={onKey}
    >
      <h2 className="tp-section__title" id={headingId} ref={headingRef} tabIndex={-1}>
        {pt(lang, "rp.h")}
      </h2>
      <p className="tp-muted">{pt(lang, "rp.sub")}</p>
      {checkedUntil ? (
        <p className="tp-help">{pt(lang, "pp.busyCap", { date: longDate(lang, checkedUntil) })}</p>
      ) : null}
      {refreshed ? (
        <p className="tp-help" data-testid="replan-refreshed" tabIndex={-1} ref={refreshedRef}>
          {pt(lang, "rp.refreshed")}
        </p>
      ) : null}
      {newDate ? <p>{pt(lang, "rp.newDate", { date: longDate(lang, newDate) })}</p> : null}
      {result.moves.length > 0 ? (
        <ul className="tp-plan__sessions tp-plan__moves">
          {result.moves.map((move) => (
            <li className="tp-plan__session" data-replan="move" key={move.id}>
              <strong dir="auto">{title(move.id)}</strong>
              <span>
                {ptNodes(lang, "rp.fromTo", {
                  fromDate: shortDate(lang, move.from.date),
                  fromTime: { time: formatClock(move.from.startMinute) },
                  toDate: shortDate(lang, move.to.date),
                  toTime: { time: formatClock(move.to.startMinute) },
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {unplaced > 0 ? (
        <div
          className="tp-notice"
          data-tone="caution"
          data-component="Notice"
          data-testid="replan-short"
        >
          <span className="tp-notice__icon">
            <TpIcon name="info" size="sm" />
          </span>
          <div className="tp-notice__text">
            <p className="tp-notice__title">
              {ptNodes(lang, countKey(unplaced, "rp.short1", "rp.shortN"), {
                n: unplaced,
                date: longDate(lang, deadline),
              })}
            </p>
            <ul className="tp-plan__sessions">
              {result.unplaced.map((item) => (
                <li className="tp-plan__session" data-replan="unplaced" key={item.id}>
                  <span dir="auto">{title(item.id)}</span>
                  {leaveOut ? <span className="tp-chip">{pt(lang, "rp.leftOut")}</span> : null}
                </li>
              ))}
            </ul>
            <p>{pt(lang, countKey(unplaced, "rp.short.b1", "rp.short.bN"))}</p>
            <ul className="tp-plan__ways">
              <li className="tp-plan__way" data-way="later">
                <strong>{pt(lang, "rp.later")}</strong>
                {ways?.laterDate ? (
                  <>
                    <span>{pt(lang, "rp.laterB", { date: longDate(lang, ways.laterDate) })}</span>
                    {onUseDate ? (
                      <button
                        className="tp-btn tp-btn--secondary tp-btn--sm"
                        type="button"
                        disabled={busy}
                        onClick={() => onUseDate(ways.laterDate as LocalDate)}
                      >
                        {pt(lang, "rp.laterBtn", { date: shortDate(lang, ways.laterDate) })}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span>{pt(lang, "rp.laterNone")}</span>
                )}
              </li>
              <li className="tp-plan__way" data-way="longer">
                <strong>{pt(lang, "rp.longer")}</strong>
                {ways?.longerMinutes ? (
                  <>
                    <span>{ptNodes(lang, "rp.longerB", { n: ways.longerMinutes })}</span>
                    {onUseMinutes ? (
                      <button
                        className="tp-btn tp-btn--secondary tp-btn--sm"
                        type="button"
                        disabled={busy}
                        onClick={() => onUseMinutes(ways.longerMinutes as number)}
                      >
                        {/* One child: the button is a flex row, so loose text and the number would get gaps. */}
                            <span>{ptNodes(lang, "rp.longerBtn", { n: ways.longerMinutes })}</span>
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span>{pt(lang, "rp.longerNone")}</span>
                )}
              </li>
              <li className="tp-plan__way" data-way="fewer">
                <strong>{pt(lang, "rp.fewer")}</strong>
                <span>{pt(lang, "rp.fewerB")}</span>
                <button
                  className="tp-btn tp-btn--secondary tp-btn--sm"
                  type="button"
                  aria-pressed={leaveOut}
                  disabled={busy}
                  onClick={() => onLeaveOut(!leaveOut)}
                >
                  {leaveOut ? <TpIcon name="check" size="sm" /> : null}
                  <span>{pt(lang, countKey(unplaced, "rp.fewerBtn1", "rp.fewerBtnN"))}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
      <div className="tp-plan__actions">
        <button
          className={`tp-btn ${primary ? "tp-btn--primary" : "tp-btn--secondary"}`}
          type="button"
          data-action="replan-accept"
          disabled={busy || !canAccept || offline}
          aria-busy={busy || undefined}
          aria-describedby={offline ? `${headingId}-offline` : undefined}
          onClick={onAccept}
        >
          <TpIcon name="check" size="sm" />
          <span>{busy ? pt(lang, "rp.accepting") : pt(lang, "rp.accept")}</span>
        </button>
        <button
          className="tp-btn tp-btn--ghost"
          type="button"
          data-action="replan-cancel"
          disabled={busy}
          onClick={onCancel}
        >
          {pt(lang, "rp.cancel")}
        </button>
      </div>
      {canAccept ? null : <p className="tp-help">{pt(lang, "rp.nothing")}</p>}
      {offline ? (
        <p className="tp-help" id={`${headingId}-offline`}>
          {pt(lang, "rp.offline")}
        </p>
      ) : null}
      {failed ? (
        <p className="tp-error-text" role="alert">
          {pt(lang, "rp.error")}
        </p>
      ) : null}
    </section>
  );
}

/** A saved re-plan's Undo: which plan, the toast's words and when the 5:00 window ends. */
export type ReplanDone = { planId: Id<"studyPlans">; title: string; undoUntil: number };

export type ReplanPanelProps = {
  planId: Id<"studyPlans">;
  lang: PlanLang;
  /** False when the screen already shows its one primary button (a plan preview to add). */
  primary?: boolean;
  /** A re-plan was saved: the owner shows its Undo toast (ReplanArea). */
  onReplanned: (done: ReplanDone) => void;
  /** The "Re-plan the rest" button, for the owner to hand focus back to. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
  /** The browser's online flag (`useOnline`); offline, "Use these times" sends nothing. */
  online?: boolean;
};

export function ReplanPanel({
  planId,
  lang,
  primary = true,
  onReplanned,
  buttonRef,
  online = true,
}: ReplanPanelProps) {
  const saved = usePlan(planId);
  const { replan } = useReplanActions();
  const liveNow = useNowMoment();
  const [open, setOpen] = useState(false);
  // The preview holds still while it is open: now is read once, when it opens.
  const [openedAt, setOpenedAt] = useState<LocalMoment | null>(null);
  const [overrides, setOverrides] = useState<ReplanOverrides>({});
  const [leaveOut, setLeaveOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // How many times the preview was worked out again on Accept because the clock moved on.
  const [refreshed, setRefreshed] = useState(0);
  const refreshedRef = useRef<HTMLParagraphElement>(null);
  const ownRef = useRef<HTMLButtonElement>(null);
  const openRef = buttonRef ?? ownRef;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previewId = useId();

  const now = open && openedAt ? openedAt : liveNow;
  const deadline = saved?.plan.deadline;
  // Up to the later date when one is picked here, so the days it adds have their busy time too.
  const span = now && deadline ? busyWindows(now.date, overrides.deadline ?? deadline) : null;
  const { events, tasks } = useBusyTime(span);

  const input = useMemo(
    () =>
      saved && now && events && tasks
        ? replanInput({
            deadline: saved.plan.deadline,
            tasks: saved.tasks,
            source: {
              events: events.map((e) => ({ id: e._id, title: e.title, startsAtMs: e.startsAtMs })),
              tasks,
            },
            now,
            overrides,
          })
        : null,
    [saved, now, events, tasks, overrides]
  );
  const result = useMemo(() => (input ? replanRest(input) : null), [input]);
  const ways = useMemo(
    () => (open && input && result && result.unplaced.length > 0 ? replanWaysOut(input) : null),
    [open, input, result]
  );
  const titles = useMemo(
    () => new Map((saved?.tasks ?? []).map((task) => [task._id as string, task.title])),
    [saved]
  );
  const notice = result ? replanNotice(result) : null;

  // Opening moves focus to the preview's heading.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);
  // New times after a late Accept: the note that says so takes the keyboard.
  useEffect(() => {
    if (refreshed > 0) refreshedRef.current?.focus();
  }, [refreshed]);

  const close = () => {
    setOpen(false);
    setOpenedAt(null);
    setOverrides({});
    setLeaveOut(false);
    setFailed(false);
    setRefreshed(0);
  };
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setOpenedAt(liveNow);
    setOpen(true);
  };
  const cancel = () => {
    close();
    openRef.current?.focus();
  };

  // The preview holds the time it opened at. Some of its times may have passed since: then it is
  // worked out again from now and, when that changes anything, shown instead of being sent.
  const showFresh = () => {
    setOpenedAt(nowMoment());
    setRefreshed((n) => n + 1);
  };

  const accept = async () => {
    if (!result || !input || !saved || saving || !online) return;
    const current = nowMoment();
    if (!sameMoment(current, input.now) && !sameReplan(replanRest({ ...input, now: current }), result)) {
      showFresh();
      return;
    }
    const remove = leaveOut ? result.unplaced.map((item) => item.id as Id<"tasks">) : [];
    if (result.moves.length === 0 && remove.length === 0) return;
    setSaving(true);
    setFailed(false);
    try {
      const done = await replan({
        planId,
        moves: result.moves.map((move) => ({
          taskId: move.id as Id<"tasks">,
          date: move.to.date,
          startMinute: move.to.startMinute,
          // Each new start in this browser's zone for that date, so a DST change is honoured.
          startAt: localSlotToMs(move.to.date, move.to.startMinute),
        })),
        ...(remove.length > 0 ? { remove } : {}),
        ...(overrides.deadline && overrides.deadline !== saved.plan.deadline
          ? { deadline: overrides.deadline }
          : {}),
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
      if ("refused" in done) {
        // The server's clock says a start has passed (nothing was saved): new times, in words.
        showFresh();
        return;
      }
      close();
      onReplanned({
        planId,
        title: replanToastTitle(lang, done.moved, done.removed),
        undoUntil: done.undoUntil,
      });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!notice && !open) return null;

  return (
    <div className="tp-plan__replan" data-component="ReplanPanel">
      {notice ? (
        <ReplanNotice
          lang={lang}
          notice={notice}
          open={open}
          onToggle={toggle}
          controls={previewId}
          buttonRef={openRef}
        />
      ) : null}
      <div id={previewId}>
        {open && result && input ? (
          <ReplanPreview
            lang={lang}
            result={result}
            titles={titles}
            deadline={input.deadline}
            checkedUntil={span?.checkedUntil ?? null}
            newDate={overrides.deadline ?? null}
            ways={ways}
            leaveOut={leaveOut}
            busy={saving}
            failed={failed}
            offline={!online}
            refreshed={refreshed > 0}
            refreshedRef={refreshedRef}
            primary={primary}
            onUseMinutes={(minutesPerDay) => setOverrides((o) => ({ ...o, minutesPerDay }))}
            onUseDate={(date) => setOverrides((o) => ({ ...o, deadline: date }))}
            onLeaveOut={setLeaveOut}
            onAccept={() => void accept()}
            onCancel={cancel}
            headingRef={headingRef}
          />
        ) : null}
      </div>
    </div>
  );
}

export type ReplanAreaProps = {
  /** The plan the screen shows; null when there is none (a toast may still be open). */
  planId: Id<"studyPlans"> | null;
  lang: PlanLang;
  primary?: boolean;
  /** Takes the keyboard when the toast closes and "Re-plan the rest" isn't there (the page's h1). */
  headingRef?: RefObject<HTMLElement | null>;
  /** The browser's online flag; true when left out. */
  online?: boolean;
};

/**
 * The re-plan panel for the plan the screen shows, and the Undo toast of the last re-plan. The
 * panel starts fresh for each plan (it is keyed by it), so the toast lives here, above it: "Add
 * these sessions" makes another plan the shown one, and the Undo for the re-plan made a moment ago
 * stays for its 5:00 and still takes back that plan's re-plan.
 */
export function ReplanArea({ planId, lang, primary = true, headingRef, online = true }: ReplanAreaProps) {
  const { undoReplan } = useReplanActions();
  // `superseded`: Undo found a newer re-plan (another tab), so it changed nothing.
  const [toast, setToast] = useState<(ReplanDone & { superseded?: boolean }) | null>(null);
  const supersededRef = useRef(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  useToastRoom(toast);

  const replanned = (done: ReplanDone) => {
    setToast(done);
    // The button that was pressed is gone: Undo is the one thing left to do.
    window.setTimeout(
      () => toastRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      0
    );
  };

  // Undo names its re-plan by the window `replan` answered with, so it never takes back a newer
  // one it doesn't describe.
  const undo = async () => {
    if (!toast) return;
    const answer = await undoReplan({ planId: toast.planId, undoUntil: toast.undoUntil });
    supersededRef.current = answer.superseded === true;
  };
  // When the toast closes (Undo, Dismiss or the end of its 5:00) with the keyboard in it, the
  // keyboard goes back to "Re-plan the rest" (after Undo the notice comes back), or to the page
  // heading when there is nothing to re-plan. Typing somewhere else on the page is left alone.
  const handBackFocus = () => {
    const active = document.activeElement;
    const inToast =
      !active || active === document.body || (toastRef.current?.contains(active) ?? false);
    if (!inToast) return;
    window.setTimeout(() => (openRef.current ?? headingRef?.current)?.focus(), 0);
  };
  const closeToast = () => {
    handBackFocus();
    if (supersededRef.current) {
      // Nothing was taken back: the toast stays and says why, until its window ends.
      supersededRef.current = false;
      setToast((current) => (current ? { ...current, superseded: true } : current));
      return;
    }
    setToast(null);
  };

  return (
    <>
      {planId ? (
        <ReplanPanel
          key={planId}
          planId={planId}
          lang={lang}
          primary={primary}
          onReplanned={replanned}
          buttonRef={openRef}
          online={online}
        />
      ) : null}
      {toast ? (
        <div className="tp-plan__toast" ref={toastRef}>
          <UndoToast
            title={toast.superseded ? pt(lang, "rp.undo.newer") : toast.title}
            untilMs={toast.undoUntil}
            onUndo={toast.superseded ? undefined : undo}
            onClose={closeToast}
          />
        </div>
      ) : null}
    </>
  );
}
