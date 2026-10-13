/**
 * @screen  Calendar
 * @source  docs/design/v3/screens/mobile/calendar.html
 * @data    calendar_events.listInRange (Monday to Monday of the shown week)
 * @actions choose a day, change week (query args) · add -> calendar_events.create for the chosen day
 *          (Undo 5 min -> calendar_events.remove)
 * @states  default | empty (nothing this week) | loading | error | offline · free day
 * Calendar events keep their time, so each shows as Fixed. Events have a start only (no end, no
 * place), so the agenda shows the start time.
 */
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Clock, Lock, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Chevron, Chip, PageHeader, RADIUS, Row, T, TextField, TOUCH } from "@/components/v3/primitives";
import { MobileTopBar, Screen, Sheet } from "@/components/v3/Shell";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import {
  addDays,
  clockTime,
  localDayBounds,
  longDay,
  mondayOf,
  parseClock,
  startOfLocalDay,
  weekDates,
  weekdayOf,
  weekRange,
} from "@/lib/v3/dates";
import { countByDate } from "@/lib/v3/display";
import { WEEKDAY_KEYS } from "@/lib/v3/habits";

export default function CalendarScreen() {
  const t = useT("calendar");
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
        <CalendarBody ready={session.ready} />
      </QueryBoundary>
    </Screen>
  );
}

