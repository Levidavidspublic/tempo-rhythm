/**
 * @screen: goals
 * @source: docs/design/v3/screens/web/goals.html
 * @queries: users.getProfile, goals.list
 * @mutations: goals.create, goals.remove (Undo of a new goal)
 * @auth: required
 */
import { GoalsScreen } from "@/components/goals/GoalsScreen";

export default function Page() {
  return <GoalsScreen />;
}
