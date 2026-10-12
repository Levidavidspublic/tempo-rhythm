import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { getFunctionName, type WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import crons from "./crons";
import * as pageCleanupModule from "./pageCleanup";
import appSchema from "./schema";

/**
 * Scheduled expiry of transient page payloads and proposal content (ticket #883, B06).
 *
 * What this file proves, with `convex-test` 0.0.38 running the real `convex/schema.ts` and the
 * real `internal.pageCleanup.runBatch` body: the contract cases below, on synthetic ids and
 * synthetic text only. Every fragment, task title and note title carries a unique sentinel, and
 * the cases check that the sentinel is gone from the tables, the console, the scheduler and the
 * return value once its row is due. Nothing here touches the network, a deployment or real data.
 *
 * What it does not prove: concurrent transactions on a real deployment (convex-test serialises
 * transactions), a real scheduler or cron run, or erasure from backups, snapshots or platform
 * logs. Scheduled continuations are recorded in `_scheduled_functions` and run explicitly by
 * the `runChain` helper, so each invocation can be inspected on its own.
 */

type Modules = Record<string, () => Promise<unknown>>;

// Explicit module map: convex-test never falls back to `import.meta.glob`, which Bun lacks. Keys
// keep the `./` prefix so the `_generated` entries give the module-root prefix.
const modules: Modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./_generated/server.js": () => import("./_generated/server.js"),
  "./pageCleanup.ts": () => import("./pageCleanup"),
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** A fixed 'now' for every case. The code under test takes no time argument. */
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const SENTINEL = "SYNTHETIC-FRAGMENT-7f3a9c41";
const HEX64 = "a".repeat(64);

type TestConvex = ReturnType<typeof newTestConvex>;
type Result = Awaited<ReturnType<typeof runOnce>>;
type OperationInput = WithoutSystemFields<Doc<"pageOperations">>;
type PayloadInput = WithoutSystemFields<Doc<"pageOperationPayloads">>;
type ProposalInput = WithoutSystemFields<Doc<"pageProposals">>;

function newTestConvex() {
  return convexTest(appSchema, modules);
}

const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
let consoleSpies: ReturnType<typeof spyOn>[] = [];

beforeEach(() => {
  // Fake timers keep convex-test's scheduler from running a queued continuation on its own.
  jest.useFakeTimers();
  setSystemTime(new Date(NOW));
  consoleSpies = consoleMethods.map((method) =>
    spyOn(console, method).mockImplementation(() => {})
  );
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
  setSystemTime();
});

function consoleOutput(): string {
  return JSON.stringify(consoleSpies.map((spy) => spy.mock.calls));
}

function at(ms: number) {
  setSystemTime(new Date(ms));
}

// ---------------------------------------------------------------------------------------------
// Fixtures. All ids are created inside convex-test; all text is synthetic.
// ---------------------------------------------------------------------------------------------

type World = {
  userA: Id<"users">;
  userB: Id<"users">;
  noteA: Id<"notes">;
  noteA2: Id<"notes">;
  noteB: Id<"notes">;
  conversationA: Id<"conversations">;
  conversationB: Id<"conversations">;
};

async function seedWorld(t: TestConvex): Promise<World> {
  return await t.run(async (ctx) => {
    const userA = await ctx.db.insert("users", { email: "synthetic-a@example.test" });
    const userB = await ctx.db.insert("users", { email: "synthetic-b@example.test" });
    const note = (userId: Id<"users">) =>
      ctx.db.insert("notes", {
        userId,
        title: `${SENTINEL}-note-title`,
        body: "",
        pinned: false,
        periodType: "none",
        createdAt: NOW,
        updatedAt: NOW,
      });
    const conversation = (userId: Id<"users">) =>
      ctx.db.insert("conversations", {
        userId,
        title: "synthetic conversation",
        createdAt: NOW,
        updatedAt: NOW,
      });
    return {
      userA,
      userB,
      noteA: await note(userA),
      noteA2: await note(userA),
      noteB: await note(userB),
      conversationA: await conversation(userA),
      conversationB: await conversation(userB),
    };
  });
}

let counter = 0;

/** A fully lapsed operation receipt: applied 50 hours ago, so its 48-hour window ended. */
function operation(
  world: Pick<World, "userA" | "noteA">,
  overrides: Partial<OperationInput> = {}
): OperationInput {
  counter += 1;
  const appliedAtMs = overrides.appliedAtMs ?? NOW - 50 * HOUR;
  const resultRevision = overrides.resultRevision ?? counter;
  return {
    userId: world.userA,
    noteId: world.noteA,
    requestId: `req_SYNTHETIC${String(counter).padStart(14, "0")}`,
    requestDigest: HEX64,
    kind: "save",
    source: "ui",
    result: "applied",
    affectsBody: true,
    baseRevision: resultRevision - 1,
    resultRevision,
    baseBodyDigest: HEX64,
    resultBodyDigest: HEX64,
    delta: [{ startUtf16: 0, removedLengthUtf16: 4, insertedLengthUtf16: 5 }],
    appliedAtMs,
    undoUntilMs: appliedAtMs + 5 * MIN,
    metadataExpiresAtMs: appliedAtMs + 48 * HOUR,
    createdAt: appliedAtMs,
    updatedAt: appliedAtMs,
    ...overrides,
  };
}

/** An `available` inverse-fragment row whose Undo window and cleanup grace both ended. */
function payload(
  operationId: Id<"pageOperations">,
  world: Pick<World, "userA" | "noteA">,
  overrides: Partial<PayloadInput> = {},
  label = String(counter)
): PayloadInput {
  counter += 1;
  const undoUntilMs = overrides.undoUntilMs ?? NOW - 50 * HOUR + 5 * MIN;
  return {
    userId: world.userA,
    noteId: world.noteA,
    operationId,
    undoUntilMs,
    cleanupDueAtMs: undoUntilMs + 5 * MIN,
    payload: {
      state: "available",
      splices: [
        {
          startUtf16: 0,
          removedText: `${SENTINEL}-removed-${label}`,
          insertedText: `${SENTINEL}-inserted-${label}`,
        },
      ],
    },
    createdAt: undoUntilMs - 5 * MIN,
    updatedAt: undoUntilMs - 5 * MIN,
    ...overrides,
  };
}

function expiredMarker(expiredAtMs: number) {
  return { state: "expired" as const, expiredAtMs };
}

/** A rejected proposal whose content cleanup is due now but whose receipt window is still open. */
function proposal(
  world: Pick<World, "userA" | "noteA" | "conversationA">,
  overrides: Partial<ProposalInput> = {},
  label = String(counter)
): ProposalInput {
  counter += 1;
  return {
    userId: world.userA,
    kind: "add_task_to_today",
    schemaVersion: 1,
    noteId: world.noteA,
    localDate: "2026-10-10",
    conversationId: world.conversationA,
    sourceRequestKey: `synthetic-request-${counter}`,
    proposalRevision: 0,
    expectedPageRevision: 0,
    blockId: "blk_SYNTHETIC0000000000000000",
    status: "rejected",
    proposalExpiresAtMs: NOW - 6 * HOUR,
    cleanupDueAtMs: NOW - MIN,
    metadataExpiresAtMs: NOW + 18 * HOUR,
    payload: { state: "available", task: { title: `${SENTINEL}-task-${label}`, durationMin: 15 } },
    decidedAtMs: NOW - 6 * HOUR,
    createdAt: NOW - 30 * HOUR,
    updatedAt: NOW - 6 * HOUR,
    ...overrides,
  };
}

async function insertOperation(t: TestConvex, row: OperationInput) {
  return await t.run((ctx) => ctx.db.insert("pageOperations", row));
}
async function insertPayload(t: TestConvex, row: PayloadInput) {
  return await t.run((ctx) => ctx.db.insert("pageOperationPayloads", row));
}
async function insertProposal(t: TestConvex, row: ProposalInput) {
  return await t.run((ctx) => ctx.db.insert("pageProposals", row));
}

/** An operation row plus its `available` payload row, both due by `now`. */
async function insertOperationWithPayload(
  t: TestConvex,
  world: World,
  opOverrides: Partial<OperationInput> = {},
  payloadOverrides: Partial<PayloadInput> = {}
) {
  const operationId = await insertOperation(t, operation(world, opOverrides));
  const row = (await t.run((ctx) => ctx.db.get(operationId))) as Doc<"pageOperations">;
  const payloadId = await insertPayload(
    t,
    payload(operationId, world, {
      undoUntilMs: row.undoUntilMs ?? NOW - 50 * HOUR + 5 * MIN,
      noteId: row.noteId,
      userId: row.userId,
      ...payloadOverrides,
    })
  );
  return { operationId, payloadId };
}

/**
 * An applied operation and the undo receipt that reverted it, linked both ways in one transaction
 * as the Undo writer stores them (#828 D5). By default the undo lands two minutes after the
 * original and one revision above it, and has the usual 48-hour metadata window of its own.
 */
async function insertUndoPair(
  t: TestConvex,
  world: Pick<World, "userA" | "noteA">,
  originalOverrides: Partial<OperationInput> = {},
  undoOverrides: Partial<OperationInput> = {}
) {
  const originalId = await insertOperation(t, operation(world, originalOverrides));
  const original = (await getDoc(t, originalId)) as Doc<"pageOperations">;
  const undoAppliedAtMs = undoOverrides.appliedAtMs ?? original.appliedAtMs + 2 * MIN;
  const undoInput = operation(world, {
    kind: "undo",
    noteId: original.noteId,
    resultRevision: original.resultRevision + 1,
    appliedAtMs: undoAppliedAtMs,
    undoUntilMs: undefined,
    metadataExpiresAtMs: undoAppliedAtMs + 48 * HOUR,
    undoOfOperationId: originalId,
    ...undoOverrides,
  });
  const undoId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("pageOperations", undoInput);
    await ctx.db.patch(originalId, {
      undoneAtMs: undoAppliedAtMs,
      undoneByOperationId: id,
      updatedAt: undoAppliedAtMs,
    });
    return id;
  });
  return { originalId, undoId };
}

