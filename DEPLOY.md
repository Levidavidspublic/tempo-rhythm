# Tempo web on Hostinger

This is for the planned InsForge-backed preview. It does not replace the current [environment contract](docs/ENVIRONMENTS.md).

## Build and runtime

Set the `NEXT_PUBLIC_*` names before the build, wherever it runs. Never write environment variable values in this file.

- `NEXT_PUBLIC_DATA_BACKEND`
- `NEXT_PUBLIC_INSFORGE_URL` (from the vault item's `API_BASE_URL`)
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`
- `NEXT_PUBLIC_CONVEX_URL` (still needed while parts of Tempo use Convex)
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_ENABLE_PASSKEYS`
- `TEMPO_SURFACE`

## Server only

- `INSFORGE_API_KEY` (ops, later)
- `MISTRAL_API_KEY` (setting this on Hostinger does not configure the current Convex AI runtime; its router reads `DEEPINFRA_API_KEY` from the Convex environment)
- `WHOP_WEBHOOK_SECRET`
- `WHOP_API_KEY`
- `WHOP_PLAN_ID`
- `TEMPO_CHECKOUT_ENABLED`
- `BETA_FOUNDER_EMAIL`
- `BETA_ALLOWLIST_EMAILS`
- `BETA_MAX_TESTERS`
- `TEMPO_CRON_SECRET` (later)

## Never set on Hostinger

- `TEMPO_E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS`
- `CONVEX_DEPLOY_KEY`

The `GCP_*` settings rely on Vercel OIDC for keyless access to Firebase. They do not work off Vercel, so `/api/waitlist` and `/api/whop/webhook` will not work on Hostinger until their Firestore writes move.

## Hostinger build path: PENDING

Amit has not chosen between (a) switching the repo to pnpm so Hostinger builds from Git and (b) keeping Bun and building a Next.js standalone bundle outside Hostinger to deploy there. Whether Hostinger can run Tempo's prebuilt standalone bundle is **UNKNOWN**.

On Hostinger's managed Node.js web and cloud hosting:

- [Node.js versions](https://www.hostinger.com/support/how-to-select-the-node-js-version-for-your-application/): 18.x, 20.x, 22.x and 24.x.
- [Package managers](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/): npm, Yarn and pnpm, detected from the lockfile. Bun is not supported.
- [Environment variables](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/): Hostinger applies public Next.js variables at build time and reads runtime variables when the app starts. Changes to build-time variables need a redeploy.
- [Limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/): requests stop after 120 seconds. No inbound WebSockets or always-running background workers.
