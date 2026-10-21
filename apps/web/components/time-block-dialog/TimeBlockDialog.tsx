"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Lang, MessageKey } from "@/lib/i18n";
import {
  BLOCK_KINDS,
  type BlockFormErrors,
  type BlockKind,
  minuteToTimeString,
  parseBlockForm,
  profileGatedArgs,
} from "./blockForm";

const QUICK_DURATIONS = [15, 30, 60, 90] as const;
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
/** The close button DialogContent draws, with its label in the app language. */
const CLOSE_CLASS =
  "absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground";
const DAY_MINUTES = 1440;

const KIND_KEYS: Record<BlockKind, MessageKey> = {
  focus: "timeBlock.kind.focus",
  task: "timeBlock.kind.task",
  habit: "timeBlock.kind.habit",
  break: "timeBlock.kind.break",
  other: "timeBlock.kind.other",
};

export type FieldErrorKeys = Partial<
  Record<"title" | "start" | "durationMinutes" | "kind", MessageKey>
>;

/**
 * blockForm writes its errors in English; the dialog shows each field's copy instead. A length
 * inside blockForm's 5 to 720 range can only fail by running past midnight.
 */
export function fieldErrorKeys(errors: BlockFormErrors, durationMinutes: number): FieldErrorKeys {
  const keys: FieldErrorKeys = {};
  if (errors.title) keys.title = "timeBlock.error.title";
  if (errors.start) keys.start = "timeBlock.error.start";
  if (errors.durationMinutes) {
    const inRange =
      Number.isInteger(durationMinutes) && durationMinutes >= 5 && durationMinutes <= 720;
    keys.durationMinutes = inRange ? "timeBlock.error.pastMidnight" : "timeBlock.error.length";
  }
  if (errors.kind) keys.kind = "timeBlock.error.kind";
  return keys;
}

/**
 * English reads 9:30 AM; Hebrew reads the 24-hour 09:30. The same clock as DayTimeline's
 * formatMinute, which that file does not export.
 */
function formatMinute(minute: number, lang: Lang): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, minute));
  const hours = Math.floor(clamped / 60) % 24;
  const mins = String(clamped % 60).padStart(2, "0");
  if (lang === "he") return `${String(hours).padStart(2, "0")}:${mins}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${mins} ${suffix}`;
}

/** Fills {from} and {to} with the day's first and last minute, in the app language's clock. */
export function fillTimes(text: string, lang: Lang): string {
  return text
    .replace("{from}", () => formatMinute(0, lang))
    .replace("{to}", () => formatMinute(DAY_MINUTES - 1, lang));
}

export type TimeBlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Local calendar day, `YYYY-MM-DD`. */
  localDate: string;
  initialStartMinute?: number;
  /** When set, the dialog edits this block instead of creating one. */
  block?: Doc<"timeBlocks">;
};

function dayWindow(localDate: string): { dueFrom: number; dueTo: number } {
  const [y, m, d] = localDate.split("-").map(Number);
  return {
    dueFrom: new Date(y, m - 1, d).getTime(),
    dueTo: new Date(y, m - 1, d + 1).getTime(),
  };
}

export function TimeBlockDialog(props: TimeBlockDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <TimeBlockDialogBody {...props} /> : null}
    </Dialog>
  );
}

