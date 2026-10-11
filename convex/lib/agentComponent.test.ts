import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ComponentApi } from "@convex-dev/agent/_generated/component.js";
import { componentsGeneric } from "convex/server";
import { convexTest } from "convex-test";
import appSchema from "../schema";

/**
 * Real Agent component operations under Bun (ticket #815, B06).
 *
 * What this file proves: the pinned `@convex-dev/agent` 0.3.2 component, loaded
 * from its shipped `dist/component` modules, runs inside `convex-test` 0.0.38
 * with its real schema and real function bodies (threads, messages, users).
 * Nothing about the component is mocked or stubbed, and nothing here touches a
 * model, the network, a deployment or real user data. Every user id, thread
 * title and message body is synthetic.
 *
 * Source assumptions (all pinned, all inspected in node_modules):
 * - The Agent package exports `./test`, but that file runs `import.meta.glob`
 *   at import time, which Bun does not provide. It is NOT imported here.
 * - The package exports no standalone schema or function subpaths. Its
 *   `./package.json` IS exported, so the package root is resolved from it and
 *   the shipped `dist/component/*.js` files are loaded by absolute file URL.
 *   This is a version-pinned adaptation, not an officially documented Bun setup.
 * - convex-test accepts `Record<string, () => Promise<any>>` module maps. When a
 *   map is passed it never falls back to `import.meta.glob`. Each map must hold
 *   its real `_generated` path: convex-test takes everything before
 *   `_generated` as the module-root prefix, then strips file extensions when it
 *   looks a function up.
 * - `components.agent.*` references resolve to the component registered under
 *   the name `agent`. That is the name Agent's own `convex.config` declares
 *   (`defineComponent("agent")`) and the default `app.use(agent)` name.
 *   `convex/convex.config.ts` does not exist yet (ticket #806 owns it), so no
 *   generated app types are used. References come from `componentsGeneric()`
 *   and are typed with the `ComponentApi` type the Agent package ships.
 *
 * What this file does NOT prove:
 * - Tempo tenancy. The component stores `userId` as an opaque string and its
 *   functions take no caller identity. Ownership, soft-delete and account
 *   tombstones stay host-side and need their own application tests.
 * - Scheduler and streaming behaviour (see the `test.todo` entries at the end).
 */

type LoaderMap = Record<string, () => Promise<unknown>>;

const AGENT_COMPONENT_NAME = "agent";

// Resolve the installed package through its exported package.json.
const agentPackageJson = createRequire(import.meta.url).resolve("@convex-dev/agent/package.json");
const componentDir = join(dirname(agentPackageJson), "dist", "component");

function loadComponentModule(relativePath: string): () => Promise<unknown> {
  const url = pathToFileURL(join(componentDir, relativePath)).href;
  return () => import(url);
}

// Explicit module map for the shipped Agent component. Keys keep a `./`
// prefix so the `_generated` entries give convex-test its module-root prefix
// (`./`). Every runtime file in dist/component except convex.config.js, which
// is the app-level definition and not a function module.
const agentComponentModules: LoaderMap = {
  "./_generated/api.js": loadComponentModule("_generated/api.js"),
  "./_generated/component.js": loadComponentModule("_generated/component.js"),
  "./_generated/dataModel.js": loadComponentModule("_generated/dataModel.js"),
  "./_generated/server.js": loadComponentModule("_generated/server.js"),
  "./apiKeys.js": loadComponentModule("apiKeys.js"),
  "./files.js": loadComponentModule("files.js"),
  "./messages.js": loadComponentModule("messages.js"),
  "./schema.js": loadComponentModule("schema.js"),
  "./streams.js": loadComponentModule("streams.js"),
  "./threads.js": loadComponentModule("threads.js"),
  "./users.js": loadComponentModule("users.js"),
  "./vector/index.js": loadComponentModule("vector/index.js"),
  "./vector/tables.js": loadComponentModule("vector/tables.js"),
};

// Explicit module map for the root Tempo app. Only the `_generated` files are
// needed: they carry the module-root prefix (`../`), and keeping the map
// explicit stops convex-test from running its Vite-style glob fallback. No
// Tempo function is called through it in this file.
const appModules: LoaderMap = {
  "../_generated/api.js": () => import("../_generated/api.js"),
  "../_generated/server.js": () => import("../_generated/server.js"),
};

