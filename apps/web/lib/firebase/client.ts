import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { type FirebaseWebEnv, readFirebaseWebConfig } from "@/lib/firebase-web-config";

export type FirebaseClient = Readonly<{
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}>;

let cachedClient: FirebaseClient | undefined;

export function getFirebaseClient(env?: FirebaseWebEnv): FirebaseClient | null {
  const config = readFirebaseWebConfig(env);
  if (config === null) {
    return null;
  }

  if (cachedClient === undefined) {
    const app =
      getApps()[0] ??
      initializeApp({
        ...config,
        storageBucket: config.storageBucket ?? undefined,
        messagingSenderId: config.messagingSenderId ?? undefined,
      });
    cachedClient = { app, auth: getAuth(app), db: getFirestore(app) };
  }

  return cachedClient;
}

export function resetFirebaseClientForTests(): void {
  cachedClient = undefined;
}
