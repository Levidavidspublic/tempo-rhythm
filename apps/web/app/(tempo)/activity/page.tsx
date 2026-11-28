/**
 * @screen: activity
 * @category: You
 * @source: docs/design/v3/screens/web/activity.html
 * @summary: What changed in the last seven days, newest first, grouped by day.
 * @queries: activity.list
 * @mutations: (none)
 * @auth: required (calm sign-in link otherwise)
 */
import { ActivityScreen } from "@/components/activity/ActivityScreen";

export default function Page() {
  return <ActivityScreen />;
}
