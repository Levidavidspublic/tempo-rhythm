/**
 * @screen: settings-prefs (docs/design/v3/screens/web/settings-prefs.html)
 * @data: preferences.get, coach.getSettings; saves preferences.update, coach.setDial
 * @auth: required
 */
import { PreferencesForm } from "@/components/notifications-preferences/PreferencesForm";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="settings-preferences" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsScreen
        title="set.prefs.title"
        sub="set.prefs.sub"
        offline="set.prefs.offline"
        loading="set.prefs.loading"
        errorTitle="set.prefs.errorTitle"
        errorBody="set.prefs.errorBody"
        bodyClassName="pr-body"
        stateClassName="pr-state"
        statusLine
      >
        <PreferencesForm />
      </SettingsScreen>
    </div>
  );
}
