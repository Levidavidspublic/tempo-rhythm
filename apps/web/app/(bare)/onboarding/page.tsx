/**
 * @screen: onboarding (docs/design/v3/screens/web/onboarding.html), bare layout; `?step=1..5`
 * @data: users.getProfile, coach.getSettings; saves users.completeOnboarding, coach.setDial,
 *        notes.create / notes.update (first brain dump), preferences.update({ locale })
 * @auth: required
 */
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { BareScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <BareScreen
      testId="onboarding-route"
      loading="set.onb.loading"
      errorTitle="set.profile.errorTitle"
      errorBody="set.profile.errorBody"
    >
      <OnboardingFlow />
    </BareScreen>
  );
}
