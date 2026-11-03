/** Minutes in a local day. Layout never paints outside this range. */
export const DAY_MINUTES = 1440;

/** Shortest block or event the timeline will draw. */
export const MIN_RENDERED_MINUTES = 15;

/**
 * Local clock minute (0-1439) of an instant. The hour grid, now marker and time
 * blocks all use local clock minutes, so events must too: elapsed time since
 * midnight drifts by an hour after a DST change.
 */
export function localMinuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export type TimelineLayoutInput = {
  id: string;
  kind: string;
  startMinute: number;
  durationMinutes: number;
};

export type TimelineLayoutItem = {
  id: string;
  kind: string;
  startMinute: number;
  durationMinutes: number;
  top: number;
  height: number;
  column: number;
  columns: number;
};

type Placed = TimelineLayoutItem & { end: number };

function clampedRange(
  startMinute: number,
  durationMinutes: number
): { start: number; end: number } | null {
  if (!Number.isFinite(startMinute) || !Number.isFinite(durationMinutes)) return null;

  const rawEnd = startMinute + Math.max(0, durationMinutes);
  if (rawEnd <= 0 || startMinute >= DAY_MINUTES) return null;

  let start = Math.max(0, startMinute);
  let end = Math.min(DAY_MINUTES, Math.max(start, rawEnd));

  if (end - start < MIN_RENDERED_MINUTES) {
    if (start + MIN_RENDERED_MINUTES <= DAY_MINUTES) {
      end = start + MIN_RENDERED_MINUTES;
    } else {
      start = DAY_MINUTES - MIN_RENDERED_MINUTES;
      end = DAY_MINUTES;
    }
  }

  if (end <= start) return null;
  return { start, end };
}

/**
 * Place blocks and events on a 24-hour day.
 * `top` and `height` are minutes from local midnight.
 * Overlapping items share a column count and sit side by side.
 */
export function layoutItems(items: readonly TimelineLayoutInput[]): TimelineLayoutItem[] {
  const placed: Placed[] = [];

  for (const item of items) {
    const range = clampedRange(item.startMinute, item.durationMinutes);
    if (!range) continue;
    const height = range.end - range.start;
    placed.push({
      id: item.id,
      kind: item.kind,
      startMinute: range.start,
      durationMinutes: height,
      top: range.start,
      height,
      column: 0,
      columns: 1,
      end: range.end,
    });
  }

  placed.sort((a, b) => a.startMinute - b.startMinute || a.end - b.end || a.id.localeCompare(b.id));

  const columnEnds: number[] = [];
  for (const item of placed) {
    let column = columnEnds.findIndex((end) => end <= item.startMinute);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    item.column = column;
  }

  let clusterFrom = 0;
  let clusterEnd = -1;
  const clusters: Array<{ from: number; to: number }> = [];

  for (let index = 0; index < placed.length; index += 1) {
    const item = placed[index];
    if (!item) continue;
    if (index === 0) {
      clusterEnd = item.end;
      continue;
    }
    if (item.startMinute >= clusterEnd) {
      clusters.push({ from: clusterFrom, to: index });
      clusterFrom = index;
      clusterEnd = item.end;
    } else {
      clusterEnd = Math.max(clusterEnd, item.end);
    }
  }
  if (placed.length > 0) clusters.push({ from: clusterFrom, to: placed.length });

  for (const cluster of clusters) {
    let columns = 1;
    for (let index = cluster.from; index < cluster.to; index += 1) {
      const item = placed[index];
      if (item) columns = Math.max(columns, item.column + 1);
    }
    for (let index = cluster.from; index < cluster.to; index += 1) {
      const item = placed[index];
      if (item) item.columns = columns;
    }
  }

  return placed.map((item) => ({
    id: item.id,
    kind: item.kind,
    startMinute: item.startMinute,
    durationMinutes: item.durationMinutes,
    top: item.top,
    height: item.height,
    column: item.column,
    columns: item.columns,
  }));
}
