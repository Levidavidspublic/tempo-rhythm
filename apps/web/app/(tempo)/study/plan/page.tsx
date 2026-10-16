/**
 * @screen: study plan (Plan back from a deadline + SessionScheduler), kitchen T8 S3 / S4
 * @source: docs/kitchen/study/T8-T10-SPEC.md, docs/design/v3/screens/web/plan.html
 * @queries: users.getProfile, plans.list, plans.get, calendar_events.listInRange, tasks.listDueInRange
 * @mutations: plans.createFromPreview, plans.undoCreate (Undo 5:00), tasks.update (move a session)
 * @auth: the preview works signed out; saving needs a signed-in account
 */
import { PlanPathScreen } from "@/components/calendar/plan/PlanPathScreen";

export default function Page() {
  return <PlanPathScreen />;
}
