import { describe, expect, test } from "bun:test";
import { v, type GenericValidator } from "convex/values";
import schema from "../schema";
import { signInRestorePatch, softDeleteUserAccount } from "./accountDeletion";

const NOW = 1_700_000_000_000;
const USER = "users:fictional" as Parameters<typeof softDeleteUserAccount>[1];
type Row = { _id: string; deletedAt?: number; isActive?: boolean; [field: string]: unknown };

/** Fictional transaction fixture; patches remove undefined exactly as Convex does. */
function world(user: Record<string, unknown> | null = {}) {
  const rows = new Map<string, Row>();
  const writes: { id: string; patch: Record<string, unknown> }[] = [];
  const queries: string[] = [];
  if (user) rows.set(USER, { _id: USER, email: "fictional@example.test", isActive: true, ...user });
  const db = {
    get: async (id: string) => rows.get(id) ?? null,
    patch: async (id: string, patch: Record<string, unknown>) => {
      const row = rows.get(id);
      if (!row) throw new Error("Missing fictional row");
      writes.push({ id, patch: structuredClone(patch) });
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete row[key];
        else row[key] = value;
      }
    },
    query: (table: string) => {
      queries.push(table);
      return {
        withIndex: (_index: string, select: (query: { eq(field: string, value: unknown): unknown }) => unknown) => {
          const filters: [string, unknown][] = [];
          const query = { eq(field: string, value: unknown) { filters.push([field, value]); return query; } };
          select(query);
          const selected = () => [...rows.values()].filter(row => row._id.startsWith(`${table}:`) && filters.every(([key, value]) => row[key] === value));
          return {
            collect: async () => selected(),
            unique: async () => {
              const found = selected();
              if (found.length > 1) throw new Error("Singleton violated");
              return found[0] ?? null;
            },
          };
        },
      };
    },
  };
  const ctx = { db } as unknown as Parameters<typeof softDeleteUserAccount>[0];
  return { rows, writes, queries, db, ctx, user: () => rows.get(USER) as Row };
}

