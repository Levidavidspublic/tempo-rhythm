"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  const [errors, setErrors] = useState<BlockFormErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = async () => {
    const parsed = parseBlockForm({
      localDate: block?.localDate ?? localDate,
      title,
      start,
      durationMinutes: duration.trim() === "" ? Number.NaN : Number(duration),
      kind,
      taskId: taskId || undefined,
      habitId: habitId || undefined,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setServerError("");
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
      setServerError("Could not save that block right now. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!block) return;
    setServerError("");
    setBusy(true);
    try {
      await removeBlock({ timeBlockId: block._id });
      onOpenChange(false);
    } catch {
      setServerError("Could not delete that block right now. Try again?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById("time-block-title")?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit time block" : "New time block"}</DialogTitle>
        <DialogDescription>Set aside a slot for a task, habit or focus time.</DialogDescription>
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
          <Label htmlFor="time-block-title">Title</Label>
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
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="time-block-start">Start time</Label>
            <Input
              id="time-block-start"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              aria-invalid={errors.start ? true : undefined}
              disabled={busy}
            />
            {errors.start ? <p className="text-destructive text-sm">{errors.start}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="time-block-kind">Type</Label>
            <select
              id="time-block-kind"
              className={SELECT_CLASS}
              value={kind}
              onChange={(event) => setKind(event.target.value as BlockKind)}
              disabled={busy}
            >
              {BLOCK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
            {errors.kind ? <p className="text-destructive text-sm">{errors.kind}</p> : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="time-block-duration">Length (minutes)</Label>
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
            <p className="text-destructive text-sm">{errors.durationMinutes}</p>
          ) : null}
        </div>

        {isEdit ? null : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="time-block-task">Link a task</Label>
              <select
                id="time-block-task"
                className={SELECT_CLASS}
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={busy}
              >
                <option value="">No task</option>
                {(tasks ?? []).map((task) => (
                  <option key={task._id} value={task._id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="time-block-habit">Link a habit</Label>
              <select
                id="time-block-habit"
                className={SELECT_CLASS}
                value={habitId}
                onChange={(event) => setHabitId(event.target.value)}
                disabled={busy}
              >
                <option value="">No habit</option>
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
            {serverError}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:items-center">
          {isEdit ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2 sm:mr-auto">
                <span className="text-sm">Delete this block?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Yes, delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                >
                  Keep it
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
                Delete block
              </Button>
            )
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add block"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
