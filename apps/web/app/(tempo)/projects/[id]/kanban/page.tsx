/**
 * @screen: project-kanban
 * @source: docs/design/v3/screens/web/project-kanban.html
 * @queries: users.getProfile, tasks.list
 * @mutations: tasks.update (moves), tasks.create, tasks.remove (Undo)
 * @auth: required
 */
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";

type Params = { id: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <TaskKanbanBoard projectSlug={id} />;
}
