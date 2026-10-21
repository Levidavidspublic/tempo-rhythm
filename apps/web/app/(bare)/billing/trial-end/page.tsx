/**
 * @screen: trial-end (docs/design/v3/screens/web/trial-end.html), bare layout
 * @data: users.getMyPlan. No continue / cancel backend, so nothing here charges or changes a plan.
 * @auth: required
 */
import { TrialEnd } from "@/components/billing-plan/TrialEnd";
import { BareScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <BareScreen
      testId="trial-end-route"
      loading="set.trial.loading"
      errorTitle="set.trial.errorTitle"
      errorBody="set.trial.errorBody"
      errorLink={{ href: "/billing", label: "set.trial.plans" }}
    >
      <TrialEnd />
    </BareScreen>
  );
}
