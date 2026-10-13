/**
 * @screen: settings-privacy (docs/design/v3/screens/web/settings-privacy.html)
 * @data: users.getProfile (gate); deletes with users.deleteMyAccount
 * @auth: required
 */
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="settings-privacy" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsScreen
        title="set.privacy.title"
        sub="set.privacy.sub"
        offline="set.privacy.offline"
        loading="set.privacy.loading"
        errorTitle="set.privacy.errorTitle"
        errorBody="set.privacy.errorBody"
        bodyClassName="pv-body"
        stateClassName="pv-state"
      >
        <PrivacySettings />
      </SettingsScreen>
    </div>
  );
}
