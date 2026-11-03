/**
 * @screen: empty-states
 * @source: docs/design/v3/screens/web/empty-states.html
 * @summary: Internal reference: every empty, loading, error and offline pattern, grouped by kind.
 * @queries: (none — a static gallery)
 * @auth: required
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { useOnline } from "@/lib/useOnline";

type Where = { label: MessageKey; icon: TpIconName; href: string };

/** One gallery card: the screen it belongs to, a link there, the state itself, and a note. */
function StateCard({ where, note, children }: { where: Where; note?: MessageKey; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <article className="tp-card es-card">
      <div className="es-card__where">
        <span className="tp-badge" data-tone="info">
          <TpIcon name={where.icon} size="sm" />
          <span>{t(where.label)}</span>
        </span>
        <Link className="tp-btn tp-btn--link" href={where.href}>
          {t("es.see")}
        </Link>
      </div>
      {children}
      {note ? <p className="tp-muted tp-small">{t(note)}</p> : null}
    </article>
  );
}

/** The example's next step. Cards are a static reference, so it looks like the button but does nothing. */
function ExampleAction({ icon, label }: { icon: TpIconName; label: MessageKey }) {
  const { t } = useLocale();
  return (
    <div className="tp-state__actions">
      <span className="tp-btn tp-btn--secondary">
        <TpIcon name={icon} size="sm" />
        <span>{t(label)}</span>
      </span>
    </div>
  );
}

function Empty({ icon, title, body, action }: { icon: TpIconName; title: ReactNode; body: MessageKey; action?: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="tp-state tp-state--empty" data-component="StateEmpty">
      <span className="tp-state__icon">
        <TpIcon name={icon} size="lg" />
      </span>
      <h3 className="tp-state__title">{title}</h3>
      <p className="tp-state__body">{t(body)}</p>
      {action}
    </div>
  );
}

function ErrorState({ title, body }: { title: MessageKey; body: MessageKey }) {
  const { t } = useLocale();
  return (
    <div className="tp-state tp-state--error" data-component="StateError">
      <span className="tp-state__icon">
        <TpIcon name="refresh" size="lg" />
      </span>
      <h3 className="tp-state__title">{t(title)}</h3>
      <p className="tp-state__body">{t(body)}</p>
      <ExampleAction icon="refresh" label="tx.retry" />
    </div>
  );
}

function Offline({ text }: { text: MessageKey }) {
  const { t } = useLocale();
  return (
    <div className="tp-notice" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">{t(text)}</span>
    </div>
  );
}

function SkelRow({ a, b }: { a: string; b: string }) {
  return (
    <div className="tp-skel-row">
      <span className="tp-skeleton tp-skel-row__box" />
      <span className="tp-skel-row__lines">
        <span className={`tp-skeleton ${a}`} />
        <span className={`tp-skeleton tp-skeleton--sm ${b}`} />
      </span>
    </div>
  );
}

function Section({ id, title, count, children }: { id: string; title: MessageKey; count: number; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <section className="tp-section" data-component="Section" aria-labelledby={id}>
      <div className="tp-section__head">
        <h2 className="tp-section__title" id={id} tabIndex={-1}>
          {t(title)}
        </h2>
        <span className="tp-section__count tp-num">{count}</span>
      </div>
      <div className="tp-cards" data-component="CardGrid">
        {children}
      </div>
    </section>
  );
}

/**
 * Empty states (docs/design/v3/screens/web/empty-states.html): an internal reference, not in
 * the product navigation. Builders copy the component and the words; nothing here is new.
 */