describe("durable account billing deletion fence", () => {
  test("first live deletion writes both fence fields atomically in the existing user patch", async () => {
    const state = world();
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
    expect(state.writes).toEqual([{ id: USER, patch: { deletedAt: NOW, isActive: false, updatedAt: NOW, billingDeletionEpoch: 1, billingDeletedAt: NOW } }]);
  });

  test("repeated deletion leaves generation and deletion instant unchanged", async () => {
    const state = world();
    await softDeleteUserAccount(state.ctx, USER, NOW);
    const before = structuredClone(state.user());
    expect(await softDeleteUserAccount(state.ctx, USER, NOW + 5_000)).toEqual({ deletedCount: 0 });
    expect(state.user()).toEqual(before);
    expect(state.writes).toHaveLength(1);
  });

  test("the unchanged restore patch preserves both fence fields", async () => {
    const state = world();
    await softDeleteUserAccount(state.ctx, USER, NOW);
    const restore = signInRestorePatch(state.user(), NOW + 1);
    expect(restore).toEqual({ deletedAt: undefined, isActive: true });
    if (!restore) throw new Error("Expected restorable fixture");
    await state.db.patch(USER, restore);
    expect(state.user()).toMatchObject({ billingDeletionEpoch: 1, billingDeletedAt: NOW, isActive: true });
    expect(state.user().deletedAt).toBeUndefined();
  });

  test("restore and deletion advance exactly once even in the same millisecond", async () => {
    const state = world();
    await softDeleteUserAccount(state.ctx, USER, NOW);
    const restore = signInRestorePatch(state.user(), NOW);
    if (!restore) throw new Error("Expected restorable fixture");
    await state.db.patch(USER, restore);
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
    expect(state.user()).toMatchObject({ billingDeletionEpoch: 2, billingDeletedAt: NOW, deletedAt: NOW });
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 0 });
    expect(state.user().billingDeletionEpoch).toBe(2);
  });

  test("a later real deletion replaces only the last fence timestamp and increments generation", async () => {
    const state = world({ billingDeletionEpoch: 7, billingDeletedAt: NOW - 100 });
    await softDeleteUserAccount(state.ctx, USER, NOW);
    expect(state.user()).toMatchObject({ billingDeletionEpoch: 8, billingDeletedAt: NOW });
  });

  test("an absent subscription still creates a durable deletion fence", async () => {
    const state = world();
    await softDeleteUserAccount(state.ctx, USER, NOW);
    expect(state.queries).toContain("subscriptionStates");
    expect(state.user().billingDeletionEpoch).toBe(1);
    expect([...state.rows.keys()]).toEqual([USER]);
  });

  test("already-inactive subscription retains its row and timestamps while user gains the fence", async () => {
    const state = world();
    const subscription = { _id: "subscriptionStates:fictional", userId: USER, status: "inactive", updatedAt: NOW - 1, plan: "pro" };
    state.rows.set(subscription._id, structuredClone(subscription));
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
    expect(state.rows.get(subscription._id)).toEqual(subscription);
    expect(state.user().billingDeletionEpoch).toBe(1);
  });

  test("missing users produce zero writes and no child queries", async () => {
    const state = world(null);
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 0 });
    expect(state.writes).toEqual([]);
    expect(state.queries).toEqual([]);
  });

  test("child cleanup, provider deactivation, tenant isolation and deletedCount stay intact", async () => {
    const state = world();
    state.rows.set("tasks:fictional", { _id: "tasks:fictional", userId: USER, title: "Fictional task" });
    state.rows.set("tasks:other", { _id: "tasks:other", userId: "users:other", title: "Other fictional task" });
    state.rows.set("subscriptionStates:fictional", { _id: "subscriptionStates:fictional", userId: USER, status: "active", updatedAt: 1 });
    state.rows.set("mcpTokens:fictional", { _id: "mcpTokens:fictional", userId: USER });
    state.rows.set("conversations:fictional", { _id: "conversations:fictional", userId: USER });
    state.rows.set("messages:fictional", { _id: "messages:fictional", conversationId: "conversations:fictional" });
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 6 });
    expect(state.rows.get("tasks:fictional")).toMatchObject({ deletedAt: NOW, updatedAt: NOW });
    expect(state.rows.get("tasks:other")?.deletedAt).toBeUndefined();
    expect(state.rows.get("subscriptionStates:fictional")).toMatchObject({ status: "inactive", updatedAt: NOW });
    expect(state.rows.get("mcpTokens:fictional")?.revokedAt).toBe(NOW);
    expect(state.rows.get("messages:fictional")?.deletedAt).toBe(NOW);
    expect(state.writes.filter(write => write.id === USER)).toHaveLength(1);
  });

  test("saturated generation never wraps or prevents privacy deletion", async () => {
    const state = world({ billingDeletionEpoch: Number.MAX_SAFE_INTEGER });
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
    expect(state.user()).toMatchObject({ billingDeletionEpoch: Number.MAX_SAFE_INTEGER, billingDeletedAt: NOW, deletedAt: NOW });
  });

  test("malformed persisted generations saturate and still allow deletion", async () => {
    for (const billingDeletionEpoch of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, "fictional malformed value"]) {
      const state = world({ billingDeletionEpoch });
      expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
      expect(state.user()).toMatchObject({ billingDeletionEpoch: Number.MAX_SAFE_INTEGER, billingDeletedAt: NOW, isActive: false });
    }
  });

  test("zero and the last unsaturated safe integer each advance once", async () => {
    for (const epoch of [0, Number.MAX_SAFE_INTEGER - 1]) {
      const state = world({ billingDeletionEpoch: epoch });
      await softDeleteUserAccount(state.ctx, USER, NOW);
      expect(state.user().billingDeletionEpoch).toBe(epoch + 1);
    }
  });

  test("legacy already-deleted user receives no invented marker while cleanup can finish", async () => {
    const state = world({ deletedAt: NOW - 1, isActive: false });
    state.rows.set("tasks:late", { _id: "tasks:late", userId: USER });
    expect(await softDeleteUserAccount(state.ctx, USER, NOW)).toEqual({ deletedCount: 1 });
    expect(state.user().billingDeletionEpoch).toBeUndefined();
    expect(state.user().billingDeletedAt).toBeUndefined();
    expect(state.writes.map(write => write.id)).toEqual(["tasks:late"]);
  });

  test("existing markers on an already-deleted user are never repaired or rewritten", async () => {
    const state = world({ deletedAt: NOW - 5, billingDeletionEpoch: 3, billingDeletedAt: NOW - 5 });
    await softDeleteUserAccount(state.ctx, USER, NOW);
    expect(state.writes).toEqual([]);
    expect(state.user()).toMatchObject({ billingDeletionEpoch: 3, billingDeletedAt: NOW - 5 });
  });
});

