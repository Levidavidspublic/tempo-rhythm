import { describe, expect, mock, test } from "bun:test";
import { readDeletedAccountState, signOutDeletedAccount } from "./accountDeleted";

describe("signOutDeletedAccount", () => {
  test("a failed sign-out is kept for the retry, and a later success leaves", async () => {
    const leave = mock(() => {});
    await signOutDeletedAccount(async () => {
      throw new Error("network");
    }, leave);
    expect(leave).not.toHaveBeenCalled();
    expect(readDeletedAccountState()).toBe("signOutFailed");

    let during = "";
    await signOutDeletedAccount(async () => {
      during = readDeletedAccountState();
    }, leave);
    expect(during).toBe("signingOut");
    expect(leave).toHaveBeenCalledTimes(1);
    expect(readDeletedAccountState()).toBe("none");
  });
});
