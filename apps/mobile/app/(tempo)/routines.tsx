/**
 * @screen  Routines
 * @source  docs/design/v3/screens/mobile/routines.html (list, and ?view=guide&routine=<id>)
 * @data    the guided routines that ship with the app (lib/movement-routines.ts); there is no
 *          routines table in Convex yet, so a run's place is saved on this phone (AsyncStorage)
 * @actions start / continue -> guided view · Done, next step · Skip (a normal choice) · Pause ·
 *          Back a step · finish card with done and skipped counts
 * @states  default | empty | loading | offline · view list | guide · paused · finished
 * Guided sessions (breathwork, movement library, session player) stay reachable from here.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Check, Clock, Leaf, ListChecks, MessageCircle, Pause, Play, SkipForward, Sun, Undo2, Wind } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { BreathworkTimer } from "@/components/breathwork/BreathworkTimer";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Card, Dot, Eyebrow, ListRow, Notice, PageHeader, Row, SectionHead, T, TouchRow } from "@/components/v3/primitives";
import { MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline } from "@/components/v3/session";
import { OfflineNotice, StateEmpty, StateLoading } from "@/components/v3/states";
import { clockTime } from "@/lib/v3/dates";
import { type GuidedMovementRoutine, guidedMovementRoutines } from "@/lib/movement-routines";
import { isResumable, parseRun, type RoutineRun, runCounts, runReducer, startRun } from "@/lib/v3/routine-run";

const runKey = (id: string) => `tempo.v3.routineRun.${id}`;

function saveRun(run: RoutineRun): void {
  AsyncStorage.setItem(runKey(run.routineId), JSON.stringify(run)).catch(() => undefined);
}

export default function RoutinesScreen() {
  const t = useT("routines");
  const router = useRouter();
  const offline = useOffline();
  const params = useLocalSearchParams<{ view?: string; routine?: string }>();
  const [runs, setRuns] = useState<Record<string, RoutineRun | null> | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(
      guidedMovementRoutines.map(async (r) => [r.id, parseRun(await AsyncStorage.getItem(runKey(r.id)).catch(() => null), r.id, r.steps.length)] as const),
    )
      .then((pairs) => live && setRuns(Object.fromEntries(pairs)))
      .catch(() => live && setRuns({}));
    return () => {
      live = false;
    };
  }, []);

  // ?view=guide opens the guided view once, when the saved runs have loaded.
  const opened = useRef(false);
  useEffect(() => {
    if (params.view !== "guide" || !runs || opened.current) return;
    opened.current = true;
    const pick =
      guidedMovementRoutines.find((r) => r.id === params.routine) ??
      guidedMovementRoutines.find((r) => isResumable(runs[r.id])) ??
      guidedMovementRoutines[0];
    if (pick) setActive(pick.id);
  }, [params.view, params.routine, runs]);

  const routine = guidedMovementRoutines.find((r) => r.id === active) ?? null;
  const setRun = useCallback((run: RoutineRun) => {
    setRuns((cur) => ({ ...(cur ?? {}), [run.routineId]: run }));
    saveRun(run);
  }, []);

  const open = (r: GuidedMovementRoutine) => {
    const saved = runs?.[r.id];
    if (!saved || saved.finished) setRun(startRun(r.id, r.steps.length, Date.now()));
    setActive(r.id);
  };

  return (
    <Screen>
      <MobileTopBar
        title={routine ? t("title.guide") : t("top.title")}
        start={routine ? { kind: "icon", icon: ListChecks, label: t("fin.list"), onPress: () => setActive(null) } : { kind: "back" }}
      />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      {!runs ? (
        <StateLoading label={t("load.label")} rows={3} />
      ) : routine ? (
        <Guide
          routine={routine}
          run={runs[routine.id] ?? startRun(routine.id, routine.steps.length, Date.now())}
          setRun={setRun}
          onList={() => setActive(null)}
          onToday={() => router.navigate("/today")}
        />
      ) : (
        <List runs={runs} onOpen={open} />
      )}
    </Screen>
  );
}

function List({ runs, onOpen }: { runs: Record<string, RoutineRun | null>; onOpen: (r: GuidedMovementRoutine) => void }) {
  const t = useT("routines");
  const router = useRouter();
  const resume = guidedMovementRoutines
    .map((r) => ({ r, run: runs[r.id] }))
    .filter((x): x is { r: GuidedMovementRoutine; run: RoutineRun } => isResumable(x.run))
    .sort((a, b) => b.run.updatedAt - a.run.updatedAt)[0];

  if (!guidedMovementRoutines.length) {
    return (
      <StateEmpty icon={ListChecks} title={t("empty.title")} body={t("empty.body")}>
        <Button icon={MessageCircle} label={t("empty.coach")} onPress={() => router.push("/coach")} />
      </StateEmpty>
    );
  }

  return (
    <View style={{ gap: 24 }}>
      <PageHeader
        title={t("page.title")}
        sub={
          <T tone="muted">
            <T tone="muted" ltr>
              {String(guidedMovementRoutines.length)}
            </T>
            {` ${t("page.sub")}`}
          </T>
        }
      />
      {resume ? (
        <Card style={{ gap: 12 }}>
          <T size="sm" weight="600" tone="muted" accessibilityRole="header">
            {t("resume.title")}
          </T>
          <T>
            <T user>{resume.r.title}</T>
            {` · ${t("step")} `}
            <T ltr>{String(resume.run.index + 1)}</T>
            {` ${t("of")} `}
            <T ltr>{String(resume.r.steps.length)}</T>
          </T>
          {resume.run.paused && resume.run.pausedAt ? (
            <T size="sm" tone="muted">
              {t("resume.note", { time: clockTime(resume.run.pausedAt) })}
            </T>
          ) : null}
          <Button block icon={Play} label={t("resume.go")} onPress={() => onOpen(resume.r)} />
        </Card>
      ) : null}
      <View style={{ gap: 12 }}>
        <SectionHead title={t("all.title")} count={String(guidedMovementRoutines.length)} />
        <Card padded={false}>
          {guidedMovementRoutines.map((r, i) => {
            const inProgress = isResumable(runs[r.id]);
            const meta = [`${r.steps.length} ${t("steps")}`, `${t("about")} ${r.durationMinutes} ${t("unit.min")}`, inProgress ? t("r.inprogress") : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListRow
                key={r.id}
                icon={i === 0 ? Sun : i === guidedMovementRoutines.length - 1 ? Leaf : Clock}
                title={r.title}
                accessibilityLabel={`${r.title}, ${meta}`}
                meta={
                  <T size="sm" tone="muted">
                    {meta}
                  </T>
                }
                last={i === guidedMovementRoutines.length - 1}
                onPress={() => onOpen(r)}
              />
            );
          })}
        </Card>
        <T size="sm" tone="muted">
          {t("bundled.note")}
        </T>
        <Button variant="ghost" icon={MessageCircle} label={t("new.coach")} onPress={() => router.push("/coach")} />
      </View>
      <View style={{ gap: 12 }}>
        <SectionHead title={t("sessions.title")} />
        <Card padded={false}>
          <Link href="/breathwork" asChild>
            <TouchRow icon={Wind} label={t("sessions.breathwork")} role="link" />
          </Link>
          <Link href="/movement" asChild>
            <TouchRow icon={Leaf} label={t("sessions.movement")} role="link" />
          </Link>
          <Link href="/session-player" asChild>
            <TouchRow icon={Play} label={t("sessions.player")} role="link" last />
          </Link>
        </Card>
        {/* The breathwork timer that landed on this screen stays here (see tests/unit/*_leftover). */}
        <BreathworkTimer />
      </View>
    </View>
  );
}

