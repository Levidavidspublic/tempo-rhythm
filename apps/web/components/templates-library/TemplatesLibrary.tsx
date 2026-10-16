"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type KeyboardEvent, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useShellSlots } from "@/components/tempo/ShellSlots";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { filterTemplates, type TemplateScope } from "@/lib/template-pages";
import { TemplateCard, type TemplateCardModel } from "./TemplateCard";

type ListedTemplate = TemplateCardModel & {
  body: string;
  updatedAt?: number;
};

const SCOPES: readonly TemplateScope[] = ["all", "starter", "mine"];
const SCOPE_LABEL = { all: "tpl.all", starter: "tpl.builtin", mine: "tpl.yours" } as const;

/**
 * Templates (docs/design/v3/screens/web/templates.html): built-in shapes first, then the
 * person's own. "Use" makes an ordinary Markdown page from the template (TemplateRun).
 */
export function TemplatesLibrary() {
  const { t } = useLocale();
  const shell = useShellSlots();
  const templates = useQuery(api.templates.list, { scope: "all" });
  const remove = useMutation(api.templates.remove);
  const [scope, setScope] = useState<TemplateScope>("all");
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const selectScope = (next: TemplateScope) => {
    setScope(next);
    setPendingDeleteId(null);
    setDeleteError("");
  };

  // Radio group keys: one tab stop (the checked option); arrows move and choose, wrapping.
  const onScopeKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = SCOPES[(index + step + SCOPES.length) % SCOPES.length] as TemplateScope;
    selectScope(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-scope="${next}"]`)?.focus());
  };

  const confirmDelete = async (templateId: string) => {
    setDeletingId(templateId);
    setDeleteError("");
    try {
      await remove({ templateId: templateId as Id<"templates"> });
      setPendingDeleteId((current) => (current === templateId ? null : current));
    } catch {
      setDeleteError(t("tpl.deleteError"));
    } finally {
      setDeletingId((current) => (current === templateId ? null : current));
    }
  };

  const shown = templates === undefined ? [] : filterTemplates(templates as ListedTemplate[], scope, query);
  const builtIn = shown.filter((template) => template.source === "starter");
  const mine = shown.filter((template) => template.source === "user");
  const searching = query.trim().length > 0;
  // While searching, a section with no matches steps aside; one notice says when nothing matches.
  const noMatch = searching && shown.length === 0;

  const cardProps = {
    pendingDeleteId,
    deletingId,
    onAskDelete: (templateId: string) => {
      setDeleteError("");
      setPendingDeleteId(templateId);
    },
    onConfirmDelete: (templateId: string) => {
      void confirmDelete(templateId);
    },
    onCancelDelete: () => setPendingDeleteId(null),
  };

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("tpl.title")}</h1>
          <p className="tp-pagehead__sub">{t("tpl.sub")}</p>
        </div>
        <div className="tp-pagehead__actions">
          <Link className="tp-btn tp-btn--secondary" href="/templates/builder">
            <TpIcon name="plus" size="sm" />
            <span>{t("tpl.new")}</span>
          </Link>
          {shell?.coachAvailable ? (
            <button type="button" className="tp-btn tp-btn--primary" onClick={shell.openCoach}>
              <TpIcon name="sparkle" size="sm" />
              <span>{t("tpl.ask")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="tp-toolbar" data-component="Toolbar">
        <div className="tp-search tp-toolbar__grow" data-component="SearchInput">
          <label className="tp-sr-only" htmlFor="tpl-q">
            {t("tpl.q")}
          </label>
          <div className="tp-search__box">
            <span className="tp-search__icon">
              <TpIcon name="search" size="sm" />
            </span>
            <input
              className="tp-input"
              id="tpl-q"
              type="search"
              dir="auto"
              autoComplete="off"
              placeholder={t("tpl.q")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="tp-segmented" role="radiogroup" aria-label={t("tpl.show")} data-component="Segmented">
          {SCOPES.map((option, index) => (
            // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
            <button
              key={option}
              type="button"
              role="radio"
              data-scope={option}
              className="tp-seg__opt"
              aria-checked={scope === option}
              tabIndex={scope === option ? 0 : -1}
              onClick={() => selectScope(option)}
              onKeyDown={(event) => onScopeKey(event, index)}
            >
              {t(SCOPE_LABEL[option])}
            </button>
          ))}
        </div>
      </div>

      {deleteError ? (
        <p role="alert" className="tp-notice" data-tone="caution">
          <span className="tp-notice__text">{deleteError}</span>
        </p>
      ) : null}

      {templates === undefined ? (
        <div aria-busy="true" className="tp-section">
          <output className="tp-sr-only">{t("tpl.loading")}</output>
          <div className="tpl-skel">
            <div className="tp-skeleton tpl-skel__card" />
            <div className="tp-skeleton tpl-skel__card" />
            <div className="tp-skeleton tpl-skel__card" />
          </div>
        </div>
      ) : (
        <>
          {noMatch ? (
            <div className="tp-empty" data-component="EmptyState">
              <p>{t("tpl.noMatch")}</p>
              <p className="tp-small">{t("tpl.noMatchHint")}</p>
            </div>
          ) : null}
          {scope !== "mine" && !(searching && builtIn.length === 0) ? (
            <TemplateSection
              id="tpl-builtin"
              title={t("tpl.builtin")}
              templates={builtIn}
              empty={searching ? t("tpl.noMatch") : t("tpl.empty.builtin")}
              emptyHint={searching ? t("tpl.noMatchHint") : ""}
              {...cardProps}
            />
          ) : null}
          {scope !== "starter" && !(searching && mine.length === 0) ? (
            <TemplateSection
              id="tpl-mine"
              title={t("tpl.yours")}
              templates={mine}
              empty={searching ? t("tpl.noMatch") : t("tpl.empty.mine")}
              emptyHint={searching ? t("tpl.noMatchHint") : t("tpl.empty.mineHint")}
              {...cardProps}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

type TemplateSectionProps = {
  id: string;
  title: string;
  templates: ListedTemplate[];
  empty: string;
  emptyHint: string;
  pendingDeleteId: string | null;
  deletingId: string | null;
  onAskDelete: (templateId: string) => void;
  onConfirmDelete: (templateId: string) => void;
  onCancelDelete: () => void;
};

function TemplateSection({
  id,
  title,
  templates,
  empty,
  emptyHint,
  pendingDeleteId,
  deletingId,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: TemplateSectionProps) {
  return (
    <section className="tp-section" data-component="Section" aria-labelledby={`${id}-h`}>
      <div className="tp-section__head">
        <h2 className="tp-section__title" id={`${id}-h`}>
          {title}
        </h2>
        <span className="tp-section__count tp-num">{templates.length}</span>
      </div>
      {templates.length === 0 ? (
        <div className="tp-empty" data-component="EmptyState">
          <p>{empty}</p>
          {emptyHint ? <p className="tp-small">{emptyHint}</p> : null}
        </div>
      ) : (
        <ul className="tp-cards tpl-list" data-component="CardGrid">
          {templates.map((template) => (
            <li key={template.templateId}>
              <TemplateCard
                template={template}
                confirming={pendingDeleteId === template.templateId}
                deleting={deletingId === template.templateId}
                onAskDelete={onAskDelete}
                onConfirmDelete={onConfirmDelete}
                onCancelDelete={onCancelDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