const agentSchema = (
  (await import(pathToFileURL(join(componentDir, "schema.js")).href)) as {
    default: Parameters<ReturnType<typeof convexTest>["registerComponent"]>[1];
  }
).default;

// Typed with the ComponentApi type shipped in the Agent package, not with
// hand-written generated types.
const agent = (componentsGeneric() as Record<string, unknown>)[
  AGENT_COMPONENT_NAME
] as ComponentApi<typeof AGENT_COMPONENT_NAME>;

function newTestConvex() {
  // convexTest() installs a fresh in-memory global per call, so every test
  // starts with empty root and component tables.
  const t = convexTest(appSchema, appModules);
  t.registerComponent(AGENT_COMPONENT_NAME, agentSchema, agentComponentModules);
  return t;
}

type TestConvex = ReturnType<typeof newTestConvex>;

const USER_A = "synthetic-user-a";
const USER_B = "synthetic-user-b";

async function createThread(t: TestConvex, userId: string, title: string, summary?: string) {
  return await t.mutation(agent.threads.createThread, {
    userId,
    title,
    summary,
  });
}

async function savePrompt(
  t: TestConvex,
  threadId: string,
  userId: string,
  prompt: string,
  reply: string
) {
  return await t.mutation(agent.messages.addMessages, {
    threadId,
    userId,
    agentName: "synthetic-agent",
    messages: [
      { message: { role: "user", content: prompt } },
      { message: { role: "assistant", content: reply } },
    ],
  });
}

describe("Agent component under Bun: loader and registration", () => {
  test("both explicit maps carry a _generated path and resolve real modules", async () => {
    expect(Object.keys(agentComponentModules).some((k) => k.includes("_generated"))).toBe(true);
    expect(Object.keys(appModules).some((k) => k.includes("_generated"))).toBe(true);

    const threadsModule = (await agentComponentModules["./threads.js"]?.()) as Record<
      string,
      { isMutation?: boolean; isQuery?: boolean; isAction?: boolean }
    >;
    expect(threadsModule.createThread?.isMutation).toBe(true);
    expect(threadsModule.getThread?.isQuery).toBe(true);
    expect(threadsModule.deleteAllForThreadIdSync?.isAction).toBe(true);
  });

  test("the component is reachable only under its registered name", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Registered name");
    expect(thread.userId).toBe(USER_A);

    const unregistered = (componentsGeneric() as Record<string, unknown>)
      .notRegistered as ComponentApi<"notRegistered">;
    await expect(
      t.mutation(unregistered.threads.createThread, {
        userId: USER_A,
        title: "Nobody home",
      })
    ).rejects.toThrow(/not registered/);
  });

  test("a host (root) mutation can call the component through ctx.runMutation and ctx.runQuery", async () => {
    const t = newTestConvex();
    const result = await t.run(async (ctx) => {
      const created = await ctx.runMutation(agent.threads.createThread, {
        userId: USER_A,
        title: "Created from host context",
      });
      const fetched = await ctx.runQuery(agent.threads.getThread, {
        threadId: created._id,
      });
      return { created, fetched };
    });
    expect(result.fetched).not.toBeNull();
    expect(result.fetched?._id).toBe(result.created._id);
    expect(result.fetched?.title).toBe("Created from host context");
  });
});