/** GuidedStep: ONE step at a time, then a calm finish card. */
function Guide({
  routine,
  run,
  setRun,
  onList,
  onToday,
}: {
  routine: GuidedMovementRoutine;
  run: RoutineRun;
  setRun: (run: RoutineRun) => void;
  onList: () => void;
  onToday: () => void;
}) {
  const t = useT("routines");
  const { colors: c } = usePrefs();
  const [note, setNote] = useState("");
  const step = routine.steps[run.index];
  const counts = runCounts(run);
  const act = (type: "done" | "skip" | "back" | "pause" | "resume") => {
    const next = runReducer(run, { type, now: Date.now() });
    setRun(next);
    setNote(type === "skip" ? t("note.skipped") : type === "back" ? t("note.back") : type === "resume" ? t("note.resumed") : "");
  };

  if (run.finished) {
    return (
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.doneWash, alignItems: "center", justifyContent: "center" }}>
          <Leaf size={28} color={c.done} />
        </View>
        <T size="xl" serif weight="500" center accessibilityRole="header">
          {t("fin.t")}
        </T>
        <T tone="muted" center>
          {`${t("fin.done")} `}
          <T tone="muted" ltr>
            {String(counts.done)}
          </T>
          {` · ${t("fin.skipped")} `}
          <T tone="muted" ltr>
            {String(counts.skipped)}
          </T>
          {`. ${t("fin.b")}`}
        </T>
        <Row className="gap-2" wrap style={{ justifyContent: "center" }}>
          <Button icon={Sun} label={t("fin.today")} onPress={onToday} />
          <Button variant="ghost" label={t("fin.list")} onPress={onList} />
        </Row>
      </View>
    );
  }

  if (!step) return null;

  return (
    <Card style={{ padding: 20, gap: 20 }}>
      <View accessible accessibilityLiveRegion="polite">
        <Eyebrow>{`${routine.title} · ${t("step")} ${run.index + 1} ${t("of")} ${routine.steps.length}`}</Eyebrow>
      </View>
      <Row className="gap-2" style={{ alignItems: "center" }}>
        {routine.steps.map((s, i) => (
          <Dot key={s.id} state={i < run.index ? "done" : i === run.index ? "current" : "todo"} />
        ))}
      </Row>
      <View style={{ gap: 8 }}>
        <T size="3xl" serif weight="500" user accessibilityRole="header">
          {step.title}
        </T>
        <T tone="muted" user>
          {step.guidance}
        </T>
        <Row className="gap-1" style={{ alignItems: "center" }}>
          <Clock size={14} color={c.inkMuted} />
          <T size="sm" tone="muted">
            {`${t("about")} `}
            <T size="sm" tone="muted" ltr>
              {String(step.durationMinutes)}
            </T>
            {` ${t("unit.min")}`}
          </T>
        </Row>
      </View>
      {run.paused ? <Notice tone="info" icon={Pause} title={t("paused.t")} body={t("paused.b")} live="polite" /> : null}
      {note ? (
        <T size="sm" tone="muted" accessibilityLiveRegion="polite">
          {note}
        </T>
      ) : null}
      <View style={{ gap: 8 }}>
        <Button variant="primary" block icon={Check} label={t("done")} onPress={() => act("done")} />
        <Row className="gap-2">
          <View style={{ flex: 1 }}>
            <Button block icon={SkipForward} label={t("skip.one")} onPress={() => act("skip")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              block
              variant="ghost"
              icon={run.paused ? Play : Pause}
              label={run.paused ? t("resume") : t("pause")}
              pressed={run.paused}
              onPress={() => act(run.paused ? "resume" : "pause")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button block variant="ghost" icon={Undo2} label={t("back.step")} disabled={run.index === 0} onPress={() => act("back")} />
          </View>
        </Row>
      </View>
    </Card>
  );
}
