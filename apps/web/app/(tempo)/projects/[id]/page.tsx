/**
 * @screen: project-detail
 * @source: docs/design/v3/screens/web/project-detail.html
 * @queries: users.getProfile, tasks.list({ projectId })
 * @mutations: tasks.create, tasks.toggleCompletion, tasks.update (rename), tasks.remove (Undo)
 * @auth: required
 */
import { ProjectDetailScreen } from "@/components/projects/ProjectDetailScreen";

type Params = { id: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <ProjectDetailScreen projectSlug={id} />;
}
