/**
 * @screen: goal-detail
 * @source: docs/design/v3/screens/web/goal-detail.html
 * @queries: users.getProfile, goals.list (the goal is found by id, so a bad id reads as not found)
 * @mutations: goals.update (title, why, status)
 * @auth: required
 */
import { GoalDetailScreen } from "@/components/goals/GoalDetailScreen";

type Params = { id: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <GoalDetailScreen goalId={id} />;
}
