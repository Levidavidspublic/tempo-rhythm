# Firebase keyless setup (Workload Identity Federation) - docs only

Status: design + infra record, 2026-11-08. Docs only: no code changes, nothing deployed. Companion to the draft PR #1361 (``docs/backlog/FIREBASE-MIGRATION.md``, branch ``reason/tempo-flow-firebase-depl-9c3cb6f7``); once that merges, fold this file into it.

Decision (Amit, 2026-11-08): go keyless ("headless"). Vercel preview builds and functions reach Firebase / Google Cloud through Workload Identity Federation (WIF). **No service-account key is ever created.** This supersedes `FIREBASE_SERVICE_ACCOUNT_TEMPO` / `FIREBASE_SERVICE_ACCOUNT_OMNIAGENT` from the mapping below: do not create or store those.

## Firebase env-name mapping (Amit's decision, 2026-11-08)

Decision (Amit, 2026-11-08): "with the equivalent thing that would need to be in Convex to Firebase: if variables are A, B, C in Convex and, in Firebase, they are X, Y, Z, and X = A, then that's basically what they need to do." The Firebase names below are the Firebase equivalents of each Convex variable the repo uses today. This supersedes the "do not invent names" line above. It is a naming decision only: HARD_RULES section 2 still forbids the Firebase SDK until a separate policy decision; no code changes here.

| Convex name | Firebase name | Secret? | Source |
|---|---|---|---|
| NEXT_PUBLIC_CONVEX_URL | NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID | No (public web config) | apps/web/.env.example; apps/web/components/providers/providers.tsx; .github/workflows/ci.yml; docs/ENVIRONMENTS.md |
| EXPO_PUBLIC_CONVEX_URL | EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_APP_ID | No | apps/mobile/.env.example; apps/mobile/utils/convexConfig.ts (omniagent) |
| CONVEX_DEPLOYMENT | FIREBASE_PROJECT_ID | No | root .env.example; apps/web/.env.example; apps/mobile/.env.example |
| CONVEX_DEPLOY_KEY | FIREBASE_SERVICE_ACCOUNT_<PROJECT> (TEMPO / OMNIAGENT) | Yes | root .env.example |
| CONVEX_DEPLOY_KEY_TEST | FIREBASE_SERVICE_ACCOUNT_<PROJECT> (preview project) | Yes | .github/workflows/convex-deploy-test.yml |
| CONVEX_DEPLOY_KEY_LIVE | FIREBASE_SERVICE_ACCOUNT_<PROJECT>_LIVE | Yes | scripts/factory/deploy-live-plan.mjs, release-gate.mjs (tempo-rhythm only). No live Firebase project exists: not created |
| CONVEX_SITE_URL | none (Convex HTTP-actions base URL / auth issuer domain). Token verification uses FIREBASE_PROJECT_ID; HTTP handlers move to Vercel routes | No | convex/auth.config.ts; root .env.example |

Not Convex vars, unchanged: MISTRAL_API_KEY, AUTH_RESEND_KEY, RESEND_FROM_EMAIL, BETA_*, REVENUECAT_*, POLAR_*, NEXT_PUBLIC_POSTHOG_*.

## Keyless design

Flow: Vercel injects a short-lived OIDC token -> Google STS exchanges it (checked against the pool provider's attribute condition) -> impersonates a service account -> short-lived access token for Firebase / Google APIs.

| Item | Value |
|---|---|
| Vercel team / project | `amit-levins-projects` / `tempo-web` |
| Vercel OIDC federation | enabled, issuer mode **team** |
| Issuer URL | `https://oidc.vercel.com/amit-levins-projects` |
| Audience | the pool provider's default audience: `https://iam.googleapis.com/projects/905398254866/locations/global/workloadIdentityPools/vercel-preview/providers/vercel-oidc` |
| GCP project (Spark, billing off - keep it so) | `tempo-flow-preview-20261106` (number `905398254866`) |
| Workload Identity Pool / provider | `vercel-preview` / `vercel-oidc` |
| Attribute condition | `assertion.sub == 'owner:amit-levins-projects:project:tempo-web:environment:preview' && assertion.iss == 'https://oidc.vercel.com/amit-levins-projects'` (this team, this project, environment preview only) |
| Attribute mapping | `google.subject=assertion.sub`, `attribute.owner/project/environment=assertion.*` |
| Service account | `firebase-preview-admin@tempo-flow-preview-20261106.iam.gserviceaccount.com` |
| SA project role | `roles/firebaseauth.admin` only (Firebase Auth: verify ID tokens, manage users). Narrower than the Admin SDK service-agent role. Add `roles/datastore.user` / `roles/storage.objectUser` only when Firestore / Storage are enabled and a ticket needs them |
| WIF binding | `roles/iam.workloadIdentityUser` on the SA for `principalSet://iam.googleapis.com/projects/905398254866/locations/global/workloadIdentityPools/vercel-preview/attribute.project/tempo-web` |
| APIs enabled for this | `iam`, `iamcredentials`, `sts` (no billing required) |
| User-managed SA keys | none exist; do not create any |

Live / production: **no live Firebase project and no live pool exists.** Preview only. A live pool needs its own project, condition (`environment:production`) and an owner decision.

## Vercel env names (PREVIEW, non-secret identifiers)

| Name | Meaning |
|---|---|
| `GCP_PROJECT_ID` | `tempo-flow-preview-20261106` |
| `GCP_PROJECT_NUMBER` | `905398254866` |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | `vercel-preview` |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | `vercel-oidc` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | the service account above |
| `NEXT_PUBLIC_FIREBASE_*` (6) | public web config, already set (see mapping) |

Names match Vercel's documented GCP OIDC guide (https://vercel.com/docs/oidc/gcp). Names only here, never values of secrets (there are none in this design).

## Work to do (for ticket loops; none done here)

1. Server code builds its credentials from WIF, not a key file: `ExternalAccountClient.fromJSON` from `google-auth-library` with `subject_token_supplier` calling `getVercelOidcToken({ audience })` from `@vercel/oidc` and `service_account_impersonation_url` for the SA (pattern in the Vercel GCP OIDC doc). Pass that auth client to the Firebase Admin / Google API client.
2. Client uses the `NEXT_PUBLIC_FIREBASE_*` config.
3. `CONVEX_SITE_URL` has no Firebase equivalent: token verification uses the Firebase project id; HTTP handlers move to Vercel routes.
4. Runtime proof: UNKNOWN. Config is verified; a real token exchange has not been run from a preview deployment. First ticket should add a tiny preview-only check.
5. Only `roles/firebaseauth.admin` is granted; widen per ticket, least privilege.


## Needs Amit (policy)

- **HARD_RULES currently forbid the Firebase SDK** (section 2, forbidden tech; Convex is the mandated backend). Server and client code cannot switch to Firebase until Amit changes that rule. Agents must not edit it.
- Convex stays untouched until that decision.
