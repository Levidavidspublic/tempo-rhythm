/**
 * @screen: projects
 * @source: docs/design/v3/screens/web/projects.html
 * @queries: users.getProfile, tasks.list (a project is the tasks that share a projectId)
 * @mutations: (none; a new project is saved by its first task)
 * @auth: required
 */
import { ProjectsScreen } from "@/components/projects/ProjectsScreen";

export default function Page() {
  return <ProjectsScreen />;
}