export default function Page() {
  const { t } = useLocale();
  const online = useOnline();
  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      {online ? null : (
        <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
          <span className="tp-notice__icon">
            <TpIcon name="wifi-off" size="sm" />
          </span>
          <span className="tp-notice__text">{t("tx.offline")}</span>
        </output>
      )}

      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("es.h1")}</h1>
          <p className="tp-pagehead__sub">{t("es.sub")}</p>
        </div>
      </header>

      <section className="tp-card" data-component="Card" aria-labelledby="rules-h">
        <h2 className="tp-card__title" id="rules-h">
          {t("es.rules.h")}
        </h2>
        <ul className="es-rules">
          <li>{t("es.rules.1")}</li>
          <li>{t("es.rules.2")}</li>
          <li>{t("es.rules.3")}</li>
          <li>{t("es.rules.4")}</li>
          <li>{t("es.rules.5")}</li>
        </ul>
      </section>

      <nav className="es-toc" aria-label={t("es.toc")}>
        <a className="tp-btn tp-btn--secondary tp-btn--sm" href="#k-empty">
          {t("es.k.empty")}
        </a>
        <a className="tp-btn tp-btn--secondary tp-btn--sm" href="#k-loading">
          {t("es.k.loading")}
        </a>
        <a className="tp-btn tp-btn--secondary tp-btn--sm" href="#k-error">
          {t("es.k.error")}
        </a>
        <a className="tp-btn tp-btn--secondary tp-btn--sm" href="#k-offline">
          {t("es.k.offline")}
        </a>
      </nav>

      <Section id="k-empty" title="es.k.empty" count={8}>
        <StateCard where={{ label: "es.w.today", icon: "today", href: "/today" }}>
          <Empty
            icon="sun"
            title={t("es.e.today.t")}
            body="es.e.today.b"
            action={<ExampleAction icon="plus" label="es.e.today.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.inbox", icon: "inbox", href: "/brain-dump" }}>
          <Empty
            icon="inbox"
            title={t("es.e.inbox.t")}
            body="es.e.inbox.b"
            action={<ExampleAction icon="mic" label="es.e.inbox.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.tasks", icon: "checklist", href: "/tasks" }}>
          <Empty
            icon="checklist"
            title={t("es.e.tasks.t")}
            body="es.e.tasks.b"
            action={<ExampleAction icon="plus" label="es.e.today.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.habits", icon: "habit", href: "/habits" }}>
          <Empty
            icon="habit"
            title={t("es.e.habits.t")}
            body="es.e.habits.b"
            action={<ExampleAction icon="plus" label="es.e.habits.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.history", icon: "history", href: "/history" }}>
          <Empty
            icon="coach"
            title={t("es.e.coach.t")}
            body="es.e.coach.b"
            action={<ExampleAction icon="coach" label="es.e.coach.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.search", icon: "search", href: "/search" }}>
          <Empty
            icon="search"
            title={
              <>
                <span>{t("es.e.search.t")}</span> <q dir="auto">{t("es.e.search.q")}</q>
              </>
            }
            body="es.e.search.b"
            action={<ExampleAction icon="sparkle" label="es.e.search.a" />}
          />
        </StateCard>
        <StateCard where={{ label: "es.w.templates", icon: "template", href: "/templates" }}>
          <Empty
            icon="template"
            title={t("es.e.tpl.t")}
            body="es.e.tpl.b"
            action={
              <div className="tp-state__actions">
                <Link className="tp-btn tp-btn--secondary" href="/templates/sketch">
                  <TpIcon name="list" size="sm" />
                  <span>{t("es.e.tpl.a")}</span>
                </Link>
              </div>
            }
          />
        </StateCard>
        <StateCard where={{ label: "es.w.page", icon: "page", href: "/notes" }}>
          <Empty icon="text" title={t("es.e.page.t")} body="es.e.page.b" />
        </StateCard>
      </Section>

      <Section id="k-loading" title="es.k.loading" count={3}>
        <StateCard where={{ label: "es.w.lists", icon: "checklist", href: "/tasks" }} note="es.l.tasks.note">
          <div className="tp-state--loading" data-component="StateLoading">
            <span className="tp-sr-only">{t("es.l.tasks")}</span>
            <div className="tp-skel-list">
              <SkelRow a="tp-skeleton--w80" b="tp-skeleton--w40" />
              <SkelRow a="tp-skeleton--w60" b="tp-skeleton--w40" />
              <SkelRow a="tp-skeleton--w80" b="tp-skeleton--w60" />
            </div>
          </div>
        </StateCard>
        <StateCard where={{ label: "es.w.pages", icon: "page", href: "/notes" }} note="es.l.page.note">
          <div className="tp-state--loading" data-component="StateLoading">
            <span className="tp-sr-only">{t("es.l.page")}</span>
            <div className="tp-skel-list">
              <div className="tp-skeleton tp-skeleton--w60" />
              <div className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
              <div className="tp-skeleton tp-skeleton--block" />
              <div className="tp-skeleton tp-skeleton--w80" />
            </div>
          </div>
        </StateCard>
        <StateCard where={{ label: "es.w.coach", icon: "coach", href: "/coach" }} note="es.l.coach.note">
          <div className="tp-typing" data-component="TypingIndicator">
            <span className="tp-typing__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{t("es.l.coach")}</span>
          </div>
        </StateCard>
      </Section>

      <Section id="k-error" title="es.k.error" count={3}>
        <StateCard where={{ label: "es.w.tasks", icon: "checklist", href: "/tasks" }}>
          <ErrorState title="es.x.tasks.t" body="tx.safe" />
        </StateCard>
        <StateCard where={{ label: "es.w.coach", icon: "coach", href: "/coach" }}>
          <ErrorState title="es.x.coach.t" body="es.x.coach.b" />
        </StateCard>
        <StateCard where={{ label: "es.w.block", icon: "page", href: "/notes" }} note="es.x.block.note">
          <div className="tp-block-broken" data-component="BrokenBlock">
            <TpIcon name="info" size="sm" />
            <span className="tp-block-broken__text">{t("es.x.block.t")}</span>
            <span className="tp-btn tp-btn--secondary tp-btn--sm tp-block-broken__action">
              <TpIcon name="undo" size="sm" />
              <span>{t("es.x.block.a")}</span>
            </span>
          </div>
        </StateCard>
      </Section>

      <Section id="k-offline" title="es.k.offline" count={3}>
        <StateCard where={{ label: "es.w.most", icon: "today", href: "/today" }} note="es.o.most.note">
          <Offline text="tx.offline" />
        </StateCard>
        <StateCard where={{ label: "es.w.coach", icon: "coach", href: "/coach" }} note="es.o.coach.note">
          <Offline text="es.o.coach" />
        </StateCard>
        <StateCard where={{ label: "es.w.searchonly", icon: "search", href: "/search" }} note="es.o.search.note">
          <Offline text="es.o.search" />
        </StateCard>
      </Section>
    </div>
  );
}
