import { describe, expect, test } from "bun:test";

import { mergeSaveStatus, readSaveStatus } from "./save-status";

describe("readSaveStatus", () => {
  test("is loading before the first snapshot", () => {
    expect(
      readSaveStatus({
        hasSnapshot: false,
        hasPendingWrites: false,
        fromCache: false,
        online: true,
      })
    ).toEqual({ state: "loading", copyKey: "fs.save.loading" });
  });

  test("is saving while online writes are pending", () => {
    expect(
      readSaveStatus({ hasSnapshot: true, hasPendingWrites: true, fromCache: false, online: true })
    ).toEqual({ state: "saving", copyKey: "fs.save.saving" });
  });

  test("is saved when no writes are pending", () => {
    expect(
      readSaveStatus({ hasSnapshot: true, hasPendingWrites: false, fromCache: false, online: true })
    ).toEqual({ state: "saved", copyKey: "fs.save.saved" });
  });

  test("is saved on this device while offline writes are pending", () => {
    expect(
      readSaveStatus({ hasSnapshot: true, hasPendingWrites: true, fromCache: true, online: false })
    ).toEqual({ state: "on-device", copyKey: "fs.save.on-device" });
  });

  test("is saved for a cached snapshot when no writes are pending", () => {
    expect(
      readSaveStatus({ hasSnapshot: true, hasPendingWrites: false, fromCache: true, online: false })
    ).toEqual({ state: "saved", copyKey: "fs.save.saved" });
  });
});

describe("mergeSaveStatus", () => {
  test("picks the worst status and treats an empty list as loading", () => {
    const saved = readSaveStatus({
      hasSnapshot: true,
      hasPendingWrites: false,
      fromCache: false,
      online: true,
    });
    const loading = readSaveStatus({
      hasSnapshot: false,
      hasPendingWrites: false,
      fromCache: false,
      online: true,
    });
    const saving = readSaveStatus({
      hasSnapshot: true,
      hasPendingWrites: true,
      fromCache: false,
      online: true,
    });
    const onDevice = readSaveStatus({
      hasSnapshot: true,
      hasPendingWrites: true,
      fromCache: true,
      online: false,
    });

    expect(mergeSaveStatus([saved, loading, saving, onDevice])).toEqual(onDevice);
    expect(mergeSaveStatus([])).toEqual({ state: "loading", copyKey: "fs.save.loading" });
  });
});
