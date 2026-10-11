/**
 * @screen: settings-integrations
 * @category: Settings
 * @source: docs/design/claude-export/design-system/screens-6.jsx
 * @summary: Planned calendar integrations and MCP access.
 * @queries: mcp.listTokens
 * @mutations: mcp.createToken, mcp.revokeToken
 * @auth: required
 */
import Link from "next/link";
import { McpTokensCard } from "@/components/mcp/McpTokensCard";

const plannedIntegrations = [
  {
    name: "Google Calendar",
    description: "Two-way calendar sync",
  },
  {
    name: "Apple Calendar",
    description: "Two-way calendar sync",
  },
] as const;

export default function Page() {
  return (
    <>
      <main className="container mx-auto max-w-4xl px-6 py-12" data-testid="integrations-page">
        <header className="max-w-2xl">
          <p className="font-eyebrow text-muted-foreground">Settings</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">Integrations</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Calendar connections are planned, but they are not available yet.
          </p>
        </header>

        <section aria-labelledby="planned-integrations-heading" className="mt-8">
          <h2 id="planned-integrations-heading" className="sr-only">
            Planned integrations
          </h2>
          <ul className="space-y-3">
            {plannedIntegrations.map((integration) => (
              <li
                key={integration.name}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card"
              >
                <div>
                  <p className="font-medium text-foreground">{integration.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Coming soon
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Want one sooner? Tell us on{" "}
            <Link href="/ask-founder" className="font-medium text-foreground underline underline-offset-4">
              Ask the founder
            </Link>
            .
          </p>
        </section>
      </main>
      <div className="container mx-auto max-w-4xl px-6 pb-12">
        <McpTokensCard />
      </div>
    </>
  );
}
