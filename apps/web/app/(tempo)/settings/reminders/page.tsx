/**
 * @screen: settings-reminders (no v3 mock; kitchen T10 S14 [EXTRAPOLATED])
 * @summary: Messaging channels a nag can use: Telegram (connect, send a test, disconnect with Undo);
 *   WhatsApp and SMS stay "Not connected yet". No scheduled sends yet.
 * @queries: reminders.channels, nags.list
 * @mutations: reminders.startTelegramLink, reminders.unlinkTelegram, reminders.undoUnlinkTelegram,
 *   reminders.sendTest (action)
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