describe("Agent component under Bun: threads", () => {
  test("createThread then getThread returns the same synthetic thread", async () => {
    const t = newTestConvex();
    const created = await createThread(t, USER_A, "Plan my morning", "Synthetic summary");

    expect(created.userId).toBe(USER_A);
    expect(created.title).toBe("Plan my morning");
    expect(created.summary).toBe("Synthetic summary");
    expect(created.status).toBe("active");
    expect(typeof created._id).toBe("string");
    expect(created._creationTime).toBeGreaterThan(0);

    const fetched = await t.query(agent.threads.getThread, { threadId: created._id });
    expect(fetched).toEqual(created);
  });

  test("thread documents leave out the component's internal fields", async () => {
    const t = newTestConvex();
    const created = await createThread(t, USER_A, "Public shape");
    const keys = Object.keys(created);
    expect(keys).not.toContain("order");
    expect(keys).not.toContain("parentThreadIds");
    expect(keys).not.toContain("defaultSystemPrompt");
  });

  test("updateThread patches title and summary and getThread sees the change", async () => {
    const t = newTestConvex();
    const created = await createThread(t, USER_A, "Before");
    const updated = await t.mutation(agent.threads.updateThread, {
      threadId: created._id,
      patch: { title: "After", summary: "Edited summary" },
    });
    expect(updated.title).toBe("After");
    expect(updated.summary).toBe("Edited summary");

    const fetched = await t.query(agent.threads.getThread, { threadId: created._id });
    expect(fetched?.title).toBe("After");
    expect(fetched?.userId).toBe(USER_A);
  });

  test("listThreadsByUserId returns only the threads of the requested synthetic user", async () => {
    const t = newTestConvex();
    const a1 = await createThread(t, USER_A, "A one");
    const a2 = await createThread(t, USER_A, "A two");
    const b1 = await createThread(t, USER_B, "B one");

    const listA = await t.query(agent.threads.listThreadsByUserId, {
      userId: USER_A,
      order: "asc",
    });
    expect(listA.page.map((th) => th._id)).toEqual([a1._id, a2._id]);
    expect(listA.page.every((th) => th.userId === USER_A)).toBe(true);

    const listB = await t.query(agent.threads.listThreadsByUserId, { userId: USER_B });
    expect(listB.page.map((th) => th._id)).toEqual([b1._id]);

    const unknown = await t.query(agent.threads.listThreadsByUserId, {
      userId: "synthetic-user-nobody",
    });
    expect(unknown.page).toEqual([]);
  });
});

describe("Agent component under Bun: saved prompt and reply", () => {
  test("addMessages saves a user prompt and an assistant reply that listMessagesByThreadId reads back in order", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Prompt and reply");

    const saved = await savePrompt(
      t,
      thread._id,
      USER_A,
      "What should I start with today?",
      "Start with the smallest task on your list."
    );
    expect(saved.messages).toHaveLength(2);

    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page).toHaveLength(2);

    const [prompt, reply] = listed.page;
    expect(prompt?.message).toEqual({
      role: "user",
      content: "What should I start with today?",
    });
    expect(prompt?.text).toBe("What should I start with today?");
    expect(prompt?.status).toBe("success");
    expect(prompt?.order).toBe(0);
    expect(prompt?.stepOrder).toBe(0);
    expect(prompt?.userId).toBe(USER_A);
    expect(prompt?.threadId).toBe(thread._id);

    expect(reply?.message).toEqual({
      role: "assistant",
      content: "Start with the smallest task on your list.",
    });
    expect(reply?.text).toBe("Start with the smallest task on your list.");
    expect(reply?.agentName).toBe("synthetic-agent");
    expect(reply?.order).toBe(0);
    expect(reply?.stepOrder).toBe(1);

    // Same rows come back by id, and the newest-first order flips the page.
    const byIds = await t.query(agent.messages.getMessagesByIds, {
      messageIds: saved.messages.map((m) => m._id),
    });
    expect(byIds.map((m) => m?.text)).toEqual([prompt?.text, reply?.text]);

    const desc = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "desc",
    });
    expect(desc.page.map((m) => m.text)).toEqual([reply?.text, prompt?.text]);
  });

  test("a second prompt in the same thread gets the next order", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Two turns");
    await savePrompt(t, thread._id, USER_A, "First question", "First answer");
    await savePrompt(t, thread._id, USER_A, "Second question", "Second answer");

    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page.map((m) => m.text)).toEqual([
      "First question",
      "First answer",
      "Second question",
      "Second answer",
    ]);
    expect(listed.page.map((m) => [m.order, m.stepOrder])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  test("messages without an explicit userId inherit the thread's synthetic user", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_B, "Inherited user");
    const saved = await t.mutation(agent.messages.addMessages, {
      threadId: thread._id,
      messages: [{ message: { role: "user", content: "No userId passed" } }],
    });
    expect(saved.messages[0]?.userId).toBe(USER_B);
  });
});

