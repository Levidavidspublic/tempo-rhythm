"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReadView } from "@/components/editor/ReadView";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { localIsoDate } from "@/lib/period-pages";
import { templatePageDraft } from "@/lib/template-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { ProposalBanner } from "./ProposalBanner";

/**
 * Template run (v3, OVERNIGHT-RUN.md decision 6): a preview of the page a template makes, with
 * today's {{tokens}} filled, and one choice. "Make the page" creates an ordinary Markdown page
 * and opens it at /notes/[id]; nothing is made until then.
 */
export function TemplateRun({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { t, lang } = useLocale();
  const template = useQuery(api.templates.get, { templateId });
  const createNote = useMutation(api.notes.create);
  const bounds = useLocalDayBounds();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const declined = useRef(false);
  useEffect(() => setMounted(true), []);

  if (template === undefined) {
    return (
      <div className="tp-page tp-run" data-component="PageLayout">
        <output className="tp-muted">{t("tplRun.loading")}</output>
      </div>
    );
  }

  if (template === null) {
    return (
      <div className="tp-page tp-run" data-component="PageLayout">
        <header className="tp-pagehead">
          <div className="tp-pagehead__text">
            <h1 className="tp-pagehead__title">{t("tplRun.missing")}</h1>
            <p className="tp-pagehead__sub">{t("tplRun.missingHint")}</p>
          </div>
        </header>
        <Link className="tp-btn tp-btn--secondary" href="/templates">
          {t("tplRun.back")}
        </Link>
      </div>
    );
  }

  // The local date is read after mount, so the server render and the first client render agree.
  const today = mounted ? localIsoDate(new Date(bounds.startMs)) : null;
  const draft = today ? templatePageDraft(template, { title, isoDate: today, lang }) : null;

  const onReject = () => {
    declined.current = true;
    router.push("/templates");
  };

  const onAccept = async () => {
    if (pending || declined.current || !draft) return;
    setPending(true);
    setError("");
    try {
      const id = await createNote({ title: draft.title, body: draft.body, periodType: template.periodType });
      if (declined.current) return;
      router.push(`/notes/${id}`);
    } catch {
      if (declined.current) return;
      setError(t("tplRun.error"));
      setPending(false);
    }
  };

  return (
    <div className="tp-page tp-run" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <span className="tp-eyebrow">{t("tplRun.eyebrow")}</span>
          <h1 className="tp-pagehead__title" dir="auto">
            {template.name}
          </h1>
          {template.description ? (
            <p className="tp-pagehead__sub" dir="auto">
              {template.description}
            </p>
          ) : null}
        </div>
      </header>
      <ProposalBanner periodType={template.periodType} title={title} />
      <div className="tp-field">
        <label className="tp-label" htmlFor="template-run-title">
          {t("tplRun.title")}
        </label>
        <input
          className="tp-input"
          id="template-run-title"
          dir="auto"
          value={title}
          placeholder={t("tplRun.optional")}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <section className="tp-surface" aria-label={t("tplRun.preview")}>
        <p className="tp-small tp-muted">{t("tplRun.previewHint")}</p>
        <ReadView
          body={draft?.body ?? template.body}
          labels={{ minutes: t("editor.minutes"), brokenBlock: t("editor.broken"), template: t("editor.template") }}
        />
      </section>
      {error ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{error}</span>
        </p>
      ) : null}
      <div className="tp-pagehead__actions">
        <button type="button" className="tp-btn tp-btn--primary" onClick={onAccept} disabled={pending || !draft}>
          <TpIcon name="play" size="sm" />
          <span>{pending ? t("tplRun.creating") : t("tplRun.accept")}</span>
        </button>
        <button type="button" className="tp-btn tp-btn--ghost" onClick={onReject} disabled={pending}>
          {t("tplRun.reject")}
        </button>
      </div>
    </div>
  );
}
