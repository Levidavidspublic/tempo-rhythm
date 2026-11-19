import { describe, expect, test } from "bun:test";
import { checkNoteBlockDoc, softDeleteNoteBlock, type NoteBlockDoc } from "./note-block-doc";

const common = { noteId: "note_1", position: 0, createdAt: 100, updatedAt: 100 };
const pageMeta = {
  ...common,
  type: "page-meta",
  blockId: "blk_1",
  v: 1,
  data: { pageType: "daily", tags: ["work"] },
} as const;
const task = {
  ...common,
  type: "task",
  blockId: "blk_2",
  v: 1,
  data: {
    title: "Start",
    durationMin: 15,
    status: "now",
    order: 0,
    inelastic: false,
  },
} as const;
const template = {
  ...common,
  type: "template",
  blockId: "blk_3",
  v: 1,
  data: {
    name: "Daily",
    forPageType: "daily",
    isDefault: true,
    tokens: ["today"],
    origin: "builtin",
    status: "live",
    enabled: true,
  },
} as const;

describe("note block documents", () => {
  test("accepts a valid page-meta block", () => expect(checkNoteBlockDoc(pageMeta).ok).toBe(true));
  test("accepts a valid task block", () => expect(checkNoteBlockDoc(task).ok).toBe(true));
  test("accepts a valid template block", () => expect(checkNoteBlockDoc(template).ok).toBe(true));
  test("accepts a valid broken block without blockId", () => {
    expect(
      checkNoteBlockDoc({
        ...common,
        type: "broken",
        errorCode: "malformed_json",
      }).ok
    ).toBe(true);
  });
  test("rejects the unknown userId key", () =>
    expect(checkNoteBlockDoc({ ...pageMeta, userId: "user_1" }).ok).toBe(false));
  test("rejects an unknown key inside data", () =>
    expect(checkNoteBlockDoc({ ...pageMeta, data: { ...pageMeta.data, extra: true } }).ok).toBe(
      false
    ));
  test("rejects an unknown type", () =>
    expect(checkNoteBlockDoc({ ...pageMeta, type: "event" }).ok).toBe(false));
  test("rejects a task with durationMin 0", () =>
    expect(checkNoteBlockDoc({ ...task, data: { ...task.data, durationMin: 0 } }).ok).toBe(false));
  test("soft delete sets deletedAt and keeps data unchanged", () => {
    const deleted = softDeleteNoteBlock(task as NoteBlockDoc, 200);
    expect(deleted.deletedAt).toBe(200);
    expect(deleted.updatedAt).toBe(200);
    expect("data" in deleted && deleted.data).toEqual(task.data);
  });
});
