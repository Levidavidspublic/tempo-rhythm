"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import {
  insertSection,
  joinSections,
  moveSection,
  newSection,
  removeSection,
  renameSection,
  type SectionedBody,
  type SectionKind,
  sectionKind,
  splitSections,
  type TemplateSection,
} from "@/lib/template-sections";
import { useOnline } from "@/lib/useOnline";
import { draftFrom, type PeriodType, type SourceTemplate, type TemplateDraft } from "./TemplateBuilder";

const PAGE_TYPES: readonly { value: PeriodType; label: MessageKey }[] = [
  { value: "daily", label: "te.pt.daily" },
  { value: "weekly", label: "te.pt.weekly" },
  { value: "monthly", label: "te.pt.monthly" },
  { value: "none", label: "te.pt.none" },
];

const KIND_LABEL: Record<SectionKind, MessageKey> = {
  heading: "te.k.heading",
  tasks: "te.k.tasks",
  text: "te.k.text",
};

/** Undo lasts five minutes (HARD_RULES: every accepted change has a 5-minute Undo). */
const UNDO_MS = 5 * 60_000;

function isPeriodType(value: string): value is PeriodType {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "none";
}

type Toast =
  | { kind: "removed"; section: TemplateSection; index: number }
  | { kind: "saved"; previous: TemplateDraft };

