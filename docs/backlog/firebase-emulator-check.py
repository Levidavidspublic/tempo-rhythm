#!/usr/bin/env python3
"""Official emulator REST acceptance; no SDK, credentials, or product config.

1. python3 docs/backlog/firebase-emulator-check.py --fixture /tmp/tempo-r1-emulator
2. firebase emulators:exec --project demo-tempo-r1 --only auth,firestore \
   --config /tmp/tempo-r1-emulator/firebase.json \
   'python3 docs/backlog/firebase-emulator-check.py'

Run only after the official CLI and Java prerequisites exist. This fixture is
EXTRAPOLATED isolation-test scaffolding, NOT an accepted product collection map.
No deployment, live connection, provider call, or email delivery is exercised.
"""

import argparse
import json
import os
from pathlib import Path
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, ProxyHandler, build_opener
import uuid

PROJECT = "demo-tempo-r1"
AUTH = "127.0.0.1:19099"
STORE = "127.0.0.1:18080"
RULES = """rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /isolationUsers/{uid}/items/{item} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['ownerUid', 'title'])
        && request.resource.data.ownerUid == uid
        && request.resource.data.title is string;
      allow update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['ownerUid', 'title'])
        && request.resource.data.ownerUid == resource.data.ownerUid
        && request.resource.data.ownerUid == uid
        && request.resource.data.title is string;
    }
  }
}
"""
# Loopback only, without proxy routing; never log response bodies or tokens.
HTTP = build_opener(ProxyHandler({}))


def request(host, path, method="GET", data=None, token=None):
  if host not in (AUTH, STORE):
    raise ValueError("Only fixed loopback emulator endpoints are allowed")
  headers = {"Content-Type": "application/json"}
  if token:
    headers["Authorization"] = "Bearer " + token
  body = json.dumps(data).encode() if data is not None else None
  req = Request(
      "http://" + host + path, data=body, method=method, headers=headers
  )
  try:
    with HTTP.open(req, timeout=15) as response:
      return response.status, json.load(response)
  except HTTPError as error:
    return error.code, {}  # Never expose a possible token/credential response.


def expect(actual, wanted, label):
  if actual != wanted:
    raise AssertionError(f"{label}: expected HTTP {wanted}, got {actual}")
  print("PASS: " + label)


def signup():
  status, response = request(
      AUTH,
      "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only",
      "POST",
      {
          "email": uuid.uuid4().hex + "@example.invalid",
          "password": uuid.uuid4().hex,
          "returnSecureToken": True,
      },
  )
  expect(status, 200, "official Auth emulator issues synthetic identity")
  # Tokens exist only in process memory; never invented, persisted or printed.
  return response["localId"], response["idToken"]


def run():
  required = {
      "FIREBASE_AUTH_EMULATOR_HOST": AUTH,
      "FIRESTORE_EMULATOR_HOST": STORE,
      "GCLOUD_PROJECT": PROJECT,
  }
  if any(os.environ.get(key) != value for key, value in required.items()):
    raise RuntimeError(
        "NOT RUN: use official emulators:exec with the fixed demo project and fixture ports"
    )
  uid_a, token_a = signup()
  _, token_b = signup()
  collection = f"/v1/projects/{PROJECT}/databases/(default)/documents/isolationUsers/{uid_a}/items"
  doc = collection + "/" + uuid.uuid4().hex
  payload = {
      "fields": {
          "ownerUid": {"stringValue": uid_a},
          "title": {"stringValue": "synthetic isolation"},
      }
  }
  status, _ = request(STORE, doc, "PATCH", payload, token_a)
  expect(status, 200, "A creates own record")
  status, result = request(STORE, doc, token=token_a)
  expect(status, 200, "A reads own record")
  if result.get("fields") != payload["fields"]:
    raise AssertionError("owner round-trip fields differ")
  print("PASS: owner fields round-trip")
  for token, actor in [(token_b, "B"), (None, "anonymous")]:
    for path, method, data, action in [
        (doc, "GET", None, "read"),
        (doc, "PATCH", payload, "write"),
        (collection, "GET", None, "list"),
    ]:
      status, _ = request(STORE, path, method, data, token)
      expect(status, 403, actor + " denied cross-owner " + action)
  forged = {
      "fields": {
          **payload["fields"],
          "ownerUid": {"stringValue": "another-owner"},
      }
  }
  status, _ = request(STORE, doc, "PATCH", forged, token_a)
  expect(status, 403, "A cannot reassign owner")
  status, _ = request(STORE, collection + "/forged", "PATCH", forged, token_a)
  expect(status, 403, "A cannot create forged owner")
  status, _ = request(
      STORE,
      f"/v1/projects/{PROJECT}/databases/(default)/documents/serverOnly/test",
      "PATCH",
      payload,
      token_a,
  )
  expect(status, 403, "unmatched server-only path denied")
  print(
      "PASS: official emulator isolation fixture only; product mapping/email-link/preview NOT VERIFIED"
  )


def fixture(directory):
  destination = Path(directory).resolve()
  temp = Path(tempfile.gettempdir()).resolve()
  if not destination.is_relative_to(temp) or destination == temp:
    raise ValueError(
        "Fixture must be a new directory below the system temporary directory"
    )
  destination.mkdir(mode=0o700, parents=True, exist_ok=False)
  (destination / "firestore.rules").write_text(RULES)
  config = {
      "firestore": {"rules": "firestore.rules"},
      "emulators": {
          "auth": {"host": "127.0.0.1", "port": 19099},
          "firestore": {"host": "127.0.0.1", "port": 18080},
          "ui": {"enabled": False},
          "singleProjectMode": True,
      },
  }
  (destination / "firebase.json").write_text(
      json.dumps(config, indent=2) + "\n"
  )
  print(
      "PASS: wrote temporary demo-only fixture (not deployed; not a product rules change)"
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--fixture")
  args = parser.parse_args()
  try:
    fixture(args.fixture) if args.fixture else run()
  except (
      AssertionError,
      RuntimeError,
      URLError,
      OSError,
      ValueError,
      KeyError,
  ):
    # Deliberately omit raw server responses, request headers and exception text.
    print(
        "FAIL / NOT RUN: prerequisite, identity, fixture, or isolation assertion failed; no success attestation"
    )
    raise SystemExit(1)
