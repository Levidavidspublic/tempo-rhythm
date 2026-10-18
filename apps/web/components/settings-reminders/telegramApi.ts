"use client";

import * as convexReact from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * The live Telegram row's Convex calls, in one place (like components/study/record/recordApi), so
 * a mounted test can stand in for them without replacing convex/react, which other test files
 * replace process-wide. The nags load only once Telegram is connected.
 */
export function useTelegramApi(connected: boolean) {
  return {
    nags: useQuery(api.nags.list, connected ? {} : "skip"),
    startLink: useMutation(api.reminders.startTelegramLink),
    unlink: useMutation(api.reminders.unlinkTelegram),
    undoUnlink: useMutation(api.reminders.undoUnlinkTelegram),
    // Through the namespace: several test files stand in for convex/react without `useAction`, and
    // a named import of a missing export fails when this module loads (bun's process-wide mocks).
    sendTest: convexReact.useAction(api.reminders.sendTest),
  };
}