function EditorForm({ template }: { template: SourceTemplate }) {
  const { t } = useLocale();
  const router = useRouter();
  const update = useMutation(api.templates.update);
  const online = useOnline();
  const readOnly = template.source === "starter";
  const initial = draftFrom(template);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [periodType, setPeriodType] = useState<PeriodType>(initial.periodType);
  const [doc, setDoc] = useState<SectionedBody>(() => splitSections(initial.body));
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [saved, setSaved] = useState(initial);
  const nextKey = useRef(0);
  const focusKey = useRef<string | null>(null);
  const summary = useRef<HTMLDivElement | null>(null);
  const addButton = useRef<HTMLButtonElement | null>(null);

  // The control asked for focus (a new row's title, the moved row's button, the next row after
  // a removal) gets it once it is drawn; a button that just became disabled hands it to the title.
  useEffect(() => {
    const target = focusKey.current;
    if (!target) return;
    focusKey.current = null;
    if (target === "__add__") {
      addButton.current?.focus();
      return;
    }
    const el = document.getElementById(target) as HTMLButtonElement | HTMLInputElement | null;
    if (el && !el.disabled) el.focus();
    else document.getElementById(`${target.replace(/-(up|down)$/, "")}-t`)?.focus();
  });

  // The Undo toast leaves after five minutes.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const newSectionTitle = t("te.newSection");
  const currentDraft = (): TemplateDraft => ({ name, description, periodType, body: joinSections(doc, newSectionTitle) });

  const loadDraft = (draft: TemplateDraft) => {
    setName(draft.name);
    setDescription(draft.description);
    setPeriodType(draft.periodType);
    nextKey.current += 1;
    setDoc(splitSections(draft.body, `u${nextKey.current}-`));
  };

  const onAdd = () => {
    nextKey.current += 1;
    const key = `n${nextKey.current}`;
    setDoc((current) => ({ ...current, sections: [...current.sections, newSection(key)] }));
    focusKey.current = `${key}-t`;
  };

  const onMove = (index: number, delta: -1 | 1) => {
    const row = doc.sections[index];
    setDoc((current) => moveSection(current, index, delta));
    if (row) focusKey.current = `${row.key}-${delta < 0 ? "up" : "down"}`;
  };

  const onRemove = (index: number) => {
    const row = doc.sections[index];
    if (!row) return;
    const next = doc.sections[index + 1] ?? doc.sections[index - 1];
    setDoc((current) => removeSection(current, index));
    setToast({ kind: "removed", section: row, index });
    focusKey.current = next ? `${next.key}-t` : "__add__";
  };

  const onUndo = async () => {
    if (!toast) return;
    if (toast.kind === "removed") {
      setDoc((current) => insertSection(current, toast.index, toast.section));
      focusKey.current = `${toast.section.key}-t`;
      setToast(null);
      return;
    }
    const previous = toast.previous;
    setPending(true);
    setError("");
    try {
      await update({
        templateId: template.templateId as Id<"templates">,
        name: previous.name.trim(),
        description: previous.description.trim(),
        periodType: previous.periodType,
        body: previous.body,
      });
      loadDraft(previous);
      // The version Undo put back is now the saved one, so a later Undo returns to it.
      setSaved(previous);
      setToast(null);
    } catch {
      setError(t("te.saveError"));
    } finally {
      setPending(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || pending) return;
    if (!name.trim()) {
      setInvalid(true);
      // Focus moves to the summary, which links to the field; nothing typed is lost.
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setInvalid(false);
    setPending(true);
    setError("");
    const draft = currentDraft();
    try {
      await update({
        templateId: template.templateId as Id<"templates">,
        name: draft.name.trim(),
        description: draft.description.trim(),
        periodType: draft.periodType,
        body: draft.body,
      });
      setToast({ kind: "saved", previous: saved });
      setSaved(draft);
    } catch {
      setError(t("te.saveError"));
    } finally {
      setPending(false);
    }
  };

  const nameInvalid = invalid && !name.trim();
  const count = doc.sections.length;

  return (
    <div className="tp-page tp-page--narrow" data-component="PageLayout">
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
          <h1 className="tp-pagehead__title">{t("te.h1")}</h1>
          <p className="tp-pagehead__sub">{readOnly ? t("te.readOnly") : t("te.sub")}</p>
        </div>
        <div className="tp-pagehead__actions">
          {readOnly ? (
            <button
              className="tp-btn tp-btn--primary"
              type="button"
              onClick={() => router.push(`/templates/builder?from=${encodeURIComponent(template.templateId)}`)}
            >
              <TpIcon name="plus" size="sm" />
              <span>{t("te.copy")}</span>
            </button>
          ) : (
            <Link className="tp-btn tp-btn--secondary" href={`/templates/builder?id=${encodeURIComponent(template.templateId)}`}>
              <TpIcon name="template" size="sm" />
              <span>{t("te.builder")}</span>
            </Link>
          )}
        </div>
      </header>

      {nameInvalid ? (
        <div className="tp-error-summary" role="alert" tabIndex={-1} id="ed-errors" ref={summary} data-component="FormErrorSummary">
          <p className="tp-error-summary__title">
            <TpIcon name="alert" size="sm" />
            {t("te.err.title")}
          </p>
          <ul>
            <li>
              <a href="#ed-name">{t("te.err.name")}</a>
            </li>
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{error}</span>
        </p>
      ) : null}

      <form className="tp-form ed-form" id="ed-form" data-component="Form" noValidate onSubmit={(event) => void onSubmit(event)}>
        <div className="tp-field" data-component="Field">
          <label className="tp-label" htmlFor="ed-name">
            {t("te.name")}
          </label>
          <input
            className="tp-input"
            id="ed-name"
            type="text"
            dir="auto"
            value={name}
            disabled={readOnly}
            aria-invalid={nameInvalid || undefined}
            aria-describedby={nameInvalid ? "ed-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {nameInvalid ? (
            <p className="tp-error-text" id="ed-name-error">
              {t("te.err.name")}
            </p>
          ) : null}
        </div>

        <div className="tp-field" data-component="Field">
          <label className="tp-label" htmlFor="ed-desc">
            <span>{t("te.desc")}</span> <span className="tp-label__opt">{t("tx.opt")}</span>
          </label>
          <textarea
            className="tp-textarea"
            id="ed-desc"
            rows={2}
            dir="auto"
            value={description}
            disabled={readOnly}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="tp-field" data-component="Field">
          <label className="tp-label" htmlFor="ed-type">
            {t("te.type")}
          </label>
          <div className="tp-select" data-component="Select">
            <select
              className="tp-select__input"
              id="ed-type"
              value={periodType}
              disabled={readOnly}
              onChange={(event) => {
                if (isPeriodType(event.target.value)) setPeriodType(event.target.value);
              }}
            >
              {PAGE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
            <span className="tp-select__icon">
              <TpIcon name="down" size="sm" />
            </span>
          </div>
        </div>

        <section className="tp-section" data-component="Section" aria-labelledby="sec-h">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="sec-h">
              {t("te.sec.h")}
            </h2>
            <span className="tp-section__count tp-num">{count}</span>
          </div>
          {count === 0 ? (
            <div className="tp-state tp-state--empty" data-component="StateEmpty">
              <span className="tp-state__icon">
                <TpIcon name="list" size="lg" />
              </span>
              <h3 className="tp-state__title">{t("te.empty.title")}</h3>
              <p className="tp-state__body">{t("te.empty.body")}</p>
            </div>
          ) : (
            <>
              <p className="tp-help">{t("te.sec.help")}</p>
              <ol className="ed-sections" id="ed-sections" data-component="TemplateSectionRow">
                {doc.sections.map((section, index) => {
                  const title = section.title.trim() || newSectionTitle;
                  return (
                    <li className="tp-card ed-section" key={section.key}>
                      <div className="tp-field">
                        <label className="tp-label" htmlFor={`${section.key}-t`}>
                          {t("te.s.title")}
                        </label>
                        <input
                          className="tp-input"
                          id={`${section.key}-t`}
                          type="text"
                          dir="auto"
                          value={section.title}
                          placeholder={newSectionTitle}
                          disabled={readOnly}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDoc((current) => renameSection(current, index, value));
                          }}
                        />
                      </div>
                      <div className="tp-field">
                        <span className="tp-label">{t("te.s.holds")}</span>
                        <span className="tp-chip ed-section__kind">{t(KIND_LABEL[sectionKind(section)])}</span>
                      </div>
                      <div className="ed-section__tools">
                        <button
                          className="tp-btn tp-btn--ghost tp-btn--icon"
                          type="button"
                          id={`${section.key}-up`}
                          aria-label={`${t("te.s.up")}: ${title}`}
                          disabled={readOnly || index === 0}
                          onClick={() => onMove(index, -1)}
                        >
                          <TpIcon name="chevron" size="sm" className="ed-up" />
                        </button>
                        <button
                          className="tp-btn tp-btn--ghost tp-btn--icon"
                          type="button"
                          id={`${section.key}-down`}
                          aria-label={`${t("te.s.down")}: ${title}`}
                          disabled={readOnly || index === count - 1}
                          onClick={() => onMove(index, 1)}
                        >
                          <TpIcon name="down" size="sm" />
                        </button>
                        <button
                          className="tp-btn tp-btn--danger-ghost tp-btn--icon"
                          type="button"
                          aria-label={`${t("te.s.remove")}: ${title}`}
                          disabled={readOnly}
                          onClick={() => onRemove(index)}
                        >
                          <TpIcon name="x" size="sm" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          {readOnly ? null : (
            <div className="ed-row">
              <button className="tp-btn tp-btn--secondary" type="button" ref={addButton} onClick={onAdd}>
                <TpIcon name="plus" size="sm" />
                <span>{t("te.s.add")}</span>
              </button>
            </div>
          )}
        </section>

        {readOnly ? null : (
          <div className="tp-form__actions">
            <button className="tp-btn tp-btn--primary" type="submit" disabled={pending}>
              <TpIcon name="check" size="sm" />
              <span>{pending ? t("tx.saving") : t("te.save")}</span>
            </button>
            <Link className="tp-btn tp-btn--ghost" href="/templates">
              {t("te.cancel")}
            </Link>
          </div>
        )}
      </form>

      {toast ? (
        <div className="tp-toast-region">
          <output className="tp-toast tp-glass">
            <span className="tp-toast__icon">
              <TpIcon name="check" size="sm" />
            </span>
            <span className="tp-toast__text">
              <span className="tp-toast__title">{toast.kind === "saved" ? t("te.saved") : t("te.removed")}</span>
            </span>
            <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" disabled={pending} onClick={() => void onUndo()}>
              <TpIcon name="undo" size="sm" />
              <span>{t("tx.undo")}</span>
            </button>
            <button
              className="tp-btn tp-btn--ghost tp-btn--icon tp-btn--sm"
              type="button"
              aria-label={t("tx.dismiss")}
              onClick={() => setToast(null)}
            >
              <TpIcon name="x" size="sm" />
            </button>
          </output>
        </div>
      ) : null}
    </div>
  );
}

function EditorLoading() {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--narrow" data-component="PageLayout">
      <div className="tp-state--loading" data-component="StateLoading">
        <output className="tp-sr-only">{t("te.loading")}</output>
        <div className="tp-skel-list">
          <div className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
          <div className="tp-skeleton tp-skeleton--w100" />
          <div className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
          <div className="tp-skeleton tp-skeleton--block" />
          <div className="tp-skeleton tp-skeleton--w80" />
        </div>
      </div>
    </div>
  );
}

function EditorMissing() {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--narrow" data-component="PageLayout">
      <div className="tp-state tp-state--error" role="alert" data-component="StateError">
        <span className="tp-state__icon">
          <TpIcon name="refresh" size="lg" />
        </span>
        <h1 className="tp-state__title">{t("te.missing")}</h1>
        <p className="tp-state__body">{t("tb.missingHint")}</p>
        <div className="tp-state__actions">
          <Link className="tp-btn tp-btn--secondary" href="/templates">
            {t("tplRun.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Template editor (docs/design/v3/screens/web/template-editor.html): the same template as a
 * plain form. Name, what it is for, page type, and its sections in order (move, rename, remove,
 * add). The words under each heading are kept byte for byte; the builder edits them.
 */
export function TemplateEditorScreen({ templateId }: { templateId: string }) {
  const template = useQuery(api.templates.get, { templateId }) as SourceTemplate | null | undefined;
  if (template === undefined) return <EditorLoading />;
  if (template === null) return <EditorMissing />;
  return <EditorForm key={template.templateId} template={template} />;
}
