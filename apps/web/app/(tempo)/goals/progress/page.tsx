/**
 * @screen: goals-progress
 * @source: docs/design/v3/screens/web/goals-progress.html
 * @queries: users.getProfile, goals.list, tasks.list({ status: "done" })
 * @mutations: (none)
 * @auth: required
 */
import { GoalsProgressScreen } from "@/components/goals/GoalsProgressScreen";

export default function Page() {
  return <GoalsProgressScreen />;
}
