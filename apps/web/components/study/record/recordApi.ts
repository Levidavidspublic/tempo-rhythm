"use client";

// A namespace import: test files swap convex/react module mocks, and a named import of a hook that
// another file's mock lacks would stop this module from linking.
import * as convexReact from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * The recordings backend as hooks, in one place (convex/recordings.ts). RecordSession and its live
 * words hook call these; tests replace this one module instead of convex/react.
 */
export function useRecordingAvailability(lang: "en" | "he") {
  return convexReact.useQuery(api.recordings.availability, { lang });
}

export function useRecordingSave() {
  return {
    propose: convexReact.useAction(api.recordings.proposeFromTranscript),
    saveSession: convexReact.useMutation(api.recordings.saveSession),
    undoSave: convexReact.useMutation(api.recordings.undoSave),
  };
}

export function useRecordingLease() {
  return {
    startLease: convexReact.useMutation(api.recordings.start),
    renewLease: convexReact.useMutation(api.recordings.renew),
    stopLease: convexReact.useMutation(api.recordings.stop),
    grant: convexReact.useAction(api.recordings.grant),
  };
}
