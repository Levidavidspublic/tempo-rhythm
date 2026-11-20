"use client";

import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateQuickTask } from "@/lib/data/tasks/use-create-quick-task";

type TodayQuickAddProps = {
  /** Any timestamp inside the current local calendar day; used so the task shows in Today immediately. */
  dueAt: number;
};

export function TodayQuickAdd({ dueAt }: TodayQuickAddProps) {
  const createQuick = useCreateQuickTask();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hint, setHint] = useState("");

  const inputId = useMemo(() => "today-quick-add", []);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setHint("Add a few words so you know what this is.");
      return;
    }

    setIsSubmitting(true);
    setHint("");

    try {
      await createQuick({
        title: trimmed,
        dueAt,
      });
      setTitle("");
    } catch {
      setHint("Could not add that right now. Try again?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
      <div className="mb-3">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          Add something small for today
        </label>
        <p className="mt-1 text-sm text-muted-foreground">Starting tiny still counts.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (hint) setHint("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setTitle("");
              setHint("");
            }
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={isSubmitting}
          placeholder="Reply to Sam, pay one bill, fold one shirt…"
          className="min-h-12 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
        />

        <Button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Adding…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </>
          )}
        </Button>
      </div>

      <div className="mt-2 min-h-5">
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