type Tables = {
  operations: Doc<"pageOperations">[];
  payloads: Doc<"pageOperationPayloads">[];
  proposals: Doc<"pageProposals">[];
};

async function readTables(t: TestConvex): Promise<Tables> {
  return await t.run(async (ctx) => ({
    operations: await ctx.db.query("pageOperations").collect(),
    payloads: await ctx.db.query("pageOperationPayloads").collect(),
    proposals: await ctx.db.query("pageProposals").collect(),
  }));
}

/** Rows whose stored value differs between two reads of the same table (by id). */
function changedRows<T extends { _id: string }>(before: T[], after: T[]): number {
  const originals = new Map(before.map((row) => [row._id, JSON.stringify(row)]));
  return after.filter((row) => originals.get(row._id) !== JSON.stringify(row)).length;
}

/** Every Undo link stored on a receipt still names a receipt that exists. */
function expectNoDanglingUndoLinks(tables: Tables) {
  const byId = new Map(tables.operations.map((row) => [row._id as string, row]));
  for (const row of tables.operations) {
    for (const link of [row.undoneByOperationId, row.undoOfOperationId]) {
      if (link === undefined) continue;
      expect({ from: row._id, to: link, exists: byId.has(link) }).toEqual({
        from: row._id,
        to: link,
        exists: true,
      });
    }
  }
}

