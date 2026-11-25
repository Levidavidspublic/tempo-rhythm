import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getFunctionName } from "convex/server";
import { makeUseNotificationList } from "./use-notification-list";

describe("useNotificationList", () => {
  test("passes the args to notifications:list and returns its result unchanged", () => {
    const marker: [] = [];
    const calls: [string, unknown][] = [];
    const useNotificationList = makeUseNotificationList((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker;
    });

    expect(useNotificationList({})).toBe(marker);
    expect(calls).toEqual([["notifications:list", {}]]);
  });

  test("passes skip to notifications:list and returns its result unchanged", () => {
    const marker: [] = [];
    const calls: [string, unknown][] = [];
    const useNotificationList = makeUseNotificationList((reference, receivedArgs) => {
      calls.push([getFunctionName(reference), receivedArgs]);
      return marker;
    });

    expect(useNotificationList("skip")).toBe(marker);
    expect(calls).toEqual([["notifications:list", "skip"]]);
  });

  test("NotificationsScreen reads the list through useNotificationList", () => {
    const source = readFileSync(
      new URL("../../../components/notifications/NotificationsScreen.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      'import { useNotificationList } from "@/lib/data/notifications/use-notification-list";'
    );
    expect(source).toContain("useNotificationList(");
    expect(source).not.toContain("useQuery(api.notifications.list");
  });
});
