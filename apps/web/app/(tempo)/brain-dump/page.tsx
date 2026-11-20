/**
 * @screen: brain-dump
 * @category: Flow
 * @source: docs/design/v3/screens/web/brain-dump.html
 * @summary: Rapid capture with auto-sort suggestions; results can be kept as a Markdown page.
 * @queries: crisis.check, crisis.resourcesCard
 * @mutations: brain_dump.prioritize, brain_dump.acceptPlan, notes.create
 * @auth: required
 */
import { BrainDumpScreen } from "@/components/brain-dump/BrainDumpScreen";

export default function Page() {
  return (
    <div data-testid="brain-dump-route">
      <BrainDumpScreen />
    </div>
  );
}
