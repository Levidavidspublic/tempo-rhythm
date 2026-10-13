/**
 * TaskRow (components.md: checkbox + title + meta in words). Ticking is optimistic: the row shows
 * the new state at once while `tasks.toggleCompletion` runs, and the screen offers a 5-minute Undo.
 */
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { clockTime, isEndOfDay, localIsoDate, shortDay } from "@/lib/v3/dates";
import { type TaskLike, taskMinutes } from "@/lib/v3/tasks";
import { usePrefs, useT } from "./prefs";
import { Checkbox, Row, T, Tag } from "./primitives";

export function TaskRow({
  task,
  todayEndMs,
  onToggle,
  last,
  showDueDay,
}: {
  task: TaskLike;
  todayEndMs: number;
  /** Runs the toggle; resolves when saved. The row flips back if it fails. */
  onToggle: (task: TaskLike) => Promise<void>;
  last?: boolean;
  /** Coming-up rows say which day they are due. */
  showDueDay?: boolean;
}) {
  const t = useT("tasks");
  const p = usePrefs();
  const c = p.colors;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const done = optimistic ?? task.status === "done";
  const minutes = taskMinutes(task);

  const toggle = () => {
    const next = !done;
    setOptimistic(next);
    onToggle(task)
      .catch(() => undefined)
      .finally(() => setOptimistic(null));
  };

  const meta: { key: string; node: ReactNode }[] = [];
  if (done && task.completedAt) {
    meta.push({
      key: "done",
      node: (
        <T size="sm" tone="muted">
          {`${t("task.donenote")} `}
          <T size="sm" tone="muted" ltr mono>
            {clockTime(task.completedAt)}
          </T>
        </T>
      ),
    });
  } else {
    if (showDueDay && task.dueAt !== undefined) {
      meta.push({ key: "due", node: <T size="sm" tone="muted">{shortDay(localIsoDate(new Date(task.dueAt)), p.lang)}</T> });
    } else if (task.dueAt !== undefined && task.dueAt < todayEndMs && !isEndOfDay(task.dueAt)) {
      meta.push({
        key: "before",
        node: (
          <T size="sm" tone="muted">
            {`${t("task.before")} `}
            <T size="sm" tone="muted" ltr mono>
              {clockTime(task.dueAt)}
            </T>
          </T>
        ),
      });
    }
    if (minutes !== null) {
      meta.push({
        key: "min",
        node: (
          <T size="sm" tone="muted">
            <T size="sm" tone="muted" ltr>
              {String(minutes)}
            </T>
            {` ${t("unit.min")}`}
          </T>
        ),
      });
    }
  }
  if (task.projectName) meta.push({ key: "tag", node: <Tag label={task.projectName} /> });

  return (
    <Row
      style={{
        alignItems: "flex-start",
        gap: 12,
        minHeight: 48,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}
    >
      <Checkbox checked={done} onPress={toggle} label={task.title} />
      <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
        <T user strike={done} tone={done ? "muted" : "ink"}>
          {task.title}
        </T>
        {meta.length ? (
          <Row className="gap-2" wrap style={{ alignItems: "center" }}>
            {meta.map((m) => (
              <View key={m.key}>{m.node}</View>
            ))}
          </Row>
        ) : null}
      </View>
    </Row>
  );
}
