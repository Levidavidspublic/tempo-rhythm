import { describe, expect, mock, test } from "bun:test";
import {
  createInsforgeSessionStore,
  type InsforgeSessionAuth,
  sessionFromCurrentUser,
} from "./session";

type CurrentUser = Awaited<ReturnType<InsforgeSessionAuth["getCurrentUser"]>>;

function fakeAuth(answers: Array<CurrentUser | Error>) {
  const callbacks = new Set<(event: string) => void>();
  let calls = 0;
  const pending: Array<() => void> = [];
  const auth: InsforgeSessionAuth = {
    getCurrentUser() {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return new Promise((resolve, reject) => {
        pending.push(() =>
          answer instanceof Error ? reject(answer) : resolve(answer as CurrentUser)
        );
      });
    },
    onAuthStateChange(callback) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
  return {
    auth,
    emit: (event: string) => {
      for (const callback of callbacks) callback(event);
    },
    listenerCount: () => callbacks.size,
    calls: () => calls,
    flush: async () => {
      while (pending.length) pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

const signedIn = (id: string, email: string): CurrentUser => ({
  data: { user: { id, email } },
  error: null,
});
const noUser: CurrentUser = { data: { user: null }, error: null };

describe("sessionFromCurrentUser", () => {
  test("a user with an id is signed in with uid and email", () => {
    expect(sessionFromCurrentUser(signedIn("u1", "a@example.com"))).toEqual({
      status: "signedIn",
      uid: "u1",
      email: "a@example.com",
    });
  });

  test("no user, a blank id or an error is signed out", () => {
    expect(sessionFromCurrentUser(noUser)).toEqual({ status: "signedOut" });
    expect(sessionFromCurrentUser(signedIn(" ", "a@example.com"))).toEqual({ status: "signedOut" });
    expect(sessionFromCurrentUser({ data: null, error: new Error("x") })).toEqual({
      status: "signedOut",
    });
  });
});

describe("createInsforgeSessionStore", () => {
  test("starts loading, then signed in from getCurrentUser", async () => {
    const fake = fakeAuth([signedIn("u1", "a@example.com")]);
    const store = createInsforgeSessionStore(fake.auth);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    expect(store.getSnapshot()).toEqual({ status: "loading" });
    store.start();
    await fake.flush();

    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });
    expect(notified).toBe(1);
  });

  test("no user is signed out", async () => {
    const fake = fakeAuth([noUser]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("null auth (client not configured) is signed out and start does nothing", () => {
    const store = createInsforgeSessionStore(null);
    store.start();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("an auth event re-reads the current user", async () => {
    const fake = fakeAuth([noUser, signedIn("u2", "b@example.com"), noUser]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });

    fake.emit("signedIn");
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u2", email: "b@example.com" });

    fake.emit("signedOut");
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(fake.calls()).toBe(3);
  });

  test("a thrown error is signed out", async () => {
    const fake = fakeAuth([new Error("network")]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("stop unsubscribes and ignores a late answer", async () => {
    const fake = fakeAuth([signedIn("u1", "a@example.com")]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    expect(fake.listenerCount()).toBe(1);

    store.stop();
    expect(fake.listenerCount()).toBe(0);
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "loading" });
  });

  test("a failed lookup is reported to onError, thrown or returned", async () => {
    const onError = mock((_error: unknown) => {});
    const fake = fakeAuth([new Error("network"), { data: null, error: new Error("expired") }]);
    const store = createInsforgeSessionStore(fake.auth, onError);
    store.start();
    await fake.flush();
    fake.emit("tokenRefreshed");
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  test("an older read that settles last does not overwrite a newer one", async () => {
    const settle: Array<(answer: CurrentUser | Error) => void> = [];
    const callbacks = new Set<(event: string) => void>();
    const auth: InsforgeSessionAuth = {
      getCurrentUser: () =>
        new Promise((resolve, reject) => {
          settle.push((answer) => (answer instanceof Error ? reject(answer) : resolve(answer)));
        }),
      onAuthStateChange(callback) {
        callbacks.add(callback);
        return () => callbacks.delete(callback);
      },
    };
    const store = createInsforgeSessionStore(auth);
    store.start();
    for (const callback of callbacks) callback("signedIn");
    expect(settle).toHaveLength(2);

    settle[1]?.(signedIn("u1", "a@example.com"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });

    settle[0]?.(new Error("refresh failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });
  });

  test("a throwing onError does not block the signed-out update", async () => {
    const fake = fakeAuth([new Error("network")]);
    const store = createInsforgeSessionStore(fake.auth, () => {
      throw new Error("diagnostic failed");
    });
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });
});
