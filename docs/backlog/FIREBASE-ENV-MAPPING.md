# Firebase setup and Convex -> Firebase env mapping (Tempo Flow)

Date: 2026-11-08. Amit's rules: Firebase is allowed; a change may move to production once it is proven in preview. Rule for names: "if Convex has A and Firebase has X, and X = A, use X".
Convex stays untouched until the Firebase rebuild is proven in preview.

## Firebase PREVIEW project
- Project ID: `tempo-flow-preview-20261106` (number 905398254866). Plan: Spark (no billing). Live project: none yet.
- Auth: initialised; provider Email (passwordless email link enabled, password allowed, `passwordRequired=false`). Matches the current Convex Auth Resend magic-link sign-in. Authorized domains today: `localhost`, `tempo-flow-preview-20261106.firebaseapp.com`, `tempo-flow-preview-20261106.web.app`. Vercel preview hostnames must be added before email-link sign-in works on a preview URL (no wildcards).
- Firestore: `(default)`, Native mode, `europe-west3` (already created before this job; kept). Rules: `firestore.rules` in this repo (deny by default; `users/{uid}/**` owner-only), deployed to the preview project 2026-11-08 and tested (6/6 rule tests pass).
- Storage: not enabled. No Convex file storage is used by this repo, and a new default bucket needs the Blaze plan. Needs Amit if storage is ever required.
- Web app: `tempo-flow-preview-20261106-web` (config in Vercel preview env below).
- Server access: keyless. Vercel preview (project `tempo-web`) -> Workload Identity pool `vercel-preview` / provider `vercel-oidc` (audience `https://vercel.com/amit-levins-projects`) -> service account `firebase-preview-admin@tempo-flow-preview-20261106.iam.gserviceaccount.com` (roles: `firebaseauth.admin`, `datastore.user`). No service-account keys exist. Verified 2026-11-08 from a preview function: OIDC -> STS -> impersonate -> list Auth users = PASS.

## Mapping (X = A)
- NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID = NEXT_PUBLIC_CONVEX_URL (web client config; public, set in Vercel preview)
- EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_APP_ID = EXPO_PUBLIC_CONVEX_URL (mobile; EAS env, not set yet; same values as the web app or a separate Android/iOS app)
- FIREBASE_PROJECT_ID (server) / GCP_PROJECT_ID (Vercel) = CONVEX_DEPLOYMENT
- GCP_PROJECT_NUMBER + GCP_WORKLOAD_IDENTITY_POOL_ID + GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID + GCP_SERVICE_ACCOUNT_EMAIL (keyless WIF, no secret) = CONVEX_DEPLOY_KEY
- Same GCP_* set, preview project = CONVEX_DEPLOY_KEY_TEST
- (no live Firebase project yet; create only after preview is proven) = CONVEX_DEPLOY_KEY_LIVE
- (none: Firebase token issuer is `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`; HTTP handlers move to Vercel routes) = CONVEX_SITE_URL

Not Convex variables, unchanged: AI provider keys, Resend, Polar/RevenueCat, PostHog, BETA_*.
Superseded: FIREBASE_SERVICE_ACCOUNT_* keys (keyless WIF replaces them; do not create).

## Vercel PREVIEW env (project tempo-web) - all set, verified clean 2026-11-08
NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, GCP_PROJECT_ID, GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID, GCP_SERVICE_ACCOUNT_EMAIL.
Fix applied 2026-11-08: the five GCP_* values had a leading byte-order mark, which broke the token exchange; they were re-set clean.

## UNKNOWN
- Which Vercel preview hostname(s) to add to Auth authorized domains.
- Email sender for magic links: Firebase's built-in sender vs Resend via a custom flow (product default is Resend).