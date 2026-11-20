import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { type FirebaseWebEnv, readFirebaseWebConfig } from "@/lib/firebase-web-config";

export type FirebaseClient = Readonly<{
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}>;

let cachedClient: FirebaseClient | null | undefined;

export function getFirebaseClient(env?: FirebaseWebEnv): FirebaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const config = readFirebaseWebConfig(env);
  if (config === null) {
    cachedClient = null;
    return cachedClient;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  cachedClient = Object.freeze({
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  });

  return cachedClient;
}

export function resetFirebaseClientForTests(): void {
  cachedClient = undefined;
}
