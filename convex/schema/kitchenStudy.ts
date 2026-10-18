import { planTables } from "./plans";
import { recordingTables } from "./recordings";
import { reminderTables } from "./reminders";
import { studyTables } from "./study";
import { studyVoiceTables } from "./studyVoice";

/**
 * Every table the kitchen study and planning run adds, gathered here so `convex/schema.ts` takes
 * them with one import and one spread line (the parallel run edits that file too).
 */
export const kitchenStudyTables = {
  ...studyTables,
  ...planTables,
  ...recordingTables,
  ...studyVoiceTables,
  ...reminderTables,
};
