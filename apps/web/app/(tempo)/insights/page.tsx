/**
 * @screen: analytics
 * @category: You
 * @source: docs/design/v3/screens/web/insights.html
 * @summary: Gentle patterns and two simple charts from your own tasks and focus sessions.
 * @queries: tasks.list, focusBlocks.listInRange
 * @mutations: (none)
 * @auth: required (calm sign-in link otherwise)
 */
import { InsightsScreen } from "@/components/insights/InsightsScreen";

export default function Page() {
  return <InsightsScreen />;
}
