/**
 * @screen: settings index. The v3 design lists these pages in the rail's Settings group
 * (settings-profile.html and its siblings); this page shows the same list at /settings.
 * @auth: required
 */
import { SettingsIndex } from "@/components/settings/SettingsIndex";

export default function Page() {
  return (
    <div data-testid="settings-index" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsIndex />
    </div>
  );
}
