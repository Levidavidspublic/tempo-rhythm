/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as ai_smoke from "../ai_smoke.js";
import type * as analytics from "../analytics.js";
import type * as approval from "../approval.js";
import type * as auth from "../auth.js";
import type * as brain_dump from "../brain_dump.js";
import type * as calendar_events from "../calendar_events.js";
import type * as chat from "../chat.js";
import type * as coach from "../coach.js";
import type * as conversations from "../conversations.js";
import type * as crisis from "../crisis.js";
import type * as dayPlans from "../dayPlans.js";
import type * as focusBlocks from "../focusBlocks.js";
import type * as goals from "../goals.js";
import type * as habitCheckIns from "../habitCheckIns.js";
import type * as habits from "../habits.js";
import type * as http from "../http.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_aiGate from "../lib/aiGate.js";
import type * as lib_ai_errors from "../lib/ai_errors.js";
import type * as lib_ai_router from "../lib/ai_router.js";
import type * as lib_approval from "../lib/approval.js";
import type * as lib_brainDumpInput from "../lib/brainDumpInput.js";
import type * as lib_brainDumpParse from "../lib/brainDumpParse.js";
import type * as lib_coachLoad from "../lib/coachLoad.js";
import type * as lib_crisisWords from "../lib/crisisWords.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_habitCheckInStreak from "../lib/habitCheckInStreak.js";
import type * as lib_habitStreak from "../lib/habitStreak.js";
import type * as lib_insights_summary from "../lib/insights_summary.js";
import type * as lib_memoryImport from "../lib/memoryImport.js";
import type * as lib_mcp_dates from "../lib/mcp/dates.js";
import type * as lib_mcp_dispatch from "../lib/mcp/dispatch.js";
import type * as lib_mcp_jsonrpc from "../lib/mcp/jsonrpc.js";
import type * as lib_mcp_origin from "../lib/mcp/origin.js";
import type * as lib_mcp_schema from "../lib/mcp/schema.js";
import type * as lib_mcp_token from "../lib/mcp/token.js";
import type * as lib_mcp_tools from "../lib/mcp/tools.js";
import type * as lib_nagPhrase from "../lib/nagPhrase.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as lib_revenuecat_events from "../lib/revenuecat_events.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_subscriptionGuards from "../lib/subscriptionGuards.js";
import type * as lib_taskChecklists from "../lib/taskChecklists.js";
import type * as lib_taskRepeat from "../lib/taskRepeat.js";
import type * as lib_task_filters from "../lib/task_filters.js";
import type * as lib_templateCatalog from "../lib/templateCatalog.js";
import type * as lib_testFakeCtx from "../lib/testFakeCtx.js";
import type * as memories from "../memories.js";
import type * as mcp from "../mcp.js";
import type * as mcpHttp from "../mcpHttp.js";
import type * as mcpTools from "../mcpTools.js";
import type * as memory from "../memory.js";
import type * as memoryImport from "../memoryImport.js";
import type * as messages from "../messages.js";
import type * as nags from "../nags.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as preferences from "../preferences.js";
import type * as revenuecat from "../revenuecat.js";
import type * as search from "../search.js";
import type * as streaks from "../streaks.js";
import type * as tasks from "../tasks.js";
import type * as templates from "../templates.js";
import type * as timeBlocks from "../timeBlocks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  ai_smoke: typeof ai_smoke;
  analytics: typeof analytics;
  approval: typeof approval;
  auth: typeof auth;
  brain_dump: typeof brain_dump;
  calendar_events: typeof calendar_events;
  chat: typeof chat;
  coach: typeof coach;
  conversations: typeof conversations;
  crisis: typeof crisis;
  dayPlans: typeof dayPlans;
  focusBlocks: typeof focusBlocks;
  goals: typeof goals;
  habitCheckIns: typeof habitCheckIns;
  habits: typeof habits;
  http: typeof http;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/aiGate": typeof lib_aiGate;
  "lib/ai_errors": typeof lib_ai_errors;
  "lib/ai_router": typeof lib_ai_router;
  "lib/approval": typeof lib_approval;
  "lib/brainDumpInput": typeof lib_brainDumpInput;
  "lib/brainDumpParse": typeof lib_brainDumpParse;
  "lib/coachLoad": typeof lib_coachLoad;
  "lib/crisisWords": typeof lib_crisisWords;
  "lib/entitlements": typeof lib_entitlements;
  "lib/habitCheckInStreak": typeof lib_habitCheckInStreak;
  "lib/habitStreak": typeof lib_habitStreak;
  "lib/insights_summary": typeof lib_insights_summary;
  "lib/memoryImport": typeof lib_memoryImport;
  "lib/mcp/dates": typeof lib_mcp_dates;
  "lib/mcp/dispatch": typeof lib_mcp_dispatch;
  "lib/mcp/jsonrpc": typeof lib_mcp_jsonrpc;
  "lib/mcp/origin": typeof lib_mcp_origin;
  "lib/mcp/schema": typeof lib_mcp_schema;
  "lib/mcp/token": typeof lib_mcp_token;
  "lib/mcp/tools": typeof lib_mcp_tools;
  "lib/nagPhrase": typeof lib_nagPhrase;
  "lib/requireUser": typeof lib_requireUser;
  "lib/revenuecat_events": typeof lib_revenuecat_events;
  "lib/softDelete": typeof lib_softDelete;
  "lib/subscriptionGuards": typeof lib_subscriptionGuards;
  "lib/taskChecklists": typeof lib_taskChecklists;
  "lib/taskRepeat": typeof lib_taskRepeat;
  "lib/task_filters": typeof lib_task_filters;
  "lib/templateCatalog": typeof lib_templateCatalog;
  "lib/testFakeCtx": typeof lib_testFakeCtx;
  mcp: typeof mcp;
  mcpHttp: typeof mcpHttp;
  mcpTools: typeof mcpTools;
  memories: typeof memories;
  memory: typeof memory;
  memoryImport: typeof memoryImport;
  messages: typeof messages;
  nags: typeof nags;
  notes: typeof notes;
  notifications: typeof notifications;
  preferences: typeof preferences;
  revenuecat: typeof revenuecat;
  search: typeof search;
  streaks: typeof streaks;
  tasks: typeof tasks;
  templates: typeof templates;
  timeBlocks: typeof timeBlocks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
