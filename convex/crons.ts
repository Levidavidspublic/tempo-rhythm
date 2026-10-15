import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * TEMPO-B06-SUPPORT-PAGE-CLEANUP (#883) — the only scheduled job in this app.
 *
 * Every five minutes it runs the bounded, idempotent cleanup in `convex/pageCleanup.ts`, which
 * expires due page-operation fragments and proposal content and removes content-free receipts
 * once nothing still needs them. The cron passes no arguments; the job reads every deadline
 * from the rows. A missed or delayed tick is fully caught up by the next one.
 */
const crons = cronJobs();

crons.interval("expire transient page payloads", { minutes: 5 }, internal.pageCleanup.runBatch, {});

export default crons;
