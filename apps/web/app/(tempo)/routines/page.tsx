/**
 * @screen: routines
 * @category: Library
 * @source: docs/design/v3/screens/web/routines.html
 * @summary: Routines as cards. A routine is a page tagged #routine; its list items are the steps.
 * @queries: notes.list
 * @mutations: notes.create (New routine)
 * @auth: required
 */
import { RoutinesScreen } from "@/components/routines/RoutinesScreen";

export default function Page() {
  return (
    <div data-testid="routines-route">
      <RoutinesScreen />
    </div>
  );
}
