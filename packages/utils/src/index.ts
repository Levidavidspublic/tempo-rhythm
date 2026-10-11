// @tempo/utils — shared utility exports

export {
  type BreathCycle,
  type BreathCycleStep,
  type BreathPatternConfig,
  type BreathPatternStep,
  type BreathPhase,
  type BreathworkSnapshot,
  buildBreathCycle,
  getBreathPhaseAt,
  getBreathworkSnapshot,
} from "./breathwork";

export {
  type EnergyLevel,
  type EnergySuggestion,
  type EnergySuggestionStatus,
  habitRoutineCopy,
  resolveEnergySuggestion,
} from "./habit-energy-suggestions";

/**
 * Format a Unix timestamp (ms) to a locale date string
 */
export function formatDate(ts: number, locale = "en-US"): string {
  return new Date(ts).toLocaleDateString(locale);
}

/**
 * Format a Unix timestamp (ms) to a locale time string
 */
export function formatTime(ts: number, locale = "en-US"): string {
  return new Date(ts).toLocaleTimeString(locale);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a random string ID (not cryptographically secure — use Convex IDs for DB)
 */
export function randomId(length = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Truncate a string to maxLength with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - 3)}...`;
}

export {
  type HistoryImportCoverage,
  type HistoryImportProvider,
  type HistoryImportRecord,
  type HistoryImportResult,
  MAX_HISTORY_CONTENT_CHARS,
  MAX_HISTORY_CONVERSATIONS,
  MAX_HISTORY_IMPORT_BYTES,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_RECORDS,
  MAX_HISTORY_SOURCE_ID_CHARS,
  parseHistoryImport,
} from "./historyImport";
