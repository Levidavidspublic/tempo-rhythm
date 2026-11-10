/** Integer 0–10. NaN and other non-finite values become the midpoint, 5. */
export function clampDial(n: number): number {
  const rounded = Math.round(n);
  if (!Number.isFinite(rounded)) return 5;
  return Math.min(10, Math.max(0, rounded));
}

/** 0–3 Gentle, 4–6 Steady, 7–10 Firm. Out-of-range values are clamped first. */
export function dialLabel(n: number): "Gentle" | "Steady" | "Firm" {
  const dial = clampDial(n);
  if (dial <= 3) return "Gentle";
  if (dial <= 6) return "Steady";
  return "Firm";
}

/** Whole minutes remaining until `panicUntil`. Never negative. Partial minutes round up. */
export function panicMinutesLeft(panicUntil: number | null, now: number): number {
  if (panicUntil === null || !Number.isFinite(panicUntil) || !Number.isFinite(now)) return 0;
  const remainingMs = panicUntil - now;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 60_000);
}

export type DialFlight = {
  inFlight: number | null;
  pending: number | null;
};

export type DialRelease =
  | { action: "ignore" }
  | { action: "save"; value: number }
  | { action: "queue"; value: number };

/**
 * What a slider release should do.
 * A value released while a save is in flight is queued (latest wins).
 * Releasing the in-flight value again drops the queue.
 */
export function releaseDial(flight: DialFlight, raw: number, persisted: number): {
  flight: DialFlight;
  release: DialRelease;
} {
  const value = clampDial(raw);
  const current = clampDial(persisted);
  if (flight.inFlight === null) {
    if (value === current) {
      return { flight: { inFlight: null, pending: null }, release: { action: "ignore" } };
    }
    return {
      flight: { inFlight: value, pending: null },
      release: { action: "save", value },
    };
  }
  if (value === flight.inFlight) {
    return {
      flight: { inFlight: flight.inFlight, pending: null },
      release: { action: "ignore" },
    };
  }
  return {
    flight: { inFlight: flight.inFlight, pending: value },
    release: { action: "queue", value },
  };
}

export type DialSettled = {
  flight: DialFlight;
  /** True only when this save is still the value the slider shows. */
  flashSaved: boolean;
  /** Failure of the latest attempt: put the slider back on the previous dial. */
  revertDraft: boolean;
  save: number | null;
};

/**
 * After a dial save finishes. A newer pending value is saved next.
 * Saved is withheld when the slider (or a queued release) has moved on.
 */
export function settleDialSave(
  flight: DialFlight,
  completed: number,
  ok: boolean,
  shown: number | null,
): DialSettled {
  const pending = flight.pending;
  const newer = pending !== null && pending !== completed;
  const nextFlight: DialFlight = newer
    ? { inFlight: pending, pending: null }
    : { inFlight: null, pending: null };
  if (!ok) {
    return {
      flight: nextFlight,
      flashSaved: false,
      revertDraft: !newer,
      save: newer ? pending : null,
    };
  }
  const showing = shown === null ? completed : clampDial(shown);
  return {
    flight: nextFlight,
    flashSaved: !newer && showing === completed,
    revertDraft: false,
    save: newer ? pending : null,
  };
}