describe("Agent component under Bun: separate synthetic user and thread contexts", () => {
  test("messages stay in the thread they were saved to", async () => {
    const t = newTestConvex();
    const threadA = await createThread(t, USER_A, "Context A");
    const threadB = await createThread(t, USER_B, "Context B");
    await savePrompt(t, threadA._id, USER_A, "alpha prompt", "alpha reply");
    await savePrompt(t, threadB._id, USER_B, "bravo prompt", "bravo reply");

    const listA = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: threadA._id,
      order: "asc",
    });
    const listB = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: threadB._id,
      order: "asc",
    });
    expect(listA.page.map((m) => m.text)).toEqual(["alpha prompt", "alpha reply"]);
    expect(listB.page.map((m) => m.text)).toEqual(["bravo prompt", "bravo reply"]);
    expect(listA.page.every((m) => m.userId === USER_A)).toBe(true);
    expect(listB.page.every((m) => m.userId === USER_B)).toBe(true);
  });

  test("listUsersWithThreads sees both synthetic users", async () => {
    const t = newTestConvex();
    await createThread(t, USER_A, "A");
    await createThread(t, USER_B, "B");
    await createThread(t, USER_A, "A again");
    const users = await t.query(agent.users.listUsersWithThreads, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect([...users.page].sort()).toEqual([USER_A, USER_B]);
  });

  test("the component itself does not enforce tenancy: any caller holding a thread id can read it", async () => {
    const t = newTestConvex();
    const threadA = await createThread(t, USER_A, "Owned by A");
    await savePrompt(t, threadA._id, USER_A, "private to A", "reply to A");

    // A different authenticated identity, and an unauthenticated caller, both
    // read user A's thread and messages. Component functions take no caller
    // identity, so ownership checks must live in the Tempo host functions.
    const asB = t.withIdentity({ subject: USER_B });
    const threadSeenByB = await asB.query(agent.threads.getThread, {
      threadId: threadA._id,
    });
    expect(threadSeenByB?.userId).toBe(USER_A);

    const messagesSeenByB = await asB.query(agent.messages.listMessagesByThreadId, {
      threadId: threadA._id,
      order: "asc",
    });
    expect(messagesSeenByB.page.map((m) => m.text)).toEqual(["private to A", "reply to A"]);

    const threadSeenAnonymously = await t.query(agent.threads.getThread, {
      threadId: threadA._id,
    });
    expect(threadSeenAnonymously?._id).toBe(threadA._id);
  });
});

describe("Agent component under Bun: deleted and unknown threads", () => {
  test("deleteAllForThreadIdSync removes the thread and its messages", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "To delete");
    const saved = await savePrompt(t, thread._id, USER_A, "bye prompt", "bye reply");

    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: thread._id });

    expect(await t.query(agent.threads.getThread, { threadId: thread._id })).toBeNull();

    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page).toEqual([]);

    const byIds = await t.query(agent.messages.getMessagesByIds, {
      messageIds: saved.messages.map((m) => m._id),
    });
    expect(byIds).toEqual([null, null]);

    const remaining = await t.query(agent.threads.listThreadsByUserId, { userId: USER_A });
    expect(remaining.page).toEqual([]);
  });

  test("deleting one thread leaves another synthetic thread untouched", async () => {
    const t = newTestConvex();
    const doomed = await createThread(t, USER_A, "Doomed");
    const kept = await createThread(t, USER_A, "Kept");
    await savePrompt(t, doomed._id, USER_A, "doomed prompt", "doomed reply");
    await savePrompt(t, kept._id, USER_A, "kept prompt", "kept reply");

    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: doomed._id });

    expect(await t.query(agent.threads.getThread, { threadId: doomed._id })).toBeNull();
    const keptThread = await t.query(agent.threads.getThread, { threadId: kept._id });
    expect(keptThread?.title).toBe("Kept");
    const keptMessages = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: kept._id,
      order: "asc",
    });
    expect(keptMessages.page.map((m) => m.text)).toEqual(["kept prompt", "kept reply"]);
  });

  test("an unknown (already deleted) thread id reads as null and has no messages", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Soon unknown");
    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: thread._id });

    expect(await t.query(agent.threads.getThread, { threadId: thread._id })).toBeNull();
    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page).toEqual([]);
    expect(listed.isDone).toBe(true);
  });

  test("addMessages and updateThread reject an unknown thread when the lookup is needed", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Gone");
    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: thread._id });

    // Without a userId the component must look the thread up to find the owner.
    await expect(
      t.mutation(agent.messages.addMessages, {
        threadId: thread._id,
        messages: [{ message: { role: "user", content: "into the void" } }],
      })
    ).rejects.toThrow(/not found/);

    await expect(
      t.mutation(agent.threads.updateThread, {
        threadId: thread._id,
        patch: { title: "Revived?" },
      })
    ).rejects.toThrow(/not found/);
  });

  test("addMessages with an explicit userId does NOT check that the thread still exists", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Deleted then written to");
    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: thread._id });

    // Pinned 0.3.2 behaviour: the thread lookup only happens when userId is
    // omitted, so a caller that passes userId can write a message row that
    // points at a deleted thread. The host must confirm the thread is live
    // (and not tombstoned) before it saves anything.
    const saved = await t.mutation(agent.messages.addMessages, {
      threadId: thread._id,
      userId: USER_A,
      messages: [{ message: { role: "user", content: "orphan row" } }],
    });
    expect(saved.messages).toHaveLength(1);
    expect(await t.query(agent.threads.getThread, { threadId: thread._id })).toBeNull();

    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page.map((m) => m.text)).toEqual(["orphan row"]);

    // A later full delete of the same thread id sweeps the orphan row too.
    await t.action(agent.threads.deleteAllForThreadIdSync, { threadId: thread._id });
    const afterSweep = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(afterSweep.page).toEqual([]);
  });

  test("deleteAllForThreadIdAsync finishes in one page for a small thread without needing the scheduler", async () => {
    const t = newTestConvex();
    const thread = await createThread(t, USER_A, "Async delete, one page");
    await savePrompt(t, thread._id, USER_A, "one", "two");

    const result = await t.mutation(agent.threads.deleteAllForThreadIdAsync, {
      threadId: thread._id,
    });
    expect(result).toEqual({ isDone: true });
    expect(await t.query(agent.threads.getThread, { threadId: thread._id })).toBeNull();
    const listed = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      order: "asc",
    });
    expect(listed.page).toEqual([]);
  });

  test("a malformed thread id is rejected by argument validation", async () => {
    const t = newTestConvex();
    await expect(
      t.query(agent.threads.getThread, { threadId: "not-a-thread-id" })
    ).rejects.toThrow();
  });
});

