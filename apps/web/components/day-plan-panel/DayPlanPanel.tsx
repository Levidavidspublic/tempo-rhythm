"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { MAX_TOP_TASKS, pruneTopTasks, toggleTopTask, toLocalDateKey } from "./dayPlanDraft";

type Energy = "low" | "medium" | "high";
const ENERGY_OPTIONS: { value: Energy; label: MessageKey }[] = [
  { value: "low", label: "dp.energy.low" },
  { value: "medium", label: "dp.energy.medium" },
  { value: "high", label: "dp.energy.high" },
];

export function DayPlanPanel() {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  // `startMs` changes exactly when the local day rolls over.
  const localDate = useMemo(() => toLocalDateKey(new Date(bounds.startMs)), [bounds.startMs]);
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const ready = isAuthenticated && profile != null;

  const plan = useQuery(api.dayPlans.getForDate, ready ? { localDate } : "skip");
  const todayTasks = useQuery(
    api.tasks.listToday,
    ready ? { dueFrom: bounds.startMs, dueTo: bounds.endMs } : "skip"
  );
  const carryOver = useQuery(api.dayPlans.listCarryOver, ready ? { beforeMs: bounds.startMs } : "skip");
  const upsert = useMutation(api.dayPlans.upsert);
  const commit = useMutation(api.dayPlans.commit);

  const [intention, setIntention] = useState("");
  const [topTaskIds, setTopTaskIds] = useState<Id<"tasks">[]>([]);
  const [energy, setEnergy] = useState<Energy | undefined>(undefined);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<"save" | "commit" | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed the draft from the server once per local day (not on every reactive update,
  // which would overwrite what the user is typing).
  useEffect(() => {
    if (plan === undefined || hydratedFor === localDate) return;
    setIntention(plan?.intention ?? "");
    setTopTaskIds(plan?.topTaskIds ?? []);
    setEnergy(plan?.energy);
    setEditing(false);
    setHydratedFor(localDate);
  }, [plan, localDate, hydratedFor]);

  const tasks = useMemo(() => {
    const seen = new Set<string>();
    return [...(todayTasks ?? []), ...(carryOver ?? [])].filter((t) => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });
  }, [todayTasks, carryOver]);

  // Only listed tasks count toward the cap; picks that left the lists cannot be unchecked.
  const selectedIds = useMemo(
    () => pruneTopTasks(topTaskIds, new Set<string>(tasks.map((t) => t._id))),
    [topTaskIds, tasks]
  );

  if (
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined ||
        (ready && (plan === undefined || todayTasks === undefined || carryOver === undefined))))
  ) {
    return <div aria-busy="true" className="h-48 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!ready) return null;

  const committed = plan?.status === "committed";
  const readOnly = committed && !editing;

  const save = async (patch: { intention?: string; topTaskIds?: Id<"tasks">[]; energy?: Energy }) => {
    setError(null);
    try {
      await upsert({
        localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...patch,
      });
    } catch {
      setError("save");
    }
  };

  const onToggleTask = (id: Id<"tasks">) => {
    const next = toggleTopTask(selectedIds, id);
    if (next.length === selectedIds.length && next.every((x, i) => x === selectedIds[i])) return;
    setTopTaskIds(next);
    void save({ topTaskIds: next });
  };

  const onPickEnergy = (value: Energy) => {
    setEnergy(value);
    void save({ energy: value });
  };

  const onCommit = async () => {
    setBusy(true);
    setError(null);
    try {
      await upsert({
        localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        intention,
        topTaskIds: selectedIds,
        ...(energy ? { energy } : {}),
      });
      await commit({ localDate });
      setEditing(false);
    } catch {
      setError("commit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card aria-label={t("dp.title")}>
      <CardHeader>
        <CardTitle className="text-xl">{t("dp.title")}</CardTitle>
        <CardDescription>{readOnly ? t("dp.set") : t("dp.sub")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="min-w-0 space-y-2">
          <label className="font-medium text-sm" htmlFor="day-plan-intention">
            {t("dp.intention")}
          </label>
          {/* A long intention scrolls inside the field; it never widens the card. */}
          <Input
            dir="auto"
            disabled={readOnly}
            id="day-plan-intention"
            onBlur={() => {
              if (intention.trim() !== (plan?.intention ?? "")) void save({ intention });
            }}
            onChange={(e) => setIntention(e.target.value)}
            placeholder={t("dp.intention.ph")}
            value={intention}
          />
        </div>

        {/* A fieldset is at least as wide as its widest word unless told otherwise (min-w-0). */}
        <fieldset className="min-w-0 space-y-2" disabled={readOnly}>
          <legend className="font-medium text-sm">
            {t("dp.pick").replace("{n}", String(MAX_TOP_TASKS))}
          </legend>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("dp.noTasks")}</p>
          ) : (
            <ul className="space-y-1">
              {tasks.map((task) => {
                const checked = selectedIds.includes(task._id);
                const atCap = !checked && selectedIds.length >= MAX_TOP_TASKS;
                return (
                  <li key={task._id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={checked}
                        className="shrink-0"
                        disabled={atCap || readOnly}
                        onChange={() => onToggleTask(task._id)}
                        type="checkbox"
                      />
                      {/* A title with no spaces wraps inside the card. */}
                      <span className="min-w-0 wrap-anywhere" dir="auto">
                        {task.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <fieldset className="min-w-0 space-y-2" disabled={readOnly}>
          <legend className="font-medium text-sm">{t("dp.energy")}</legend>
          <div className="flex flex-wrap gap-4">
            {ENERGY_OPTIONS.map((opt) => (
              <label className="flex items-center gap-2 text-sm" key={opt.value}>
                <input
                  checked={energy === opt.value}
                  name="day-plan-energy"
                  onChange={() => onPickEnergy(opt.value)}
                  type="radio"
                  value={opt.value}
                />
                {t(opt.label)}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
            <span className="min-w-0">
              {error === "save" ? t("dp.saveError") : t("dp.commitError")}
            </span>
            <Button
              onClick={() =>
                error === "commit"
                  ? void onCommit()
                  : void save({ intention, topTaskIds: selectedIds, ...(energy ? { energy } : {}) })
              }
              size="sm"
              variant="outline"
            >
              {t("today.retry")}
            </Button>
          </div>
        ) : null}

        {readOnly ? (
          <Button onClick={() => setEditing(true)} variant="outline">
            {t("dp.edit")}
          </Button>
        ) : (
          <div className="flex gap-3">
            {committed ? (
              <Button onClick={() => setEditing(false)} variant="outline">
                {t("dp.doneEditing")}
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void onCommit()}>
                {t("dp.commit")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
