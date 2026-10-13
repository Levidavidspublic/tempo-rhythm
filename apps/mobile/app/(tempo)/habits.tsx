/**
 * @screen  Habits
 * @source  docs/design/v3/screens/mobile/habits.html
 * @data    habits.list · habitCheckIns.listForDate (logged today) · habitCheckIns.listForHabit (7 days)
 * @actions log today -> habitCheckIns.check; tap again -> habitCheckIns.undo
 *          new habit -> habits.create({ name, cadence: "daily" }) (Undo 5 min -> habits.remove)
 *          start fresh -> hides the welcome-back card on this phone (it clears nothing)
 * @states  default | empty | loading | error | offline · welcome back (no log for 7+ days)
 * No streak counter anywhere. "When does it usually happen?" and "Pause it" are left out: the
 * habits table has no time-of-day or paused field yet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { Check, Leaf, Plus, RefreshCw, Repeat } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, Notice, PageHeader, Row, SectionHead, T, TextField } from "@/components/v3/primitives";
import { MobileTopBar, Screen, Sheet } from "@/components/v3/Shell";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDays, longDay } from "@/lib/v3/dates";
import { lastSevenDays, needsWelcomeBack, WEEKDAY_KEYS } from "@/lib/v3/habits";

const FRESH_KEY = "tempo.v3.habits.freshStart";

export default function HabitsScreen() {
  const t = useT("habits");
  const session = useTempoSession();
  const offline = useOffline();
  return (
    <Screen keyboard>
      <MobileTopBar title={t("top.title")} start={{ kind: "back" }} />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <QueryBoundary
        fallback={(retry) => (
          <View style={{ gap: 24 }}>
            <PageHeader title={t("page.title")} />
            <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
          </View>
        )}
      >
        <HabitsBody ready={session.ready} />
      </QueryBoundary>
    </Screen>
  );
}

type Habit = { _id: Id<"habits">; name: string; createdAt: number; deletedAt?: number };

function HabitsBody({ ready }: { ready: boolean }) {
  const t = useT("habits");
  const { lang } = usePrefs();
  const today = useToday();
  const toast = useToast();
  const habits = useQuery(api.habits.list, ready ? {} : "skip");
  const checkIns = useQuery(api.habitCheckIns.listForDate, ready ? { localDate: today.iso } : "skip");
  const create = useMutation(api.habits.create);
  const remove = useMutation(api.habits.remove);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem(FRESH_KEY)
      .then((raw) => raw && setFresh(JSON.parse(raw) as Record<string, string>))
      .catch(() => undefined);
  }, []);

  if (!habits || !checkIns) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateLoading label={t("load.label")} rows={4} />
      </View>
    );
  }

  const live = habits.filter((h) => h.deletedAt === undefined) as Habit[];
  const loggedToday = new Set(checkIns.map((c) => c.habitId as string));
  const loggedCount = live.filter((h) => loggedToday.has(h._id)).length;

  const add = async () => {
    const value = name.trim();
    if (!value) {
      setNameError(t("new.err"));
      return;
    }
    setNameError(null);
    try {
      const habitId = await create({ name: value, cadence: "daily" });
      setName("");
      setSheet(false);
      toast({ title: t("new.added"), onUndo: () => remove({ habitId }) });
    } catch {
      setNameError(t("new.error"));
    }
  };

  const startFresh = (habitId: string) => {
    const next = { ...fresh, [habitId]: today.iso };
    setFresh(next);
    AsyncStorage.setItem(FRESH_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  const newSheet = (
    <Sheet
      visible={sheet}
      title={t("new.title")}
      onClose={() => setSheet(false)}
      closeLabel={t("more.close")}
      footer={<Button variant="primary" block icon={Plus} label={t("new.add")} onPress={add} />}
    >
      <TextField
        label={t("new.name")}
        help={t("new.help")}
        error={nameError}
        value={name}
        onChangeText={setName}
        placeholder={t("new.ph")}
        maxLength={60}
        user
        autoFocus
        onSubmitEditing={add}
        returnKeyType="done"
      />
    </Sheet>
  );

  if (!live.length) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateEmpty icon={Repeat} title={t("empty.title")} body={t("empty.body")}>
          <Button icon={Plus} label={t("hb.new")} onPress={() => setSheet(true)} />
        </StateEmpty>
        {newSheet}
      </View>
    );
  }

  return (
    <View style={{ gap: 24 }}>
      <PageHeader
        title={t("page.title")}
        sub={
          <T tone="muted">
            {`${longDay(today.iso, lang)} · `}
            <T tone="muted" ltr>
              {String(loggedCount)}
            </T>
            {` ${t("page.of")} `}
            <T tone="muted" ltr>
              {String(live.length)}
            </T>
            {` ${t("page.logged")}`}
          </T>
        }
      />
      <T size="sm" tone="muted">
        {t("page.note")}
      </T>
      <View style={{ gap: 12 }}>
        <SectionHead title={t("hb.title")} count={`${live.length} ${t("hb.count")}`} />
        {live.map((habit) => (
          <HabitCard
            key={habit._id}
            habit={habit}
            todayIso={today.iso}
            logged={loggedToday.has(habit._id)}
            freshFrom={fresh[habit._id] ?? null}
            onStartFresh={() => startFresh(habit._id)}
          />
        ))}
        <Button block icon={Plus} label={t("hb.new")} onPress={() => setSheet(true)} />
      </View>
      {newSheet}
    </View>
  );
}

/** HabitBlock: name, Log today, and the last 7 days. A day without a log is an empty ring. */
function HabitCard({
  habit,
  todayIso,
  logged,
  freshFrom,
  onStartFresh,
}: {
  habit: Habit;
  todayIso: string;
  logged: boolean;
  freshFrom: string | null;
  onStartFresh: () => void;
}) {
  const t = useT("habits");
  const p = usePrefs();
  const c = p.colors;
  const days = useQuery(api.habitCheckIns.listForHabit, {
    habitId: habit._id,
    fromLocalDate: addDays(todayIso, -6),
    toLocalDate: todayIso,
  });
  const check = useMutation(api.habitCheckIns.check);
  const undo = useMutation(api.habitCheckIns.undo);
  const [local, setLocal] = useState<{ value: boolean; base: boolean } | null>(null);
  const [freshNote, setFreshNote] = useState(false);
  // The tap shows at once; it gives way when the saved value changes.
  const optimistic = local && local.base === logged ? local.value : null;
  const on = optimistic ?? logged;

  const dates = new Set((days ?? []).map((d) => d.localDate));
  if (optimistic !== null) {
    if (optimistic) dates.add(todayIso);
    else dates.delete(todayIso);
  }
  const week = lastSevenDays(todayIso, dates);
  // "Start fresh" counts as a new beginning: the 7 days run from the later of it and the last log.
  const baseline = [...dates, ...(freshFrom ? [freshFrom] : [])].sort().pop() ?? null;
  const welcome =
    days !== undefined && !freshNote && needsWelcomeBack({ todayIso, createdAt: habit.createdAt, lastLoggedIso: baseline });

  const press = () => {
    const args = { habitId: habit._id, localDate: todayIso, asOfLocalDate: todayIso };
    setLocal({ value: !on, base: logged });
    (on ? undo(args) : check({ ...args, source: "habits" })).catch(() => setLocal(null));
  };

  return (
    <Card style={{ gap: 12 }}>
      {welcome ? (
        <View style={{ gap: 8 }}>
          <Notice tone="info" icon={Leaf} title={t("fresh.title")} body={t("fresh.body", { name: habit.name })} />
          <Row className="gap-2" wrap>
            <Button
              icon={RefreshCw}
              label={t("fresh.start")}
              onPress={() => {
                onStartFresh();
                setFreshNote(true);
              }}
            />
          </Row>
        </View>
      ) : null}
      {freshNote ? (
        <T size="sm" tone="muted" accessibilityLiveRegion="polite">
          {t("fresh.started")}
        </T>
      ) : null}
      <Row className="gap-3" wrap style={{ alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <T weight="600" user>
            {habit.name}
          </T>
        </View>
        <Button
          icon={Check}
          label={on ? t("habit.logged") : t("habit.log")}
          pressed={on}
          accessibilityLabel={`${habit.name}: ${on ? t("habit.logged") : t("habit.log")}`}
          onPress={press}
        />
      </Row>
      <Row accessibilityLabel={t("hb.last7")} style={{ justifyContent: "space-between", gap: 4 }}>
        {week.map((d) => (
          <View
            key={d.date}
            accessible
            accessibilityLabel={`${t(WEEKDAY_KEYS[d.weekday] ?? "dow.mon")} ${d.day}, ${d.done ? t("habit.dayDone") : t("habit.dayOpen")}`}
            style={{ alignItems: "center", gap: 4, flex: 1 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: d.today ? 2 : 1.5,
                borderColor: d.done ? c.done : d.today ? c.ink : c.lineControl,
                backgroundColor: d.done ? c.done : c.paper,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {d.done ? <Check size={14} strokeWidth={2.5} color={c.paper} /> : null}
            </View>
            <T size="xs" tone="muted" center>
              {`${t(WEEKDAY_KEYS[d.weekday] ?? "dow.mon")} `}
              <T size="xs" tone="muted" ltr>
                {String(d.day)}
              </T>
            </T>
          </View>
        ))}
      </Row>
    </Card>
  );
}
