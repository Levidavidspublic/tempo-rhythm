"use client";

import { useEffect, useState } from "react";

export function isUndoActive(undoUntilMs: number, now: number): boolean {
  return now < undoUntilMs;
}

export function UndoDeleteToast({
  undoUntilMs,
  onUndo,
  onExpire,
}: {
  undoUntilMs: number;
  onUndo: () => Promise<void>;
  onExpire: () => void;
}) {
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    if (isUndoing) return;

    const remaining = undoUntilMs - Date.now();
    if (remaining <= 0) {
      onExpire();
      return;
    }

    const timer = window.setTimeout(onExpire, remaining);
    return () => window.clearTimeout(timer);
  }, [isUndoing, onExpire, undoUntilMs]);

  return (
    <output
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3 shadow-soft"
    >
      <span className="text-sm text-foreground">Note removed.</span>
      <button
        type="button"
        className="min-h-11 text-sm font-medium text-primary disabled:opacity-60"
        disabled={isUndoing}
        aria-busy={isUndoing}
        onClick={() => {
          if (isUndoing) return;
          setIsUndoing(true);
          void onUndo().finally(() => setIsUndoing(false));
        }}
      >
        Undo
      </button>
    </output>
  );
}
