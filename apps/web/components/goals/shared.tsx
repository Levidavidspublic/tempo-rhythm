"use client";

/**
 * Pieces the v3 Goals and Projects screens share: the signed-in gate, the offline notice, the
 * states (loading, empty, error), the status badge, the segmented filter, the Undo toast and the
 * inline "add" row. Markup and classes come from docs/design/v3/screens/web/goals*.html and
 * project*.html; colour and type come from tempo.css.
 */
import { useConvexAuth, useQuery } from "convex/react";
import {
  Component,
  type FormEvent,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { UNDO_WINDOW_MS } from "@/convex/lib/softDelete";
import { formatCountdown, type GoalStatus, type ProjectStatus } from "@/lib/goals-projects";
import type { MessageKey } from "@/lib/i18n";

/** Dev-only Playwright harness (proxy.ts lets some routes open signed out there). */
export const E2E_HARNESS =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

export { UNDO_WINDOW_MS };

/**
 * Queries that call requireUser must wait for `users.getProfile` to return a row: it is null
 * while signed out and during the short race after sign-in (see ProfileReady).
 */
export function useSignedIn(): "loading" | "ready" | "signedOut" {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && profile === undefined)) return "loading";
  if (!isAuthenticated || !profile) return "signedOut";
  return "ready";
}

/** Browser connectivity; Convex keeps the last answers on screen while offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

/** Reads one query parameter once on mount and writes it back without a navigation. */
export function useQueryParam<T extends string>(
  name: string,
  fallback: T,
  accept: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(name);
    if (accept(raw)) setValue(raw);
  }, [name, accept]);
  const set = (next: T) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete(name);
    else url.searchParams.set(name, next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  return [value, set];
}

/* ------------------------------------------------------------------ */
/* Status badge (ProjectStatus): an icon plus a word, never colour alone */
/* ------------------------------------------------------------------ */

const STATUS_ICON: Record<GoalStatus | ProjectStatus, TpIconName> = {
  active: "play",
  resting: "pause",
  paused: "pause",
  done: "check",
  idea: "leaf",
};

/** Goals say Resting where projects say Paused; both use the "paused" look. */
export function StatusBadge({ kind, status }: { kind: "goal" | "project"; status: GoalStatus | ProjectStatus }) {
  const { t } = useLocale();
  const look = status === "resting" ? "paused" : status;
  const key = (kind === "goal" ? `gl.status.${status}` : `pj.status.${status}`) as MessageKey;
  return (
    <span className="tp-status" data-status={look} data-component="ProjectStatus">
      <TpIcon name={STATUS_ICON[status]} size="sm" />
      <span>{t(key)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented (toggle-group): radio keys, one tab stop                  */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelledBy: string;
  render: (option: T) => ReactNode;
}) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const nextIndex = (index + step + options.length) % options.length;
    const next = options[nextIndex] as T;
    onChange(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelectorAll<HTMLButtonElement>("[data-option]")[nextIndex]?.focus(),
    );
  };
  return (
    <div className="tp-segmented" role="radiogroup" aria-labelledby={labelledBy} data-component="Segmented">
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={option}
          type="button"
          role="radio"
          className="tp-seg__opt"
          data-option={option}
          aria-checked={value === option}
          tabIndex={value === option ? 0 : -1}
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKey(event, index)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

export function OfflineNotice({ text }: { text: string }) {
  return (
    <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">
        <span>{text}</span>
      </span>
    </output>
  );
}

/** Skeleton rows; `lead` adds the wide first bar (detail pages), `block` the chart block. */
export function StateLoading({ label, rows = 3, lead }: { label: string; rows?: number; lead?: "line" | "block" }) {
  const widths = ["tp-skeleton--w60", "tp-skeleton--w80", "tp-skeleton--w100"];
  return (
    <output className="tp-state--loading" data-component="StateLoading" aria-busy="true">
      <span className="tp-sr-only">{label}</span>
      <span className="tp-skel-list">
        {lead === "line" ? <span className="tp-skeleton tp-skeleton--w80" /> : null}
        {lead === "block" ? <span className="tp-skeleton tp-skeleton--block" /> : null}
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="tp-skel-row">
            <span className="tp-skeleton tp-skel-row__box" />
            <span className="tp-skel-row__lines">
              <span className={`tp-skeleton ${widths[i % widths.length]}`} />
              <span className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
            </span>
          </span>
        ))}
      </span>
    </output>
  );
}

export function StateEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: TpIconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="tp-state tp-state--empty" data-component="StateEmpty">
      <span className="tp-state__icon">
        <TpIcon name={icon} size="lg" />
      </span>
      <h2 className="tp-state__title">{title}</h2>
      <p className="tp-state__body">{body}</p>
      {action ? <div className="tp-state__actions">{action}</div> : null}
    </div>
  );
}

