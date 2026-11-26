/**
 * @screen  Today (tab home)
 * @source  docs/design/v3/screens/mobile/today.html
 * @data    tasks.listToday · dayPlans.getForDate (energy) · timeBlocks.listForDate ·
 *          calendar_events.listInRange (today) · habits.list · habitCheckIns.listForDate · users.getProfile
 * @actions tick -> tasks.toggleCompletion (Undo 5 min) · energy -> dayPlans.upsert ·
 *          log habit -> habitCheckIns.check / undo (Undo 5 min) · finished focus timer -> focusBlocks.create
 * @states  default | empty | loading | error | offline
 */
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Check, Clock, Lock, Pause, Play, Plus, Repeat, Search, Sun, Zap } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, Chip, Eyebrow, PageHeader, Row, SectionHead, Segmented, T } from "@/components/v3/primitives";
import { CaptureFab, MobileTopBar, Screen } from "@/components/v3/Shell";
import { useNow, useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { TaskRow } from "@/components/v3/TaskRow";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clockTime, longDay, partOfDay } from "@/lib/v3/dates";
import {
  ENERGY_TO_PLAN,
  energyWord,
  focusMinutes,
  formatCountdown,
  isOpen,
  nextUpReason,
  pickNextUp,
  planEnergyWord,
  type TaskLike,
} from "@/lib/v3/tasks";

type Today = { iso: string; startMs: number; endMs: number };

export default function TodayScreen() {
  const t = useT("today");
  const { lang } = usePrefs();
  const router = useRouter();
  const session = useTempoSession();
  const today = useToday();
  const offline = useOffline();
  const part = partOfDay(new Date().getHours());
  // "Good morning, Maya"; with no name, just "Good morning".
  const greeting = session.name
    ? t(`date.eyebrow.${part}`, { name: session.name })
    : t(`date.eyebrow.${part}`, { name: "" }).replace(/,\s*$/, "").trim();

  return (
    <Screen tabs overlay={<CaptureFab label={t("fab.capture")} onPress={() => router.push("/capture")} />}>
      <MobileTopBar
        title={t("top.title")}
        start={{
          kind: "icon",
          icon: Search,
          label: t("top.search"),
          onPress: () => router.push({ pathname: "/tasks", params: { search: "1" } }),
        }}
      />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <PageHeader eyebrow={greeting} title={longDay(today.iso, lang)} />
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        <TodayBody ready={session.ready} today={today} />
      </QueryBoundary>
    </Screen>
  );
}

