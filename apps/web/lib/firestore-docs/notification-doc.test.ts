import { describe, expect, test } from "bun:test";
import {
  countUnread,
  markNotificationRead,
  type NotificationDoc,
  NotificationDocError,
  parseNotificationDoc,
  softDeleteNotificationDoc,
} from "./notification-doc";

const valid = (): NotificationDoc => ({
  title: "A notification",
  body: "Notification details",
  kind: "system",
  createdAt: 100,
  updatedAt: 100,
});

describe("notification documents", () => {
  test("parses a valid document and trims its text", () => {
    expect(
      parseNotificationDoc({
        ...valid(),
        title: "  A notification  ",
        body: "\nNotification details\t",
      }),
    ).toEqual(valid());
  });

  test("refuses a bad kind and an empty title or body", () => {
    expect(() =>
      parseNotificationDoc({ ...valid(), kind: "marketing" }),
    ).toThrow(new NotificationDocError("kind"));
    expect(() => parseNotificationDoc({ ...valid(), title: "  " })).toThrow(
      new NotificationDocError("title"),
    );
    expect(() => parseNotificationDoc({ ...valid(), body: "" })).toThrow(
      new NotificationDocError("body"),
    );
  });

  test("drops legacy keys and refuses an unknown key by name", () => {
    expect(
      parseNotificationDoc({
        ...valid(),
        userId: "legacy-user",
        _id: "legacy-id",
        _creationTime: 50,
      }),
    ).toEqual(valid());
    expect(() => parseNotificationDoc({ ...valid(), surprise: true })).toThrow(
      new NotificationDocError("surprise"),
    );
  });

  test("marks a notification read once without moving readAt", () => {
    const read = markNotificationRead(valid(), 200);
    expect(read).toEqual({ ...valid(), readAt: 200, updatedAt: 200 });
    expect(markNotificationRead(read, 300)).toBe(read);
  });

  test("soft deletes a notification and keeps the rest", () => {
    expect(softDeleteNotificationDoc(valid(), 200)).toEqual({
      ...valid(),
      deletedAt: 200,
      updatedAt: 200,
    });
  });

  test("counts only notifications that are neither read nor soft deleted", () => {
    expect(
      countUnread([
        valid(),
        { ...valid(), readAt: 150 },
        { ...valid(), deletedAt: 160 },
        { ...valid(), readAt: 150, deletedAt: 160 },
      ]),
    ).toBe(1);
  });
});
