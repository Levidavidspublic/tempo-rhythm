import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

const project = "demo-tempo-alpha";

function emulatorOrigin(name) {
  const address = process.env[name];
  if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(address ?? "")) {
    throw new Error(`${name} must point to a loopback emulator`);
  }
  return `http://${address}`;
}

const auth = emulatorOrigin("FIREBASE_AUTH_EMULATOR_HOST");
const firestore = emulatorOrigin("FIRESTORE_EMULATOR_HOST");
const documents = `${firestore}/v1/projects/${project}/databases/(default)/documents`;

async function authPost(operation, data) {
  const url = `${auth}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=demo-key`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  assert.equal(response.status, 200, `Auth emulator: ${operation}`);
  return response.json();
}

async function emailLinkIdentity() {
  const email = `tester-${randomUUID()}@example.test`;
  await authPost("sendOobCode", {
    requestType: "EMAIL_SIGNIN",
    email,
    continueUrl: "http://127.0.0.1:3000/sign-in",
    canHandleCodeInApp: true,
  });
  const response = await fetch(`${auth}/emulator/v1/projects/${project}/oobCodes`);
  assert.equal(response.status, 200, "read emulator mail outbox");
  const { oobCodes } = await response.json();
  const link = oobCodes.find((entry) => entry.email === email);
  assert.ok(link?.oobCode, "the emulator issued a sign-in code");
  return authPost("signInWithEmailLink", { email, oobCode: link.oobCode });
}

async function document(path, method, token, fields) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (fields) headers["content-type"] = "application/json";
  const response = await fetch(`${documents}/${path}`, {
    method,
    headers,
    body: fields ? JSON.stringify({ fields }) : undefined,
  });
  await response.body?.cancel();
  return response.status;
}

const testNote = { title: { stringValue: "Alpha test note" } };

function gatePath(uid) {
  return `private/${uid}/account/gate`;
}

function setGate(uid, status, fields = {}) {
  return document(gatePath(uid), "PATCH", "owner", {
    approvalStatus: { stringValue: status },
    ...fields,
  });
}

test("only an approved, active, verified owner can access their Firestore data", async () => {
  const owner = await emailLinkIdentity();
  const another = await emailLinkIdentity();
  const note = `users/${owner.localId}/notes/alpha`;
  const gate = gatePath(owner.localId);

  assert.equal(await document(note, "PATCH", "owner", testNote), 200, "seed note");
  assert.equal(await document(note, "GET"), 403, "signed-out read");
  assert.equal(await document(note, "PATCH", undefined, testNote), 403, "signed-out write");
  assert.equal(await document(note, "GET", owner.idToken), 403, "missing gate");
  assert.equal(await document(note, "PATCH", owner.idToken, testNote), 403, "missing gate write");
  assert.equal(await document(gate, "PATCH", owner.idToken, testNote), 403, "self-approval");

  assert.equal(await setGate(owner.localId, "pending"), 200, "seed pending gate");
  assert.equal(await document(note, "GET", owner.idToken), 403, "pending read");
  assert.equal(await document(note, "PATCH", owner.idToken, testNote), 403, "pending write");

  assert.equal(await setGate(owner.localId, "approved"), 200, "approve owner");
  assert.equal(await setGate(another.localId, "approved"), 200, "approve second user");
  assert.equal(await document(note, "GET", owner.idToken), 200, "approved owner read");
  assert.equal(await document(note, "PATCH", owner.idToken, testNote), 200, "approved owner write");
  assert.equal(await document(gate, "GET", owner.idToken), 403, "private gate read");
  assert.equal(await document(note, "GET", another.idToken), 403, "other approved user read");
  assert.equal(await document(note, "PATCH", another.idToken, testNote), 403, "other approved user write");

  assert.equal(await setGate(owner.localId, "revoked"), 200, "revoke owner");
  assert.equal(await document(note, "GET", owner.idToken), 403, "revoked existing token");
  assert.equal(await document(note, "PATCH", owner.idToken, testNote), 403, "revoked write");

  assert.equal(await setGate(owner.localId, "approved", { isActive: { booleanValue: false } }), 200);
  assert.equal(await document(note, "GET", owner.idToken), 403, "inactive account");
  assert.equal(await setGate(owner.localId, "approved", {
    deletedAt: { timestampValue: "2026-01-01T00:00:00Z" },
  }), 200);
  assert.equal(await document(note, "GET", owner.idToken), 403, "soft-deleted account");
});

test("an approved gate does not grant an unverified Firebase identity access", async () => {
  const unverified = await authPost("signUp", {
    email: `tester-${randomUUID()}@example.test`,
    password: randomUUID(),
    returnSecureToken: true,
  });
  const note = `users/${unverified.localId}/notes/alpha`;
  assert.equal(await setGate(unverified.localId, "approved"), 200);
  assert.equal(await document(note, "PATCH", unverified.idToken, testNote), 403);
});