// Pinned users contract at integration 7d1a0f6. Preserve every legacy validator;
// separately approved additive fields/indexes are not rejected by this regression.
const legacyUsers = v.object({
  email: v.string(), emailVerificationTime: v.optional(v.number()), emailVerified: v.optional(v.boolean()),
  fullName: v.optional(v.string()), name: v.optional(v.string()),
  role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  userType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
  betaAccess: v.optional(v.union(v.literal("none"), v.literal("tester"), v.literal("founder"))),
  entitlementTier: v.optional(v.union(v.literal("none"), v.literal("basic"), v.literal("pro"), v.literal("max"), v.literal("god"))),
  isGodTier: v.optional(v.boolean()), betaApprovedAt: v.optional(v.number()), isActive: v.optional(v.boolean()),
  createdAt: v.optional(v.number()), updatedAt: v.optional(v.number()), deletedAt: v.optional(v.number()),
  onboardedAt: v.optional(v.number()),
  approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("revoked"))),
  approvalUpdatedAt: v.optional(v.number()), approvalUpdatedBy: v.optional(v.string()),
});
const users = schema.tables.users as unknown as {
  validator: { fields: Record<string, GenericValidator> };
  " indexes"(): { indexDescriptor: string; fields: string[] }[];
};

type LegacyValidatorShape = {
  kind: string;
  optional: "optional" | "required";
  value?: unknown;
  members?: LegacyValidatorShape[];
};

/** All kinds in the pinned users contract, using declared validator properties only. */
function legacyValidatorShape(validator: GenericValidator): LegacyValidatorShape {
  const common = { kind: validator.kind, optional: validator.isOptional };
  switch (validator.kind) {
    case "string":
    case "float64":
    case "boolean":
      return common;
    case "literal":
      return { ...common, value: validator.value };
    case "union":
      return { ...common, members: validator.members.map(legacyValidatorShape) };
    default:
      throw new Error(`Unexpected legacy users validator kind: ${validator.kind}`);
  }
}

function assertLegacyValidator(actual: GenericValidator, expected: GenericValidator) {
  expect(legacyValidatorShape(actual)).toEqual(legacyValidatorShape(expected));
}

describe("billing deletion schema compatibility", () => {
  test("both fence fields are optional numbers and all existing user validators remain unchanged", () => {
    for (const name of ["billingDeletionEpoch", "billingDeletedAt"]) {
      expect(users.validator.fields[name].kind).toBe("float64");
      expect(users.validator.fields[name].isOptional).toBe("optional");
    }
    for (const [name, validator] of Object.entries(legacyUsers.fields)) {
      assertLegacyValidator(users.validator.fields[name], validator);
      expect(users.validator.fields[name].isOptional).toBe(validator.isOptional);
    }
    expect(Object.entries(users.validator.fields).filter(([, field]) => field.isOptional === "required").map(([name]) => name)).toEqual(["email"]);
  });

  test("all six legacy users indexes preserve their exact indexed fields", () => {
    const indexes = users[" indexes"]();
    for (const [indexDescriptor, field] of [["by_email", "email"], ["by_approvalStatus", "approvalStatus"], ["by_role", "role"], ["by_userType", "userType"], ["by_betaAccess", "betaAccess"], ["by_deletedAt", "deletedAt"]]) {
      expect(indexes.find(index => index.indexDescriptor === indexDescriptor)).toEqual({ indexDescriptor, fields: [field] });
    }
  });

  test("legacy compatibility rejects changing a validator kind", () => {
    expect(() => assertLegacyValidator(v.number(), legacyUsers.fields.email)).toThrow();
  });

  test("legacy compatibility rejects changing an enum literal value", () => {
    const changed = v.optional(v.union(v.literal("admin"), v.literal("fictional-other-role")));
    expect(() => assertLegacyValidator(changed, legacyUsers.fields.role)).toThrow();
  });

  test("legacy compatibility rejects adding or removing union members", () => {
    const added = v.optional(v.union(v.literal("admin"), v.literal("user"), v.literal("fictional-extra-role")));
    const removed = v.optional(v.union(v.literal("admin")));
    expect(() => assertLegacyValidator(added, legacyUsers.fields.role)).toThrow();
    expect(() => assertLegacyValidator(removed, legacyUsers.fields.role)).toThrow();
  });

  test("legacy compatibility rejects changing either required or optional flags", () => {
    expect(() => assertLegacyValidator(v.optional(v.string()), legacyUsers.fields.email)).toThrow();
    expect(() => assertLegacyValidator(v.number(), legacyUsers.fields.createdAt)).toThrow();
  });
});