function TodayBody({ ready, today }: { ready: boolean; today: Today }) {
  const t = useT("today");
  const router = useRouter();
  const toast = useToast();
  const tasks = useQuery(api.tasks.listToday, ready ? { dueFrom: today.startMs, dueTo: today.endMs } : "skip");
  const plan = useQuery(api.dayPlans.getForDate, ready ? { localDate: today.iso } : "skip");
  const blocks = useQuery(api.timeBlocks.listForDate, ready ? { localDate: today.iso } : "skip");
  const events = useQuery(api.calendar_events.listInRange, ready ? { startMs: today.startMs, endMs: today.endMs } : "skip");
  const habits = useQuery(api.habits.list, ready ? {} : "skip");
  const checkIns = useQuery(api.habitCheckIns.listForDate, ready ? { localDate: today.iso } : "skip");
  const toggle = useMutation(api.tasks.toggleCompletion);
  const update = useMutation(api.tasks.update);

  if (!tasks || plan === undefined || !blocks || !events || !habits || !checkIns) {
    return <StateLoading label={t("load.label")} rows={3} block />;
  }

  // A habit-only day still opens the normal layout, so the habit can be logged from here.
  if (!tasks.length && !blocks.length && !events.length && !habits.some((h) => h.deletedAt === undefined)) {
    return (
      <StateEmpty icon={Sun} title={t("empty.title")} body={t("empty.body")}>
        <Button icon={Plus} label={t("empty.capture")} onPress={() => router.push("/capture")} />
        <Button variant="ghost" label={t("empty.coach")} onPress={() => router.push("/coach")} />
      </StateEmpty>
    );
  }

  const onToggle = async (task: TaskLike) => {
    const taskId = task._id as Id<"tasks">;
    const before = task.status;
    const result = await toggle({ taskId });
    if (result.status !== "done") return;
    // Undo puts back the status it had; a repeating task's completion also creates the next one,
    // which this Undo could not take back, so that case gets no Undo rather than a partial one.
    toast({
      title: t("task.undone"),
      ...(task.repeatCfgId ? {} : { onUndo: () => update({ taskId, status: before }) }),
    });
  };

  const open = tasks.filter(isOpen);
  const ordered = [...open, ...tasks.filter((x) => x.status === "done")];
  const liveHabit = habits.find((h) => h.deletedAt === undefined);

  return (
    <View style={{ gap: 24 }}>
      <NextUp tasks={open} />
      <EnergyCheck today={today} value={planEnergyWord(plan?.energy)} />

      <View style={{ gap: 12 }}>
        <SectionHead title={t("h.tasks")} count={`${open.length} ${t("tasks.open")}`} />
        {ordered.length ? (
          <View>
            {ordered.map((task, i) => (
              <TaskRow key={task._id} task={task} todayEndMs={today.endMs} onToggle={onToggle} last={i === ordered.length - 1} />
            ))}
          </View>
        ) : null}
        <Button variant="ghost" icon={Plus} label={t("tasks.add")} onPress={() => router.push("/capture")} />
      </View>

      <TimeBlocks blocks={blocks} events={events} tasks={tasks} />

      {liveHabit ? (
        <HabitToday habit={liveHabit} today={today} logged={checkIns.some((c) => c.habitId === liveHabit._id)} />
      ) : null}
    </View>
  );
}

/** A running focus stretch keeps its own task and length, whatever Next up picks meanwhile. */
type Timer = { task: TaskLike; durationMs: number; leftMs: number; runningSince: number | null; startedAt: number };