/** "Couldn't load …" + "Your data is safe." + Retry (or another way out). */
export function StateError({ title, onRetry, action }: { title: string; onRetry?: () => void; action?: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="tp-state tp-state--error" role="alert" data-component="StateError">
      <span className="tp-state__icon">
        <TpIcon name="refresh" size="lg" />
      </span>
      <h2 className="tp-state__title">{title}</h2>
      <p className="tp-state__body">{t("gx.safe")}</p>
      <div className="tp-state__actions">
        {onRetry ? (
          <button className="tp-btn tp-btn--secondary" type="button" onClick={onRetry}>
            <TpIcon name="refresh" size="sm" />
            <span>{t("gx.retry")}</span>
          </button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function SignedOutState() {
  const { t } = useLocale();
  return (
    <div className="tp-state" data-component="StateSignedOut">
      <span className="tp-state__icon">
        <TpIcon name="lock" size="lg" />
      </span>
      <p className="tp-state__body">{t("gx.signedOut")}</p>
    </div>
  );
}

type BoundaryProps = { fallback: (retry: () => void) => ReactNode; children: ReactNode };

/** A query that throws (Convex re-throws server errors in render) shows the error state. */
class Boundary extends Component<BoundaryProps & { onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return this.props.fallback(() => {
        this.setState({ failed: false });
        this.props.onRetry();
      });
    }
    return this.props.children;
  }
}

/** Retry remounts the screen, so its queries subscribe again. */
export function ScreenBoundary({ fallback, children }: BoundaryProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Boundary fallback={fallback} onRetry={() => setAttempt((n) => n + 1)}>
      <Fragment key={attempt}>{children}</Fragment>
    </Boundary>
  );
}

/* ------------------------------------------------------------------ */
/* Undo toast (sonner in the design): 5:00 countdown, Undo, Dismiss    */
/* ------------------------------------------------------------------ */

export type ToastState = {
  id: number;
  title: string;
  undoUntilMs: number;
  onUndo?: () => Promise<unknown>;
};

export function makeToast(title: string, onUndo?: () => Promise<unknown>): ToastState {
  const now = Date.now();
  return { id: now, title, undoUntilMs: now + UNDO_WINDOW_MS, onUndo };
}

export function UndoToast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const left = toast.undoUntilMs - now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onClose();
  }, [left, onClose]);

  const undo = () => {
    if (!toast.onUndo || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    toast
      .onUndo()
      .then(() => onClose())
      .catch(() => setError(true))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  return (
    <div className="tp-toast-region">
      <output className="tp-toast tp-glass" data-component="UndoToast">
        <span className="tp-toast__icon">
          <TpIcon name="check" />
        </span>
        <span className="tp-toast__text">
          <span className="tp-toast__title">{toast.title}</span>
          {toast.onUndo ? (
            <span className="tp-toast__sub">
              {t("gx.toast.sub")} <span className="tp-sr-only">{formatCountdown(UNDO_WINDOW_MS)}</span>
              <span className="tp-num tp-mono" aria-hidden="true">
                {formatCountdown(left)}
              </span>
            </span>
          ) : null}
          {error ? (
            <span className="tp-toast__sub" role="alert">
              {t("gx.toast.undoError")}
            </span>
          ) : null}
        </span>
        {toast.onUndo ? (
          <button
            className="tp-btn tp-btn--secondary tp-btn--sm"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={undo}
          >
            <TpIcon name="undo" size="sm" />
            <span>{t("gx.toast.undo")}</span>
          </button>
        ) : null}
        <button
          className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
          type="button"
          aria-label={t("gx.toast.dismiss")}
          onClick={onClose}
        >
          <TpIcon name="x" size="sm" />
        </button>
      </output>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline add row (a labelled field + Add / Cancel)                    */
/* ------------------------------------------------------------------ */

export function InlineAdd({
  id,
  label,
  onSubmit,
  onCancel,
}: {
  id: string;
  label: string;
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(false);
    onSubmit(value)
      .then(() => {
        setTitle("");
        inputRef.current?.focus();
      })
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };

  return (
    <form className="gx-add" onSubmit={submit} data-component="InlineAdd">
      <label className="tp-field" htmlFor={id}>
        <span className="tp-label">{label}</span>
        <input
          ref={inputRef}
          id={id}
          className="tp-input"
          dir="auto"
          autoComplete="off"
          placeholder={t("gx.taskPlaceholder")}
          value={title}
          aria-invalid={error || undefined}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </label>
      <button className="tp-btn tp-btn--secondary" type="submit" disabled={busy || !title.trim()} aria-busy={busy}>
        <TpIcon name="plus" size="sm" />
        <span>{t("gx.add")}</span>
      </button>
      <button className="tp-btn tp-btn--ghost" type="button" onClick={onCancel}>
        {t("gx.cancel")}
      </button>
      {error ? (
        <p className="tp-error-text" role="alert">
          {t("gx.saveError")}
        </p>
      ) : null}
    </form>
  );
}
