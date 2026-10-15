"use client";

import { useState } from "react";
import { DayTimeline, type DayTimelineBlock } from "@/components/day-timeline/DayTimeline";
import { TimeBlockDialog } from "@/components/time-block-dialog/TimeBlockDialog";
import { toDateInputValue } from "@/lib/calendar/date-math";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

type PlanDialog =
  | { kind: "closed" }
  | { kind: "create"; startMinute: number }
  | { kind: "edit"; block: DayTimelineBlock };

export function PlanScreen() {
  const bounds = useLocalDayBounds();
  const localDate = toDateInputValue(new Date(bounds.startMs));
  const [dialog, setDialog] = useState<PlanDialog>({ kind: "closed" });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6" data-testid="plan-day">
      <DayTimeline
        localDate={localDate}
        onCreateAt={(startMinute) => setDialog({ kind: "create", startMinute })}
        onSelectBlock={(block) => setDialog({ kind: "edit", block })}
      />
      <TimeBlockDialog
        block={dialog.kind === "edit" ? dialog.block : undefined}
        initialStartMinute={dialog.kind === "create" ? dialog.startMinute : undefined}
        localDate={localDate}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        open={dialog.kind !== "closed"}
      />
    </div>
  );
}
