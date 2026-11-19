import { describe, expect, test } from "bun:test";
import {
  leaseUsedMs,
  usedMsOnUtcDay,
  validateVoiceLeaseDoc,
  type VoiceLeaseDoc,
} from "./voice-lease-doc";

const activeLease: VoiceLeaseDoc = {
  conversationId: "conversation-1",
  clientKey: "client-1",
  status: "active",
  language: "en",
  startedAt: 1_000,
  lastRenewalAt: 4_000,
  dateKey: "2026-11-19",
  utcDateKey: "2026-11-19",
  grants: 1,
  sentences: 2,
  ttsChars: 300,
  createdAt: 1_000,
  updatedAt: 4_000,
};

const endedLease: VoiceLeaseDoc = {
  ...activeLease,
  status: "ended",
  endedAt: 5_000,
  durationMs: 4_000,
  endReason: "stopped",
};

describe("voice lease documents", () => {
  test("valid active and ended leases pass", () => {
    expect(validateVoiceLeaseDoc(activeLease)).toEqual({ ok: true, doc: activeLease });
    expect(validateVoiceLeaseDoc(endedLease)).toEqual({ ok: true, doc: endedLease });
  });

  test("unknown keys and userId are refused", () => {
    expect(validateVoiceLeaseDoc({ ...activeLease, extra: true }).ok).toBe(false);
    expect(validateVoiceLeaseDoc({ ...activeLease, userId: "user-1" }).ok).toBe(false);
  });

  test("bad dates and bad enums are refused", () => {
    expect(validateVoiceLeaseDoc({ ...activeLease, utcDateKey: "2026-02-30" }).ok).toBe(false);
    expect(validateVoiceLeaseDoc({ ...activeLease, status: "paused" }).ok).toBe(false);
    expect(validateVoiceLeaseDoc({ ...activeLease, language: "fr" }).ok).toBe(false);
    expect(validateVoiceLeaseDoc({ ...endedLease, endReason: "finished" }).ok).toBe(false);
  });

  test("ended leases need end fields and active leases refuse them", () => {
    const { durationMs: _durationMs, ...endedWithoutDuration } = endedLease;
    expect(validateVoiceLeaseDoc(endedWithoutDuration).ok).toBe(false);
    expect(validateVoiceLeaseDoc({ ...activeLease, endedAt: 5_000 }).ok).toBe(false);
  });

  test("leaseUsedMs returns active elapsed time and ended duration", () => {
    expect(leaseUsedMs(activeLease)).toBe(3_000);
    expect(leaseUsedMs(endedLease)).toBe(4_000);
  });

  test("usedMsOnUtcDay sums one day and skips soft-deleted leases", () => {
    const otherDay = { ...endedLease, utcDateKey: "2026-11-20", durationMs: 10_000 };
    const deleted = { ...endedLease, durationMs: 20_000, deletedAt: 6_000 };

    expect(usedMsOnUtcDay([activeLease, endedLease, otherDay, deleted], "2026-11-19")).toBe(
      7_000
    );
  });
});
