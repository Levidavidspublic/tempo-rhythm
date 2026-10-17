/**
 * @screen: settings-reminders (no v3 mock; kitchen T10 S14 [EXTRAPOLATED])
 * @summary: Messaging channels a nag could use, all "Not connected yet"; reminders stay in the app.
 * @queries: reminders.channels
 * @mutations: none
 * @auth: required
 */
import { RemindersSettings } from "@/components/settings-reminders";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="reminders-page" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsScreen
        title="rem.title"
        sub="rem.sub"
        offline="rem.offline"
        loading="rem.loading"
        errorTitle="rem.errorTitle"
        errorBody="rem.errorBody"
        bodyClassName="tp-rem-body"
        stateClassName="tp-rem-state"
        notice={{ tone: "info", icon: "info", title: "rem.nTitle", body: "rem.nBody" }}
      >
        <RemindersSettings />
      </SettingsScreen>
    </div>
  );
}
