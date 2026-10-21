/**
 * @screen  Tasks
 * @source  docs/design/v3/screens/mobile/tasks.html
 * @data    tasks.list — grouped on the phone: Today (due before tomorrow), Coming up, Inbox (no due
 *          date yet), Done today
 * @actions tick -> tasks.toggleCompletion (Undo 5 min) · filter and search (on the phone) · add -> /capture
 * @states  default | empty | loading | error | offline · no match
 */
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ListChecks, Plus, Search } from "lucide-react-native";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { useT } from "@/components/v3/prefs";
import { Button, PageHeader, SearchField, SectionHead, Segmented, T } from "@/components/v3/primitives";
import { CaptureFab, MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateEmpty, StateError, StateLoading } from "@/components/v3/states";
import { TaskRow } from "@/components/v3/TaskRow";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { filterGroups, groupsAreEmpty, groupTasks, type TaskFilter, type TaskLike } from "@/lib/v3/tasks";

export default function TasksScreen() {
  const t = useT("tasks");
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const session = useTempoSession();
  const offline = useOffline();
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (params.search === "1") setTimeout(() => searchRef.current?.focus(), 300);
  }, [params.search]);

  return (
    <Screen tabs keyboard overlay={<CaptureFab label={t("fab.capture")} onPress={() => router.push("/capture")} />}>
      <MobileTopBar
        title={t("top.title")}
        start={{ kind: "icon", icon: Search, label: t("top.search"), onPress: () => searchRef.current?.focus() }}
      />
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      <QueryBoundary
        fallback={(retry) => (
          <View style={{ gap: 24 }}>
            <PageHeader title={t("page.title")} />
            <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
          </View>
        )}
      >
        <TasksBody ready={session.ready} searchRef={searchRef} />
      </QueryBoundary>
    </Screen>
  );
}

function TasksBody({ ready, searchRef }: { ready: boolean; searchRef: RefObject<TextInput | null> }) {
  const t = useT("tasks");
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const tasks = useQuery(api.tasks.list, ready ? {} : "skip");
  const toggle = useMutation(api.tasks.toggleCompletion);
  const update = useMutation(api.tasks.update);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => (tasks ? groupTasks(tasks, today.startMs, today.endMs) : null), [tasks, today.startMs, today.endMs]);

  if (!tasks || !groups) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateLoading label={t("load.label")} rows={4} />
      </View>
    );
  }

  const openCount = groups.today.length + groups.upcoming.length + groups.inbox.length;
  if (groupsAreEmpty(groups)) {
    return (
      <View style={{ gap: 24 }}>
        <PageHeader title={t("page.title")} />
        <StateEmpty icon={ListChecks} title={t("empty.title")} body={t("empty.body")}>
          <Button icon={Plus} label={t("empty.capture")} onPress={() => router.push("/capture")} />
        </StateEmpty>
      </View>
    );
  }

  const shown = filterGroups(groups, filter, search);
  const onToggle = async (task: TaskLike) => {
    const taskId = task._id as Id<"tasks">;
    const before = task.status;
    const result = await toggle({ taskId });
    if (result.status !== "done") return;
    // Undo puts back the status it had. Completing a repeating task also creates the next one,
    // which this Undo could not take back, so that case gets no Undo rather than a partial one.
    toast({
      title: t("task.undone"),
      ...(task.repeatCfgId ? {} : { onUndo: () => update({ taskId, status: before }) }),
    });
  };

  const section = (key: string, title: string, count: string, rows: TaskLike[], extra?: ReactNode, dueDay?: boolean) =>
    rows.length ? (
      <View key={key} style={{ gap: 12 }}>
        <SectionHead title={title} count={count} />
        <View>
          {rows.map((task, i) => (
            <TaskRow key={task._id} task={task} todayEndMs={today.endMs} onToggle={onToggle} last={i === rows.length - 1} showDueDay={dueDay} />
          ))}
        </View>
        {extra}
      </View>
    ) : null;

  const nothing = groupsAreEmpty(shown);

  return (
    <View style={{ gap: 24 }}>
      <PageHeader
        title={t("page.title")}
        sub={
          <T tone="muted">
            <T tone="muted" ltr>
              {String(openCount)}
            </T>
            {` ${t("page.open")} · `}
            <T tone="muted" ltr>
              {String(groups.doneToday.length)}
            </T>
            {` ${t("page.done")}`}
          </T>
        }
      />
      <View style={{ gap: 12 }}>
        <SearchField label={t("search.label")} placeholder={t("search.ph")} value={search} onChangeText={setSearch} inputRef={searchRef} />
        <Segmented
          label={t("filter.label")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("filter.all") },
            { value: "today", label: t("filter.today") },
            { value: "upcoming", label: t("filter.upcoming") },
            { value: "inbox", label: t("filter.inbox") },
          ]}
        />
      </View>
      {section(
        "today",
        t("g.today"),
        `${shown.today.length} ${t("g.open")}`,
        shown.today,
        <Button variant="ghost" icon={Plus} label={t("tasks.add")} onPress={() => router.push("/capture")} />,
      )}
      {section("upcoming", t("g.upcoming"), `${shown.upcoming.length} ${t("g.open")}`, shown.upcoming, undefined, true)}
      {section("inbox", t("g.inbox"), `${shown.inbox.length} ${t("g.tosort")}`, shown.inbox)}
      {section("done", t("g.done"), String(shown.doneToday.length), shown.doneToday)}
      {nothing ? (
        <T tone="muted" accessibilityRole="text" accessibilityLabel={t("search.none")}>
          {t("search.none")}
        </T>
      ) : null}
    </View>
  );
}