/** NextUpCard: one task, why it was picked, how long it takes, and one primary "Start N minutes". */
function NextUp({ tasks }: { tasks: TaskLike[] }) {
  const t = useT("today");
  const router = useRouter();
  const createFocus = useMutation(api.focusBlocks.create);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const picked = useMemo(() => pickNextUp(tasks, skipped), [tasks, skipped]);
  // The focus timer is local (no Undo needed); a stretch that runs to the end is logged.
  const [timer, setTimer] = useState<Timer | null>(null);
  // While a stretch runs, the card stays on its task (fresh from the list if still open).
  const task = timer ? (tasks.find((item) => item._id === timer.task._id) ?? timer.task) : picked;
  const minutes = timer ? Math.round(timer.durationMs / 60_000) : task ? focusMinutes(task) : 25;
  const now = useNow(1000, timer?.runningSince != null);
  const left = timer ? (timer.runningSince != null ? timer.leftMs - (now - timer.runningSince) : timer.leftMs) : minutes * 60_000;
  const logged = useRef<string | null>(null);

  useEffect(() => {
    if (!timer || timer.runningSince == null || left > 0) return;
    const key = `${timer.task._id}:${timer.startedAt}`;
    if (logged.current === key) return;
    logged.current = key;
    createFocus({ startedAtMs: timer.startedAt, durationMs: timer.durationMs, taskId: timer.task._id as Id<"tasks"> }).catch(
      () => undefined,
    );
    setTimer(null);
  }, [left, timer, createFocus]);

  if (!task) {
    return (
      <Card strong style={{ padding: 20, gap: 8 }}>
        <Eyebrow>{t("next.eyebrow")}</Eyebrow>
        <T size="lg" serif weight="500">
          {t("next.done")}
        </T>
      </Card>
    );
  }

  const mine = timer !== null;
  const running = mine && timer?.runningSince != null;
  const paused = mine && timer?.runningSince == null;
  const startLabel = running
    ? `${t("timer.running")} · ${formatCountdown(left)}`
    : paused
      ? `${t("timer.paused")} · ${formatCountdown(left)}`
      : t("next.start.n", { n: minutes });

  const onStart = () => {
    const at = Date.now();
    if (running && timer) setTimer({ ...timer, leftMs: left, runningSince: null });
    else if (paused && timer) setTimer({ ...timer, runningSince: at });
    else setTimer({ task, durationMs: minutes * 60_000, leftMs: minutes * 60_000, runningSince: at, startedAt: at });
  };

  return (
    <Card strong style={{ padding: 20, gap: 12 }}>
      <Eyebrow>{t("next.eyebrow")}</Eyebrow>
      <T size="2xl" serif weight="500" user accessibilityRole="header">
        {task.title}
      </T>
      <T tone="muted">{t(`next.why.${nextUpReason(task)}`)}</T>
      <Row className="gap-2" wrap>
        <Chip icon={Clock} label={`${minutes} ${t("unit.min")}`} />
        <Chip icon={Zap} label={t(`energy.${energyWord(task.energy)}`)} />
      </Row>
      <View style={{ gap: 8, marginTop: 4 }}>
        <Button variant="primary" block icon={running ? Pause : Play} label={startLabel} onPress={onStart} />
        <Row className="gap-2">
          <View style={{ flex: 1 }}>
            <Button
              block
              label={t("next.notnow")}
              onPress={() => {
                setTimer(null);
                setSkipped((s) => new Set([...s, task._id]));
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              block
              variant="ghost"
              label={t("next.smaller")}
              onPress={() => router.push({ pathname: "/coach", params: { ask: "smaller", task: task.title } })}
            />
          </View>
        </Row>
      </View>
    </Card>
  );
}

/** EnergyBlock: Quiet / Steady / Push, saved on today's day plan. Nothing is picked until you pick. */
function EnergyCheck({ today, value }: { today: Today; value: "quiet" | "steady" | "push" | null }) {
  const t = useT("today");
  const toast = useToast();
  const upsert = useMutation(api.dayPlans.upsert);
  // The choice shows at once; it gives way when the saved value changes.
  const [local, setLocal] = useState<{ value: "quiet" | "steady" | "push"; base: typeof value } | null>(null);
  const shown = local && local.base === value ? local.value : value;

  const choose = (next: "quiet" | "steady" | "push") => {
    setLocal({ value: next, base: value });
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }
    upsert({ localDate: today.iso, energy: ENERGY_TO_PLAN[next], ...(timezone ? { timezone } : {}) }).catch(() => {
      setLocal(null);
      toast({ title: t("action.error") });
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <T size="xl" serif weight="500" accessibilityRole="header">
        {t("h.energy")}
      </T>
      <Card style={{ gap: 12 }}>
        <T tone="muted">{t("energy.q")}</T>
        <Segmented
          block
          tall
          label={t("energy.q")}
          value={shown}
          onChange={choose}
          options={[
            { value: "quiet", label: t("energy.quiet"), hint: t("energy.quiet.hint") },
            { value: "steady", label: t("energy.steady"), hint: t("energy.steady.hint") },
            { value: "push", label: t("energy.push"), hint: t("energy.push.hint") },
          ]}
        />
      </Card>
    </View>
  );
}

type Block = { key: string; startMs: number; endMs?: number; title: string; kind: "fixed" | "flex" };

/** TimeBlock rows: fixed = solid edge, lock and "Fixed"; flexible = dashed edge and "Flexible". */
function TimeBlocks({
  blocks,
  events,
  tasks,
}: {
  blocks: { _id: string; title: string; startsAtMs: number; endsAtMs: number; taskId?: string; status: string }[];
  events: { _id: string; title: string; startsAtMs: number }[];
  tasks: TaskLike[];
}) {
  const t = useT("today");
  const { colors: c } = usePrefs();
  const flexibility = new Map(tasks.map((x) => [x._id, x.flexibility]));
  const items: Block[] = [
    ...blocks
      .filter((b) => b.status !== "skipped")
      .map(
        (b): Block => ({
          key: b._id,
          startMs: b.startsAtMs,
          endMs: b.endsAtMs,
          title: b.title,
          // A block is elastic unless its task is fixed (convex/schema.ts: absent = elastic).
          kind: b.taskId && flexibility.get(b.taskId) === "fixed" ? "fixed" : "flex",
        }),
      ),
    // Calendar events keep their time, so they are fixed.
    ...events.map((e): Block => ({ key: e._id, startMs: e.startsAtMs, title: e.title, kind: "fixed" })),
  ].sort((a, b) => a.startMs - b.startMs);
  if (!items.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <T size="xl" serif weight="500" accessibilityRole="header">
        {t("h.time")}
      </T>
      <View style={{ gap: 8 }}>
        {items.map((item) => {
          const fixed = item.kind === "fixed";
          const range = item.endMs ? `${clockTime(item.startMs)}–${clockTime(item.endMs)}` : clockTime(item.startMs);
          const word = fixed ? t("time.fixed") : t("time.flex");
          return (
            <Row
              key={item.key}
              accessible
              accessibilityLabel={`${range}, ${item.title}, ${word}`}
              style={{
                alignItems: "center",
                gap: 12,
                minHeight: 52,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: c.ground,
                borderWidth: 1,
                borderColor: fixed ? c.info : c.caution,
                borderStyle: fixed ? "solid" : "dashed",
              }}
            >
              <View style={{ width: 104 }}>
                <T size="sm" tone="muted" mono ltr>
                  {range}
                </T>
              </View>
              <Row className="gap-2" wrap style={{ flex: 1, alignItems: "center" }}>
                <View style={{ flexShrink: 1 }}>
                  <T user>{item.title}</T>
                </View>
                <Chip tone={fixed ? "fixed" : "flex"} icon={fixed ? Lock : Clock} label={word} />
              </Row>
            </Row>
          );
        })}
      </View>
    </View>
  );
}

/** HabitBlock: one habit with Log today. No streak counter. */
function HabitToday({ habit, today, logged }: { habit: { _id: Id<"habits">; name: string }; today: Today; logged: boolean }) {
  const t = useT("today");
  const toast = useToast();
  const check = useMutation(api.habitCheckIns.check);
  const undo = useMutation(api.habitCheckIns.undo);
  const [local, setLocal] = useState<{ value: boolean; base: boolean } | null>(null);
  const on = local && local.base === logged ? local.value : logged;

  const press = () => {
    const args = { habitId: habit._id, localDate: today.iso, asOfLocalDate: today.iso };
    setLocal({ value: !on, base: logged });
    if (on) {
      undo(args).catch(() => setLocal(null));
      return;
    }
    check({ ...args, source: "today" })
      .then(() => toast({ title: t("habit.logged"), onUndo: () => undo(args) }))
      .catch(() => {
        setLocal(null);
        toast({ title: t("action.error") });
      });
  };

  return (
    <View style={{ gap: 12 }}>
      <T size="xl" serif weight="500" accessibilityRole="header">
        {t("h.habit")}
      </T>
      <Card>
        <Row className="gap-3" wrap style={{ alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <T weight="600" user>
              {habit.name}
            </T>
          </View>
          <Button
            small
            icon={on ? Check : Repeat}
            label={on ? t("habit.logged") : t("habit.log")}
            pressed={on}
            accessibilityLabel={`${habit.name}: ${on ? t("habit.logged") : t("habit.log")}`}
            onPress={press}
          />
        </Row>
      </Card>
    </View>
  );
}
