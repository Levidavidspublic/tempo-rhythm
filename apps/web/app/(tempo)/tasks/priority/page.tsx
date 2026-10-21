import { PriorityBoard } from "@/components/tasks-priority/PriorityBoard";
import { TaskViewsScreen } from "@/components/tasks/TaskViewsScreen";

export default function PriorityTasksPage() {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1"
  ) {
    return <TaskViewsScreen view="priority" />;
  }

  return <PriorityBoard />;
}
