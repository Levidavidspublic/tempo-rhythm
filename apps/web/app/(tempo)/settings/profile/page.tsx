/**
 * @screen: settings-profile (docs/design/v3/screens/web/settings-profile.html)
 * @data: users.getProfile; saves users.updateMyProfile, preferences.update({ locale })
 * @auth: required
 */
import { ProfileForm } from "@/components/account/ProfileForm";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="settings-profile" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsScreen
        title="set.profile.title"
        sub="set.profile.sub"
        offline="set.profile.offline"
        loading="set.profile.loading"
        errorTitle="set.profile.errorTitle"
        errorBody="set.profile.errorBody"
        bodyClassName="sp-body"
        stateClassName="sp-state"
      >
        <ProfileForm />
      </SettingsScreen>
    </div>
  );
}
