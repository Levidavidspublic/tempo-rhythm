/**
 * @screen: routine-detail
 * @category: Library
 * @source: docs/design/v3/screens/web/routine-detail.html
 * @summary: Guided run of a routine, one step at a time.
 * @queries: notes.getSafe
 * @mutations: (none; the run lives on the screen)
 * @auth: required
 */
import { RoutineGuide } from "@/components/routines/RoutineGuide";

type Params = { id: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return (
    <div data-testid="routine-detail-route">
      <RoutineGuide routineId={id} />
    </div>
  );
}
