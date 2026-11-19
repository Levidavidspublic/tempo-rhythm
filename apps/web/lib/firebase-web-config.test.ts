// biome-ignore-all lint/style/useNamingConvention: Firebase environment names are external API keys.
import { expect, test } from "bun:test";

import {
  FIREBASE_WEB_ENV_NAMES,
  FirebaseWebConfigValidationError,
  missingFirebaseWebEnv,
  readFirebaseWebConfig,
  type FirebaseWebEnv,
} from "./firebase-web-config";

const completeEnv: FirebaseWebEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: " test-api-key ",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: " demo.example.test ",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: " demo-project ",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: " demo-bucket ",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: " 123456 ",
  NEXT_PUBLIC_FIREBASE_APP_ID: " demo-app-id ",
};

test("a full environment returns a frozen config with trimmed values", () => {
  const config = readFirebaseWebConfig(completeEnv);

  expect(config).toEqual({
    apiKey: "test-api-key",
    authDomain: "demo.example.test",
    projectId: "demo-project",
    appId: "demo-app-id",
    storageBucket: "demo-bucket",
    messagingSenderId: "123456",
  });
  expect(Object.isFrozen(config)).toBe(true);
});

test("blank optional values become null", () => {
  const config = readFirebaseWebConfig({
    ...completeEnv,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "  ",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: undefined,
  });

  expect(config?.storageBucket).toBeNull();
  expect(config?.messagingSenderId).toBeNull();
});

test("each missing or blank required name fails closed and is listed", () => {
  const requiredNames = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ] as const;

  for (const [index, name] of requiredNames.entries()) {
    const env = { ...completeEnv, [name]: index % 2 === 0 ? undefined : "  " };
    expect(readFirebaseWebConfig(env)).toBeNull();
    expect(missingFirebaseWebEnv(env)).toEqual([name]);
  }
});

test("a malformed project id reports its field without exposing its value", () => {
  const invalidProjectId = "Invalid_ID";
  const readInvalidConfig = () =>
    readFirebaseWebConfig({
      ...completeEnv,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: invalidProjectId,
    });

  expect(readInvalidConfig).toThrow(FirebaseWebConfigValidationError);

  try {
    readInvalidConfig();
  } catch (error) {
    expect(error).toBeInstanceOf(FirebaseWebConfigValidationError);
    expect((error as FirebaseWebConfigValidationError).field).toBe(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    );
    expect((error as Error).message).not.toContain(invalidProjectId);
  }
});

test("the documented names are exposed and missing output never contains values", () => {
  expect(FIREBASE_WEB_ENV_NAMES).toEqual([
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ]);

  const marker = "never-expose-this-value";
  const env = {
    ...completeEnv,
    NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: marker,
  };
  const missing = missingFirebaseWebEnv(env);
  expect(missing).toEqual(["NEXT_PUBLIC_FIREBASE_API_KEY"]);
  expect(missing).not.toContain(marker);
});
