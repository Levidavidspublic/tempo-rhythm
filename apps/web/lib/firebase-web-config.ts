// biome-ignore-all lint/style/useNamingConvention: Firebase environment names are external API keys.
export const FIREBASE_WEB_ENV_NAMES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export const REQUIRED_FIREBASE_WEB_ENV_NAMES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export type FirebaseWebEnv = Partial<
  Record<(typeof FIREBASE_WEB_ENV_NAMES)[number], string | undefined>
>;

export type FirebaseWebConfig = Readonly<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket: string | null;
  messagingSenderId: string | null;
}>;

export function publicFirebaseEnv(): FirebaseWebEnv {
  // Next.js only inlines public environment values when they use literal property reads.
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function missingFirebaseWebEnv(
  env: FirebaseWebEnv = publicFirebaseEnv(),
): string[] {
  return REQUIRED_FIREBASE_WEB_ENV_NAMES.filter((name) => !env[name]?.trim());
}

const FIREBASE_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function readFirebaseWebConfig(
  env: FirebaseWebEnv = publicFirebaseEnv(),
): FirebaseWebConfig | null {
  if (missingFirebaseWebEnv(env).length > 0) {
    return null;
  }

  const projectId = (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string).trim();
  if (!FIREBASE_PROJECT_ID_PATTERN.test(projectId)) {
    return null;
  }

  return Object.freeze({
    apiKey: (env.NEXT_PUBLIC_FIREBASE_API_KEY as string).trim(),
    authDomain: (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string).trim(),
    projectId,
    appId: (env.NEXT_PUBLIC_FIREBASE_APP_ID as string).trim(),
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || null,
    messagingSenderId:
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || null,
  });
}
