/**
 * @screen: habits
 * @category: Library
 * @source: docs/design/v3/screens/web/habits.html
 * @summary: Each habit with Log today and its last 7 local days. No streak counter.
 * @queries: habits.list, habitCheckIns.listForDate (x7)
 * @mutations: habitCheckIns.check, habitCheckIns.undo, habits.create, habits.remove (Undo)
 * @auth: required
 */
import { HabitsScreen } from "@/components/habits/HabitsScreen";

export default function Page() {
  return (
    <div data-testid="habits-route">
      <HabitsScreen />
    </div>
  );
}