function CalendarBody({ ready }: { ready: boolean }) {
  const t = useT("calendar");
  const p = usePrefs();
  const c = p.colors;
  const toast = useToast();
  const today = useToday();
  const [monday, setMonday] = useState(() => mondayOf(today.iso));
  const [selected, setSelected] = useState(today.iso);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<{ title?: string; time?: string; save?: string }>({});
  const dates = weekDates(monday);
  const range = { startMs: startOfLocalDay(monday), endMs: startOfLocalDay(addDays(monday, 7)) };
  const events = useQuery(api.calendar_events.listInRange, ready ? range : "skip");
  const create = useMutation(api.calendar_events.create);
  const remove = useMutation(api.calendar_events.remove);

  const moveWeek = (weeks: number) => {
    const next = addDays(monday, weeks * 7);
    setMonday(next);
    setSelected(weekDates(next).includes(today.iso) ? today.iso : next);
  };

  if (!events) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateLoading label={t("load.label")} rows={4} />
      </View>
    );
  }

  const counts = countByDate(
    events.map((e) => e.startsAtMs),
    dates,
  );
  const dayBounds = localDayBounds(selected);
  const agenda = events
    .filter((e) => e.startsAtMs >= dayBounds.startMs && e.startsAtMs < dayBounds.endMs)
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
  const itemsWord = (n: number) => (n === 1 ? t("item") : t("items"));

  const add = async () => {
    const minutes = parseClock(time);
    const next: typeof errors = {};
    if (!title.trim()) next.title = t("add.err.title");
    if (minutes === null) next.time = t("add.err.time");
    setErrors(next);
    if (next.title || next.time || minutes === null) return;
    try {
      const d = new Date(startOfLocalDay(selected));
      d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      const eventId = await create({ title: title.trim(), startsAtMs: d.getTime() });
      setTitle("");
      setTime("");
      setAdding(false);
      toast({ title: t("added"), onUndo: () => remove({ eventId }) });
    } catch {
      setErrors({ save: t("add.error") });
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <PageHeader
        title={t("page.title")}
        sub={
          <T tone="muted">
            <T tone="muted" ltr>
              {String(events.length)}
            </T>
            {` ${t("page.sub")}`}
          </T>
        }
      />
      <View style={{ gap: 12 }}>
        <Row style={{ alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Pressable
            onPress={() => moveWeek(-1)}
            accessibilityRole="button"
            accessibilityLabel={t("wk.prev")}
            style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}
          >
            <Chevron back color={c.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T size="xl" serif weight="500" center accessibilityRole="header">
              {weekRange(monday, p.lang)}
            </T>
          </View>
          <Pressable
            onPress={() => moveWeek(1)}
            accessibilityRole="button"
            accessibilityLabel={t("wk.next")}
            style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}
          >
            <Chevron color={c.ink} />
          </Pressable>
        </Row>
        <Row style={{ gap: 4, padding: 4, backgroundColor: c.sunken, borderRadius: RADIUS.md }}>
          {dates.map((d) => {
            const n = counts[d] ?? 0;
            const on = d === selected;
            const isToday = d === today.iso;
            const dow = t(WEEKDAY_KEYS[weekdayOf(d)] ?? "dow.mon");
            const label = [longDay(d, p.lang), n ? `${n} ${itemsWord(n)}` : t("nothing"), isToday ? t("today") : ""]
              .filter(Boolean)
              .join(", ");
            return (
              <Pressable
                key={d}
                onPress={() => setSelected(d)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  minHeight: TOUCH + 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: on ? c.lineControl : "transparent",
                  backgroundColor: on ? c.paper : "transparent",
                  padding: 4,
                }}
              >
                <T size="xs" weight="600" tone={on || isToday ? "ink" : "muted"} underline={isToday} center>
                  {dow}
                </T>
                <T size="lg" weight="600" ltr center>
                  {String(Number(d.slice(8, 10)))}
                </T>
                <T size="xs" tone="muted" ltr center>
                  {String(n)}
                </T>
              </Pressable>
            );
          })}
        </Row>
        <Row className="gap-2" wrap accessibilityLabel={t("legend.label")}>
          <Chip tone="fixed" icon={Lock} label={t("legend.fixed")} />
          <Chip tone="flex" icon={Clock} label={t("legend.flex")} />
        </Row>
      </View>

      {events.length === 0 ? (
        <StateEmpty icon={CalendarDays} title={t("empty.title")} body={t("empty.body")}>
          <Button icon={Plus} label={t("add")} onPress={() => setAdding(true)} />
        </StateEmpty>
      ) : (
        <View style={{ gap: 12 }}>
          <Row className="items-baseline gap-3" wrap>
            <View style={{ flex: 1 }}>
              <T size="xl" serif weight="500" accessibilityRole="header">
                {longDay(selected, p.lang)}
              </T>
            </View>
            {agenda.length ? (
              <T size="sm" tone="muted">
                {`${agenda.length} ${itemsWord(agenda.length)}`}
              </T>
            ) : null}
          </Row>
          {agenda.length ? (
            <View style={{ gap: 8 }}>
              {agenda.map((e) => (
                <Row
                  key={e._id}
                  accessible
                  accessibilityLabel={`${clockTime(e.startsAtMs)}, ${e.title}, ${t("kind.fixed")}`}
                  style={{
                    gap: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: RADIUS.md,
                    backgroundColor: c.ground,
                    borderWidth: 1,
                    borderColor: c.info,
                    alignItems: "flex-start",
                  }}
                >
                  <T size="sm" tone="muted" mono ltr>
                    {clockTime(e.startsAtMs)}
                  </T>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T weight="600" user>
                      {e.title}
                    </T>
                    <Row className="gap-2" wrap>
                      <Chip tone="fixed" icon={Lock} label={t("kind.fixed")} />
                    </Row>
                  </View>
                </Row>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <T tone="muted" center>
                {t("free")}
              </T>
            </View>
          )}
          <Button block icon={Plus} label={t("add")} onPress={() => setAdding(true)} />
        </View>
      )}

      <Sheet
        visible={adding}
        title={`${t("add")} · ${longDay(selected, p.lang)}`}
        onClose={() => setAdding(false)}
        closeLabel={t("more.close")}
        footer={<Button variant="primary" block icon={Plus} label={t("add")} onPress={add} />}
      >
        <TextField label={t("add.what")} value={title} onChangeText={setTitle} error={errors.title} user autoFocus />
        <TextField
          label={t("add.time")}
          help={t("add.timeHelp")}
          value={time}
          onChangeText={setTime}
          error={errors.time}
          placeholder="14:30"
          keyboardType="numbers-and-punctuation"
          ltr
        />
        {errors.save ? (
          <T size="sm" tone="danger" accessibilityRole="alert">
            {errors.save}
          </T>
        ) : null}
      </Sheet>
    </View>
  );
}