describe("Agent component under Bun: per-user cleanup", () => {
  test("deleteAllForUserId removes one synthetic user's threads and messages and keeps the other's", async () => {
    const t = newTestConvex();
    const a1 = await createThread(t, USER_A, "A one");
    const a2 = await createThread(t, USER_A, "A two");
    const b1 = await createThread(t, USER_B, "B one");
    await savePrompt(t, a1._id, USER_A, "a1 prompt", "a1 reply");
    await savePrompt(t, a2._id, USER_A, "a2 prompt", "a2 reply");
    await savePrompt(t, b1._id, USER_B, "b1 prompt", "b1 reply");

    await t.action(agent.users.deleteAllForUserId, { userId: USER_A });

    const listA = await t.query(agent.threads.listThreadsByUserId, { userId: USER_A });
    expect(listA.page).toEqual([]);
    expect(await t.query(agent.threads.getThread, { threadId: a1._id })).toBeNull();
    expect(await t.query(agent.threads.getThread, { threadId: a2._id })).toBeNull();
    const orphanCheck = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: a1._id,
      order: "asc",
    });
    expect(orphanCheck.page).toEqual([]);

    const listB = await t.query(agent.threads.listThreadsByUserId, { userId: USER_B });
    expect(listB.page.map((th) => th._id)).toEqual([b1._id]);
    const messagesB = await t.query(agent.messages.listMessagesByThreadId, {
      threadId: b1._id,
      order: "asc",
    });
    expect(messagesB.page.map((m) => m.text)).toEqual(["b1 prompt", "b1 reply"]);

    const users = await t.query(agent.users.listUsersWithThreads, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(users.page).toEqual([USER_B]);
  });
});

// Unresolved coverage, deliberately not exercised here:
// - Scheduler: deleteAllForThreadIdAsync, deleteAllForUserIdAsync and the
//   internal stream timeout use ctx.scheduler.runAfter. Driving them needs
//   convex-test's fake-timer hooks (finishAllScheduledFunctions), which the
//   documented route wires to Vitest's vi. A Bun equivalent is not established.
// - Streaming: streams.create/addDelta/finish/abort/heartbeat and the stream
//   timeout cleanup were not run.
// - Vector search, file storage and searchMessages (needs an embedding model).
describe("Agent component under Bun: unresolved coverage", () => {
  const notYetCovered = () => {};
  test.todo(
    "scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers",
    notYetCovered
  );
  test.todo("streaming deltas, abort and timeout cleanup (streams.*)", notYetCovered);
  test.todo("vector and text search over saved messages", notYetCovered);
});
