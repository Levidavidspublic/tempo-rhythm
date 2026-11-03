import { fillTemplate } from "./habits-view";
import { type Lang, translate } from "./i18n";
import { intlLocale } from "./you/screenState";

export type TrackingSessionLog = {
  id: string;
  completedAt: number;
  durationMinutes: number;
  intention: string;
};

type CompleteSessionInput = {
  completedAt: number;
  durationMinutes: number;
  intention: string;
};

export type TrackingChartPoint = {
  day: string;
  sessions: number;
  minutes: number;
};

export type TrackingDashboard = {
  enso: {
    value: number;
    max: number;
    label: string;
  };
  chart: {
    dataSource: "session-logs";
    points: TrackingChartPoint[];
    placeholderDetected: false;
  };
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toUtcDay(timestamp: number): string {
  return dayFormatter.format(new Date(timestamp));
}

function logIdFor(input: CompleteSessionInput, index: number): string {
  return `session-${input.completedAt}-${index}`;
}

function calculateCurrentStreak(logs: TrackingSessionLog[]): number {
  const days = Array.from(new Set(logs.map((log) => toUtcDay(log.completedAt)))).sort();
  if (days.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = days.length - 1; index > 0; index -= 1) {
    const current = Date.parse(`${days[index]}T00:00:00.000Z`);
    const previous = Date.parse(`${days[index - 1]}T00:00:00.000Z`);
    const daysApart = Math.round((current - previous) / 86_400_000);
    if (daysApart !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export function trackingLogsStorageKey(userId: string): string {
  return `tempo.tracking.logs:v1:${userId}`;
}

export function parseTrackingLogs(raw: string | null): TrackingSessionLog[] {
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const logs: TrackingSessionLog[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.completedAt !== "number" ||
      typeof row.durationMinutes !== "number" ||
      typeof row.intention !== "string" ||
      !Number.isFinite(row.completedAt) ||
      !Number.isFinite(row.durationMinutes)
    ) {
      continue;
    }
    logs.push({
      id: row.id,
      completedAt: row.completedAt,
      durationMinutes: row.durationMinutes,
      intention: row.intention,
    });
  }
  return logs;
}

export function completeTrackingSession(logs: TrackingSessionLog[], input: CompleteSessionInput) {
  const createdLog = {
    id: logIdFor(input, logs.length + 1),
    completedAt: input.completedAt,
    durationMinutes: input.durationMinutes,
    intention: input.intention.trim(),
  };
  const nextLogs = [...logs, createdLog].sort((a, b) => a.completedAt - b.completedAt);

  return {
    logs: nextLogs,
    createdLog,
    streakCount: calculateCurrentStreak(nextLogs),
  };
}

export function buildTrackingDashboard(logs: TrackingSessionLog[]): TrackingDashboard {
  const pointsByDay = new Map<string, TrackingChartPoint>();
  for (const log of logs) {
    const day = toUtcDay(log.completedAt);
    const existing = pointsByDay.get(day);
    if (existing) {
      pointsByDay.set(day, {
        day,
        sessions: existing.sessions + 1,
        minutes: existing.minutes + log.durationMinutes,
      });
      continue;
    }
    pointsByDay.set(day, {
      day,
      sessions: 1,
      minutes: log.durationMinutes,
    });
  }

  const points = Array.from(pointsByDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  const streakCount = calculateCurrentStreak(logs);

  return {
    enso: {
      value: streakCount,
      max: 7,
      label: `${streakCount}-day streak`,
    },
    chart: {
      dataSource: "session-logs",
      points,
      placeholderDetected: false,
    },
  };
}

/** "1 minute" / "25 minutes"; Hebrew "דקה אחת" / "25 דקות". */
export function formatSessionMinutes(minutes: number, lang: Lang = "en"): string {
  if (minutes === 1) {
    return translate(lang, "track.minute.one");
  }
  return fillTemplate(translate(lang, "track.minutes"), { n: minutes });
}

/** "1 block" / "3 blocks"; Hebrew "בלוק אחד" / "3 בלוקים". */
export function formatBlockCount(blocks: number, lang: Lang = "en"): string {
  if (blocks === 1) {
    return translate(lang, "track.block.one");
  }
  return fillTemplate(translate(lang, "track.blocks"), { n: blocks });
}

const LOCAL_DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Display label for a local day key (`YYYY-MM-DD`, still the data key): "Fri 16 Oct" in English,
 * "יום ו׳, 16 באוק׳" in Hebrew. An unreadable key is shown as written.
 */
export function formatTrackingDay(dayKey: string, lang: Lang = "en"): string {
  const ms = LOCAL_DAY_KEY.test(dayKey) ? Date.parse(`${dayKey}T00:00:00.000Z`) : Number.NaN;
  if (Number.isNaN(ms)) {
    return dayKey;
  }
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(ms));
}
