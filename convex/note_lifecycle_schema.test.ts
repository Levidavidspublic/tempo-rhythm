import { describe, expect, test } from "bun:test";
import type { GenericValidator } from "convex/values";
import { convexTest } from "convex-test";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { softDeleteUserAccount, USER_OWNED_TABLES } from "./lib/accountDeletion";
import { GRACE_MS } from "./lib/softDelete";
import schema from "./schema";

/**
 * TEMPO-CORE-NOTE-SCHEMA-01 (#841): inactive note kind, archive, template discriminator, stored
 * preview and task-link schema, as adopted from contract #837 (docs/contracts/CORE-WEB-NOTES.md
 * §4, §5.3, §6, §8.1, §8.2, §8.5, §8.6).
 *
 * Two kinds of evidence:
 * - Static: the declared validators and indexes, read from the schema definition itself.
 * - Behavioural: `convex-test` 0.0.38 with the real schema and schema validation on. It validates
 *   every insert and patch against the table validators (so invalid literals and ids are refused
 *   the way a deployment refuses them), refuses an index that is not declared, refuses a range
 *   that skips an index field, and evaluates multi-field ranges with Convex value ordering
 *   (undefined sorts before numbers and booleans). No Tempo function is called: nothing reads or
 *   writes these fields yet.
 *
 * What this file does NOT prove: query cost or read bounds in a deployment (convex-test evaluates
 * a range by filtering every row), pagination byte limits (#842, NL-24), concurrent transactions,
 * or the Convex server's index-name length rule. All rows and ids are synthetic.
 */

// convex-test needs a module map whose keys carry the `_generated` path (its module-root prefix).
// Only the generated files are listed: no Tempo function is called through it.
const modules: Record<string, () => Promise<unknown>> = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};

function newTest() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof newTest>;
type NoteRow = Omit<Doc<"notes">, "_id" | "_creationTime">;
type TaskRow = Omit<Doc<"tasks">, "_id" | "_creationTime">;

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const TRASH_FROM = NOW - GRACE_MS;

