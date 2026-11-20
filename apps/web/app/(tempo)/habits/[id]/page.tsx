/**
 * @screen: habit-detail
 * @category: Library
 * @source: docs/design/v3/screens/web/habit-detail.html
 * @summary: One habit: Log today, a 6-week grid and one plain sentence. No streaks.
 * @queries: habits.get, habitCheckIns.listForHabit
 * @mutations: habitCheckIns.check, habitCheckIns.undo, habits.update
 * @auth: required
 */
import { HabitDetail } from "@/components/habit-detail/HabitDetail";

type Params = { id: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return (
    <div data-testid="habit-detail-route">
      <HabitDetail habitId={id} />
    </div>
  );
}
