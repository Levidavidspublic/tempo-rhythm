import { describe, expect, test } from "bun:test";
import * as notes from "./notes";

/** notes.searchTitles and notes.backlinks: bounded, metadata-only link queries for the v3 editor. */
type Row = Record<string, unknown>;

let reads: Row[] = [];

function makeCtx(userId: string, rows: Row[]) {
  reads = [];
  function chain(selected: Row[]) {
    return {
      withIndex: (_index: string, build: (q: unknown) => unknown) => {
        const filters: ((row: Row) => boolean)[] = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push((row) => row[field] === value);
            return q;
          },
          lt(field: string, value: number) {
            filters.push((row) => (row[field] as number) < value);
            return q;
          },
          lte(field: string, value: number) {
            filters.push((row) => (row[field] as number) <= value);
            return q;
          },
        };
        build(q);
        return chain(selected.filter((row) => filters.every((f) => f(row))));
      },
      // Index order: updatedAt, then _creationTime (every Convex index ends in it).
      order: () =>
        chain(
          [...selected].sort(
            (a, b) =>
              (b.updatedAt as number) - (a.updatedAt as number) ||
              (b._creationTime as number) - (a._creationTime as number),
          ),
        ),
      take: async (n: number) => {
        const got = selected.slice(0, n);
        reads.push(...got);
        return got;
      },
      collect: async () => selected,
      first: async () => selected[0] ?? null,
      unique: async () => selected[0] ?? null,
    };
  }
  const users = [{ _id: userId, email: "maya@example.com" }];
  const all = [...users, ...rows];
  return {
    auth: { getUserIdentity: async () => ({ subject: userId }) },
    db: {
      get: async (id: string) => all.find((r) => r._id === id) ?? null,
      query: (table: string) => chain(table === "users" ? users : rows),
      normalizeId: (_t: string, id: string) => (all.some((r) => r._id === id) ? id : null),
    },
  } as never;
}

function note(id: string, title: string, body: string, over: Partial<Row> = {}): Row {
  return { _id: `notes:${id}`, _creationTime: Number(id), userId: "users:a", title, body, pinned: false, periodType: "none", createdAt: 1, updatedAt: Number(id), ...over };
}

type Handler = { _handler: (ctx: never, args: object) => Promise<Row[]> };
const search = (notes.searchTitles as unknown as Handler)._handler;
const backlinks = (notes.backlinks as unknown as Handler)._handler;

describe("notes.searchTitles", () => {
  const rows = [
    note("1", "Kitchen moving", "x"),
    note("2", "Moving checklist", "x"),
    note("3", "Moving", "x"),
    note("4", "Gone", "x", { deletedAt: 5 }),
    note("5", "Someone else's Moving", "x", { userId: "users:b" }),
    note("6", "   ", "x"),
  ];
  test("titles that start with the query come first, then contains; no bodies", async () => {
    const result = await search(makeCtx("users:a", rows), { query: "mov" });
    expect(result.map((r) => r._id)).toEqual(["notes:3", "notes:2", "notes:1"]);
    expect(Object.keys(result[0]!).sort()).toEqual(["_id", "pinned", "title", "updatedAt"]);
  });
  test("an exact title comes first even behind more recent prefix matches than the limit", async () => {
    const newer = Array.from({ length: 25 }, (_, i) => note(String(100 + i), `Moving part ${i}`, "x"));
    const result = await search(makeCtx("users:a", [...newer, note("3", " moving ", "x")]), {
      query: "Moving",
      limit: 20,
    });
    expect(result).toHaveLength(20);
    expect(result[0]?._id).toBe("notes:3");
  });
  test("an empty query lists recent titled pages, bounded by the limit", async () => {
    const result = await search(makeCtx("users:a", rows), { query: "", limit: 2 });
    expect(result.map((r) => r._id)).toEqual(["notes:3", "notes:2"]);
  });
});

describe("notes.backlinks", () => {
  const rows = [
    note("1", "Today", "Plan for the day"),
    note("2", "Week 42", "- Monday: slides, then [[today]].\nother"),
    note("3", "Alias", "> see [[Today|the day]]"),
    note("4", "Code only", "`[[Today]]` is code\n```json tempo\n{\"x\":\"[[Today]]\"}\n```\n"),
    note("5", "Deleted", "[[Today]]", { deletedAt: 9 }),
    note("6", "Other user", "[[Today]]", { userId: "users:b" }),
  ];
  test("lists live pages of the same owner that link to the title (not from code), with context", async () => {
    const result = await backlinks(makeCtx("users:a", rows), { noteId: "notes:1" });
    expect(result.map((r) => r.id)).toEqual(["notes:3", "notes:2"]);
    expect(result.find((r) => r.id === "notes:2")?.context).toBe("Monday: slides, then today.");
    expect(result.find((r) => r.id === "notes:3")?.context).toBe("see the day");
  });
  test("an unknown or foreign page has no backlinks", async () => {
    expect(await backlinks(makeCtx("users:a", rows), { noteId: "notes:404" })).toEqual([]);
    expect(await backlinks(makeCtx("users:a", rows), { noteId: "notes:6" })).toEqual([]);
  });
});

describe("link scans stay under Convex's read limit", () => {
  test("a notebook of near-1 MiB pages is read up to the byte budget, never past 16 MiB", async () => {
    const big = "x".repeat(350_000); // ~1 MiB by the 3-bytes-per-unit bound
    const rows = Array.from({ length: 40 }, (_, i) => note(String(i + 1), `Big ${i + 1}`, big));
    const result = await search(makeCtx("users:a", rows), { query: "big", limit: 20 });
    const readBytes = reads.reduce((sum, r) => sum + notes.noteSizeBound(r as never), 0);
    expect(readBytes).toBeLessThan(16 * 1024 * 1024);
    expect(reads.length).toBeLessThan(40);
    expect(result.length).toBeGreaterThan(0);
    // Newest first: the scan saw the most recent pages.
    expect(result[0]?._id).toBe("notes:40");
  });

  test("small pages are all read, up to LINK_SCAN_LIMIT, each exactly once even when updatedAt ties", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => note(String(i + 1), `Page ${i}`, "x", { updatedAt: 1000 - Math.floor(i / 50) }));
    await search(makeCtx("users:a", rows), { query: "page", limit: 20 });
    expect(reads).toHaveLength(120);
    expect(new Set(reads.map((r) => r._id)).size).toBe(120);
    const many = Array.from({ length: 700 }, (_, i) => note(String(i + 1), `P ${i}`, "x"));
    await search(makeCtx("users:a", many), { query: "p" });
    expect(reads).toHaveLength(notes.LINK_SCAN_LIMIT);
    expect(new Set(reads.map((r) => r._id)).size).toBe(notes.LINK_SCAN_LIMIT);
  });

  test("backlinks use the same bounded scan", async () => {
    const big = "[[Target]] ".repeat(30_000);
    const rows = [note("1", "Target", "self"), ...Array.from({ length: 40 }, (_, i) => note(String(i + 2), `L ${i}`, big))];
    const result = await backlinks(makeCtx("users:a", rows), { noteId: "notes:1" });
    const readBytes = reads.reduce((sum, r) => sum + notes.noteSizeBound(r as never), 0);
    expect(readBytes).toBeLessThan(16 * 1024 * 1024);
    expect(result.length).toBeGreaterThan(0);
  });
});