/** Synthetic block ids in the contract's `blk_` + 26-character ULID form. */
const blk = (n: number) => `blk_01ARZ3NDEKTSV4RRFFQ69G5F${String(n).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Schema introspection
// ---------------------------------------------------------------------------

type TableDefinitionShape = {
  validator: GenericValidator;
  " indexes"(): { indexDescriptor: string; fields: string[] }[];
};

const tables = schema.tables as unknown as Record<string, TableDefinitionShape>;

function fields(table: string): Record<string, GenericValidator> {
  const validator = tables[table].validator;
  if (validator.kind !== "object") {
    throw new Error(`${table} is expected to be a single object table`);
  }
  return validator.fields;
}

function describeDeep(validator: GenericValidator): string {
  switch (validator.kind) {
    case "id":
      return `id:${validator.tableName}`;
    case "literal":
      return `literal:${String(validator.value)}`;
    case "array":
      return `array<${describeDeep(validator.element)}>`;
    case "object":
      return `{${Object.entries(validator.fields)
        .map(([name, f]) => `${name}${f.isOptional === "optional" ? "?" : ""}:${describeDeep(f)}`)
        .join(",")}}`;
    case "union":
      return `union(${validator.members.map(describeDeep).join("|")})`;
    default:
      return validator.kind;
  }
}

function shapeOf(table: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields(table)).map(([name, f]) => [
      name,
      `${describeDeep(f)}${f.isOptional === "optional" ? "?" : ""}`,
    ]),
  );
}

function requiredOf(table: string): string[] {
  return Object.entries(fields(table))
    .filter(([, f]) => f.isOptional === "required")
    .map(([name]) => name)
    .sort();
}

function indexesOf(table: string) {
  return tables[table][" indexes"]();
}

function indexFields(table: string, name: string): string[] | undefined {
  return indexesOf(table).find((index) => index.indexDescriptor === name)?.fields;
}

/** Notes fields as they stood after #786 and #828 (integration e752319). */
const LEGACY_NOTE_SHAPE = {
  userId: "id:users",
  title: "string",
  body: "string",
  pinned: "boolean",
  periodType: "union(literal:daily|literal:weekly|literal:monthly|literal:none)",
  pageType: "union(literal:daily|literal:weekly|literal:project|literal:plain|literal:template)?",
  date: "string?",
  aiGenerated: "boolean?",
  revision: "float64?",
  createdAt: "float64",
  updatedAt: "float64",
  deletedAt: "float64?",
};

const NEW_NOTE_SHAPE = {
  kind: "union(literal:quick|literal:todo)?",
  archivedAt: "float64?",
  isTemplate: "literal:true?",
  preview: "string?",
};

const LEGACY_NOTE_INDEXES = [
  { indexDescriptor: "by_userId", fields: ["userId"] },
  { indexDescriptor: "by_userId_pinned", fields: ["userId", "pinned"] },
  { indexDescriptor: "by_userId_updatedAt", fields: ["userId", "updatedAt"] },
  { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
  {
    indexDescriptor: "by_userId_deletedAt_pageType_date",
    fields: ["userId", "deletedAt", "pageType", "date"],
  },
];

const FEED = "by_userId_deletedAt_isTemplate_archivedAt_pinned_updatedAt";
const FEED_KIND = "by_userId_deletedAt_isTemplate_archivedAt_kind_pinned_updatedAt";
const TRASH = "by_userId_isTemplate_deletedAt";
const LINK = "by_userId_sourceNoteId_deletedAt_sourceBlockId";
const TODO = "by_userId_deletedAt_status_dueAt";

const NEW_NOTE_INDEXES = [
  {
    indexDescriptor: FEED,
    fields: ["userId", "deletedAt", "isTemplate", "archivedAt", "pinned", "updatedAt"],
  },
  {
    indexDescriptor: FEED_KIND,
    fields: ["userId", "deletedAt", "isTemplate", "archivedAt", "kind", "pinned", "updatedAt"],
  },
  { indexDescriptor: TRASH, fields: ["userId", "isTemplate", "deletedAt"] },
];

const LEGACY_TASK_INDEXES = [
  { indexDescriptor: "by_userId", fields: ["userId"] },
  { indexDescriptor: "by_userId_status", fields: ["userId", "status"] },
  { indexDescriptor: "by_userId_dueAt", fields: ["userId", "dueAt"] },
  { indexDescriptor: "by_userId_projectId", fields: ["userId", "projectId"] },
  { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
];

const NEW_TASK_INDEXES = [
  { indexDescriptor: LINK, fields: ["userId", "sourceNoteId", "deletedAt", "sourceBlockId"] },
  { indexDescriptor: TODO, fields: ["userId", "deletedAt", "status", "dueAt"] },
];

// ---------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------

function legacyNote(userId: Id<"users">, title: string, extra: Partial<NoteRow> = {}): NoteRow {
  return {
    userId,
    title,
    body: `synthetic body for ${title}`,
    pinned: false,
    periodType: "none",
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...extra,
  };
}

function legacyTask(userId: Id<"users">, title: string, extra: Partial<TaskRow> = {}): TaskRow {
  return {
    userId,
    title,
    status: "todo",
    priority: "medium",
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...extra,
  };
}

async function twoUsers(t: T) {
  return await t.run(async (ctx) => ({
    a: await ctx.db.insert("users", { email: "user-a@example.test" }),
    b: await ctx.db.insert("users", { email: "user-b@example.test" }),
  }));
}

/** Inserts without the compile-time row type, so the runtime validator is what refuses it. */
function insertUnchecked(ctx: MutationCtx, table: "notes" | "tasks", row: Record<string, unknown>) {
  return (ctx.db.insert as unknown as (t: string, r: Record<string, unknown>) => Promise<string>)(
    table,
    row,
  );
}

function patchUnchecked(ctx: MutationCtx, id: string, patch: Record<string, unknown>) {
  return (ctx.db.patch as unknown as (i: string, p: Record<string, unknown>) => Promise<void>)(
    id,
    patch,
  );
}

async function countRows(t: T, table: "notes" | "tasks", userId: Id<"users">) {
  return await t.run(
    async (ctx) =>
      (await ctx.db
        .query(table)
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()).length,
  );
}

// ---------------------------------------------------------------------------
// Static declarations
// ---------------------------------------------------------------------------

describe("notes schema declarations (#841)", () => {
  // Shapes and index lists are checked per field and per index, not as a whole-table snapshot, so
  // a later serial schema writer that adds its own optional field or index does not have to edit
  // this file. The required-field set IS exact: a new required field would break legacy rows.
  test("adds kind, archivedAt, isTemplate and preview, all optional, with the contract types", () => {
    expect(shapeOf("notes")).toMatchObject(NEW_NOTE_SHAPE);
    for (const name of Object.keys(NEW_NOTE_SHAPE)) {
      expect(fields("notes")[name].isOptional).toBe("optional");
    }
  });

  test("kind stores only the two non-default kinds; 'note' is the absent value", () => {
    const kind = fields("notes").kind;
    expect(kind.kind).toBe("union");
    const literals = kind.kind === "union" ? kind.members.map(describeDeep) : [];
    expect(literals).toEqual(["literal:quick", "literal:todo"]);
    expect(literals).not.toContain("literal:note");
  });

  test("every legacy notes field keeps its exact shape; body stays the canonical required text", () => {
    expect(shapeOf("notes")).toMatchObject(LEGACY_NOTE_SHAPE);
    expect(requiredOf("notes")).toEqual(
      ["body", "createdAt", "periodType", "pinned", "title", "updatedAt", "userId"].sort(),
    );
  });

  test("keeps the five legacy indexes unchanged and adds the three feed/trash indexes in binding order", () => {
    const declared = indexesOf("notes");
    expect(declared).toEqual(expect.arrayContaining([...LEGACY_NOTE_INDEXES, ...NEW_NOTE_INDEXES]));
    for (const index of [...LEGACY_NOTE_INDEXES, ...NEW_NOTE_INDEXES]) {
      expect(indexFields("notes", index.indexDescriptor)).toEqual(index.fields);
    }
    for (const name of [FEED, FEED_KIND]) {
      const order = indexFields("notes", name) ?? [];
      expect(order.indexOf("isTemplate")).toBeGreaterThan(order.indexOf("deletedAt"));
      expect(order.indexOf("isTemplate")).toBeLessThan(order.indexOf("archivedAt"));
    }
    expect(indexFields("notes", TRASH)).toEqual(["userId", "isTemplate", "deletedAt"]);
  });

  test("index names are identifiers and within the documented per-table limits", () => {
    for (const table of ["notes", "tasks"]) {
      const declared = indexesOf(table);
      // Convex: at most 32 indexes per table and 16 fields per index, _creationTime included.
      expect(declared.length).toBeLessThanOrEqual(32);
      for (const index of declared) {
        expect(index.indexDescriptor).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(index.fields.length + 1).toBeLessThanOrEqual(16);
        expect(new Set(index.fields).size).toBe(index.fields.length);
      }
    }
    // The longest name is 63 characters (contract §8.1). No server-side length rule was verified.
    expect(FEED_KIND.length).toBe(63);
  });
});

describe("tasks link declarations (#841)", () => {
  test("adds sourceNoteId (notes id) and sourceBlockId (string), both optional", () => {
    expect(shapeOf("tasks")).toMatchObject({
      sourceNoteId: "id:notes?",
      sourceBlockId: "string?",
    });
    expect(requiredOf("tasks")).toEqual(
      ["createdAt", "priority", "status", "title", "updatedAt", "userId"].sort(),
    );
  });

  test("keeps the five legacy task indexes and adds the link and TODO indexes; deletedAt precedes sourceBlockId", () => {
    expect(indexesOf("tasks")).toEqual(
      expect.arrayContaining([...LEGACY_TASK_INDEXES, ...NEW_TASK_INDEXES]),
    );
    for (const index of [...LEGACY_TASK_INDEXES, ...NEW_TASK_INDEXES]) {
      expect(indexFields("tasks", index.indexDescriptor)).toEqual(index.fields);
    }
    const link = indexFields("tasks", LINK) ?? [];
    expect(link.indexOf("deletedAt")).toBeLessThan(link.indexOf("sourceBlockId"));
    // Only one note-link index: no index on the link fields that skips deletedAt.
    const linkIndexes = indexesOf("tasks").filter((index) => index.fields.includes("sourceNoteId"));
    expect(linkIndexes.map((index) => index.indexDescriptor)).toEqual([LINK]);
  });

  test("notes and tasks stay enrolled in account soft deletion; the new fields need no enrollment", () => {
    expect(USER_OWNED_TABLES).toContain("notes");
    expect(USER_OWNED_TABLES).toContain("tasks");
    for (const table of ["notes", "tasks"]) {
      expect(indexFields(table, "by_userId")).toEqual(["userId"]);
      expect(fields(table).deletedAt.isOptional).toBe("optional");
      expect(fields(table).updatedAt.isOptional).toBe("required");
    }
  });
});

// ---------------------------------------------------------------------------
// Runtime validation (convex-test, schema validation on)
// ---------------------------------------------------------------------------

describe("legacy rows and every adopted value validate", () => {
  test("a legacy note and a legacy task with none of the new fields insert and read back unchanged", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const { note, task } = await t.run(async (ctx) => {
      const noteId = await ctx.db.insert("notes", legacyNote(a, "legacy"));
      const taskId = await ctx.db.insert("tasks", legacyTask(a, "legacy task"));
      return { note: await ctx.db.get(noteId), task: await ctx.db.get(taskId) };
    });
    expect(note).not.toBeNull();
    for (const name of ["kind", "archivedAt", "isTemplate", "preview", "revision"]) {
      expect(note ?? {}).not.toHaveProperty(name);
    }
    expect(note?.body).toBe("synthetic body for legacy");
    expect(task ?? {}).not.toHaveProperty("sourceNoteId");
    expect(task ?? {}).not.toHaveProperty("sourceBlockId");
  });

  test("each adopted kind round-trips: absent (note), quick, todo", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const kinds = await t.run(async (ctx) => {
      const ids = [
        await ctx.db.insert("notes", legacyNote(a, "note")),
        await ctx.db.insert("notes", legacyNote(a, "quick", { kind: "quick", title: "" })),
        await ctx.db.insert("notes", legacyNote(a, "todo", { kind: "todo" })),
      ];
      return Promise.all(ids.map(async (id) => (await ctx.db.get(id))?.kind ?? null));
    });
    expect(kinds).toEqual([null, "quick", "todo"]);
  });

  test("archive states: active, archived, archived then trashed (archivedAt kept), unarchived", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const states = await t.run(async (ctx) => {
      const id = await ctx.db.insert("notes", legacyNote(a, "lifecycle"));
      const read = async () => {
        const row = await ctx.db.get(id);
        return { archivedAt: row?.archivedAt ?? null, deletedAt: row?.deletedAt ?? null };
      };
      const active = await read();
      await ctx.db.patch(id, { archivedAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY });
      const archived = await read();
      await ctx.db.patch(id, { deletedAt: NOW - DAY, updatedAt: NOW - DAY });
      const trashed = await read();
      await ctx.db.patch(id, { deletedAt: undefined, updatedAt: NOW });
      const restored = await read();
      await ctx.db.patch(id, { archivedAt: undefined, updatedAt: NOW });
      const unarchived = await read();
      return { active, archived, trashed, restored, unarchived };
    });
    expect(states.active).toEqual({ archivedAt: null, deletedAt: null });
    expect(states.archived).toEqual({ archivedAt: NOW - 2 * DAY, deletedAt: null });
    expect(states.trashed).toEqual({ archivedAt: NOW - 2 * DAY, deletedAt: NOW - DAY });
    expect(states.restored).toEqual({ archivedAt: NOW - 2 * DAY, deletedAt: null });
    expect(states.unarchived).toEqual({ archivedAt: null, deletedAt: null });
  });

  test("isTemplate: true with pageType template and a stored preview are accepted", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const row = await t.run(async (ctx) => {
      const id = await ctx.db.insert(
        "notes",
        legacyNote(a, "template", { pageType: "template", isTemplate: true, preview: "Plan the day" }),
      );
      return await ctx.db.get(id);
    });
    expect(row?.isTemplate).toBe(true);
    expect(row?.pageType).toBe("template");
    expect(row?.preview).toBe("Plan the day");
  });

  test("a note linked task with a notes id and a block id is accepted", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const row = await t.run(async (ctx) => {
      const noteId = await ctx.db.insert("notes", legacyNote(a, "todo note", { kind: "todo" }));
      const taskId = await ctx.db.insert(
        "tasks",
        legacyTask(a, "linked", { sourceNoteId: noteId, sourceBlockId: blk(1) }),
      );
      return { noteId, task: await ctx.db.get(taskId) };
    });
    expect(row.task?.sourceNoteId).toBe(row.noteId);
    expect(row.task?.sourceBlockId).toBe(blk(1));
  });
});

describe("invalid literals, ids and fields are refused by the validator", () => {
  const badNoteValues: [string, Record<string, unknown>][] = [
    ["kind 'note' (the default is stored as absent)", { kind: "note" }],
    ["kind 'blinko'", { kind: "blinko" }],
    ["kind 'Quick'", { kind: "Quick" }],
    ["kind ''", { kind: "" }],
    ["kind null", { kind: null }],
    ["kind 1", { kind: 1 }],
    ["isTemplate false", { isTemplate: false }],
    ["isTemplate 'true'", { isTemplate: "true" }],
    ["isTemplate null", { isTemplate: null }],
    ["archivedAt as a date string", { archivedAt: "2026-10-11" }],
    ["archivedAt null", { archivedAt: null }],
    ["archivedAt boolean", { archivedAt: true }],
    ["preview number", { preview: 42 }],
    ["preview null", { preview: null }],
    ["preview array", { preview: ["a"] }],
    ["undeclared notes.taskId (rejected alternative)", { taskId: "x" }],
    ["undeclared notes.tags", { tags: ["work"] }],
    ["undeclared notes.archived flag", { archived: true }],
  ];

  for (const [label, extra] of badNoteValues) {
    test(`note insert refuses ${label} and writes nothing`, async () => {
      const t = newTest();
      const { a } = await twoUsers(t);
      await expect(
        t.run(async (ctx) => {
          await insertUnchecked(ctx, "notes", { ...legacyNote(a, "bad"), ...extra });
        }),
      ).rejects.toThrow(/Validator error/);
      expect(await countRows(t, "notes", a)).toBe(0);
    });
  }

  test("patching an existing note to an invalid kind, isTemplate or archivedAt is refused and leaves it unchanged", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const id = await t.run(async (ctx) => await ctx.db.insert("notes", legacyNote(a, "patch me")));
    for (const patch of [{ kind: "blinko" }, { isTemplate: false }, { archivedAt: "soon" }]) {
      await expect(
        t.run(async (ctx) => {
          await patchUnchecked(ctx, id, patch);
        }),
      ).rejects.toThrow(/Validator error/);
    }
    const row = await t.run(async (ctx) => await ctx.db.get(id));
    expect(row ?? {}).not.toHaveProperty("kind");
    expect(row ?? {}).not.toHaveProperty("isTemplate");
    expect(row ?? {}).not.toHaveProperty("archivedAt");
  });

  test("tasks.sourceNoteId refuses a tasks id, a users id and a non-id string; sourceBlockId refuses a number", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const otherTaskId = await t.run(
      async (ctx) => await ctx.db.insert("tasks", legacyTask(a, "unrelated")),
    );
    const noteId = await t.run(async (ctx) => await ctx.db.insert("notes", legacyNote(a, "n")));
    const cases: Record<string, unknown>[] = [
      { sourceNoteId: otherTaskId, sourceBlockId: blk(1) },
      { sourceNoteId: a, sourceBlockId: blk(1) },
      { sourceNoteId: "not-an-id", sourceBlockId: blk(1) },
      { sourceNoteId: noteId, sourceBlockId: 7 },
      { sourceNoteId: null },
    ];
    for (const extra of cases) {
      await expect(
        t.run(async (ctx) => {
          await insertUnchecked(ctx, "tasks", { ...legacyTask(a, "forged"), ...extra });
        }),
      ).rejects.toThrow(/Validator error/);
    }
    expect(await countRows(t, "tasks", a)).toBe(1);
  });

  test("existing contract: body stays required and revision stays an optional number", async () => {
    const t = newTest();
    const { a } = await twoUsers(t);
    const { body: _body, ...withoutBody } = legacyNote(a, "no body");
    await expect(
      t.run(async (ctx) => {
        await insertUnchecked(ctx, "notes", withoutBody);
      }),
    ).rejects.toThrow(/Validator error/);
    await expect(
      t.run(async (ctx) => {
        await insertUnchecked(ctx, "notes", { ...legacyNote(a, "rev"), revision: "1" });
      }),
    ).rejects.toThrow(/Validator error/);
    const revision = await t.run(async (ctx) => {
      const id = await ctx.db.insert("notes", legacyNote(a, "rev ok", { revision: 3 }));
      return (await ctx.db.get(id))?.revision;
    });
    expect(revision).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Index ranges as the contract reads them (§8.1, §8.2)
// ---------------------------------------------------------------------------

/** One user's notes in every state, plus template pages in every state and another user's note. */
async function seedNotes(t: T) {
  const { a, b } = await twoUsers(t);
  await t.run(async (ctx) => {
    const insert = (row: NoteRow) => ctx.db.insert("notes", row);
    await insert(legacyNote(a, "active old", { updatedAt: NOW - 5 * DAY }));
    await insert(legacyNote(a, "active new", { updatedAt: NOW - 1 * DAY }));
    await insert(legacyNote(a, "active pinned", { pinned: true, updatedAt: NOW - 9 * DAY }));
    await insert(legacyNote(a, "quick", { kind: "quick", updatedAt: NOW - 2 * DAY }));
    await insert(legacyNote(a, "todo", { kind: "todo", updatedAt: NOW - 3 * DAY }));
    await insert(legacyNote(a, "archived old", { archivedAt: NOW - 8 * DAY }));
    await insert(legacyNote(a, "archived new", { archivedAt: NOW - 4 * DAY, kind: "quick" }));
    await insert(
      legacyNote(a, "archived then trashed", { archivedAt: NOW - 6 * DAY, deletedAt: NOW - 1 * DAY }),
    );
    await insert(legacyNote(a, "trash boundary", { deletedAt: TRASH_FROM }));
    await insert(legacyNote(a, "trash expired", { deletedAt: TRASH_FROM - 1 }));
    await insert(legacyNote(a, "trash recent", { deletedAt: NOW - 2 * DAY }));
    // Template pages in every state. isTemplate: true sorts after undefined, so in a descending
    // range that does not fix isTemplate they would come first.
    for (let i = 0; i < 5; i += 1) {
      const template = { pageType: "template" as const, isTemplate: true as const };
      await insert(legacyNote(a, `template ${i}`, { ...template, pinned: true, updatedAt: NOW }));
      await insert(legacyNote(a, `template archived ${i}`, { ...template, archivedAt: NOW }));
      await insert(legacyNote(a, `template trashed ${i}`, { ...template, deletedAt: NOW }));
    }
    await insert(legacyNote(b, "b active"));
    await insert(legacyNote(b, "b trashed", { deletedAt: NOW - DAY }));
  });
  return { a, b };
}

const titles = (rows: Doc<"notes">[]) => rows.map((row) => row.title);

describe("note feed and trash ranges (§8.1)", () => {
  test("Active: owner, live, not a template, not archived; pinned first, then newest updatedAt", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    const page = await t.run(async (ctx) =>
      ctx.db
        .query("notes")
        .withIndex(FEED, (q) =>
          q
            .eq("userId", a)
            .eq("deletedAt", undefined)
            .eq("isTemplate", undefined)
            .eq("archivedAt", undefined),
        )
        .order("desc")
        .take(50),
    );
    expect(titles(page)).toEqual(["active pinned", "active new", "quick", "todo", "active old"]);
  });

  test("Active + kind: kind undefined selects 'note'; quick and todo select their own rows", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    const byKind = await t.run(async (ctx) => {
      const read = (kind: "quick" | "todo" | undefined) =>
        ctx.db
          .query("notes")
          .withIndex(FEED_KIND, (q) =>
            q
              .eq("userId", a)
              .eq("deletedAt", undefined)
              .eq("isTemplate", undefined)
              .eq("archivedAt", undefined)
              .eq("kind", kind),
          )
          .order("desc")
          .take(50);
      return {
        note: titles(await read(undefined)),
        quick: titles(await read("quick")),
        todo: titles(await read("todo")),
      };
    });
    expect(byKind).toEqual({
      note: ["active pinned", "active new", "active old"],
      quick: ["quick"],
      todo: ["todo"],
    });
  });

  test("Archived: live archived notes only, newest archivedAt first; trashed and template rows excluded", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    const page = await t.run(async (ctx) =>
      ctx.db
        .query("notes")
        .withIndex(FEED, (q) =>
          q
            .eq("userId", a)
            .eq("deletedAt", undefined)
            .eq("isTemplate", undefined)
            .gte("archivedAt", 0),
        )
        .order("desc")
        .take(50),
    );
    expect(titles(page)).toEqual(["archived new", "archived old"]);
  });

  test("Trash: inclusive 30-day boundary, newest deletedAt first, archived-then-trashed included; older rows hidden, not erased", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    const { page, expired } = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("notes")
        .withIndex(TRASH, (q) =>
          q.eq("userId", a).eq("isTemplate", undefined).gte("deletedAt", TRASH_FROM),
        )
        .order("desc")
        .take(50);
      const all = await ctx.db
        .query("notes")
        .withIndex("by_userId", (q) => q.eq("userId", a))
        .collect();
      return { page: rows, expired: all.filter((row) => row.title === "trash expired") };
    });
    expect(titles(page)).toEqual(["archived then trashed", "trash recent", "trash boundary"]);
    expect(page.find((row) => row.title === "archived then trashed")?.archivedAt).toBe(NOW - 6 * DAY);
    expect(expired).toHaveLength(1);
    expect(expired[0].deletedAt).toBe(TRASH_FROM - 1);
  });

  test("template pages are excluded by the index prefix: an unfixed range reads them first, a fixed one never", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    const { unfixed, fixed, archived, trash } = await t.run(async (ctx) => ({
      unfixed: await ctx.db
        .query("notes")
        .withIndex(FEED, (q) => q.eq("userId", a).eq("deletedAt", undefined))
        .order("desc")
        .take(3),
      fixed: await ctx.db
        .query("notes")
        .withIndex(FEED, (q) =>
          q.eq("userId", a).eq("deletedAt", undefined).eq("isTemplate", undefined),
        )
        .order("desc")
        .take(3),
      archived: await ctx.db
        .query("notes")
        .withIndex(FEED, (q) =>
          q.eq("userId", a).eq("deletedAt", undefined).eq("isTemplate", undefined).gte("archivedAt", 0),
        )
        .take(50),
      trash: await ctx.db
        .query("notes")
        .withIndex(TRASH, (q) => q.eq("userId", a).eq("isTemplate", undefined).gte("deletedAt", 0))
        .take(50),
    }));
    expect(unfixed.every((row) => row.isTemplate === true)).toBe(true);
    expect(fixed.some((row) => row.isTemplate !== undefined)).toBe(false);
    expect(fixed).toHaveLength(3);
    for (const rows of [archived, trash]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row.isTemplate !== undefined || row.pageType === "template")).toBe(false);
    }
  });

  test("the declared field order is enforced: a feed range cannot skip isTemplate", async () => {
    const t = newTest();
    const { a } = await seedNotes(t);
    await expect(
      t.run(async (ctx) => {
        await ctx.db
          .query("notes")
          // biome-ignore lint/suspicious/noExplicitAny: deliberately builds an out-of-order range.
          .withIndex(FEED, (q: any) => q.eq("userId", a).eq("deletedAt", undefined).eq("archivedAt", undefined))
          .take(1);
      }),
    ).rejects.toThrow(/expected "isTemplate"/);
    await expect(
      t.run(async (ctx) => {
        // biome-ignore lint/suspicious/noExplicitAny: an index the schema does not declare.
        await (ctx.db.query("notes") as any).withIndex("by_userId_archivedAt", (q: any) => q).take(1);
      }),
    ).rejects.toThrow(/not declared in the schema/);
  });
});

describe("task link and TODO ranges (§8.2)", () => {
  async function seedLinks(t: T) {
    const { a, b } = await twoUsers(t);
    return await t.run(async (ctx) => {
      const noteId = await ctx.db.insert("notes", legacyNote(a, "todo note", { kind: "todo" }));
      const otherNoteId = await ctx.db.insert("notes", legacyNote(a, "other note"));
      const bNoteId = await ctx.db.insert("notes", legacyNote(b, "b note", { kind: "todo" }));
      const link = (n: number, extra: Partial<TaskRow> = {}) =>
        ctx.db.insert(
          "tasks",
          legacyTask(a, `linked ${n}`, { sourceNoteId: noteId, sourceBlockId: blk(n), ...extra }),
        );
      // Inserted out of block order on purpose.
      await link(3);
      await link(1, { status: "done", completedAt: NOW - DAY });
      await link(2);
      // 120 removed linked tasks on the same note, including one for block 1 (a removed ghost
      // whose block has a live row) and the rest for blocks that no live row holds.
      await link(1, { deletedAt: NOW - 200 * DAY });
      for (let i = 0; i < 119; i += 1) {
        await link(10 + (i % 80), { deletedAt: NOW - (i + 1) * 60_000 });
      }
      await ctx.db.insert(
        "tasks",
        legacyTask(a, "other note link", { sourceNoteId: otherNoteId, sourceBlockId: blk(1) }),
      );
      await ctx.db.insert("tasks", legacyTask(a, "unlinked"));
      // Another owner's row pointing at A's note id must never appear in A's reads.
      await ctx.db.insert(
        "tasks",
        legacyTask(b, "b forged", { sourceNoteId: noteId, sourceBlockId: blk(2) }),
      );
      await ctx.db.insert(
        "tasks",
        legacyTask(b, "b linked", { sourceNoteId: bNoteId, sourceBlockId: blk(1) }),
      );
      return { a, b, noteId };
    });
  }

  test("live read fixes deletedAt: exactly the live links, ordered by block id, with 120 removed rows on the note", async () => {
    const t = newTest();
    const { a, noteId } = await seedLinks(t);
    const live = await t.run(async (ctx) =>
      ctx.db
        .query("tasks")
        .withIndex(LINK, (q) =>
          q.eq("userId", a).eq("sourceNoteId", noteId).eq("deletedAt", undefined),
        )
        .take(51),
    );
    expect(live.map((row) => row.sourceBlockId)).toEqual([blk(1), blk(2), blk(3)]);
    expect(live.every((row) => row.deletedAt === undefined && row.userId === a)).toBe(true);
  });

  test("point read of one block takes at most two rows and finds the one live link", async () => {
    const t = newTest();
    const { a, noteId } = await seedLinks(t);
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("tasks")
        .withIndex(LINK, (q) =>
          q
            .eq("userId", a)
            .eq("sourceNoteId", noteId)
            .eq("deletedAt", undefined)
            .eq("sourceBlockId", blk(1)),
        )
        .take(2),
    );
    expect(rows.map((row) => row.title)).toEqual(["linked 1"]);
  });

  test("removed read: deletedAt >= 0, newest removal first, bounded by take", async () => {
    const t = newTest();
    const { a, noteId } = await seedLinks(t);
    const removed = await t.run(async (ctx) =>
      ctx.db
        .query("tasks")
        .withIndex(LINK, (q) => q.eq("userId", a).eq("sourceNoteId", noteId).gte("deletedAt", 0))
        .order("desc")
        .take(21),
    );
    expect(removed).toHaveLength(21);
    expect(removed.every((row) => row.deletedAt !== undefined)).toBe(true);
    const stamps = removed.map((row) => row.deletedAt ?? 0);
    expect([...stamps].sort((x, y) => y - x)).toEqual(stamps);
    expect(stamps[0]).toBe(NOW - 60_000);
  });

  test("a link range cannot skip deletedAt to reach sourceBlockId", async () => {
    const t = newTest();
    const { a, noteId } = await seedLinks(t);
    await expect(
      t.run(async (ctx) => {
        await ctx.db
          .query("tasks")
          // biome-ignore lint/suspicious/noExplicitAny: deliberately builds an out-of-order range.
          .withIndex(LINK, (q: any) => q.eq("userId", a).eq("sourceNoteId", noteId).eq("sourceBlockId", blk(1)))
          .take(2);
      }),
    ).rejects.toThrow(/expected "deletedAt"/);
  });

  test("TODO list: live rows of one status, undated first, then dueAt ascending", async () => {
    const t = newTest();
    const { a, b } = await twoUsers(t);
    const page = await t.run(async (ctx) => {
      await ctx.db.insert("tasks", legacyTask(a, "due late", { dueAt: NOW + 3 * DAY }));
      await ctx.db.insert("tasks", legacyTask(a, "undated"));
      await ctx.db.insert("tasks", legacyTask(a, "due soon", { dueAt: NOW + DAY }));
      await ctx.db.insert("tasks", legacyTask(a, "removed", { dueAt: NOW, deletedAt: NOW }));
      await ctx.db.insert("tasks", legacyTask(a, "in progress", { status: "in_progress" }));
      await ctx.db.insert("tasks", legacyTask(b, "b todo", { dueAt: NOW }));
      return await ctx.db
        .query("tasks")
        .withIndex(TODO, (q) => q.eq("userId", a).eq("deletedAt", undefined).eq("status", "todo"))
        .take(50);
    });
    expect(page.map((row) => row.title)).toEqual(["undated", "due soon", "due late"]);
  });
});

// ---------------------------------------------------------------------------
// Existing account-deletion contract (unchanged)
// ---------------------------------------------------------------------------

describe("account soft deletion with the new fields present", () => {
  test("stamps live and archived notes and linked tasks once, keeps earlier tombstones and every new field, never touches another owner", async () => {
    const t = newTest();
    const { a, b } = await twoUsers(t);
    const at = NOW;
    const { before, after, others } = await t.run(async (ctx) => {
      const noteId = await ctx.db.insert(
        "notes",
        legacyNote(a, "todo", { kind: "todo", preview: "Buy milk" }),
      );
      const ids = [
        noteId,
        await ctx.db.insert("notes", legacyNote(a, "archived", { archivedAt: NOW - DAY, kind: "quick" })),
        await ctx.db.insert(
          "notes",
          legacyNote(a, "template", { pageType: "template", isTemplate: true }),
        ),
        await ctx.db.insert(
          "notes",
          legacyNote(a, "already trashed", { archivedAt: NOW - 9 * DAY, deletedAt: NOW - 3 * DAY }),
        ),
        await ctx.db.insert(
          "tasks",
          legacyTask(a, "linked", { sourceNoteId: noteId, sourceBlockId: blk(1) }),
        ),
        await ctx.db.insert(
          "tasks",
          legacyTask(a, "linked removed", {
            sourceNoteId: noteId,
            sourceBlockId: blk(2),
            deletedAt: NOW - 2 * DAY,
          }),
        ),
      ];
      const otherIds = [
        await ctx.db.insert("notes", legacyNote(b, "b archived", { archivedAt: NOW - DAY })),
        await ctx.db.insert("tasks", legacyTask(b, "b task")),
      ];
      const snapshot = async (list: string[]) =>
        Promise.all(list.map((id) => ctx.db.get(id as Id<"notes"> | Id<"tasks">)));
      const beforeRows = await snapshot(ids);
      const otherBefore = await snapshot(otherIds);
      await softDeleteUserAccount(ctx, a, at);
      return {
        before: beforeRows,
        after: await snapshot(ids),
        others: { before: otherBefore, after: await snapshot(otherIds) },
      };
    });

    const LIFECYCLE = new Set(["deletedAt", "updatedAt"]);
    for (let i = 0; i < before.length; i += 1) {
      const was = (before[i] ?? {}) as Record<string, unknown>;
      const now = (after[i] ?? {}) as Record<string, unknown>;
      if (was.deletedAt === undefined) {
        expect(now.deletedAt).toBe(at);
        expect(now.updatedAt).toBe(at);
      } else {
        expect(now).toEqual(was);
      }
      // Every non-lifecycle field, including kind, archivedAt, isTemplate, preview and the link
      // fields, is byte-identical.
      for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
        if (!LIFECYCLE.has(key)) {
          expect(now[key]).toEqual(was[key]);
        }
      }
    }
    expect(others.after).toEqual(others.before);
  });
});
