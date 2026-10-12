import { describe, expect, test } from "bun:test";
import * as notes from "./notes";

/** notes.searchTitles and notes.backlinks: bounded, metadata-only link queries for the v3 editor. */
type Row = Record<string, unknown>;

function makeCtx(userId: string, rows: Row[]) {
  function chain(selected: Row[]) {
    return {
      withIndex: (_index: string, build: (q: unknown) => unknown) => {
        const filters: [string, unknown][] = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push([field, value]);
            return q;
          },
        };
        build(q);
        return chain(selected.filter((row) => filters.every(([f, v]) => row[f] === v)));
      },
      order: () => chain([...selected].sort((a, b) => (b.updatedAt as number) - (a.updatedAt as number))),
      take: async (n: number) => selected.slice(0, n),
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
  return { _id: `notes:${id}`, userId: "users:a", title, body, pinned: false, periodType: "none", createdAt: 1, updatedAt: Number(id), ...over };
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