function TimeBlockDialogBody({
  onOpenChange,
  localDate,
  initialStartMinute,
  block,
}: TimeBlockDialogProps) {
  const isEdit = block !== undefined;
  const { t, lang } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  const createBlock = useMutation(api.timeBlocks.create);
  const updateBlock = useMutation(api.timeBlocks.update);
  const removeBlock = useMutation(api.timeBlocks.remove);
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const tasks = useQuery(
    api.tasks.listToday,
    profileGatedArgs(isAuthenticated, profile, dayWindow(localDate))
  );
  const habits = useQuery(api.habits.list, profileGatedArgs(isAuthenticated, profile, {}));

  const [title, setTitle] = useState(block?.title ?? "");
  const [start, setStart] = useState(
    minuteToTimeString(block?.startMinute ?? initialStartMinute ?? 540)
  );
  const [duration, setDuration] = useState(String(block?.durationMinutes ?? 30));
  const [kind, setKind] = useState<BlockKind>(block?.kind ?? "focus");
  const [taskId, setTaskId] = useState("");
  const [habitId, setHabitId] = useState("");
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const [serverError, setServerError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const errorText = (key: MessageKey) => fillTimes(t(key), lang);

  const submit = async () => {
    const durationMinutes = duration.trim() === "" ? Number.NaN : Number(duration);
    const parsed = parseBlockForm({
      localDate: block?.localDate ?? localDate,
      title,
      start,
      durationMinutes,
      kind,
      taskId: taskId || undefined,
      habitId: habitId || undefined,
    });
    if (!parsed.ok) {
      setErrors(fieldErrorKeys(parsed.errors, durationMinutes));
      return;
    }
    setErrors({});
    setServerError(null);
    setBusy(true);
    try {
      const v = parsed.value;
      if (block) {
        await updateBlock({
          timeBlockId: block._id,
          title: v.title,
          startMinute: v.startMinute,
          durationMinutes: v.durationMinutes,
          startsAtMs: v.startsAtMs,
          endsAtMs: v.endsAtMs,
          kind: v.kind,
        });
      } else {
        await createBlock({
          localDate: v.localDate,
          title: v.title,
          startMinute: v.startMinute,
          durationMinutes: v.durationMinutes,
          startsAtMs: v.startsAtMs,
          endsAtMs: v.endsAtMs,
          kind: v.kind,
          taskId: v.taskId as Id<"tasks"> | undefined,
          habitId: v.habitId as Id<"habits"> | undefined,
        });
      }
      onOpenChange(false);
    } catch {
      setServerError("timeBlock.error.save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!block) return;
    setServerError(null);
    setBusy(true);
    try {
      await removeBlock({ timeBlockId: block._id });
      onOpenChange(false);
    } catch {
      setServerError("timeBlock.error.delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent
      hideCloseButton
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById("time-block-title")?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(isEdit ? "timeBlock.editTitle" : "timeBlock.newTitle")}</DialogTitle>
        <DialogDescription>{t("timeBlock.description")}</DialogDescription>
      </DialogHeader>

      <form
        className="grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="time-block-title">{t("timeBlock.field.title")}</Label>
          <Input
            id="time-block-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "time-block-title-error" : undefined}
            disabled={busy}
          />
          {errors.title ? (
            <p id="time-block-title-error" className="text-destructive text-sm">
              {errorText(errors.title)}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="time-block-start">{t("timeBlock.field.start")}</Label>
            <Input
              id="time-block-start"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              aria-invalid={errors.start ? true : undefined}
              disabled={busy}
            />
            {errors.start ? (
              <p className="text-destructive text-sm">{errorText(errors.start)}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="time-block-kind">{t("timeBlock.field.kind")}</Label>
            <select
              id="time-block-kind"
              className={SELECT_CLASS}
              value={kind}
              onChange={(event) => setKind(event.target.value as BlockKind)}
              disabled={busy}
            >
              {BLOCK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(KIND_KEYS[k])}
                </option>
              ))}
            </select>
            {errors.kind ? (
              <p className="text-destructive text-sm">{errorText(errors.kind)}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="time-block-duration">{t("timeBlock.field.length")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="time-block-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={720}
              className="w-24"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              aria-invalid={errors.durationMinutes ? true : undefined}
              disabled={busy}
            />
            {QUICK_DURATIONS.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                size="sm"
                variant={duration === String(minutes) ? "default" : "outline"}
                onClick={() => setDuration(String(minutes))}
                disabled={busy}
              >
                {minutes}
              </Button>
            ))}
          </div>
          {errors.durationMinutes ? (
            <p className="text-destructive text-sm">{errorText(errors.durationMinutes)}</p>
          ) : null}
        </div>

        {isEdit ? null : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="time-block-task">{t("timeBlock.field.task")}</Label>
              <select
                id="time-block-task"
                className={SELECT_CLASS}
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={busy}
              >
                <option value="">{t("timeBlock.noTask")}</option>
                {(tasks ?? []).map((task) => (
                  <option key={task._id} value={task._id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="time-block-habit">{t("timeBlock.field.habit")}</Label>
              <select
                id="time-block-habit"
                className={SELECT_CLASS}
                value={habitId}
                onChange={(event) => setHabitId(event.target.value)}
                disabled={busy}
              >
                <option value="">{t("timeBlock.noHabit")}</option>
                {(habits ?? []).map((habit) => (
                  <option key={habit._id} value={habit._id}>
                    {habit.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {serverError ? (
          <p role="alert" className="text-destructive text-sm">
            {t(serverError)}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:items-center">
          {isEdit ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2 sm:mr-auto">
                <span className="text-sm">{t("timeBlock.deleteAsk")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  {t("timeBlock.deleteYes")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                >
                  {t("timeBlock.deleteKeep")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                {t("timeBlock.delete")}
              </Button>
            )
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("timeBlock.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {t(busy ? "timeBlock.saving" : isEdit ? "timeBlock.save" : "timeBlock.add")}
          </Button>
        </DialogFooter>
      </form>
      <DialogClose className={CLOSE_CLASS}>
        <Cross2Icon className="h-4 w-4" />
        <span className="sr-only">{t("timeBlock.close")}</span>
      </DialogClose>
    </DialogContent>
  );
}
