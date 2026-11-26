/**
 * UndoToast (components.md: sonner, 5:00 countdown, Undo button). One toast at a time; the
 * countdown is real and the toast leaves when the window closes. Undo calls the screen's restore.
 */
import { Check, X } from "lucide-react-native";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UNDO_MS, undoCountdown } from "@/lib/v3/undo";
import { usePrefs, useT } from "./prefs";
import { Button, RADIUS, Row, T } from "./primitives";
import { useNow } from "./session";

export type ToastInput = {
  title: string;
  /** Called by Undo while the window is open. Leave out for a plain note with no Undo. */
  onUndo?: () => unknown;
  /** How long the toast stays: the Undo window by default, 6 s for a plain note. */
  ms?: number;
};

type ToastState = ToastInput & { id: number; startedAt: number; windowMs: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => undefined);

export function useToast(): (toast: ToastInput) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children, bottomOffset = 88 }: { children: ReactNode; bottomOffset?: number }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const show = useCallback((input: ToastInput) => {
    seq.current += 1;
    setToast({ ...input, id: seq.current, startedAt: Date.now(), windowMs: input.ms ?? (input.onUndo ? UNDO_MS : 6000) });
    AccessibilityInfo.announceForAccessibility(input.title);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} bottomOffset={bottomOffset} onClose={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, bottomOffset, onClose }: { toast: ToastState; bottomOffset: number; onClose: () => void }) {
  const t = useT("tasks");
  const p = usePrefs();
  const c = p.colors;
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const left = undoCountdown(toast.startedAt, now, toast.windowMs);
  const [busy, setBusy] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);

  useEffect(() => {
    if (left === null) onClose();
  }, [left, onClose]);

  const undo = async () => {
    if (!toast.onUndo || busy) return;
    setBusy(true);
    setUndoFailed(false);
    try {
      await toast.onUndo();
    } catch {
      // The change is still in place: keep the toast, and its Undo, for another try.
      setBusy(false);
      setUndoFailed(true);
      return;
    }
    onClose();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + bottomOffset, alignItems: "center" }}
    >
      <Row
        style={{
          alignItems: "center",
          gap: 12,
          minHeight: 56,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: RADIUS.lg,
          backgroundColor: c.glassSolid,
          borderWidth: 1,
          borderColor: c.line,
          maxWidth: 520,
          alignSelf: "stretch",
          shadowColor: c.ink,
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <Check size={18} color={c.done} />
        <View style={{ flex: 1 }} accessible accessibilityLiveRegion="polite">
          <T size="sm" weight="600" snug>
            {toast.title}
          </T>
          {undoFailed ? (
            <T size="xs" tone="muted" snug>
              {t("toast.undoFailed")}
            </T>
          ) : null}
          {toast.onUndo && left ? (
            <T size="xs" tone="muted" snug>
              {`${t("toast.sub")} `}
              <T size="xs" tone="muted" ltr mono>
                {left}
              </T>
            </T>
          ) : null}
        </View>
        {toast.onUndo ? <Button small variant="ghost" label={t("toast.undo")} onPress={undo} disabled={busy} /> : null}
        <Button small variant="ghost" iconOnly icon={X} accessibilityLabel={t("toast.dismiss")} onPress={onClose} />
      </Row>
    </View>
  );
}
