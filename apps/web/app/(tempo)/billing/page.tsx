/**
 * @screen: billing (docs/design/v3/screens/web/billing.html; the route stays /billing)
 * @data: users.getMyPlan. Read-only: no checkout, no payment provider call.
 * @auth: required
 */
import { BillingPlan } from "@/components/billing-plan/BillingPlan";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="billing-page" className="tp-page" data-component="PageLayout">
      <SettingsScreen
        title="set.billing.title"
        sub="set.billing.sub"
        offline="set.billing.offline"
        loading="set.billing.loading"
        errorTitle="set.billing.errorTitle"
        errorBody="set.billing.errorBody"
        bodyClassName="bl-body"
        stateClassName="bl-state"
      >
        <BillingPlan />
      </SettingsScreen>
    </div>
  );
}