async function scheduledJobs(t: TestConvex) {
  return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

async function getDoc<T extends "pageOperations" | "pageOperationPayloads" | "pageProposals">(
  t: TestConvex,
  id: Id<T>
) {
  return await t.run((ctx) => ctx.db.get(id));
}

// ---------------------------------------------------------------------------------------------
// Running the job
// ---------------------------------------------------------------------------------------------

type RunArgs = { stage?: Stage; cursor?: string | null };
type Stage = "payloads" | "proposals" | "operations" | "proposalReceipts";

async function runOnce(t: TestConvex, args: RunArgs = {}) {
  return await t.mutation(internal.pageCleanup.runBatch, args);
}

/**
 * Runs one invocation, then every continuation it queued, one at a time, by feeding the queued
 * args back in. Each invocation's own return value is kept. Jobs recorded in
 * `_scheduled_functions` are never fired by a timer here.
 */
async function runChain(t: TestConvex, first: RunArgs = {}) {
  const results: Result[] = [];
  let args: RunArgs = first;
  for (let guard = 0; guard < 400; guard++) {
    const before = (await scheduledJobs(t)).length;
    const result = await runOnce(t, args);
    results.push(result);
    if (!result.hasMore) return results;
    const jobs = await scheduledJobs(t);
    expect(jobs.length).toBe(before + 1);
    args = jobs[jobs.length - 1].args[0] as RunArgs;
  }
  throw new Error("the cleanup chain did not end");
}

function sum(results: Result[], pick: (result: Result) => number) {
  return results.reduce((total, result) => total + pick(result), 0);
}

async function expectNoSentinel(t: TestConvex, results: unknown) {
  expect(JSON.stringify(await readTables(t))).not.toContain(SENTINEL);
  expect(JSON.stringify(await scheduledJobs(t))).not.toContain(SENTINEL);
  expect(consoleOutput()).not.toContain(SENTINEL);
  expect(JSON.stringify(results)).not.toContain(SENTINEL);
}

// ---------------------------------------------------------------------------------------------
// The cases named by the ticket's DONE section
// ---------------------------------------------------------------------------------------------

describe("pageCleanup.runBatch", () => {
  test("1. operation fragments are gone after expiry and appear nowhere else", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // 25 due rows is more than one invocation may write, so a continuation is queued and the
    // scheduler entry's args are part of what is checked.
    const ids: Id<"pageOperationPayloads">[] = [];
    for (let i = 0; i < 25; i++) {
      const { payloadId } = await insertOperationWithPayload(
        t,
        world,
        { metadataExpiresAtMs: NOW + 10 * HOUR },
        {}
      );
      ids.push(payloadId);
    }
    const before = await readTables(t);
    expect(JSON.stringify(before)).toContain(SENTINEL);

    const first = await runOnce(t);
    expect(first.hasMore).toBe(true);
    expect(JSON.stringify(await scheduledJobs(t))).not.toContain(SENTINEL);
    const results = [first, ...(await runChain(t, (await scheduledJobs(t))[0].args[0] as RunArgs))];

    for (const id of ids) {
      const row = (await getDoc(t, id)) as Doc<"pageOperationPayloads">;
      expect(row.payload).toEqual({ state: "expired", expiredAtMs: NOW });
      expect(Object.keys(row.payload).sort()).toEqual(["expiredAtMs", "state"]);
      const original = before.payloads.find((p) => p._id === id) as Doc<"pageOperationPayloads">;
      expect({ ...row, payload: original.payload, updatedAt: original.updatedAt }).toEqual(
        original
      );
      expect(row.updatedAt).toBe(NOW);
    }
    expect(sum(results, (r) => r.expiredOperationPayloads)).toBe(25);
    // The operation receipts are inside their window and are kept.
    expect((await readTables(t)).operations).toHaveLength(25);
    await expectNoSentinel(t, results);
  });

  test("2. proposal content is gone for lapsed pending, rejected, cancelled and confirmed", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const { operationId } = await insertOperationWithPayload(t, world, {
      metadataExpiresAtMs: NOW + 10 * HOUR,
    });
    const make = (overrides: Partial<ProposalInput>, label: string) =>
      insertProposal(t, proposal(world, overrides, label));
    const pending = await make(
      { status: "pending", proposalExpiresAtMs: NOW - MIN, decidedAtMs: undefined },
      "pending"
    );
    const rejected = await make({ status: "rejected", decidedAtMs: NOW - 2 * HOUR }, "rejected");
    const cancelled = await make({ status: "cancelled", decidedAtMs: NOW - 3 * HOUR }, "cancelled");
    const confirmed = await make(
      {
        status: "confirmed",
        decidedAtMs: NOW - 4 * HOUR,
        confirmedOperationId: operationId,
        confirmDigest: HEX64,
      },
      "confirmed"
    );
    const expiredStatus = await make({ status: "expired" }, "expired-status");
    const before = await readTables(t);

    const results = await runChain(t);

    for (const id of [pending, rejected, cancelled, confirmed, expiredStatus]) {
      const row = (await getDoc(t, id)) as Doc<"pageProposals">;
      expect(row.payload).toEqual({ state: "expired", expiredAtMs: NOW });
      expect(row.updatedAt).toBe(NOW);
      const original = before.proposals.find((p) => p._id === id) as Doc<"pageProposals">;
      // decidedAtMs, confirmedOperationId, confirmDigest, cleanup/metadata deadlines, blockId and
      // ids are untouched. Only the payload, updatedAt and a lapsed pending status change.
      expect({
        ...row,
        payload: original.payload,
        updatedAt: original.updatedAt,
        status: original.status,
      }).toEqual(original);
    }
    expect(((await getDoc(t, pending)) as Doc<"pageProposals">).status).toBe("expired");
    expect(((await getDoc(t, rejected)) as Doc<"pageProposals">).status).toBe("rejected");
    expect(((await getDoc(t, cancelled)) as Doc<"pageProposals">).status).toBe("cancelled");
    const confirmedRow = (await getDoc(t, confirmed)) as Doc<"pageProposals">;
    expect(confirmedRow.status).toBe("confirmed");
    expect(confirmedRow.confirmedOperationId).toBe(operationId);
    expect(confirmedRow.confirmDigest).toBe(HEX64);
    expect(sum(results, (r) => r.expiredProposalPayloads)).toBe(5);
    expect(sum(results, (r) => r.lapsedProposals)).toBe(1);
    await expectNoSentinel(t, results);
  });

  test("3. nothing is expired early", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // Payload: cleanup deadline reached but the Undo window is still open.
    const { payloadId } = await insertOperationWithPayload(
      t,
      world,
      { appliedAtMs: NOW - MIN, undoUntilMs: NOW + 4 * MIN, metadataExpiresAtMs: NOW + 40 * HOUR },
      { undoUntilMs: NOW + 4 * MIN, cleanupDueAtMs: NOW - 1 }
    );
    // Pending proposal: cleanup deadline reached but the proposal itself has not lapsed.
    const pendingId = await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW + 1,
        cleanupDueAtMs: NOW - 1,
        decidedAtMs: undefined,
      })
    );
    // Payload whose cleanup deadline is still in the future.
    const { payloadId: futurePayloadId } = await insertOperationWithPayload(
      t,
      world,
      { metadataExpiresAtMs: NOW + 40 * HOUR },
      { cleanupDueAtMs: NOW + 1 }
    );
    const before = await readTables(t);

    const results = await runChain(t);

    expect(await readTables(t)).toEqual(before);
    expect(((await getDoc(t, payloadId)) as Doc<"pageOperationPayloads">).payload.state).toBe(
      "available"
    );
    expect(((await getDoc(t, pendingId)) as Doc<"pageProposals">).status).toBe("pending");
    expect(((await getDoc(t, futurePayloadId)) as Doc<"pageOperationPayloads">).payload.state).toBe(
      "available"
    );
    expect(sum(results, (r) => r.rowsWritten)).toBe(0);
  });

  test("4. boundaries at deadline - 1, deadline and deadline + 1", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const offsets = [-1, 0, 1];

    // cleanupDueAtMs on a payload row and on a proposal. A row is due when deadline <= now.
    const payloadIds: Id<"pageOperationPayloads">[] = [];
    const proposalIds: Id<"pageProposals">[] = [];
    for (const offset of offsets) {
      const { payloadId } = await insertOperationWithPayload(
        t,
        world,
        { metadataExpiresAtMs: NOW + 40 * HOUR },
        { cleanupDueAtMs: NOW + offset, undoUntilMs: NOW - 10 * MIN }
      );
      payloadIds.push(payloadId);
      proposalIds.push(await insertProposal(t, proposal(world, { cleanupDueAtMs: NOW + offset })));
    }
    // metadataExpiresAtMs on a content-free operation and a proposal receipt.
    const operationIds: Id<"pageOperations">[] = [];
    const receiptIds: Id<"pageProposals">[] = [];
    for (const offset of offsets) {
      operationIds.push(
        await insertOperation(
          t,
          operation(world, {
            metadataExpiresAtMs: NOW + offset,
            appliedAtMs: NOW - 50 * HOUR,
            undoUntilMs: NOW - 49 * HOUR,
            resultRevision: 1000 + offset,
          })
        )
      );
      receiptIds.push(
        await insertProposal(
          t,
          proposal(world, {
            cleanupDueAtMs: NOW - HOUR,
            metadataExpiresAtMs: NOW + offset,
            payload: expiredMarker(NOW - HOUR),
          })
        )
      );
    }

    await runChain(t);

    const payloadStates = await Promise.all(
      payloadIds.map(
        async (id) => ((await getDoc(t, id)) as Doc<"pageOperationPayloads">).payload.state
      )
    );
    expect(payloadStates).toEqual(["expired", "expired", "available"]);
    const proposalStates = await Promise.all(
      proposalIds.map(async (id) => ((await getDoc(t, id)) as Doc<"pageProposals">).payload.state)
    );
    expect(proposalStates).toEqual(["expired", "expired", "available"]);
    expect(
      await Promise.all(operationIds.map(async (id) => (await getDoc(t, id)) === null))
    ).toEqual([true, true, false]);
    expect(await Promise.all(receiptIds.map(async (id) => (await getDoc(t, id)) === null))).toEqual(
      [true, true, false]
    );
  });

  test("5. idempotent: repeated and back-to-back runs leave every table byte-identical", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    for (let i = 0; i < 6; i++) {
      await insertOperationWithPayload(t, world, { metadataExpiresAtMs: NOW + 10 * HOUR });
      await insertProposal(t, proposal(world, { status: i % 2 === 0 ? "rejected" : "cancelled" }));
    }
    await insertOperation(t, operation(world));
    await insertProposal(
      t,
      proposal(world, { cleanupDueAtMs: NOW - HOUR, payload: expiredMarker(NOW - HOUR) })
    );

    const first = await runChain(t);
    expect(sum(first, (r) => r.expiredOperationPayloads)).toBe(6);
    expect(sum(first, (r) => r.expiredProposalPayloads)).toBe(6);
    const afterFirst = await readTables(t);

    // Later runs at the same instant and at a later instant, expiry values already written.
    for (let i = 0; i < 2; i++) {
      const again = await runChain(t);
      expect(sum(again, (r) => r.rowsWritten)).toBe(0);
      expect(await readTables(t)).toEqual(afterFirst);
    }
    at(NOW + 5 * MIN);
    const later = await runChain(t);
    expect(sum(later, (r) => r.rowsWritten)).toBe(0);
    expect(await readTables(t)).toEqual(afterFirst);

    // Two back-to-back invocations against a fresh set of due rows: no double count.
    const { payloadId } = await insertOperationWithPayload(t, world, {
      metadataExpiresAtMs: NOW + 40 * HOUR,
    });
    const a = await runOnce(t);
    const b = await runOnce(t);
    expect(a.expiredOperationPayloads + b.expiredOperationPayloads).toBe(1);
    const row = (await getDoc(t, payloadId)) as Doc<"pageOperationPayloads">;
    expect(row.payload).toEqual({ state: "expired", expiredAtMs: NOW + 5 * MIN });
    const settled = await readTables(t);
    at(NOW + 6 * MIN);
    await runChain(t);
    expect(await readTables(t)).toEqual(settled);
    // expiredAtMs and updatedAt keep the time of the first expiry.
    expect(((await getDoc(t, payloadId)) as Doc<"pageOperationPayloads">).updatedAt).toBe(
      NOW + 5 * MIN
    );
  });

  test("6. bounded batch: at most 100 rows and 20 payload rows per invocation, cursor chain", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const payloadIds: Id<"pageOperationPayloads">[] = [];
    for (let i = 0; i < 130; i++) {
      const { payloadId } = await insertOperationWithPayload(
        t,
        world,
        { metadataExpiresAtMs: NOW + 40 * HOUR },
        { cleanupDueAtMs: NOW - 3 * DAY + i }
      );
      payloadIds.push(payloadId);
    }
    const proposalIds: Id<"pageProposals">[] = [];
    for (let i = 0; i < 130; i++) {
      proposalIds.push(
        await insertProposal(t, proposal(world, { cleanupDueAtMs: NOW - 2 * DAY + i }))
      );
    }
    expect(payloadIds.length + proposalIds.length).toBeGreaterThanOrEqual(250);

    const before = await readTables(t);
    const jobsBefore = (await scheduledJobs(t)).length;
    const first = await runOnce(t);
    const after = await readTables(t);
    // Measured from the stored rows, not from the job's own report of what it did.
    const changedPayloads = changedRows(before.payloads, after.payloads);
    const changedProposals = changedRows(before.proposals, after.proposals);
    expect(changedPayloads).toBeGreaterThan(0);
    expect(changedPayloads).toBeLessThanOrEqual(20);
    expect(changedPayloads + changedProposals).toBeLessThanOrEqual(100);
    expect(first.rowsWritten).toBe(changedPayloads + changedProposals);
    expect(first.hasMore).toBe(true);

    // One reschedule, carrying only the stage and an opaque cursor.
    const jobs = await scheduledJobs(t);
    expect(jobs.length).toBe(jobsBefore + 1);
    const queued = jobs[jobs.length - 1].args[0] as RunArgs;
    expect(Object.keys(queued).sort()).toEqual(["cursor", "stage"]);
    expect(["payloads", "proposals", "operations", "proposalReceipts"]).toContain(
      queued.stage as string
    );
    expect(typeof queued.cursor === "string" || queued.cursor === null).toBe(true);
    expect(jobs[jobs.length - 1].name).toBe("pageCleanup:runBatch");

    const rest = await runChain(t, queued);
    const results = [first, ...rest];
    for (const result of results) {
      expect(result.rowsWritten).toBeLessThanOrEqual(100);
      expect(result.expiredOperationPayloads).toBeLessThanOrEqual(20);
      expect(result.examined).toBeLessThanOrEqual(100);
    }
    // Every row handled exactly once.
    expect(sum(results, (r) => r.expiredOperationPayloads)).toBe(130);
    expect(sum(results, (r) => r.expiredProposalPayloads)).toBe(130);
    const finalTables = await readTables(t);
    expect(finalTables.payloads.every((row) => row.payload.state === "expired")).toBe(true);
    expect(finalTables.proposals.every((row) => row.payload.state === "expired")).toBe(true);
  });

  test("7. no starvation: skipped rows ahead of a live due row do not stop it", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // 120 older payload rows that stay in the index: already expired, in a tombstoned account.
    for (let i = 0; i < 120; i++) {
      const operationId = await insertOperation(
        t,
        operation(world, { metadataExpiresAtMs: NOW + 40 * HOUR })
      );
      await insertPayload(
        t,
        payload(operationId, world, {
          cleanupDueAtMs: NOW - 4 * DAY + i,
          payload: expiredMarker(NOW - 4 * DAY),
          ...(i % 2 === 0 ? { deletedAt: NOW - 3 * DAY } : {}),
        })
      );
    }
    const { payloadId: livePayload } = await insertOperationWithPayload(
      t,
      world,
      { metadataExpiresAtMs: NOW + 40 * HOUR },
      { cleanupDueAtMs: NOW - MIN }
    );
    // 120 older pending proposals that are due but not lapsed, kept in the index, then a live one.
    for (let i = 0; i < 120; i++) {
      await insertProposal(
        t,
        proposal(world, {
          status: "pending",
          proposalExpiresAtMs: NOW + HOUR,
          cleanupDueAtMs: NOW - 4 * DAY + i,
          decidedAtMs: undefined,
        })
      );
    }
    const liveProposal = await insertProposal(t, proposal(world, { cleanupDueAtMs: NOW - MIN }));
    // 120 receipts that are kept (their payload is still available) ahead of a deletable one.
    for (let i = 0; i < 120; i++) {
      const operationId = await insertOperation(
        t,
        operation(world, { metadataExpiresAtMs: NOW - 4 * DAY + i })
      );
      await insertPayload(
        t,
        payload(operationId, world, { cleanupDueAtMs: NOW + 10 * HOUR, undoUntilMs: NOW - HOUR })
      );
    }
    const deletable = await insertOperation(
      t,
      operation(world, { metadataExpiresAtMs: NOW - MIN })
    );

    const results = await runChain(t);

    expect(results.length).toBeGreaterThan(5);
    expect(((await getDoc(t, livePayload)) as Doc<"pageOperationPayloads">).payload).toEqual(
      expiredMarker(NOW)
    );
    expect(((await getDoc(t, liveProposal)) as Doc<"pageProposals">).payload).toEqual(
      expiredMarker(NOW)
    );
    expect(await getDoc(t, deletable)).toBeNull();
  });

  test("8. late job: rows overdue by days are handled oldest first with no lookback", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const ids: Id<"pageOperationPayloads">[] = [];
    // Created newest first so insertion order differs from deadline order.
    for (let i = 29; i >= 0; i--) {
      const { payloadId } = await insertOperationWithPayload(
        t,
        world,
        {
          appliedAtMs: NOW - 400 * DAY,
          undoUntilMs: NOW - 399 * DAY,
          metadataExpiresAtMs: NOW + 200 * DAY,
        },
        { cleanupDueAtMs: NOW - i * DAY - HOUR, undoUntilMs: NOW - 399 * DAY }
      );
      ids[i] = payloadId;
    }

    const first = await runOnce(t);
    expect(first.expiredOperationPayloads).toBe(20);
    // The 20 oldest deadlines (largest i) are the ones written.
    for (let i = 29; i >= 10; i--) {
      expect(((await getDoc(t, ids[i])) as Doc<"pageOperationPayloads">).payload.state).toBe(
        "expired"
      );
    }
    for (let i = 9; i >= 0; i--) {
      expect(((await getDoc(t, ids[i])) as Doc<"pageOperationPayloads">).payload.state).toBe(
        "available"
      );
    }
    // A job that was missed for a long time is caught up by the next one, however old the rows.
    at(NOW + 90 * DAY);
    const jobs = await scheduledJobs(t);
    const results = await runChain(t, jobs[jobs.length - 1].args[0] as RunArgs);
    expect(sum(results, (r) => r.expiredOperationPayloads)).toBe(10);
    const fresh = await runChain(t);
    expect(sum(fresh, (r) => r.expiredOperationPayloads)).toBe(0);
    for (const id of ids) {
      expect(((await getDoc(t, id)) as Doc<"pageOperationPayloads">).payload.state).toBe("expired");
    }
  });

  test("9. receipts are deleted only after their window, with their expired markers", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const expiredOp = await insertOperation(t, operation(world, { metadataExpiresAtMs: NOW - 1 }));
    const expiredOpMarker = await insertPayload(
      t,
      payload(expiredOp, world, { payload: expiredMarker(NOW - 40 * HOUR) })
    );
    // Due payload on a receipt that is past its window: payload expires first, then the receipt
    // and its marker go in the same run.
    const dueOp = await insertOperation(
      t,
      operation(world, { metadataExpiresAtMs: NOW - 2 * MIN })
    );
    const dueOpPayload = await insertPayload(t, payload(dueOp, world, {}));
    const expiredProposal = await insertProposal(
      t,
      proposal(world, {
        metadataExpiresAtMs: NOW - MIN,
        cleanupDueAtMs: NOW - 30 * HOUR,
        payload: expiredMarker(NOW - 30 * HOUR),
      })
    );
    const insideOp = await insertOperation(
      t,
      operation(world, { metadataExpiresAtMs: NOW + 1, resultRevision: 900 })
    );
    const insideMarker = await insertPayload(
      t,
      payload(insideOp, world, { payload: expiredMarker(NOW - 40 * HOUR) })
    );
    const insideProposal = await insertProposal(
      t,
      proposal(world, {
        metadataExpiresAtMs: NOW + 1,
        cleanupDueAtMs: NOW - 30 * HOUR,
        payload: expiredMarker(NOW - 30 * HOUR),
      })
    );

    const results = await runChain(t);

    expect(await getDoc(t, expiredOp)).toBeNull();
    expect(await getDoc(t, expiredOpMarker)).toBeNull();
    expect(await getDoc(t, dueOp)).toBeNull();
    expect(await getDoc(t, dueOpPayload)).toBeNull();
    expect(await getDoc(t, expiredProposal)).toBeNull();
    expect(sum(results, (r) => r.deletedOperations)).toBe(2);
    expect(sum(results, (r) => r.deletedPayloadMarkers)).toBe(2);
    expect(sum(results, (r) => r.deletedProposals)).toBe(1);
    // Rows still inside their window survive this run and every later run before the deadline.
    for (const id of [insideOp, insideMarker, insideProposal]) {
      expect(await getDoc(t as TestConvex, id as Id<"pageOperations">)).not.toBeNull();
    }
    await runChain(t);
    await runChain(t);
    expect(await getDoc(t, insideOp)).not.toBeNull();
    expect(await getDoc(t, insideProposal)).not.toBeNull();
    at(NOW + 1);
    await runChain(t);
    expect(await getDoc(t, insideOp)).toBeNull();
    expect(await getDoc(t, insideMarker)).toBeNull();
    expect(await getDoc(t, insideProposal)).toBeNull();
  });

  test("10. metadata is kept while it is still referenced, always scoped by user", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);

    // (a) Past its window but the payload is still available: kept until the payload expires,
    // and deleted by the run that expires it (receipt checks see already-expired content).
    const { operationId: opA, payloadId: payloadA } = await insertOperationWithPayload(
      t,
      world,
      { metadataExpiresAtMs: NOW - MIN },
      { cleanupDueAtMs: NOW + 5 * MIN, undoUntilMs: NOW - 5 * MIN }
    );
    const resultsA = await runChain(t);
    expect(await getDoc(t, opA)).not.toBeNull();
    expect(sum(resultsA, (r) => r.skipped.retained)).toBeGreaterThanOrEqual(1);
    at(NOW + 5 * MIN);
    await runChain(t);
    expect(await getDoc(t, opA)).toBeNull();
    expect(await getDoc(t, payloadA)).toBeNull();
    at(NOW);

    // (b) An operation whose proposal is still inside its window.
    const proposalB = await insertProposal(
      t,
      proposal(world, {
        status: "confirmed",
        cleanupDueAtMs: NOW - HOUR,
        payload: expiredMarker(NOW - HOUR),
        metadataExpiresAtMs: NOW + 3 * HOUR,
      })
    );
    const opB = await insertOperation(
      t,
      operation(world, {
        metadataExpiresAtMs: NOW - MIN,
        proposalId: proposalB,
        resultRevision: 500,
      })
    );
    await runChain(t);
    expect(await getDoc(t, opB)).not.toBeNull();
    expect(await getDoc(t, proposalB)).not.toBeNull();

    // (c) A proposal whose confirmed operation is still inside its window.
    const opC = await insertOperation(
      t,
      operation(world, { metadataExpiresAtMs: NOW + 3 * HOUR, resultRevision: 501 })
    );
    const proposalC = await insertProposal(
      t,
      proposal(world, {
        status: "confirmed",
        confirmedOperationId: opC,
        cleanupDueAtMs: NOW - HOUR,
        payload: expiredMarker(NOW - HOUR),
        metadataExpiresAtMs: NOW - MIN,
      })
    );
    await runChain(t);
    expect(await getDoc(t, proposalC)).not.toBeNull();
    expect(await getDoc(t, opC)).not.toBeNull();

    // Both directions are plain time comparisons, so the pairs go together once both lapse.
    at(NOW + 3 * HOUR);
    await runChain(t);
    expect(await getDoc(t, opB)).toBeNull();
    expect(await getDoc(t, proposalB)).toBeNull();
    expect(await getDoc(t, opC)).toBeNull();
    expect(await getDoc(t, proposalC)).toBeNull();
    at(NOW);

    // (d) An operation inside the gap-free chain of a still-eligible lower revision is kept.
    const lower = await insertOperation(
      t,
      operation(world, {
        noteId: world.noteA2,
        resultRevision: 10,
        appliedAtMs: NOW - MIN,
        undoUntilMs: NOW + 2 * MIN,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );
    const upper = await insertOperation(
      t,
      operation(world, { noteId: world.noteA2, resultRevision: 11, metadataExpiresAtMs: NOW - MIN })
    );
    const results = await runChain(t);
    expect(await getDoc(t, upper)).not.toBeNull();
    expect(await getDoc(t, lower)).not.toBeNull();
    expect(sum(results, (r) => r.skipped.retained)).toBeGreaterThanOrEqual(1);
    at(NOW + 3 * MIN);
    await runChain(t);
    expect(await getDoc(t, upper)).toBeNull();
    expect(await getDoc(t, lower)).not.toBeNull();
    at(NOW);

    // An undone lower operation, or one on another note, does not hold an operation back.
    const undoneLower = await insertOperation(
      t,
      operation(world, {
        noteId: world.noteA,
        resultRevision: 20,
        appliedAtMs: NOW - MIN,
        undoUntilMs: NOW + 2 * MIN,
        undoneAtMs: NOW - 30_000,
        undoneByOperationId: lower,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );
    const otherNoteLower = await insertOperation(
      t,
      operation(world, {
        noteId: world.noteA2,
        resultRevision: 21,
        appliedAtMs: NOW - MIN,
        undoUntilMs: NOW + 2 * MIN,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );
    const heldOnlyByThem = await insertOperation(
      t,
      operation(world, { noteId: world.noteA, resultRevision: 22, metadataExpiresAtMs: NOW - MIN })
    );
    await runChain(t);
    expect(await getDoc(t, heldOnlyByThem)).toBeNull();
    expect(await getDoc(t, undoneLower)).not.toBeNull();
    expect(await getDoc(t, otherNoteLower)).not.toBeNull();
  });

  test("10e. lookups never cross users: another user's rows neither satisfy nor block", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // User B has an eligible lower-revision operation on the very same note id, an `available`
    // payload row pointing at A's operation id, and an open proposal that A's operation names.
    const foreignProposal = await insertProposal(
      t,
      proposal(
        { userA: world.userB, noteA: world.noteB, conversationA: world.conversationB },
        {
          status: "confirmed",
          cleanupDueAtMs: NOW - HOUR,
          payload: expiredMarker(NOW - HOUR),
          metadataExpiresAtMs: NOW + 40 * HOUR,
        }
      )
    );
    const mine = await insertOperation(
      t,
      operation(world, {
        resultRevision: 50,
        metadataExpiresAtMs: NOW - MIN,
        proposalId: foreignProposal,
      })
    );
    await insertOperation(
      t,
      operation(
        { userA: world.userB, noteA: world.noteA },
        {
          resultRevision: 49,
          appliedAtMs: NOW - MIN,
          undoUntilMs: NOW + 2 * MIN,
          metadataExpiresAtMs: NOW + 40 * HOUR,
        }
      )
    );
    const foreignPayload = await insertPayload(
      t,
      payload(mine, { userA: world.userB, noteA: world.noteA }, { cleanupDueAtMs: NOW + 5 * MIN })
    );

    // A's confirmed proposal names an operation that belongs to B and is still inside its window.
    const foreignOperation = await insertOperation(
      t,
      operation(
        { userA: world.userB, noteA: world.noteB },
        { resultRevision: 7, metadataExpiresAtMs: NOW + 40 * HOUR }
      )
    );
    const myProposal = await insertProposal(
      t,
      proposal(world, {
        status: "confirmed",
        confirmedOperationId: foreignOperation,
        cleanupDueAtMs: NOW - HOUR,
        payload: expiredMarker(NOW - HOUR),
        metadataExpiresAtMs: NOW - MIN,
      })
    );

    await runChain(t);

    // None of B's rows blocked A's receipts, and A's cleanup did not touch B's rows.
    expect(await getDoc(t, myProposal)).toBeNull();
    expect(await getDoc(t, foreignOperation)).not.toBeNull();
    expect(await getDoc(t, mine)).toBeNull();
    expect(await getDoc(t, foreignProposal)).not.toBeNull();
    expect(((await getDoc(t, foreignPayload)) as Doc<"pageOperationPayloads">).payload.state).toBe(
      "available"
    );

    // And B's own rows are processed by the same rules: B's lapsed payload expires.
    const bOp = await insertOperation(
      t,
      operation({ userA: world.userB, noteA: world.noteB }, { metadataExpiresAtMs: NOW + HOUR })
    );
    const bPayload = await insertPayload(
      t,
      payload(bOp, { userA: world.userB, noteA: world.noteB }, {})
    );
    await runChain(t);
    expect(((await getDoc(t, bPayload)) as Doc<"pageOperationPayloads">).payload).toEqual(
      expiredMarker(NOW)
    );
  });

  test("11. account-deleted rows: content is expired in place, never hard-deleted in a window", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const deletedAt = NOW - 2 * DAY;
    const tombstone = { deletedAt, updatedAt: deletedAt };

    // A tombstoned payload and proposals with due content.
    const { payloadId: deadPayload, operationId: deadOperation } = await insertOperationWithPayload(
      t,
      world,
      { metadataExpiresAtMs: NOW + 5 * HOUR, deletedAt, updatedAt: deletedAt },
      { ...tombstone }
    );
    const deadPending = await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW - MIN,
        decidedAtMs: undefined,
        ...tombstone,
      })
    );
    const deadRejected = await insertProposal(t, proposal(world, { ...tombstone }));
    // A tombstoned pending proposal that has not lapsed is left alone, as for a live row.
    const deadOpen = await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW + HOUR,
        decidedAtMs: undefined,
        ...tombstone,
      })
    );
    // Tombstoned receipts: one inside its window, one past it with an expired marker.
    const deadInsideProposal = await insertProposal(
      t,
      proposal(world, {
        cleanupDueAtMs: NOW - HOUR,
        payload: expiredMarker(NOW - HOUR),
        metadataExpiresAtMs: NOW + HOUR,
        ...tombstone,
      })
    );
    const deadPastOperation = await insertOperation(
      t,
      operation(world, { metadataExpiresAtMs: NOW - MIN, ...tombstone })
    );
    const deadPastMarker = await insertPayload(
      t,
      payload(deadPastOperation, world, { payload: expiredMarker(NOW - 40 * HOUR), ...tombstone })
    );
    // Live rows of the same user are processed normally.
    const { payloadId: livePayload } = await insertOperationWithPayload(t, world, {
      metadataExpiresAtMs: NOW + 5 * HOUR,
    });
    const before = await readTables(t);

    const results = await runChain(t);

    const after = await readTables(t);
    const find = <T extends { _id: string }>(list: T[], id: string) =>
      list.find((row) => row._id === id) as T;

    const deadPayloadRow = find(after.payloads, deadPayload);
    expect(deadPayloadRow.payload).toEqual({ state: "expired", expiredAtMs: NOW });
    expect({ ...deadPayloadRow, payload: find(before.payloads, deadPayload).payload }).toEqual(
      find(before.payloads, deadPayload)
    );
    expect(deadPayloadRow.deletedAt).toBe(deletedAt);
    expect(deadPayloadRow.updatedAt).toBe(deletedAt);

    for (const id of [deadPending, deadRejected]) {
      const row = find(after.proposals, id);
      expect(row.payload).toEqual({ state: "expired", expiredAtMs: NOW });
      expect(row.deletedAt).toBe(deletedAt);
      expect(row.updatedAt).toBe(deletedAt);
      expect({
        ...row,
        payload: find(before.proposals, id).payload,
        status: find(before.proposals, id).status,
      }).toEqual(find(before.proposals, id));
    }
    expect(find(after.proposals, deadPending).status).toBe("expired");
    expect(find(after.proposals, deadRejected).status).toBe("rejected");
    // Not lapsed: untouched, byte for byte.
    expect(find(after.proposals, deadOpen)).toEqual(find(before.proposals, deadOpen));

    // Inside the window nothing is hard-deleted, whatever the account state.
    expect(find(after.operations, deadOperation)).toEqual(find(before.operations, deadOperation));
    expect(find(after.proposals, deadInsideProposal)).toEqual(
      find(before.proposals, deadInsideProposal)
    );
    // Past its own window, a content-free tombstoned receipt follows the same rule as a live one.
    expect(await getDoc(t, deadPastOperation)).toBeNull();
    expect(await getDoc(t, deadPastMarker)).toBeNull();

    // Live row of the same user: expired and stamped with the run time.
    const livePayloadRow = find(after.payloads, livePayload);
    expect(livePayloadRow.payload).toEqual({ state: "expired", expiredAtMs: NOW });
    expect(livePayloadRow.updatedAt).toBe(NOW);
    expect(sum(results, (r) => r.expiredOperationPayloads)).toBe(2);
    await expectNoSentinelInExpiredRows(t);
  });

  test("12. never hard-deletes inside a window, never leaves a due fragment (table-driven mix)", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const BASE = NOW - 20 * HOUR;
    let seed = 20_261_011;
    const rnd = (max: number) => {
      seed = (Math.imul(seed, 1_103_515_245) + 12_345) & 0x7fffffff;
      return seed % max;
    };

    const lastNoteRevision = new Map<string, number>();
    for (let i = 0; i < 90; i++) {
      const appliedAtMs = BASE + rnd(60 * HOUR);
      const noteId = rnd(2) === 0 ? world.noteA : world.noteA2;
      const resultRevision = (lastNoteRevision.get(noteId) ?? 0) + 1;
      lastNoteRevision.set(noteId, resultRevision);
      const tombstoned = rnd(5) === 0 ? { deletedAt: BASE, updatedAt: BASE } : {};
      const undone = rnd(6) === 0 ? { undoneAtMs: appliedAtMs + MIN } : {};
      const metadataJitter = rnd(3) === 0 ? rnd(30 * HOUR) - 24 * HOUR : 0;
      const op = operation(world, {
        noteId,
        resultRevision,
        appliedAtMs,
        undoUntilMs: appliedAtMs + 5 * MIN,
        metadataExpiresAtMs: appliedAtMs + 48 * HOUR + metadataJitter,
        ...tombstoned,
        ...undone,
      });
      const operationId = await insertOperation(t, op);
      if (rnd(4) !== 0) {
        const markerOpen = rnd(5) === 0;
        await insertPayload(
          t,
          payload(
            operationId,
            { userA: world.userA, noteA: noteId },
            {
              undoUntilMs: op.undoUntilMs as number,
              cleanupDueAtMs: (op.undoUntilMs as number) + 5 * MIN + (markerOpen ? 3 * HOUR : 0),
              ...tombstoned,
            },
            `mix-${i}`
          )
        );
      }
      if (rnd(3) === 0) {
        const status = (["pending", "confirmed", "rejected", "cancelled", "expired"] as const)[
          rnd(5)
        ];
        const createdAt = BASE + rnd(50 * HOUR);
        const proposalExpiresAtMs = createdAt + 24 * HOUR;
        await insertProposal(
          t,
          proposal(
            world,
            {
              status,
              createdAt,
              updatedAt: createdAt,
              proposalExpiresAtMs,
              cleanupDueAtMs:
                (status === "pending" ? proposalExpiresAtMs : createdAt + 2 * HOUR) + 5 * MIN,
              metadataExpiresAtMs: createdAt + 48 * HOUR,
              ...(status === "confirmed" ? { confirmedOperationId: operationId } : {}),
              ...tombstoned,
            },
            `mix-${i}`
          )
        );
      }
    }

    const start = await readTables(t);
    expect(
      start.operations.length + start.payloads.length + start.proposals.length
    ).toBeGreaterThan(150);
    const seen = new Set<string>();
    const times = Array.from({ length: 14 }, (_, i) => BASE + i * 7 * HOUR + rnd(HOUR));
    let previous = await readTables(t);
    for (const time of times) {
      at(time);
      await runChain(t);
      const current = await readTables(t);

      for (const row of current.payloads) {
        // Rows that were expired stay expired, and an expired row never gains text back.
        const was = previous.payloads.find((p) => p._id === row._id);
        if (was?.payload.state === "expired") expect(row.payload).toEqual(was.payload);
        if (row.payload.state === "available") {
          expect(row.cleanupDueAtMs <= time && row.undoUntilMs <= time).toBe(false);
        }
      }
      for (const row of current.proposals) {
        const was = previous.proposals.find((p) => p._id === row._id);
        if (was?.payload.state === "expired") expect(row.payload).toEqual(was.payload);
        if (row.payload.state === "available") {
          const lapsed = row.status !== "pending" || row.proposalExpiresAtMs <= time;
          expect(row.cleanupDueAtMs <= time && lapsed).toBe(false);
        }
      }
      // Anything that disappeared had reached its own deadline at this run.
      const operationsNow = new Set(current.operations.map((r) => r._id as string));
      for (const gone of previous.operations.filter((r) => !operationsNow.has(r._id))) {
        expect(gone.metadataExpiresAtMs <= time).toBe(true);
        expect(gone.undoUntilMs === undefined || gone.undoUntilMs <= time).toBe(true);
        // Its proposal, if it still existed, had lapsed too.
        const linked = previous.proposals.find((p) => p._id === gone.proposalId);
        if (linked) expect(linked.metadataExpiresAtMs <= time).toBe(true);
        // No lower revision on the same note was still eligible for Undo.
        for (const other of previous.operations) {
          if (other.noteId !== gone.noteId || other.resultRevision >= gone.resultRevision) continue;
          const stillEligible = other.undoneAtMs === undefined && (other.undoUntilMs ?? 0) > time;
          expect(stillEligible).toBe(false);
        }
        seen.add(gone._id);
      }
      const proposalsNow = new Set(current.proposals.map((r) => r._id as string));
      for (const gone of previous.proposals.filter((r) => !proposalsNow.has(r._id))) {
        expect(gone.metadataExpiresAtMs <= time).toBe(true);
        expect(gone.payload.state).toBe("expired");
        // Its confirmed operation, if it still existed, had lapsed too.
        const linked = previous.operations.find((o) => o._id === gone.confirmedOperationId);
        if (linked) expect(linked.metadataExpiresAtMs <= time).toBe(true);
        seen.add(gone._id);
      }
      const payloadsNow = new Set(current.payloads.map((r) => r._id as string));
      for (const gone of previous.payloads.filter((r) => !payloadsNow.has(r._id))) {
        // A marker row leaves only together with its operation, and only once expired.
        expect(gone.payload.state).toBe("expired");
        expect(operationsNow.has(gone.operationId as string)).toBe(false);
      }
      previous = current;
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  test("13. internal only: no public function, one 300-second cron on pageCleanup.runBatch", () => {
    const source = readFileSync(new URL("./pageCleanup.ts", import.meta.url), "utf8");
    // The ticket's EVIDENCE grep, and a wider one: no public builder is called anywhere.
    expect(source).not.toMatch(/export const \w+ = (query|mutation|action|httpAction)\(/);
    expect(source).not.toMatch(/(?<![A-Za-z_.])(query|mutation|action|httpAction)\(/);
    expect(source).not.toContain("console.");

    const registered = Object.entries(pageCleanupModule).filter(
      ([, value]) => typeof value === "function"
    );
    expect(registered.map(([name]) => name)).toEqual(["runBatch"]);
    for (const [, fn] of registered) {
      const flags = fn as unknown as {
        isInternal?: boolean;
        isMutation?: boolean;
        isPublic?: boolean;
      };
      expect(flags.isInternal).toBe(true);
      expect(flags.isMutation).toBe(true);
      expect(flags.isPublic).toBeUndefined();
    }

    const jobs = Object.entries(crons.crons);
    expect(jobs).toHaveLength(1);
    const [name, job] = jobs[0];
    expect(name).toBe("expire transient page payloads");
    expect(job.name).toBe("pageCleanup:runBatch");
    expect(getFunctionName(internal.pageCleanup.runBatch)).toBe("pageCleanup:runBatch");
    expect(job.schedule).toEqual({ type: "interval", minutes: 5 });
    expect(5 * 60).toBe(300);
    expect(job.args).toEqual([{}]);
  });

  test("14. failure safety: an inconsistent row is skipped, counted and unchanged", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // Cleanup deadline reached while the Undo window is still open.
    await insertOperationWithPayload(
      t,
      world,
      { appliedAtMs: NOW - MIN, undoUntilMs: NOW + 4 * MIN, metadataExpiresAtMs: NOW + 40 * HOUR },
      { undoUntilMs: NOW + 4 * MIN, cleanupDueAtMs: NOW - 1 }
    );
    // Pending proposal whose cleanup deadline passed before the proposal lapsed.
    await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW + HOUR,
        cleanupDueAtMs: NOW - 1,
        decidedAtMs: undefined,
      })
    );
    // An operation with more payload rows than the contract allows, all expired.
    const crowded = await insertOperation(t, operation(world, { metadataExpiresAtMs: NOW - MIN }));
    for (let i = 0; i < 3; i++) {
      await insertPayload(t, payload(crowded, world, { payload: expiredMarker(NOW - 40 * HOUR) }));
    }
    // A pending proposal with an expired marker that is still inside its own window.
    await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW + HOUR,
        cleanupDueAtMs: NOW - HOUR,
        metadataExpiresAtMs: NOW - MIN,
        payload: expiredMarker(NOW - HOUR),
        decidedAtMs: undefined,
      })
    );
    const before = await readTables(t);

    const results = await runChain(t);

    expect(await readTables(t)).toEqual(before);
    expect(sum(results, (r) => r.skipped.windowOpen)).toBeGreaterThanOrEqual(3);
    expect(sum(results, (r) => r.skipped.inconsistent)).toBeGreaterThanOrEqual(1);
    expect(sum(results, (r) => r.rowsWritten)).toBe(0);
    expect(consoleOutput()).toBe(JSON.stringify(consoleMethods.map(() => [])));
    expect(JSON.stringify(results)).not.toContain(SENTINEL);

    // A garbled cursor or an unknown stage cannot make the job loop, throw or write.
    const odd = await runOnce(t, { stage: "operations", cursor: "not-a-cursor" });
    expect(odd.hasMore).toBe(false);
    await expect(
      t.mutation(internal.pageCleanup.runBatch, { stage: "everything" } as unknown as RunArgs)
    ).rejects.toThrow();
    expect(await readTables(t)).toEqual(before);
  });

  test("15. account-deleted rows lose their fragments and pending content, keep receipts until their window", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const deletedAt = NOW - DAY;
    const tomb = { deletedAt, updatedAt: deletedAt };
    const { payloadId, operationId } = await insertOperationWithPayload(
      t,
      world,
      { metadataExpiresAtMs: NOW + 20 * HOUR, ...tomb },
      { ...tomb }
    );
    const pendingId = await insertProposal(
      t,
      proposal(world, {
        status: "pending",
        proposalExpiresAtMs: NOW - MIN,
        decidedAtMs: undefined,
        metadataExpiresAtMs: NOW + 20 * HOUR,
        ...tomb,
      })
    );
    const before = await readTables(t);

    const results = await runChain(t);

    const after = await readTables(t);
    const payloadRow = after.payloads.find(
      (row) => row._id === payloadId
    ) as Doc<"pageOperationPayloads">;
    expect(payloadRow.payload).toEqual({ state: "expired", expiredAtMs: NOW });
    expect(payloadRow.deletedAt).toBe(deletedAt);
    expect(payloadRow.updatedAt).toBe(deletedAt);
    const pendingRow = after.proposals.find((row) => row._id === pendingId) as Doc<"pageProposals">;
    expect(pendingRow.payload).toEqual({ state: "expired", expiredAtMs: NOW });
    expect(pendingRow.deletedAt).toBe(deletedAt);
    expect(pendingRow.updatedAt).toBe(deletedAt);
    // The tombstoned receipts survive: their own windows are still open.
    expect(after.operations).toEqual(before.operations);
    expect(after.operations.map((row) => row._id)).toContain(operationId);
    expect(after.proposals).toHaveLength(1);
    expect(sum(results, (r) => r.deletedOperations + r.deletedProposals)).toBe(0);

    // After their windows they follow the same rule as any other receipt.
    at(NOW + 21 * HOUR);
    await runChain(t);
    const later = await readTables(t);
    expect(later.operations).toHaveLength(0);
    expect(later.payloads).toHaveLength(0);
    expect(later.proposals).toHaveLength(0);
  });

  // -------------------------------------------------------------------------------------------
  // Undo pairs (#828 D5): an original and its undo receipt name each other and leave together.
  // -------------------------------------------------------------------------------------------

  test("16. Undo pair: neither row goes while the other is inside its window, in both directions", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);

    // (a) The original's window ended a minute ago; its undo receipt's window ends in a minute.
    const originalApplied = NOW - 48 * HOUR - MIN;
    const a = await insertUndoPair(
      t,
      world,
      { appliedAtMs: originalApplied, resultRevision: 40 },
      { metadataExpiresAtMs: NOW + MIN }
    );
    const aMarker = await insertPayload(
      t,
      payload(a.originalId, world, {
        undoUntilMs: originalApplied + 5 * MIN,
        cleanupDueAtMs: originalApplied + 10 * MIN,
        payload: expiredMarker(originalApplied + 10 * MIN),
      })
    );
    // (b) The other way round: the undo receipt is past its window, the original is not.
    const b = await insertUndoPair(
      t,
      { userA: world.userA, noteA: world.noteA2 },
      { appliedAtMs: NOW - 49 * HOUR, metadataExpiresAtMs: NOW + HOUR, resultRevision: 60 },
      { metadataExpiresAtMs: NOW - MIN }
    );
    const before = await readTables(t);

    const first = await runChain(t);
    expect(sum(first, (r) => r.deletedOperations + r.deletedPayloadMarkers)).toBe(0);
    // One hold per reviewed receipt: each is kept for its partner's open window.
    expect(sum(first, (r) => r.skipped.retained)).toBe(2);
    expect(await readTables(t)).toEqual(before);
    // However many times it runs before the later deadline.
    await runChain(t);
    at(NOW + MIN - 1);
    await runChain(t);
    expect(await readTables(t)).toEqual(before);
    expectNoDanglingUndoLinks(await readTables(t));

    // (a) The undo receipt's window ends: both rows and the original's marker go in one run.
    at(NOW + MIN);
    const aRun = await runOnce(t);
    expect(aRun.deletedOperations).toBe(2);
    expect(aRun.deletedPayloadMarkers).toBe(1);
    expect(await getDoc(t, a.originalId)).toBeNull();
    expect(await getDoc(t, a.undoId)).toBeNull();
    expect(await getDoc(t, aMarker)).toBeNull();
    expect(await getDoc(t, b.originalId)).not.toBeNull();
    expect(await getDoc(t, b.undoId)).not.toBeNull();
    expectNoDanglingUndoLinks(await readTables(t));

    // (b) The original's window ends: both go in one run.
    at(NOW + HOUR);
    const bRun = await runOnce(t);
    expect(bRun.deletedOperations).toBe(2);
    expect((await readTables(t)).operations).toHaveLength(0);
  });

  test("17. Undo pair: once both lapse, both rows and their markers go in the same invocation", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    // Pair 2's undo receipt is scanned first, then pair 1's original. Their partners both sort
    // after the last row this invocation scans (2 receipts per invocation), and still go with them.
    const one = await insertUndoPair(
      t,
      world,
      { appliedAtMs: NOW - 50 * HOUR, resultRevision: 70 },
      {}
    );
    const oneMarker = await insertPayload(
      t,
      payload(one.originalId, world, { payload: expiredMarker(NOW - 49 * HOUR) })
    );
    const two = await insertUndoPair(
      t,
      { userA: world.userA, noteA: world.noteA2 },
      { appliedAtMs: NOW - 51 * HOUR, metadataExpiresAtMs: NOW - MIN, resultRevision: 80 },
      { metadataExpiresAtMs: NOW - 3 * HOUR }
    );
    const twoMarker = await insertPayload(
      t,
      payload(
        two.originalId,
        { userA: world.userA, noteA: world.noteA2 },
        { payload: expiredMarker(NOW - 50 * HOUR) }
      )
    );
    expect(pageCleanupModule.MAX_OPERATION_ROWS_PER_INVOCATION).toBe(2);

    const first = await runOnce(t);

    // Four receipts, both pairs, both markers: all gone after the first invocation.
    expect(first.deletedOperations).toBe(4);
    expect(first.deletedPayloadMarkers).toBe(2);
    expect(first.rowsWritten).toBe(6);
    expect(first.skipped).toEqual({
      alreadyExpired: 2,
      windowOpen: 0,
      retained: 0,
      inconsistent: 0,
    });
    for (const id of [one.originalId, one.undoId, two.originalId, two.undoId]) {
      expect(await getDoc(t, id)).toBeNull();
    }
    expect(await getDoc(t, oneMarker)).toBeNull();
    expect(await getDoc(t, twoMarker)).toBeNull();
    // The continuation it queued finds nothing left and writes nothing.
    if (first.hasMore) {
      const jobs = await scheduledJobs(t);
      const rest = await runChain(t, jobs[jobs.length - 1].args[0] as RunArgs);
      expect(sum(rest, (r) => r.rowsWritten)).toBe(0);
    }
    expect(await readTables(t)).toEqual({ operations: [], payloads: [], proposals: [] });
  });

  test("18. Undo pair: anything that still needs either row keeps both", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const onNote2 = { userA: world.userA, noteA: world.noteA2 };

    // (a) Gap-free chain: an eligible operation sits between the original and its undo, so the
    // undo receipt is in its chain. The original alone is not, but it stays with its partner.
    const chained = await insertUndoPair(
      t,
      onNote2,
      { appliedAtMs: NOW - 50 * HOUR, resultRevision: 30 },
      { resultRevision: 32, metadataExpiresAtMs: NOW - 2 * HOUR }
    );
    const between = await insertOperation(
      t,
      operation(onNote2, {
        resultRevision: 31,
        appliedAtMs: NOW - MIN,
        undoUntilMs: NOW + 2 * MIN,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );

    // (b) The original's proposal is still inside its window; the undo receipt names no proposal.
    const openProposal = await insertProposal(
      t,
      proposal(world, {
        status: "confirmed",
        cleanupDueAtMs: NOW - HOUR,
        payload: expiredMarker(NOW - HOUR),
        metadataExpiresAtMs: NOW + 3 * HOUR,
      })
    );
    const proposed = await insertUndoPair(
      t,
      world,
      { appliedAtMs: NOW - 52 * HOUR, resultRevision: 90, proposalId: openProposal },
      {}
    );

    // (c) The original still has an available fragment that is not due yet.
    const fragment = await insertUndoPair(
      t,
      world,
      { appliedAtMs: NOW - 53 * HOUR, resultRevision: 95 },
      {}
    );
    const fragmentPayload = await insertPayload(
      t,
      payload(fragment.originalId, world, {
        cleanupDueAtMs: NOW + 5 * MIN,
        undoUntilMs: NOW - HOUR,
      })
    );

    const before = await readTables(t);
    const results = await runChain(t);
    expect(await readTables(t)).toEqual(before);
    expect(sum(results, (r) => r.deletedOperations)).toBe(0);
    expect(sum(results, (r) => r.skipped.retained)).toBeGreaterThanOrEqual(3);
    expectNoDanglingUndoLinks(await readTables(t));

    // Each pair goes as soon as the last thing holding it lapses, and only then.
    at(NOW + 3 * MIN);
    await runChain(t);
    expect(await getDoc(t, chained.originalId)).toBeNull();
    expect(await getDoc(t, chained.undoId)).toBeNull();
    expect(await getDoc(t, between)).not.toBeNull();
    expect(await getDoc(t, fragment.originalId)).not.toBeNull();
    expectNoDanglingUndoLinks(await readTables(t));

    at(NOW + 5 * MIN);
    await runChain(t);
    expect(await getDoc(t, fragment.originalId)).toBeNull();
    expect(await getDoc(t, fragment.undoId)).toBeNull();
    expect(await getDoc(t, fragmentPayload)).toBeNull();
    expect(await getDoc(t, proposed.originalId)).not.toBeNull();
    expect(await getDoc(t, proposed.undoId)).not.toBeNull();
    expectNoDanglingUndoLinks(await readTables(t));

    at(NOW + 3 * HOUR);
    await runChain(t);
    expect(await getDoc(t, proposed.originalId)).toBeNull();
    expect(await getDoc(t, proposed.undoId)).toBeNull();
    expect(await getDoc(t, openProposal)).toBeNull();
    expectNoDanglingUndoLinks(await readTables(t));
  });

  test("19. Undo links that do not fit the contract keep the rows; links never cross users", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const onNote2 = { userA: world.userA, noteA: world.noteA2 };

    // (a) Three rows chained by Undo links, all past their windows: more than one pair can hold.
    const third = await insertOperation(t, operation(world, { resultRevision: 100 }));
    const overLinked = await insertUndoPair(
      t,
      world,
      { resultRevision: 101 },
      { resultRevision: 102, undoOfOperationId: third }
    );
    // (b) One-sided links, each partner still inside its window, each named row past its own.
    // A lower row names an undo receipt that does not name it back...
    const namedFromBelow = await insertOperation(
      t,
      operation(onNote2, { kind: "undo", resultRevision: 201, undoUntilMs: undefined })
    );
    const namesFromBelow = await insertOperation(
      t,
      operation(onNote2, {
        resultRevision: 200,
        undoneAtMs: NOW - 49 * HOUR,
        undoneByOperationId: namedFromBelow,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );
    // ...and a higher undo receipt names an original that does not name it back.
    const namedFromAbove = await insertOperation(t, operation(onNote2, { resultRevision: 300 }));
    const namesFromAbove = await insertOperation(
      t,
      operation(onNote2, {
        kind: "undo",
        resultRevision: 301,
        undoUntilMs: undefined,
        undoOfOperationId: namedFromAbove,
        metadataExpiresAtMs: NOW + 40 * HOUR,
      })
    );
    const before = await readTables(t);

    const results = await runChain(t);

    // Deleting any named row would leave a link pointing at nothing: every row stays.
    expect(await readTables(t)).toEqual(before);
    expect(sum(results, (r) => r.skipped.inconsistent)).toBe(5);
    expect(sum(results, (r) => r.rowsWritten)).toBe(0);
    expectNoDanglingUndoLinks(await readTables(t));
    for (const id of [
      third,
      overLinked.originalId,
      overLinked.undoId,
      namedFromBelow,
      namesFromBelow,
      namedFromAbove,
      namesFromAbove,
    ]) {
      expect(await getDoc(t, id)).not.toBeNull();
    }

    // (c) Another user's row named by an Undo link neither holds A's receipt nor goes with it.
    const foreign = await insertOperation(
      t,
      operation(
        { userA: world.userB, noteA: world.noteB },
        {
          kind: "undo",
          resultRevision: 5,
          undoUntilMs: undefined,
          metadataExpiresAtMs: NOW + 40 * HOUR,
        }
      )
    );
    const foreignBefore = await getDoc(t, foreign);
    const mine = await insertOperation(
      t,
      operation(world, {
        resultRevision: 400,
        undoneAtMs: NOW - 49 * HOUR,
        undoneByOperationId: foreign,
      })
    );
    await runChain(t);
    expect(await getDoc(t, mine)).toBeNull();
    expect(await getDoc(t, foreign)).toEqual(foreignBefore);
  });

  test("20. no dangling Undo link after any run, and every pair leaves in one run", async () => {
    const t = newTestConvex();
    const world = await seedWorld(t);
    const pairs: { originalId: Id<"pageOperations">; undoId: Id<"pageOperations"> }[] = [];
    const revisions = new Map<string, number>();
    const nextRevision = (noteId: Id<"notes">) => {
      const revision = (revisions.get(noteId) ?? 0) + 1;
      revisions.set(noteId, revision);
      return revision;
    };

    for (let i = 0; i < 12; i++) {
      const note = i % 2 === 0 ? world.noteA : world.noteA2;
      const where = { userA: world.userA, noteA: note };
      const appliedAtMs = NOW - 50 * HOUR + i * 3 * HOUR;
      // Either partner may outlive the other by up to two hours.
      const jitter = ((i % 5) - 2) * HOUR;
      const originalRevision = nextRevision(note);
      const pair = await insertUndoPair(
        t,
        where,
        {
          appliedAtMs,
          resultRevision: originalRevision,
          metadataExpiresAtMs: appliedAtMs + 48 * HOUR + Math.max(jitter, 0),
        },
        {
          resultRevision: nextRevision(note),
          metadataExpiresAtMs: appliedAtMs + 2 * MIN + 48 * HOUR - Math.min(jitter, 0),
        }
      );
      pairs.push(pair);
      await insertPayload(
        t,
        payload(pair.originalId, where, {
          undoUntilMs: appliedAtMs + 5 * MIN,
          cleanupDueAtMs: appliedAtMs + 10 * MIN,
        })
      );
      // A plain operation between pairs.
      await insertOperation(
        t,
        operation(where, {
          appliedAtMs: appliedAtMs + HOUR,
          resultRevision: nextRevision(note),
        })
      );
    }

    const results: Result[] = [];
    for (let step = 0; step <= 40; step++) {
      at(NOW - 4 * HOUR + step * HOUR);
      // One invocation at a time, so the links are checked after every transaction, not only
      // after a whole chain.
      let args: RunArgs = {};
      for (let guard = 0; guard < 50; guard++) {
        const result = await runOnce(t, args);
        results.push(result);
        const tables = await readTables(t);
        expectNoDanglingUndoLinks(tables);
        const ids = new Set(tables.operations.map((row) => row._id as string));
        for (const pair of pairs) expect(ids.has(pair.originalId)).toBe(ids.has(pair.undoId));
        if (!result.hasMore) break;
        const jobs = await scheduledJobs(t);
        args = jobs[jobs.length - 1].args[0] as RunArgs;
      }
    }
    // Every pair, plain operation and marker is gone once the last window has ended.
    expect(sum(results, (r) => r.deletedOperations)).toBe(36);
    expect(sum(results, (r) => r.deletedPayloadMarkers)).toBe(12);
    expect(sum(results, (r) => r.skipped.inconsistent)).toBe(0);
    expect(await readTables(t)).toEqual({ operations: [], payloads: [], proposals: [] });
    await expectNoSentinel(t, results);
  });
});

async function expectNoSentinelInExpiredRows(t: TestConvex) {
  const tables = await readTables(t);
  for (const row of tables.payloads) {
    if (row.payload.state === "expired") expect(JSON.stringify(row)).not.toContain(SENTINEL);
  }
  for (const row of tables.proposals) {
    if (row.payload.state === "expired") expect(JSON.stringify(row)).not.toContain(SENTINEL);
  }
}
