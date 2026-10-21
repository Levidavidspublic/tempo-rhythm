/**
 * @screen: settings-integrations (docs/design/v3/screens/web/settings-integrations.html)
 * @summary: Planned connectors ("Coming later"), the promise for them, the memory import and MCP tokens.
 * @queries: mcp.listTokens
 * @mutations: mcp.createToken, mcp.revokeToken
 * @auth: required
 */
import { IntegrationsList } from "@/components/settings/IntegrationsList";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function Page() {
  return (
    <div data-testid="integrations-page" className="tp-page tp-page--narrow" data-component="PageLayout">
      <SettingsScreen
        title="set.integ.title"
        sub="set.integ.sub"
        offline="set.integ.offline"
        loading="set.integ.loading"
        errorTitle="set.integ.errorTitle"
        errorBody="set.integ.errorBody"
        bodyClassName="ig-body"
        stateClassName="ig-state"
        gate={false}
        notice={{ tone: "info", icon: "info", title: "set.integ.nTitle", body: "set.integ.nBody" }}
      >
        <IntegrationsList />
      </SettingsScreen>
    </div>
  );
}
