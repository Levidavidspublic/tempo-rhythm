"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import {
  LiveMessage,
  RetryRoot,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useLoadingTimeout,
} from "@/components/you/ScreenStates";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { splitByToday } from "@/lib/you/feeds";
import { deriveScreenState, intlLocale } from "@/lib/you/screenState";

/**
 * Notifications (docs/design/v3/screens/web/notifications.html): newest first, Today and
 * Earlier. Opening an unread notice marks it read; "Mark all read" marks the rest. Nothing is
 * deleted. The "notifications-page" test id and the "Mark all read" button are e2e contracts.
 */

type Notice = {
  _id: Id<"notifications">;
  title: string;
  body: string;
  kind: "system" | "reminder" | "billing";
  readAt?: number;
  createdAt: number;
};

const KIND_ICON: Record<Notice["kind"], TpIconName> = {
  system: "info",
  reminder: "bell",
  billing: "card",
};

function NoticesHead({ action }: { action?: ReactNode }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("nt.title")}</h1>
        <p className="tp-pagehead__sub">{t("nt.sub")}</p>
      </div>
      {action ? <div className="tp-pagehead__actions">{action}</div> : null}
    </header>
  );
}

export function NotificationsScreen() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={(retry) => <NotificationsContent onRetry={retry} />}
      fallback={(retry) => (
        <div
          className="tp-page tp-page--narrow"
          data-component="PageLayout"
          data-testid="notifications-page"
        >
          <NoticesHead />
          <StateError
            className="nt-state"
            title={t("nt.error.t")}
            body={t("nt.error.b")}
            onRetry={retry}
          />
        </div>
      )}
    />
  );
}

function NotificationsContent({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // notifications.list calls requireUser: wait for the users row.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const notices = useQuery(api.notifications.list, isAuthenticated && profile ? {} : "skip");
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const input = { isAuthLoading, isAuthenticated, profile, data: notices };
  const timedOut = useLoadingTimeout(deriveScreenState({ ...input, failed: false }) === "loading");
  const state = deriveScreenState({ ...input, failed: timedOut });
  const [live, setLive] = useState("");
  const [failed, setFailed] = useState(false);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setFailed(false);
    try {
      await work();
      setLive(done);
    } catch {
      setFailed(true);
    }
  };

  const list = notices ?? [];
  const unread = list.filter((notice) => notice.readAt === undefined).length;
  const { today, earlier } = splitByToday(list, bounds.startMs);

  return (
    <div
      className="tp-page tp-page--narrow"
      data-component="PageLayout"
      data-testid="notifications-page"
    >
      <NoticesHead
        action={
          state === "ready" ? (
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              disabled={unread === 0}
              onClick={() => void run(() => markAllRead({}), t("nt.allread"))}
            >
              <TpIcon name="check" size="sm" />
              <span>{t("nt.readall")}</span>
            </button>
          ) : undefined
        }
      />
      <StateOffline body={t("nt.offBody")} />
      <LiveMessage text={live} />
      {failed ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("you.saveError")}</span>
        </p>
      ) : null}
      {state === "loading" ? (
        <div className="nt-state">
          <StateLoading label={t("nt.loading")} />
        </div>
      ) : null}
      {state === "error" ? (
        <StateError
          className="nt-state"
          title={t("nt.error.t")}
          body={t("nt.error.b")}
          onRetry={onRetry}
        />
      ) : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "ready" ? (
        <div className="nt-body">
          {list.length === 0 ? (
            <StateEmpty
              className="nt-state"
              icon="bell"
              title={t("nt.empty.t")}
              body={t("nt.empty.b")}
              action={
                <Link className="tp-btn tp-btn--secondary" href="/settings/preferences">
                  {t("nt.setLabel")}
                </Link>
              }
            />
          ) : (
            <>
              {today.length > 0 ? (
                <NoticeSection
                  id="nt-today"
                  title={t("nt.today")}
                  notices={today}
                  today
                  onOpen={(id) => void run(() => markRead({ notificationId: id }), t("nt.read"))}
                />
              ) : null}
              {earlier.length > 0 ? (
                <NoticeSection
                  id="nt-earlier"
                  title={t("nt.earlier")}
                  notices={earlier}
                  onOpen={(id) => void run(() => markRead({ notificationId: id }), t("nt.read"))}
                />
              ) : null}
              <div className="tp-setting-row tp-surface od-row" data-component="SettingRow">
                <div className="tp-setting-row__text">
                  <span className="tp-setting-row__label">{t("nt.setLabel")}</span>
                  <span className="tp-help">{t("nt.setHelp")}</span>
                </div>
                <div className="tp-setting-row__control">
                  <Link className="tp-btn tp-btn--ghost" href="/settings/preferences">
                    <span>{t("nt.setBtn")}</span>
                    <TpIcon name="chevron" size="sm" flip />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NoticeSection({
  id,
  title,
  notices,
  today,
  onOpen,
}: {
  id: string;
  title: string;
  notices: readonly Notice[];
  today?: boolean;
  onOpen: (id: Id<"notifications">) => void;
}) {
  return (
    <section className="tp-section" aria-labelledby={id} data-component="Section">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id={id}>
          {title}
        </h2>
      </div>
      <ul className="tp-list" data-component="ListRow">
        {notices.map((notice) => (
          <NoticeRow key={notice._id} notice={notice} today={today} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function NoticeRow({
  notice,
  today,
  onOpen,
}: {
  notice: Notice;
  today?: boolean;
  onOpen: (id: Id<"notifications">) => void;
}) {
  const { t, lang } = useLocale();
  const unread = notice.readAt === undefined;
  const rowRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  // The row stops being a button once it is read; keep focus on it instead of losing it.
  useEffect(() => {
    if (!unread && opened.current) {
      opened.current = false;
      rowRef.current?.focus();
    }
  }, [unread]);
  const when = new Intl.DateTimeFormat(
    intlLocale(lang),
    today
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { weekday: "short", day: "numeric", month: "short" }
  ).format(notice.createdAt);
  const content = (
    <>
      <span className="tp-list-row__icon">
        <TpIcon name={KIND_ICON[notice.kind]} />
      </span>
      <span className="tp-list-row__body">
        <span className="tp-list-row__title nt-title" dir="auto">
          {notice.title}
        </span>
        {notice.body ? (
          <span className="nt-text" dir="auto">
            {notice.body}
          </span>
        ) : null}
        <span className="tp-list-row__meta">
          <time
            className={today ? "tp-num tp-mono" : undefined}
            dateTime={new Date(notice.createdAt).toISOString()}
          >
            {when}
          </time>
        </span>
      </span>
      {unread ? (
        <span className="tp-list-row__end">
          <span className="tp-badge" data-tone="info">
            <TpIcon name="bell" size="sm" />
            <span>{t("nt.new")}</span>
          </span>
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {unread ? (
        <button
          className="tp-list-row"
          type="button"
          data-unread="true"
          onClick={() => {
            opened.current = true;
            onOpen(notice._id);
          }}
        >
          {content}
        </button>
      ) : (
        <div className="tp-list-row" ref={rowRef} tabIndex={-1}>
          {content}
        </div>
      )}
    </li>
  );
}
